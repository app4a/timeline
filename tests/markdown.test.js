import test from 'node:test';
import assert from 'node:assert/strict';
import { mdToHtml } from '../js/markdown.js';

const always = () => true, never = () => false;

test('paragraphs, bold, italic, code', () => {
  const html = mdToHtml('Hello **world** and *side* of `code`.\n\nSecond.', never);
  assert.match(html, /<p>Hello <strong>world<\/strong> and <em>side<\/em> of <code>code<\/code>\.<\/p>/);
  assert.match(html, /<p>Second\.<\/p>/);
});

test('headings, lists, blockquote', () => {
  const html = mdToHtml('## Title\n\n- one\n- two\n\n> quoted', never);
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<blockquote>quoted<\/blockquote>/);
});

test('escapes raw HTML', () => {
  assert.ok(!mdToHtml('<script>alert(1)</script>', never).includes('<script>'));
});

test('external links', () => {
  assert.match(mdToHtml('[w3](https://w3.org)', never),
    /<a class="ext" href="https:\/\/w3\.org" target="_blank" rel="noopener">w3<\/a>/);
});

test('wiki links resolve, label, and fall back to plain text', () => {
  assert.match(mdToHtml('see [[ChatGPT]]', always), /<a class="wl" data-wiki="ChatGPT">ChatGPT<\/a>/);
  assert.match(mdToHtml('see [[ChatGPT|the bot]]', always), /<a class="wl" data-wiki="ChatGPT">the bot<\/a>/);
  assert.equal(mdToHtml('see [[Nope]]', never), '<p>see Nope</p>');
  assert.match(mdToHtml('see [[the-web/google|Google]]', always), /<a class="wl" data-wiki="the-web\/google">Google<\/a>/);
});

test('space-flanked numbers are never corrupted by the stash mechanism', () => {
  assert.equal(mdToHtml('BERT tops 11 benchmarks', never), '<p>BERT tops 11 benchmarks</p>');
  assert.equal(mdToHtml('reaches 1 million users in 5 days', never), '<p>reaches 1 million users in 5 days</p>');
  const html = mdToHtml('[[A]] then 0 and [[B]]', always);
  assert.match(html, /<a class="wl" data-wiki="A">A<\/a> then 0 and <a class="wl" data-wiki="B">B<\/a>/);
});

test('double quotes cannot break out of attributes', () => {
  const html = mdToHtml('see [[abc" onmouseover="alert(1)]]', always);
  assert.ok(!html.includes('onmouseover="alert'));
  assert.ok(html.includes('&quot;'));
});

test('non-http(s) URL schemes are not linkified', () => {
  const js = mdToHtml('[x](javascript:alert`1`)', never);
  assert.ok(!js.includes('href="javascript:'));
  assert.ok(js.includes('x'));
  assert.match(mdToHtml('[ok](https://w3.org)', never), /href="https:\/\/w3\.org"/);
});
