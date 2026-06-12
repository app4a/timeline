import test from 'node:test';
import assert from 'node:assert/strict';
import { searchNodes } from '../js/search.js';
import { indexTimeline } from '../js/data.js';

const idx = indexTimeline({ id:'t', title:'T', tagline:'', updated:'2026-01-01', events:[
  { id:'a', date:'2017', title:'Transformers', tagline:'attention architecture' },
  { id:'b', date:'2022', title:'ChatGPT', tagline:'ai goes mainstream', children:[
    { id:'c', date:'2023', title:'GPT-4', tagline:'capability jump' }
  ]}
]});

test('prefix beats substring beats tagline', () => {
  const r = searchNodes(idx, 'gpt');
  assert.equal(r[0].node.title, 'GPT-4');          // title prefix
  assert.equal(r[1].node.title, 'ChatGPT');        // title substring
});

test('finds nested nodes and tagline matches', () => {
  assert.equal(searchNodes(idx, 'capability')[0].node.title, 'GPT-4');
  assert.equal(searchNodes(idx, 'attention')[0].node.title, 'Transformers');
});

test('empty or no-match queries return empty', () => {
  assert.deepEqual(searchNodes(idx, ''), []);
  assert.deepEqual(searchNodes(idx, 'zzzzz'), []);
});
