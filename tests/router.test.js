import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, buildTimelineHash, buildLibraryHash } from '../js/router.js';

test('library routes', () => {
  for (const h of ['', '#', '#/', '#/nonsense', '#/t']) {
    assert.deepEqual(parseHash(h), { view:'library' }, h);
  }
});

test('timeline routes', () => {
  assert.deepEqual(parseHash('#/t/ai'), { view:'timeline', id:'ai', path:[] });
  assert.deepEqual(parseHash('#/t/ai/chatgpt/gpt-4'), { view:'timeline', id:'ai', path:['chatgpt','gpt-4'] });
});

test('builders round-trip', () => {
  assert.equal(buildLibraryHash(), '#/');
  assert.equal(buildTimelineHash('ai', []), '#/t/ai');
  const h = buildTimelineHash('ai', ['a','b']);
  assert.deepEqual(parseHash(h), { view:'timeline', id:'ai', path:['a','b'] });
});
