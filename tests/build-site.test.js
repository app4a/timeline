import test from 'node:test';
import assert from 'node:assert/strict';
import { nodePage, libraryPage, sitemap } from '../tools/build-site.js';

const SHELL = `<!DOCTYPE html><html><head><base href="/"><title>Timeline — learn anything, layer by layer</title>
<meta name="description" content="x"></head><body><main class="stage" id="stage"></main></body></html>`;

const tl = { id:'t', title:'T-Line', tagline:'tag', updated:'2026-06-12', events:[
  { id:'a', date:'1990', title:'Alpha', tagline:'first', content:'Hello **bold** [[Beta]]',
    sources:[{ title:'Src', url:'https://example.com' }] },
  { id:'b', date:'1991', title:'Beta', children:[ { id:'c', date:'1992', title:'Gamma' } ] }
]};
const SITE = 'https://app4a.github.io';
const BASE = '/timeline/';

test('branch page lists children as crawlable links', () => {
  const html = nodePage(SHELL, tl, [], { site:SITE, base:BASE });   // [] = timeline root
  assert.match(html, /<base href="\/timeline\/">/);
  assert.match(html, /<title>T-Line · Timeline<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/app4a\.github\.io\/timeline\/t\/t\/"/);
  assert.match(html, /href="\/timeline\/t\/t\/a\/"/);
  assert.match(html, /Alpha/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /og:type" content="website"/);
});

test('leaf page renders full article with sources', () => {
  const html = nodePage(SHELL, tl, ['a'], { site:SITE, base:BASE });
  assert.match(html, /<title>Alpha — T-Line · Timeline<\/title>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /https:\/\/example\.com/);
  assert.match(html, /og:title/);
  assert.match(html, /og:type" content="article"/);
});

test('nested branch page canonicalizes its own path', () => {
  const html = nodePage(SHELL, tl, ['b'], { site:SITE, base:BASE });
  assert.match(html, /canonical" href="https:\/\/app4a\.github\.io\/timeline\/t\/t\/b\/"/);
  assert.match(html, /href="\/timeline\/t\/t\/b\/c\/"/);
});

test('library page injects timeline cards', () => {
  const html = libraryPage(SHELL, { timelines:[{ id:'t', title:'T-Line', tagline:'tag', eventCount:3, updated:'2026-06-12' }] },
    { site:SITE, base:BASE });
  assert.match(html, /href="\/timeline\/t\/t\/"/);
  assert.match(html, /T-Line/);
});

test('sitemap lists every node URL with lastmod', () => {
  const xml = sitemap([tl], { site:SITE, base:BASE });
  for (const path of ['t/t/', 't/t/a/', 't/t/b/', 't/t/b/c/'])
    assert.ok(xml.includes(`<loc>${SITE}${BASE}${path}</loc>`), path);
  assert.match(xml, /<lastmod>2026-06-12<\/lastmod>/);
});
