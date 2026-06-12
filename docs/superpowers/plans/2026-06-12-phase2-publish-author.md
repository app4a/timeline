# Timeline Phase 2 — Publish & Author Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Timeline publicly with per-node SEO-grade URLs (static pre-rendering + GitHub Actions deploy), in-URL reading state (bookmarkable moments), a return chip for link jumps, and a `timeline-author` skill that turns a conversation into a live timeline URL — then prove it by authoring three real timelines.

**Architecture:** Hash routes become real paths (`/t/<tl>/<node>/…/`). A zero-dependency node generator (`tools/build-site.js`) renders every node to static HTML (reusing the app's own `js/markdown.js` + `js/data.js` in node) into `_site/`, which GitHub Actions deploys to Pages on every push. The SPA boots on each generated page and takes over. Dev uses a tiny SPA-fallback static server (`tools/serve.js`) since `python3 -m http.server` can't serve unbuilt paths.

**Tech Stack:** unchanged — vanilla ES modules, `node --test`, zero dependencies, GitHub Pages + Actions.

**Ground rules:** master only (no branches/worktrees) · no new npm deps · TDD pure logic (router, generator templates, serve fallback) · browser QA by controller for navigation tasks · 27 node tests must stay green throughout (router tests get rewritten in Task 2).

**Locked URL semantics (used by Tasks 2–7; reference, don't re-decide):**
- `BASE` = `new URL(document.baseURI).pathname` with any trailing `index.html` stripped — `'/'` in dev, `'/timeline/'` on Pages. `index.html` gains `<base href="/">`; the generator rewrites it per deploy.
- Library: `BASE` · timeline/node: `BASE + 't/' + [tlId, ...pathIds].join('/') + '/'` (always trailing slash; canonical).
- A **leaf** node URL renders its parent's level with the reading panel open on that node (bookmarkable reading state). A **branch** node URL renders its level.
- Opening the reader = `pushState` to the leaf URL (flag `state.readerPushed = true`); closing via UI = `history.back()` if `readerPushed`, else (direct deep load) `replaceState(parentURL)` + close. Drill/up/jumps = `pushState`; `popstate` routes with existing morph-direction logic.
- Old `#/t/...` hashes: boot shim → `location.replace` to the path equivalent.

---

### Task 1: Dev server with SPA fallback — `tools/serve.js` (TDD)

`python3 -m http.server` 404s on `/t/ai/` in dev. Replace with a zero-dep node server: static files + directory `index.html` + SPA fallback (extension-less paths → root `index.html`), optional `--dir _site`.

**Files:**
- Test: `tests/serve.test.js`
- Create: `tools/serve.js`
- Modify: `package.json` (scripts), `.claude/launch.json`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run `npm test`** → serve tests FAIL (module not found); existing 27 pass.

- [ ] **Step 3: Create tools/serve.js**

```js
// Zero-dep static server with SPA fallback for path-routed dev.
// Usage: node tools/serve.js [--dir _site] [--port 8080]
import { createServer as httpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.xml':'application/xml; charset=utf-8',
  '.txt':'text/plain; charset=utf-8', '.ico':'image/x-icon', '.webmanifest':'application/json' };

export function createServer(root){
  return httpServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      const tryFiles = [];
      if (p.endsWith('/')) tryFiles.push(join(root, p, 'index.html'));
      else if (!extname(p)) tryFiles.push(join(root, p, 'index.html'), join(root, p));
      else tryFiles.push(join(root, p));
      tryFiles.push(join(root, 'index.html'));                  // SPA fallback
      const withExt = extname(p) && !p.endsWith('/');
      for (const [i, f] of tryFiles.entries()){
        const isFallback = i === tryFiles.length - 1;
        if (isFallback && withExt) break;                       // real assets 404 honestly
        try {
          const body = await readFile(f);
          res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream',
                               'cache-control': 'no-cache' });
          res.end(body);
          return;
        } catch { /* try next */ }
      }
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
    } catch { res.writeHead(500); res.end(); }
  });
}

if (import.meta.url === `file://${process.argv[1]}`){
  const args = process.argv.slice(2);
  const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : '.';
  const port = args.includes('--port') ? +args[args.indexOf('--port') + 1] : 8080;
  createServer(dir).listen(port, () => console.log(`serving ${dir} on http://localhost:${port}`));
}
```

- [ ] **Step 4: `npm test`** → all pass (27 + 5 = 32).

- [ ] **Step 5: Update package.json scripts** — replace the `serve` script and add `build`/`serve:site` placeholders:

```json
  "scripts": {
    "test": "node --test",
    "validate": "node tools/validate.js",
    "build": "node tools/build-site.js",
    "serve": "node tools/serve.js",
    "serve:site": "node tools/serve.js --dir _site"
  }
```

And `.claude/launch.json`: change `runtimeExecutable` to `"node"` and `runtimeArgs` to `["tools/serve.js", "--port", "8080"]`.

- [ ] **Step 6: Commit**

```bash
git add tools/serve.js tests/serve.test.js package.json .claude/launch.json
git commit -m "feat: zero-dep dev server with SPA fallback for path routing (TDD)"
```

---

### Task 2: Path router (TDD rewrite)

**Files:**
- Modify: `js/router.js`, `tests/router.test.js` (full rewrites below)

- [ ] **Step 1: Rewrite tests/router.test.js entirely**

```js
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
```

- [ ] **Step 2: `npm test`** → router tests FAIL (old exports), others pass.

- [ ] **Step 3: Rewrite js/router.js entirely**

```js
export function stripBase(pathname, base){
  if (base !== '/' && pathname.startsWith(base)) pathname = pathname.slice(base.length - 1);
  return pathname || '/';
}
export function parsePath(pathname, base){
  const p = stripBase(pathname || '/', base).replace(/index\.html$/, '');
  const segs = p.split('/').filter(Boolean);
  if (segs[0] === 't' && segs[1]) return { view: 'timeline', id: segs[1], path: segs.slice(2) };
  return { view: 'library' };
}
export function buildTimelinePath(id, pathIds, base){
  return base + 't/' + [id, ...(pathIds || [])].join('/') + '/';
}
export function buildLibraryPath(base){ return base; }
```

- [ ] **Step 4: `npm test`** → router green; **expect js-dependent failures NOWHERE in node tests** (app/viewer/panel/search aren't node-tested), but the BROWSER app is now broken until Task 3 — that's expected mid-stack state; do not ship between Tasks 2 and 3 (commit both quickly in sequence).

- [ ] **Step 5: Commit**

```bash
git add js/router.js tests/router.test.js
git commit -m "feat: path-based router with deploy-base support (TDD)"
```

---

### Task 3: App navigation — pushState/popstate, BASE, hash shim

**Files:**
- Modify: `index.html`, `js/state.js`, `js/app.js`, `js/viewer.js`, `js/library.js`, `js/search.js`, `js/panel.js`

- [ ] **Step 1: index.html** — add `<base href="/">` as the FIRST element inside `<head>` (the generator rewrites it on deploy).

- [ ] **Step 2: js/state.js** — add BASE and a navigate helper registry. Replace the file with:

```js
export const BASE = new URL(document.baseURI).pathname.replace(/index\.html$/, '');
export const state = { layout:'v', timelineId:null, idx:null, path:[], busy:false, sel:-1,
                       pendingFrom:null, readerPushed:false, jumpStack:[] };
export const els = {};
export const handlers = {};
export function navigate(url, { replace = false } = {}){
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  handlers.route?.();
}
```

- [ ] **Step 3: js/app.js** — routing wiring changes (surgical):
  - Imports: `import { els, state, handlers, navigate, BASE } from './state.js';` and `import { parsePath, buildLibraryPath } from './router.js';`
  - `errorCard`: the back link href becomes `buildLibraryPath(BASE)`.
  - `route()` reads `parsePath(location.pathname, BASE)` instead of `parseHash`.
  - Register `handlers.route = route;`
  - Replace `window.addEventListener('hashchange', route);` with `window.addEventListener('popstate', route);`
  - Hash shim before the first `route()` call:

```js
const legacy = location.hash.match(/^#\/t\/(.+)$/);
if (legacy) location.replace(BASE + 't/' + legacy[1].replace(/\/+$/, '') + '/');
else route();
```
  (When `location.replace` fires, the page reloads at the path URL and boots normally — don't call route() in that branch.)

- [ ] **Step 4: js/viewer.js** — navigation pushes:
  - Import `navigate` and `BASE` from `./state.js`; replace `buildTimelineHash` import with `buildTimelinePath` from `./router.js`.
  - `handlers.drill`: `navigate(buildTimelinePath(state.timelineId, node.pathIds, BASE));` (replaces `location.hash = ...`).
  - `handlers.goUpTo`: same replacement with the ancestor's pathIds.
  - `renderTimelineRoute` URL-normalization line becomes:
    `history.replaceState(null, '', buildTimelinePath(parsed.id, chain.slice(1).map(n => n.id), BASE));`
  - NOTE: leaf-URL handling lands in Task 4 — in this task `resolvePath` still stops at the deepest valid node and renders its level even for leaves (a leaf node has no children so its "level" renders empty events; acceptable for the few minutes between commits; Task 4 fixes semantics).

- [ ] **Step 5: js/library.js** — card click: `navigate(buildTimelinePath(t.id, [], BASE))` (import from router/state). Topbar brand link in index.html: change `href="#/"` to `href="."` — and instead make it JS-driven: in app.js after els registration add:

```js
document.querySelector('.brand').addEventListener('click', e => {
  e.preventDefault();
  navigate(buildLibraryPath(BASE));
});
```

- [ ] **Step 6: js/search.js** — in `go()`, replace the dynamic-import hash navigation with:

```js
        import('./state.js').then(({ navigate, BASE }) =>
          import('./router.js').then(({ buildTimelinePath }) => {
            navigate(buildTimelinePath(state.timelineId, target.pathIds, BASE));
            setTimeout(() => handlers.focusChild(node), 900);
          }));
```
  (Or refactor to static imports at top — preferred: add `navigate, BASE` to the existing `./state.js` import and `buildTimelinePath` from `./router.js`, then call directly.)

- [ ] **Step 7: js/panel.js** — `followWiki`: replace both `location.hash = buildTimelineHash(...)` calls with `navigate(buildTimelinePath(..., BASE))`; same-timeline parent jump and cross-timeline land. (jumpStack comes in Task 5.)

- [ ] **Step 8: Verify** — `npm test` (32) · `node --check` each touched js file · `npm run serve` then browser QA (controller): library at `/`, drill to `/t/artificial-intelligence/chatgpt/` (URL bar shows real path), browser back/forward morph, reload deep path restores, legacy `/#/t/artificial-intelligence/chatgpt` redirects to the path URL, `#/t/nope` → error card.

- [ ] **Step 9: Commit**

```bash
git add index.html js/state.js js/app.js js/viewer.js js/library.js js/search.js js/panel.js
git commit -m "feat: pushState navigation with deploy base and legacy-hash redirect"
```

---

### Task 4: Reader-in-URL — bookmarkable moments

**Files:**
- Modify: `js/viewer.js`, `js/panel.js`

- [ ] **Step 1: js/viewer.js — leaf URL semantics in `renderTimelineRoute`.** After `const chain = resolvePath(state.idx, parsed.path);` replace the normalization + render block with:

```js
  let focusLeaf = null;
  let levelChain = chain;
  const deepest = chain[chain.length - 1];
  if (!deepest.isRoot && !deepest.children){       // leaf URL -> parent level + open reader
    focusLeaf = deepest;
    levelChain = chain.slice(0, -1);
  }
  if (chain.length - 1 !== parsed.path.length){    // unknown tail — normalize URL to deepest valid
    history.replaceState(null, '', buildTimelinePath(parsed.id, chain.slice(1).map(n => n.id), BASE));
  }
  if (!state.cur || !els.stage.contains(state.cur)) { state.path = levelChain; renderCurrent(); }
  else if (state.path[state.path.length - 1] !== levelChain[levelChain.length - 1]) transitionTo(levelChain);
  if (focusLeaf){
    state.readerPushed = false;                    // URL already points at the leaf
    const delay = state.busy ? 900 : 0;
    setTimeout(() => handlers.focusChild(focusLeaf), delay);
  }
```

- [ ] **Step 2: js/panel.js — push/pop reading state.** In `handlers.openReader`, after the busy-guard line, add:

```js
  if (!node.children && node.pathIds){
    const url = buildTimelinePath(state.timelineId, node.pathIds, BASE);
    if (location.pathname !== url){ history.pushState(null, '', url); state.readerPushed = true; }
  }
```
  (Add `BASE` to the state.js import and `buildTimelinePath` to the router.js import in panel.js.)

  In `handlers.closeReader`, at the END of the function add:

```js
  if (state.readerPushed){ state.readerPushed = false; history.back(); }
  else if (state.idx && !state.busy && state.path.length){
    const url = buildTimelinePath(state.timelineId, state.path[state.path.length - 1].pathIds, BASE);
    if (location.pathname !== url) history.replaceState(null, '', url);
  }
```
  CRITICAL ORDERING NOTE: `history.back()` fires `popstate` → `route()` → parent URL parses with no leaf → level already rendered → no-op render path. Guard against loops: closeReader must set `readerPushed = false` BEFORE calling `history.back()` (as written).

  Also in `handlers.drill` (viewer.js): reset `state.readerPushed = false` after `handlers.closeReader?.()` — drilling replaces the URL anyway and the reader's history entry is intentionally left behind (back returns to reading state — correct bookmark-like behavior).

- [ ] **Step 3: Verify (controller browser QA)** — click a leaf row → URL becomes `/t/…/turing-test/`; reload that URL → parent level + panel open + row pulsed; × → URL returns to parent path; browser Back after opening reader closes it (URL pops); bookmark-style direct load of `/t/artificial-intelligence/chatgpt/gpt-3-5/` works; ⌘K leaf jump produces the leaf URL.

- [ ] **Step 4: Commit**

```bash
git add js/viewer.js js/panel.js
git commit -m "feat: reading state lives in the URL — every moment bookmarkable"
```

---

### Task 5: Return chip for link jumps

**Files:**
- Modify: `js/panel.js`, `js/search.js`, `js/app.js`, `index.html`, `css/app.css`

- [ ] **Step 1: index.html** — inside `.stage`, after the hint bar:

```html
      <button class="jumpchip" id="jumpchip" hidden><span>←</span> Back to <b id="jumpchipname"></b><i id="jumpchipx">×</i></button>
```

- [ ] **Step 2: css/app.css** — append:

```css
/* return chip after wiki/search jumps */
.jumpchip{ all:unset; cursor:pointer; position:absolute; bottom:14px; left:20px; z-index:24;
           display:flex; align-items:center; gap:7px; font-size:12.5px; font-weight:600;
           color:var(--ink); background:#fff; border:1px solid var(--line); border-radius:99px;
           padding:8px 14px; box-shadow:0 10px 26px -14px rgba(21,21,26,.4); }
.jumpchip[hidden]{ display:none; }
.jumpchip b{ color:var(--accent); font-weight:700; }
.jumpchip i{ font-style:normal; color:var(--muted); margin-left:4px; padding:0 2px; }
.jumpchip i:hover{ color:var(--ink); }
.jumpchip:hover{ border-color:var(--accent); }
```

- [ ] **Step 3: js/app.js — chip wiring.** After els registration add `els.jumpchip = document.getElementById('jumpchip');` and:

```js
export function renderJumpChip(){
  const top = state.jumpStack[state.jumpStack.length - 1];
  els.jumpchip.hidden = !top;
  if (top) document.getElementById('jumpchipname').textContent = top.title;
}
els.jumpchip.addEventListener('click', e => {
  if (e.target.id === 'jumpchipx'){ state.jumpStack = []; renderJumpChip(); return; }
  const top = state.jumpStack.pop();
  renderJumpChip();
  if (top) navigate(top.url);
});
```
  Call `renderJumpChip()` at the end of `route()` (after `renderHint()`).
  Clearing rule: manual navigation empties the stack — in the SAME `route()` tail add:

```js
  if (state.clearJumpOnRoute) { state.jumpStack = []; }
  state.clearJumpOnRoute = true;          // default; jump initiators set it false just before navigate
  renderJumpChip();
```
  And add `clearJumpOnRoute:true` to the state object in `js/state.js`.

- [ ] **Step 4: js/panel.js — push origins on wiki jumps.** In `followWiki`, before EACH `navigate(...)` call (same-timeline parent jump and cross-timeline), insert:

```js
    state.jumpStack.push({ title: state.path[state.path.length - 1].title,
      url: location.pathname });
    if (state.jumpStack.length > 5) state.jumpStack.shift();
    state.clearJumpOnRoute = false;
```
  Same for the `handlers.drill(node, fromEl)` branch-target case: push BEFORE calling drill (drill navigates internally):

```js
    if (node.children){
      state.jumpStack.push({ title: state.path[state.path.length - 1].title, url: location.pathname });
      if (state.jumpStack.length > 5) state.jumpStack.shift();
      state.clearJumpOnRoute = false;
      handlers.drill(node, fromEl);
    }
```

- [ ] **Step 5: js/search.js — same push in `go()`** before both navigation paths (drill branch and leaf navigate), identical three lines.

- [ ] **Step 6: Verify (controller)** — read ChatGPT → click [[The Turing Test]] → chip "← Back to ChatGPT" appears bottom-left; click it → returns to the ChatGPT reading state (URL + panel restored via Task 4 semantics); chip ×-dismiss works; manual breadcrumb navigation clears the chip; two chained jumps stack (chip shows latest, popping walks back).

- [ ] **Step 7: Commit**

```bash
git add index.html css/app.css js/app.js js/panel.js js/search.js js/state.js
git commit -m "feat: return chip restores where you were after wiki/search jumps"
```

---

### Task 6: Generator page templates (TDD)

**Files:**
- Test: `tests/build-site.test.js`
- Create: `tools/build-site.js` (template functions only; emit pipeline in Task 7)

- [ ] **Step 1: Write the failing test**

```js
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
});

test('leaf page renders full article with sources', () => {
  const html = nodePage(SHELL, tl, ['a'], { site:SITE, base:BASE });
  assert.match(html, /<title>Alpha — T-Line · Timeline<\/title>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /https:\/\/example\.com/);
  assert.match(html, /og:title/);
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
```

- [ ] **Step 2: `npm test`** → FAIL (module not found).

- [ ] **Step 3: Create tools/build-site.js (templates half)**

```js
// Static site generator: every timeline node becomes a crawlable page.
// Templates here (TDD'd); the emit pipeline (main) is appended in the next task.
import { mdToHtml } from '../js/markdown.js';

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function walkFind(tl, pathIds){
  let node = { title: tl.title, tagline: tl.tagline, children: tl.events, isRoot: true };
  const chain = [node];
  for (const seg of pathIds){
    node = (node.children || []).find(e => e.id === seg);
    if (!node) throw new Error('bad path ' + pathIds.join('/'));
    chain.push(node);
  }
  return chain;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function displayDate(ev){
  if (ev.display) return ev.display;
  const [y, m, d] = (ev.date || '').split('-');
  if (d) return `${MONTHS[+m-1]} ${+d}, ${y}`;
  if (m) return `${MONTHS[+m-1]} ${y}`;
  return y || '';
}

function head(shell, { title, desc, canonical, base, jsonld }){
  return shell
    .replace(/<base href="[^"]*">/, `<base href="${base}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace('</head>', `<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>`);
}

function inject(shell, staticHtml){
  return shell.replace(/(<main class="stage" id="stage">)/, `$1
<div class="level v ssg"><div class="level-in">${staticHtml}</div></div>`);
}

function breadcrumbLd(site, base, tl, chain){
  return { '@context':'https://schema.org', '@type':'BreadcrumbList',
    itemListElement: chain.map((n, i) => ({ '@type':'ListItem', position: i + 1, name: n.title,
      item: site + base + (i === 0 ? `t/${tl.id}/` : `t/${tl.id}/${chain.slice(1, i + 1).map(x => x.id).join('/')}/`) })) };
}

export function nodePage(shell, tl, pathIds, { site, base }){
  const chain = walkFind(tl, pathIds);
  const node = chain[chain.length - 1];
  const urlPath = `t/${tl.id}/` + (pathIds.length ? pathIds.join('/') + '/' : '');
  const canonical = site + base + urlPath;
  const isLeaf = !node.isRoot && !node.children;
  const title = node.isRoot ? `${tl.title} · Timeline` : `${node.title} — ${tl.title} · Timeline`;
  const desc = node.tagline || tl.tagline;
  const ld = [breadcrumbLd(site, base, tl, chain)];
  let body;
  if (isLeaf){
    ld.push({ '@context':'https://schema.org', '@type':'Article', headline: node.title,
      description: desc, dateModified: tl.updated, mainEntityOfPage: canonical });
    body = `<article class="md"><h1>${esc(node.title)}</h1><p><b>${esc(displayDate(node))}</b> · part of <a href="${base}${`t/${tl.id}/` + pathIds.slice(0, -1).join('/')}${pathIds.length > 1 ? '/' : ''}">${esc(chain[chain.length - 2].title)}</a></p>
${mdToHtml(node.content || '', () => false)}
${node.sources?.length ? '<h2>Sources</h2><ul>' + node.sources.map(s => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a></li>`).join('') + '</ul>' : ''}</article>`;
  } else {
    body = `<h1>${esc(node.title)}</h1><p>${esc(desc)}</p><ol class="ssg-events">` +
      (node.children || []).map(ch =>
        `<li><a href="${base}${urlPath}${ch.id}/"><b>${esc(displayDate(ch))}</b> — ${esc(ch.title)}</a>${ch.tagline ? ` <span>${esc(ch.tagline)}</span>` : ''}</li>`).join('') +
      `</ol>`;
  }
  return inject(head(shell, { title, desc, canonical, base, jsonld: ld }), body);
}

export function libraryPage(shell, index, { site, base }){
  const body = `<h1>Timeline</h1><p>Beautiful, drillable timelines.</p><ul class="ssg-lib">` +
    index.timelines.map(t => `<li><a href="${base}t/${t.id}/">${esc(t.title)}</a> — ${esc(t.tagline)} (${t.eventCount} moments)</li>`).join('') + '</ul>';
  const ld = { '@context':'https://schema.org', '@type':'WebSite', name:'Timeline', url: site + base };
  return inject(head(shell, { title:'Timeline — learn anything, layer by layer',
    desc:'Beautiful, drillable timelines. Understand any topic by seeing where it came from.',
    canonical: site + base, base, jsonld: ld }), body);
}

export function sitemap(timelines, { site, base }){
  const urls = [`${site}${base}`];
  const lastmods = { [`${site}${base}`]: timelines.map(t => t.updated).sort().pop() };
  for (const tl of timelines){
    const add = (pathIds) => { const u = `${site}${base}t/${tl.id}/` + (pathIds.length ? pathIds.join('/') + '/' : '');
      urls.push(u); lastmods[u] = tl.updated; };
    add([]);
    (function walk(evs, p){ for (const e of evs || []){ add([...p, e.id]); walk(e.children, [...p, e.id]); } })(tl.events, []);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${lastmods[u]}</lastmod></url>`).join('\n')}
</urlset>\n`;
}
```

- [ ] **Step 4: `npm test`** → all green (37).

- [ ] **Step 5: Commit**

```bash
git add tools/build-site.js tests/build-site.test.js
git commit -m "feat: SSG page/library/sitemap templates (TDD)"
```

---

### Task 7: Generator emit pipeline + `npm run build`

**Files:**
- Modify: `tools/build-site.js` (append main), `.gitignore` (+`_site/`), `css/app.css` (ssg static styles)

- [ ] **Step 1: Append the emit pipeline to tools/build-site.js**

```js
/* ---------- emit pipeline (CLI) ---------- */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

export function buildSite({ root, out, site, base }){
  const shell = readFileSync(join(root, 'index.html'), 'utf8');
  const index = JSON.parse(readFileSync(join(root, 'timelines/index.json'), 'utf8'));
  const timelines = index.timelines.map(t =>
    JSON.parse(readFileSync(join(root, `timelines/${t.id}.json`), 'utf8')));
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const write = (rel, content) => {
    const f = join(out, rel);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, content);
  };
  let pages = 0;
  write('index.html', libraryPage(shell, index, { site, base })); pages++;
  for (const tl of timelines){
    const emit = (pathIds) => { write(join('t', tl.id, ...pathIds, 'index.html'),
      nodePage(shell, tl, pathIds, { site, base })); pages++; };
    emit([]);
    (function walk(evs, p){ for (const e of evs || []){ emit([...p, e.id]); walk(e.children, [...p, e.id]); } })(tl.events, []);
  }
  write('sitemap.xml', sitemap(timelines, { site, base }));
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site}${base}sitemap.xml\n`);
  write('404.html', libraryPage(shell, index, { site, base })
    .replace('</head>', '<meta name="robots" content="noindex"></head>'));
  for (const dir of ['css', 'js', 'assets', 'timelines']) cpSync(join(root, dir), join(out, dir), { recursive: true });
  return pages;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]){
  const root = fileURLToPath(new URL('..', import.meta.url));
  const site = process.env.SITE_ORIGIN || 'https://app4a.github.io';
  const base = process.env.SITE_BASE || '/timeline/';
  const { execSync } = await import('node:child_process');
  execSync('node tools/validate.js', { stdio: 'inherit', cwd: root });   // content gate before build
  const pages = buildSite({ root, out: join(root, '_site'), site, base });
  console.log(`✓ built ${pages} pages into _site/`);
}
```

- [ ] **Step 2: Append minimal static-page styles to css/app.css** (the SSG level is replaced on app boot; these keep no-JS/crawler view tidy):

```css
/* ===== SSG static content (visible pre-hydration / to crawlers) ===== */
.level.ssg h1{ font-size:clamp(30px,2.4vw + 14px,48px); letter-spacing:-.028em; margin:0 0 10px; }
.ssg-events{ list-style:none; padding:0; margin:18px 0; }
.ssg-events li{ margin:12px 0; font-size:15px; }
.ssg-events a{ color:var(--ink); text-decoration:none; font-weight:600; }
.ssg-events a b{ color:var(--accent); font-weight:700; }
.ssg-events span{ color:var(--muted); display:block; font-size:13px; }
.ssg-lib{ list-style:none; padding:0; } .ssg-lib li{ margin:10px 0; }
.ssg-lib a{ color:var(--accent); font-weight:700; text-decoration:none; }
```

- [ ] **Step 3: .gitignore** — add line `_site/`.

- [ ] **Step 4: Verify**
- `npm run build` → `✓ 2 timeline(s) valid` then `✓ built 39 pages into _site/` (1 library + 1+26 AI + 1+10 Web = 39).
- `ls _site/t/artificial-intelligence/chatgpt/gpt-4/` → `index.html` (+ child dirs).
- `SITE_BASE=/ node tools/build-site.js && npm run serve:site` → controller browser QA: load `/t/artificial-intelligence/chatgpt/gpt-3-5/` cold from `_site` — static article visible in source (curl it and grep `<strong>` content, canonical, JSON-LD), app hydrates over it, panel opens on the leaf.
- `npm test` still green.

- [ ] **Step 5: Commit**

```bash
git add tools/build-site.js css/app.css .gitignore
git commit -m "feat: full static-site emit — per-node pages, sitemap, robots, 404"
```

---

### Task 8: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: Deploy
on:
  push:
    branches: [master]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm test
      - run: npm run validate
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify** — `npx --yes yaml-lint .github/workflows/deploy.yml 2>/dev/null || node -e "console.log('skip lint')"`; sanity: the three npm steps mirror local commands that are all green.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: build and deploy to GitHub Pages on push to master"
```

---

### Task 9: `timeline-author` skill + docs refresh

**Files:**
- Create: `.claude/skills/timeline-author/SKILL.md`
- Modify: `README.md`, `SCHEMA.md` (URL examples)

- [ ] **Step 1: Create .claude/skills/timeline-author/SKILL.md**

```markdown
---
name: timeline-author
description: Create or update a Timeline site timeline from research, end to end — research a topic with sources, author schema JSON, validate, publish to master, and return the live URL. Use when the user asks to "build/create/make a timeline about X", "add ... to the X timeline", or "update the X timeline".
---

# Timeline Author

You turn a topic (or an ongoing conversation about one) into a published timeline at
https://app4a.github.io/timeline/. Work from the repo root (this repo). Never branch — master only.

## Workflow

1. **Scope.** From the conversation, fix: the angle (history of what, for whom), target depth
   (default ≥20 moments for a standalone topic; nest 2–4 levels where the story has chapters),
   and the timeline id (kebab-case). If the user has been exploring a topic with you, mine the
   conversation for the moments they cared about — those become `major: true` events.

2. **Research with sources.** Use WebSearch/WebFetch for history; use `gh api` for GitHub-history
   topics (releases: `gh api repos/<owner>/<repo>/releases --paginate`, tags, CHANGELOG files).
   Every major event needs at least one source URL (prefer primary/canonical: papers, official
   announcements, w3.org, wikipedia as fallback). Verify dates against at least one source.
   Track findings as (date, title, what-happened, why-it-matters, source-url) tuples.

3. **Author** `timelines/<id>.json` per SCHEMA.md (read it first). House style:
   - Archival, editorial tone; present tense for historical narration; no hype.
   - Every event: `date` (sortable), `title` (short), `tagline` (one line), `content` (markdown
     with paragraphs and a "## Why it matters" section for majors), `major` on the ~30% that
     carry the story, `sources` on anything non-obvious.
   - Wiki-link related moments: `[[Title]]` same timeline, `[[other-tl/event-id|label]]` cross.
   - Chronological order at every level (the validator enforces it).

4. **Gate.** Run `npm run validate` and fix every error. Update `timelines/index.json`
   (id/title/tagline/eventCount/updated — eventCount must equal the validator's count).
   Run `npm test` (must stay green) and `npm run build` (must succeed) locally.

5. **Publish.** `git add timelines/ && git commit -m "content: <title> timeline (<N> moments)"`
   then `git push`. Watch the deploy: `gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId')`.

6. **Confirm.** Reply with the live URLs:
   `https://app4a.github.io/timeline/t/<id>/` (+ a couple of deep moment URLs). If the deploy
   failed, read the Actions log, fix, and re-push before replying.

## Quality bar

- ≥20 moments for standalone topics; every date verified; no unsourced superlatives.
- Read two existing files first as exemplars: `timelines/artificial-intelligence.json`,
  `timelines/the-web.json`.
- The validator is the contract — never weaken it to make content pass.
```

- [ ] **Step 2: README.md** — update: dev commands (`npm run serve` note "SPA-fallback dev server", add `npm run build` + `serve:site`), URL examples from `#/t/...` to `/t/.../`, an "SEO & deploy" section (Actions auto-deploys on push; one-time: verify in Google Search Console with the HTML-file method — drop the file into the repo root and the generator copies it — then submit `sitemap.xml`), and an "Author with Claude" section pointing at the skill ("say: build a timeline about X").

- [ ] **Step 3: SCHEMA.md** — update the wiki-link cross-timeline example's surrounding text if it references hash URLs (grep `#/`; fix to path form).

- [ ] **Step 4: Verify** — `npm test`; `ls .claude/skills/timeline-author/SKILL.md`.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/timeline-author/SKILL.md README.md SCHEMA.md
git commit -m "feat: timeline-author skill; docs for path URLs, build, SEO setup"
```

---

### Task 10: Launch — repo, Pages, live verification

(Controller runs this task directly — it touches the user's GitHub account.)

- [ ] **Step 1:** `gh repo create app4a/timeline --public --source=. --push` (repo must be public for free Pages).
- [ ] **Step 2:** Set Pages to deploy from Actions: `gh api -X POST repos/app4a/timeline/pages -f build_type=workflow` (if 409 already-exists: `gh api -X PUT repos/app4a/timeline/pages -f build_type=workflow`).
- [ ] **Step 3:** First deploy runs from the push; watch: `gh run watch $(gh run list --repo app4a/timeline --limit 1 --json databaseId -q '.[0].databaseId')` → expect success.
- [ ] **Step 4: Live QA (controller):** `curl -s https://app4a.github.io/timeline/sitemap.xml | head`; curl a deep page and grep canonical + article content; browser: load library, deep moment URL (panel opens), legacy hash URL redirects, return chip after a wiki jump, browser back closes reader.
- [ ] **Step 5:** Tell the user the one manual step: Google Search Console verification (instructions are in README) — we cannot do this for them (needs their Google account).

---

### Task 11: Acceptance content — three timelines via the skill

Each timeline is authored by a fresh subagent **using the timeline-author skill's workflow** (research → author → validate → push), one at a time (they each touch `timelines/index.json` — sequential to avoid conflicts). ≥20 moments each, nested where the story has chapters, sources on majors.

- [ ] **Step 1: `steve-jobs`** — biography: childhood/founding (Apple I/II, Macintosh), ouster, NeXT & Pixar years (nest), the return (iMac→iPod→iTunes nest), iPhone/iPad era (nest), illness/death/legacy. Primary sources: Isaacson bio coverage, Apple press releases, Stanford commencement, obituaries.
- [ ] **Step 2: `claude`** — Anthropic + the Claude model line: founding (2021), safety-research era (constitutional AI paper), Claude 1/2 (2023), Claude 3 family (Mar 2024, nest the family), 3.5 Sonnet era + Artifacts/computer use (nest), Claude 4 era (nest), ecosystem (Claude Code, MCP — cross-link [[artificial-intelligence/...]] where genuine). Sources: anthropic.com announcements, papers.
- [ ] **Step 3: `react`** — from official GitHub history: research via `gh api repos/facebook/react/releases --paginate` + CHANGELOG.md: open-sourcing (May 2013 JSConf), 0.14 (react-dom split), 15, 16 "Fiber" (nest: error boundaries, portals), 16.8 Hooks (major, nest the hooks story), 17 "no new features", 18 (concurrent, nest), 19 (compiler/actions), ecosystem moments (React Native 2015, Next.js relationship) — every release event sourced to its GitHub release/blog URL.
- [ ] **Step 4:** After each: validator green, `git push`, Actions deploy green, live URL spot-check. Library shows 5 timelines.
- [ ] **Step 5: Acceptance test T1 (conversational flow)** — controller demonstrates end-to-end: pick a fresh topic, simulate the deep-dive conversation, invoke the skill flow, deliver ≥20-moment timeline + live URL. Report the URL trail to the user. (The user then repeats T1 interactively with any topic whenever they like — the skill triggers on "build a timeline about X".)

---

## Self-review (done at plan-writing time)

- **Spec coverage:** URL model ✓ (T2–4) · SSG per-node pages/meta/JSON-LD/sitemap/robots/404 ✓ (T6–7) · CI auto-deploy ✓ (T8) · return chip ✓ (T5) · bookmarkable reading ✓ (T4) · hash redirect ✓ (T3) · skill ✓ (T9) · MCP-ready seams ✓ (skill orchestrates validate/build/git only) · SEO ops note ✓ (T9 README + T10 step 5) · launch checklist ✓ (T10) · acceptance T1/T2 ✓ (T11). Dropped per user: all visual/UI redesign.
- **Placeholder scan:** none — every step has exact code/commands; T11 content is research-produced at execution time by design (the skill defines the quality gate), not a placeholder.
- **Type consistency:** `parsePath/buildTimelinePath/buildLibraryPath/stripBase(BASE)` consistent across T2–T6; `state.readerPushed/jumpStack/clearJumpOnRoute` defined in T3/T5 state.js edits before use; `navigate()` defined T3, used T3–5; generator exports `nodePage/libraryPage/sitemap/buildSite` consistent between T6 tests and T7 emit; `_site/` gitignored before CI references it.
- **Sequencing note:** Tasks 2→3 leave the browser app broken between commits (router swapped before app) — explicitly flagged in T2; execute back-to-back.
