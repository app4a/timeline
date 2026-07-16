import test from 'node:test';
import assert from 'node:assert/strict';
import { groupEvents } from '../js/density.js';

const ev = (id, major = false) => ({ id, major, date: '2000', title: id });

test('small levels never collapse', () => {
  const children = [ev('a'), ev('b'), ev('c'), ev('d', true), ev('e')];
  const groups = groupEvents(children);
  assert.deepEqual(groups, [{ type: 'events', items: children }]);
});

test('dense levels collapse runs of ≥3 consecutive minors', () => {
  // 12 events: M m m m M m m M m m m m  → two collapsible runs
  const children = [
    ev('a', true), ev('b'), ev('c'), ev('d'),
    ev('e', true), ev('f'), ev('g'),
    ev('h', true), ev('i'), ev('j'), ev('k'), ev('l')
  ];
  const groups = groupEvents(children);
  assert.deepEqual(groups.map(g => g.type),
    ['events', 'collapsed', 'events', 'collapsed']);
  assert.deepEqual(groups[1].items.map(x => x.id), ['b', 'c', 'd']);          // run of 3 collapses
  assert.deepEqual(groups[2].items.map(x => x.id), ['e', 'f', 'g', 'h']);     // short run stays, merges with next major
  assert.deepEqual(groups[3].items.map(x => x.id), ['i', 'j', 'k', 'l']);
});

test('expanded ids stay visible', () => {
  const children = [
    ev('a', true), ev('b'), ev('c'), ev('d'),
    ev('e', true), ev('f'), ev('g'),
    ev('h', true), ev('i'), ev('j'), ev('k'), ev('l')
  ];
  const groups = groupEvents(children, new Set(['b']));   // first run expanded
  assert.deepEqual(groups.map(g => g.type), ['events', 'collapsed']);
  assert.ok(groups[0].items.some(x => x.id === 'b'));
  assert.equal(groups[0].items.length, 8);                // a..h all visible, merged
});

test('all-major dense levels do not collapse', () => {
  const children = Array.from({ length: 12 }, (_, i) => ev('m' + i, true));
  assert.deepEqual(groupEvents(children), [{ type: 'events', items: children }]);
});
