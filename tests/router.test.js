import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePath, buildTimelinePath, buildLibraryPath, stripBase } from '../js/router.js';

test('stripBase removes the deploy prefix', () => {
  assert.equal(stripBase('/timeline/t/ai/x/', '/timeline/'), '/t/ai/x/');
  assert.equal(stripBase('/t/ai/', '/'), '/t/ai/');
  assert.equal(stripBase('/timeline/', '/timeline/'), '/');
});

test('library routes', () => {
  for (const p of ['/', '', '/index.html', '/nonsense', '/t', '/t/']) {
    assert.deepEqual(parsePath(p, '/'), { view: 'library' }, p);
  }
  assert.deepEqual(parsePath('/timeline/', '/timeline/'), { view: 'library' });
});

test('timeline routes with and without base', () => {
  assert.deepEqual(parsePath('/t/ai/', '/'), { view: 'timeline', id: 'ai', path: [] });
  assert.deepEqual(parsePath('/t/ai/chatgpt/gpt-4/', '/'),
    { view: 'timeline', id: 'ai', path: ['chatgpt', 'gpt-4'] });
  assert.deepEqual(parsePath('/timeline/t/ai/chatgpt/', '/timeline/'),
    { view: 'timeline', id: 'ai', path: ['chatgpt'] });
});

test('builders produce canonical trailing-slash URLs and round-trip', () => {
  assert.equal(buildLibraryPath('/'), '/');
  assert.equal(buildLibraryPath('/timeline/'), '/timeline/');
  assert.equal(buildTimelinePath('ai', [], '/'), '/t/ai/');
  assert.equal(buildTimelinePath('ai', ['a', 'b'], '/timeline/'), '/timeline/t/ai/a/b/');
  const p = buildTimelinePath('ai', ['a', 'b'], '/');
  assert.deepEqual(parsePath(p, '/'), { view: 'timeline', id: 'ai', path: ['a', 'b'] });
});

test('hash shim translation', () => {
  // legacy '#/t/ai/chatgpt' -> path under base
  assert.equal(buildTimelinePath('ai', ['chatgpt'], '/timeline/'), '/timeline/t/ai/chatgpt/');
});
