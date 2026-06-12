import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../tools/serve.js';

async function withServer(dir, fn){
  const server = createServer(dir);
  await new Promise(res => server.listen(0, res));
  const base = 'http://127.0.0.1:' + server.address().port;
  try { await fn(base); } finally { server.close(); }
}

test('serves static files with correct types', () => withServer('.', async base => {
  const css = await fetch(base + '/css/app.css');
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);
  const json = await fetch(base + '/timelines/index.json');
  assert.match(json.headers.get('content-type'), /application\/json/);
}));

test('serves root index.html at /', () => withServer('.', async base => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<title>Timeline/);
}));

test('SPA fallback: extension-less paths serve index.html', () => withServer('.', async base => {
  const res = await fetch(base + '/t/artificial-intelligence/chatgpt/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<title>Timeline/);
}));

test('missing files with extensions 404', () => withServer('.', async base => {
  assert.equal((await fetch(base + '/nope.js')).status, 404);
}));

test('directory index.html is preferred over fallback', () => withServer('.', async base => {
  const res = await fetch(base + '/docs/superpowers/');   // no index.html there -> fallback
  assert.equal(res.status, 200);
}));
