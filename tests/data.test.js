import test from 'node:test';
import assert from 'node:assert/strict';
import { indexTimeline, resolvePath, displayDate, getRead, markRead, getLast, getProgress } from '../js/data.js';

const tl = { id:'t', title:'T', tagline:'x', updated:'2026-06-12', events:[
  { id:'a', date:'1990', title:'Alpha' },
  { id:'b', date:'1991-05', title:'Beta', children:[ { id:'c', date:'1991-05-02', title:'Gamma' } ] }
]};

test('indexTimeline builds root, parents, paths, lookups', () => {
  const idx = indexTimeline(tl);
  assert.equal(idx.root.isRoot, true);
  assert.equal(idx.root.children.length, 2);
  const c = idx.byPath.get('b/c');
  assert.equal(c.title, 'Gamma');
  assert.equal(c.parent.id, 'b');
  assert.deepEqual(c.pathIds, ['b','c']);
  assert.equal(idx.byTitle.get('beta').id, 'b');
});

test('resolvePath stops at deepest valid node', () => {
  const idx = indexTimeline(tl);
  assert.deepEqual(resolvePath(idx, ['b','c']).map(n => n.id), ['t','b','c']);
  assert.deepEqual(resolvePath(idx, ['b','nope']).map(n => n.id), ['t','b']);
  assert.deepEqual(resolvePath(idx, ['zzz']).map(n => n.id), ['t']);
});

test('displayDate derives readable dates', () => {
  assert.equal(displayDate({ date:'1990' }), '1990');
  assert.equal(displayDate({ date:'2022-11' }), 'Nov 2022');
  assert.equal(displayDate({ date:'2023-03-14' }), 'Mar 14, 2023');
  assert.equal(displayDate({ date:'2022-11-30', display:'Launch day' }), 'Launch day');
});

test('read state round-trips through injected storage', () => {
  const store = (() => { const m = new Map(); return {
    getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,v) }; })();
  assert.equal(getRead('t', store).size, 0);
  markRead('t', 'b/c', store);
  assert.ok(getRead('t', store).has('b/c'));
});

test('markRead remembers the last-read moment', () => {
  const store = (() => { const m = new Map(); return {
    getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,v) }; })();
  assert.equal(getLast('t', store), null);
  markRead('t', 'b/c', store);
  assert.equal(getLast('t', store), 'b/c');
  markRead('t', 'a', store);
  assert.equal(getLast('t', store), 'a');
});

test('getProgress computes clamped read counts', () => {
  const store = (() => { const m = new Map(); return {
    getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,v) }; })();
  assert.deepEqual(getProgress('t', 3, store), { read: 0, total: 3, pct: 0 });
  markRead('t', 'a', store); markRead('t', 'b/c', store);
  assert.deepEqual(getProgress('t', 3, store), { read: 2, total: 3, pct: 67 });
  markRead('t', 'stale-1', store); markRead('t', 'stale-2', store);
  assert.deepEqual(getProgress('t', 3, store), { read: 3, total: 3, pct: 100 });  // clamped
  assert.deepEqual(getProgress('t', 0, store), { read: 0, total: 0, pct: 0 });    // no div-by-zero
});
