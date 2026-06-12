import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTimeline, validateIndex, countEvents } from '../tools/validate.js';

const good = { id:'t', title:'T', tagline:'x', updated:'2026-06-12', events:[
  { id:'a', date:'1990', title:'A' },
  { id:'b', date:'1991-05', title:'B', children:[ { id:'c', date:'1991-05-02', title:'C' } ] }
]};

test('valid timeline has no errors', () => {
  assert.deepEqual(validateTimeline(good, 't'), []);
});

test('id must match filename', () => {
  assert.ok(validateTimeline(good, 'other').some(e => e.includes('must match filename')));
});

test('rejects bad date and duplicate sibling ids', () => {
  const bad = { ...good, events:[
    { id:'a', date:'05-1990', title:'A' },
    { id:'a', date:'1990', title:'B' }
  ]};
  const errs = validateTimeline(bad, 't');
  assert.ok(errs.some(e => e.includes('date')));
  assert.ok(errs.some(e => e.includes('duplicate')));
});

test('rejects bad sources and empty children', () => {
  const bad = { ...good, events:[
    { id:'a', date:'1990', title:'A', sources:[{title:'x', url:'ftp://nope'}], children:[] }
  ]};
  const errs = validateTimeline(bad, 't');
  assert.ok(errs.some(e => e.includes('url')));
  assert.ok(errs.some(e => e.includes('children')));
});

test('wiki links must resolve in-timeline', () => {
  const bad = { ...good, events:[ { id:'a', date:'1990', title:'A', content:'see [[Nope]]' } ]};
  assert.ok(validateTimeline(bad, 't').some(e => e.includes('wiki')));
  const ok = { ...good, events:[ { id:'a', date:'1990', title:'A', content:'see [[B|b]]' },
                                 { id:'b', date:'1991', title:'B' } ]};
  assert.deepEqual(validateTimeline(ok, 't'), []);
});

test('index eventCount is enforced', () => {
  const idx = { timelines:[{ id:'t', title:'T', tagline:'x', eventCount: 99, updated:'2026-06-12' }] };
  const errs = validateIndex(idx, { t: good });
  assert.ok(errs.some(e => e.includes('eventCount')));
});

test('siblings must be chronological at every level', () => {
  const bad = { ...good, events:[
    { id:'a', date:'1995', title:'A' },
    { id:'b', date:'1991', title:'B' }
  ]};
  assert.ok(validateTimeline(bad, 't').some(e => e.includes('chronological')));
  const badNested = { ...good, events:[
    { id:'a', date:'1990', title:'A', children:[
      { id:'x', date:'1992', title:'X' }, { id:'y', date:'1991', title:'Y' } ] }
  ]};
  assert.ok(validateTimeline(badNested, 't').some(e => e.includes('chronological')));
});

test('rejects wrong field types', () => {
  const bad = { ...good, events:[ { id:'a', date:'1990', title:'A', major:'yes', display:42 } ]};
  const errs = validateTimeline(bad, 't');
  assert.ok(errs.some(e => e.includes('major')));
  assert.ok(errs.some(e => e.includes('display')));
});

test('countEvents counts all depths', () => {
  assert.equal(countEvents(good), 3);
  assert.equal(countEvents({ events:[] }), 0);
});
