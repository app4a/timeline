# Timeline MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and ship Timeline — a static, zero-dependency website of drillable timelines (library + viewer with morph navigation, markdown reading panel, sources, ⌘K search) — exactly as specified in `docs/superpowers/specs/2026-06-12-timeline-design.md`.

**Architecture:** Single-page vanilla-JS app with hash routing, served as static files (GitHub Pages). Content = JSON files under `timelines/`. The validated interaction prototype at `docs/superpowers/specs/2026-06-12-timeline-prototype.html` is the canonical reference for look and motion — this plan ports it into modules, rebranded per the spec's Brand section.

**Tech Stack:** HTML/CSS/ES-modules (no framework, no bundler), Web Animations API, Google Fonts CDN (Instrument Sans + Newsreader), `node --test` for pure-logic tests, `python3 -m http.server` for local dev.

**Ground rules (from user + spec):**
- Work directly on `master`. Never create worktrees or branches.
- No npm dependencies — `package.json` exists only for `"type":"module"` and scripts.
- TDD the pure-logic modules (markdown, router, data helpers, validator, search scoring). DOM/UI tasks get explicit browser verification steps instead.
- The timeline must never reflow or shift when reading opens (overlay panels, reserved scrollbar gutters, no scroll-on-click).

---

## File structure & module contracts

```
timeline/
  index.html                 app shell: fonts, favicon, topbar, app grid, panel, search overlay
  css/app.css                all styles; design tokens at top
  js/state.js                shared mutable state + DOM refs + handler registry (imports nothing)
  js/markdown.js             mdToHtml(md, resolveWiki) — pure
  js/router.js               parseHash/buildTimelineHash/buildLibraryHash — pure
  js/data.js                 fetch+cache, indexTimeline, resolvePath, countEvents, read-state
  js/panel.js                reading panel (right/bottom sheet), sources, wiki-link clicks
  js/rail.js                 map rail + legend
  js/viewer.js               level rendering (v+h), morph transitions, drill/up/focus
  js/search.js               searchNodes scoring (pure) + ⌘K palette UI
  js/library.js              library grid
  js/app.js                  boot: wiring, hashchange, layout toggle, keyboard
  assets/logo.svg  assets/favicon.svg  assets/apple-touch-icon.png  assets/favicon-32.png
  timelines/index.json
  timelines/artificial-intelligence.json
  timelines/the-web.json
  SCHEMA.md
  tools/validate.js          content validator (node, zero deps)
  tests/*.test.js            node --test
```

**Module contracts (use these names everywhere):**

```js
// state.js
export const state = { layout:'v', timelineId:null, idx:null, path:[], busy:false, sel:-1,
                       pendingFrom:null /* DOMRect|null for next down-morph */ };
export const els = {};            // populated by app.js: stage, rail, panel, search, seg, hint
export const handlers = {};       // cross-module calls without circular imports:
                                  // handlers.drill(node, fromEl) · handlers.goUpTo(i)
                                  // handlers.focusChild(node) · handlers.openReader(node, evEl)
                                  // handlers.closeReader() · handlers.navigateCross(timelineId, pathIds, fromEl)

// markdown.js
export function mdToHtml(md, resolveWiki)   // resolveWiki(target:string) => boolean (render as link?)

// router.js
export function parseHash(hash)             // '#/t/ai/a/b' => {view:'timeline', id:'ai', path:['a','b']}
                                            // ''|'#'|'#/' => {view:'library'}; anything else => {view:'library'}
export function buildTimelineHash(id, pathIds)  // => '#/t/'+[id,...pathIds].join('/')
export function buildLibraryHash()              // => '#/'

// data.js
export async function loadIndex()           // => {timelines:[...]}  (cached)
export async function loadTimeline(id)      // => raw timeline JSON (cached); throws {code:'notfound'|'badjson'|'network'}
export function indexTimeline(tl)           // => idx: {root, byTitle:Map, byPath:Map}
                                            //    root = {...tl, children: tl.events, isRoot:true}
                                            //    every node gets .parent and .pathIds (ids from root-child down, root=[])
export function resolvePath(idx, segs)      // => node[] chain [root, ...validNodes] (stops at deepest valid)
export function displayDate(ev)             // => 'Nov 2022' style string (ev.display wins; derived from ev.date)
export function getRead(timelineId, storage=localStorage)        // => Set<pathKey>
export function markRead(timelineId, pathKey, storage=localStorage)
// pathKey = node.pathIds.join('/')

// search.js
export function searchNodes(idx, query)     // => [{node, score}] sorted, max 12 — pure, TDD'd

// viewer.js
export function renderTimelineRoute(parsed) // called by app.js on hashchange (handles morph vs instant)
// also assigns handlers.drill/goUpTo/focusChild and re-renders on layout toggle via renderCurrent()
export function renderCurrent()

// panel.js  — assigns handlers.openReader/closeReader
// rail.js   — export function renderRail()
// library.js — export async function renderLibrary()
```

**Dev server:** `python3 -m http.server 8080` from repo root (ES modules + fetch don't work over `file://`). All browser-verify steps assume `http://localhost:8080`.

---

### Task 1: Scaffold — package.json, shell, design tokens

**Files:**
- Create: `package.json`, `index.html`, `css/app.css`, `js/state.js`

- [ ] **Step 1: Check node version**

Run: `node --version`
Expected: `v18` or higher (needed for `node --test`). If lower, stop and tell the user.

- [ ] **Step 2: Create package.json**

```json
{
  "name": "timeline",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "validate": "node tools/validate.js",
    "serve": "python3 -m http.server 8080"
  }
}
```

- [ ] **Step 3: Create css/app.css (tokens + base + topbar)**

```css
/* ===== Timeline — design tokens (spec: Brand & visual identity) ===== */
:root{
  --paper:#faf9f6; --ink:#15151a; --soft:#494952; --muted:#8c8c96;
  --faint:#c9c7c0; --line:#e8e6e1;
  --accent:#3548e8; --accent-soft:rgba(53,72,232,.08); --accent-tint:rgba(53,72,232,.25);
  --halo:rgba(53,72,232,.18);
  --sans:'Instrument Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  --serif:'Newsreader',Charter,Georgia,'Times New Roman',serif;
  --ease:cubic-bezier(.5,.05,.1,1); --soft-ease:cubic-bezier(.2,.7,.2,1);
}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{ font-family:var(--sans); color:var(--ink); background:var(--paper);
      display:flex; flex-direction:column; -webkit-font-smoothing:antialiased; overflow:hidden; }

/* ===== top bar ===== */
.topbar{ flex:0 0 auto; display:flex; align-items:center; justify-content:space-between;
         padding:14px 26px; border-bottom:1px solid var(--line); background:#fff; z-index:30; }
.brand{ display:flex; align-items:center; gap:10px; font-size:15px; font-weight:700;
        letter-spacing:-.01em; color:var(--ink); text-decoration:none; }
.brand img{ display:block; height:20px; }
.seg{ display:flex; gap:4px; background:#f1efe9; padding:4px; border-radius:99px; }
.seg button{ all:unset; cursor:pointer; font-size:11.5px; font-weight:700; padding:6px 14px;
             border-radius:99px; color:var(--muted); font-family:var(--sans); }
.seg button.on{ background:#fff; color:var(--ink); box-shadow:0 1px 3px rgba(0,0,0,.12); }

/* ===== app grid ===== */
.app{ flex:1 1 auto; display:grid; grid-template-columns:clamp(240px,19vw,320px) 1fr; min-height:0; }
@media(max-width:980px){ .app{grid-template-columns:1fr} .rail{display:none} }
.rail{ border-right:1px solid var(--line); background:#fff; overflow:auto;
       padding:22px 14px 30px; scrollbar-gutter:stable; }
.stage{ position:relative; overflow:hidden; min-height:0; }

/* ===== quiet, thin scrollbars (global) ===== */
.level,.rail,.pb,.hwrap{ scrollbar-width:thin; scrollbar-color:var(--faint) transparent; }
.level::-webkit-scrollbar,.rail::-webkit-scrollbar,.pb::-webkit-scrollbar,.hwrap::-webkit-scrollbar{ width:7px; height:7px; }
.level::-webkit-scrollbar-thumb,.rail::-webkit-scrollbar-thumb,.pb::-webkit-scrollbar-thumb,.hwrap::-webkit-scrollbar-thumb{ background:var(--faint); border-radius:99px; }
.level::-webkit-scrollbar-track,.rail::-webkit-scrollbar-track,.pb::-webkit-scrollbar-track,.hwrap::-webkit-scrollbar-track{ background:transparent; }
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Timeline — learn anything, layer by layer</title>
<meta name="description" content="Beautiful, drillable timelines. Understand any topic by seeing where it came from.">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/app.css">
</head>
<body>
  <header class="topbar">
    <a class="brand" href="#/"><img src="assets/logo.svg" alt="" width="64" height="24">Timeline</a>
    <div class="seg" id="seg" hidden>
      <button class="on" data-l="v">Vertical</button>
      <button data-l="h">Horizontal</button>
    </div>
  </header>
  <div class="app">
    <aside class="rail" id="rail" hidden></aside>
    <main class="stage" id="stage"></main>
  </div>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create js/state.js**

```js
export const state = { layout:'v', timelineId:null, idx:null, path:[], busy:false, sel:-1, pendingFrom:null };
export const els = {};
export const handlers = {};
```

- [ ] **Step 6: Create a minimal js/app.js so the page boots without errors**

```js
import { els } from './state.js';
els.stage = document.getElementById('stage');
els.rail  = document.getElementById('rail');
els.seg   = document.getElementById('seg');
console.log('Timeline boot ok');
```

- [ ] **Step 7: Verify in browser**

Run (background): `python3 -m http.server 8080`
Open `http://localhost:8080`. Expected: warm off-white page, white topbar with broken-image icon + "Timeline" wordmark (logo arrives next task), no console errors, "Timeline boot ok" logged.

- [ ] **Step 8: Commit**

```bash
git add package.json index.html css/app.css js/state.js js/app.js
git commit -m "feat: scaffold app shell with design tokens and fonts"
```

---

### Task 2: Brand assets — logo, favicon, touch icons

**Files:**
- Create: `assets/logo.svg`, `assets/favicon.svg`, `assets/apple-touch-icon.png`, `assets/favicon-32.png`

- [ ] **Step 1: Create assets/logo.svg** (the dot-language mark: two read-tint dots, one solid "reading now" dot with halo)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 24" width="64" height="24">
  <line x1="3" y1="12" x2="61" y2="12" stroke="#e8e6e1" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="12" r="4" fill="rgba(53,72,232,.25)" stroke="#3548e8" stroke-width="1.5"/>
  <circle cx="30" cy="12" r="4" fill="rgba(53,72,232,.25)" stroke="#3548e8" stroke-width="1.5"/>
  <circle cx="50" cy="12" r="9" fill="none" stroke="rgba(53,72,232,.3)" stroke-width="2.5"/>
  <circle cx="50" cy="12" r="5" fill="#3548e8"/>
</svg>
```

- [ ] **Step 2: Create assets/favicon.svg** (mark reduced to the single halo-dot)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#faf9f6"/>
  <line x1="4" y1="16" x2="28" y2="16" stroke="#e8e6e1" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="16" cy="16" r="9.5" fill="none" stroke="rgba(53,72,232,.35)" stroke-width="3"/>
  <circle cx="16" cy="16" r="5" fill="#3548e8"/>
</svg>
```

- [ ] **Step 3: Generate PNGs from the SVG (macOS QuickLook)**

```bash
qlmanage -t -s 180 -o assets assets/favicon.svg && mv assets/favicon.svg.png assets/apple-touch-icon.png
qlmanage -t -s 32  -o assets assets/favicon.svg && mv assets/favicon.svg.png assets/favicon-32.png
```

Then open both PNGs (`open assets/apple-touch-icon.png`) and confirm they show the rounded square with the halo dot. If qlmanage produced blank/garbled output, delete the two PNGs, remove their two `<link>` tags from `index.html`, and note it in the commit message — the SVG favicon alone covers all modern browsers.

- [ ] **Step 4: Verify in browser**

Reload `http://localhost:8080`. Expected: logo mark renders beside "Timeline" in the topbar; browser tab shows the dot favicon.

- [ ] **Step 5: Commit**

```bash
git add assets/
git commit -m "feat: add Timeline logo and favicon set (dot-language mark)"
```

---

### Task 3: Content — SCHEMA.md, AI timeline, The Web timeline, library index

The content below ports the prototype's validated copy, adding ids, ISO dates, sources, and two cross-timeline links. `\n` escapes are required inside JSON strings.

**Files:**
- Create: `SCHEMA.md`, `timelines/artificial-intelligence.json`, `timelines/the-web.json`, `timelines/index.json`

- [ ] **Step 1: Create SCHEMA.md**

````markdown
# Timeline content schema

One JSON file per timeline in `timelines/`. This file is the authoring guide for humans **and** LLMs —
paste it into any model along with "write me a timeline about X" and it will produce a valid file.
It is also the contract the future read API / MCP server serves unchanged.

## Timeline file

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | string | yes | kebab-case, must equal the filename without `.json` |
| `title` | string | yes | display name |
| `tagline` | string | yes | one sentence shown under the title |
| `updated` | string | yes | `YYYY-MM-DD` |
| `events` | Event[] | yes | at least one; chronological order |

## Event

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | string | yes | kebab-case, unique among its siblings; becomes a URL segment |
| `date` | string | yes | `YYYY` or `YYYY-MM` or `YYYY-MM-DD` (sortable precision) |
| `display` | string | no | human date override, e.g. `"Nov 2022"`; derived from `date` if absent |
| `title` | string | yes | short event name (also the wiki-link target) |
| `tagline` | string | no | one line shown on the timeline row |
| `major` | boolean | no | emphasized title; default `false` |
| `content` | string | no | markdown (see below) |
| `sources` | {title,url}[] | no | citations; `url` must start with `http` |
| `children` | Event[] | no | the timeline *inside* this event — same shape, any depth |

## Markdown subset in `content`

Paragraphs (blank-line separated), `## h2`, `### h3`, `**bold**`, `*italic*`, `` `code` ``,
`- ` lists, `> ` blockquotes, `[label](https://…)` external links, and wiki links:

- `[[Event Title]]` — links to the event with that title in the *same* timeline (case-insensitive).
- `[[Event Title|shown label]]` — same, custom label.
- `[[timeline-id/event-id/…|label]]` — cross-timeline link by id path, e.g. `[[the-web/www-proposal|the Web]]`.

Unresolvable wiki links render as plain text (the site never shows a broken link),
but `npm run validate` treats them as errors so content stays honest.

## Library manifest — timelines/index.json

```json
{ "timelines": [
  { "id": "artificial-intelligence", "title": "Artificial Intelligence",
    "tagline": "…", "eventCount": 26, "updated": "2026-06-12" }
] }
```

`eventCount` = total events at every depth. `npm run validate` recomputes and enforces it.
````

- [ ] **Step 2: Create timelines/artificial-intelligence.json**

```json
{
  "id": "artificial-intelligence",
  "title": "Artificial Intelligence",
  "tagline": "From a 1950 thought experiment to machines that act on our behalf — the whole story, layer by layer.",
  "updated": "2026-06-12",
  "events": [
    {
      "id": "turing-test", "date": "1950", "title": "The Turing Test", "major": true,
      "tagline": "Can a machine make you believe it is human?",
      "content": "Alan Turing publishes **\"Computing Machinery and Intelligence\"**, opening with a question he immediately replaces with a sharper one:\n\n> \"I propose to consider the question, 'Can machines think?' … replaced by the imitation game.\"\n\nInstead of arguing about definitions of *thinking*, Turing proposes a test: if a machine can hold a conversation indistinguishable from a human's, the philosophical question stops mattering.\n\n## Why it matters\n- It reframes intelligence as **behavior**, not mechanism — a move the whole field inherits.\n- Nearly every chatbot debate since, including the reaction to [[ChatGPT]], replays this argument.\n- It set a benchmark culture: AI progress would be measured by tests and games for decades.",
      "sources": [
        { "title": "Computing Machinery and Intelligence (Mind, 1950)", "url": "https://academic.oup.com/mind/article/LIX/236/433/986238" },
        { "title": "Turing test — Wikipedia", "url": "https://en.wikipedia.org/wiki/Turing_test" }
      ]
    },
    {
      "id": "ai-is-coined", "date": "1956", "title": "\"AI\" is coined", "major": true,
      "tagline": "A summer workshop gives the field its name.",
      "content": "At the **Dartmouth Summer Research Project**, John McCarthy — with Marvin Minsky, Claude Shannon and Nathaniel Rochester — coins the term **artificial intelligence** in the funding proposal:\n\n> \"Every aspect of learning or any other feature of intelligence can in principle be so precisely described that a machine can be made to simulate it.\"\n\nTen researchers spend the summer at Dartmouth College sketching how machines might use language, form abstractions, and improve themselves.\n\n## Why it matters\n- The name itself was a **bet**: that intelligence is describable, hence computable. Compare [[The Turing Test]] — behavior over mechanism.\n- It created a *field* with an identity, funding story, and research agenda.\n- Most of the founders believed human-level AI was a generation away. The over-promise → disappointment → \"AI winter\" cycle starts here.",
      "sources": [
        { "title": "Dartmouth workshop — Wikipedia", "url": "https://en.wikipedia.org/wiki/Dartmouth_workshop" }
      ]
    },
    {
      "id": "deep-blue", "date": "1997-05-11", "display": "1997", "title": "Deep Blue",
      "tagline": "A machine defeats the world chess champion.",
      "content": "IBM's **Deep Blue** beats Garry Kasparov 3½–2½ — the first defeat of a reigning world champion by a machine under tournament conditions.\n\nDeep Blue evaluated roughly **200 million positions per second**. It didn't *understand* chess; it searched it. That distinction — brute search versus learned intuition — frames the next era: when [[AlexNet]] arrives, the balance tips from hand-built search toward learning.\n\n## Why it matters\n- First mainstream proof that a machine could beat the best human at a \"thinking\" task.\n- Cemented the pattern of **games as milestones** (checkers → chess → Go → StarCraft).",
      "sources": [
        { "title": "IBM — Deep Blue history", "url": "https://www.ibm.com/history/deep-blue" }
      ]
    },
    {
      "id": "alexnet", "date": "2012-09-30", "display": "2012", "title": "AlexNet", "major": true,
      "tagline": "Deep learning wins, and everything changes.",
      "content": "A three-person team — Alex Krizhevsky, Ilya Sutskever, Geoffrey Hinton — enters a deep **convolutional neural network** into the ImageNet competition and wins by an unheard-of margin (15.3% error vs 26.2% for second place).\n\nThe recipe: a decades-old idea (neural nets), two new ingredients (**GPUs** + huge labeled datasets scraped from [[the-web/www-proposal|the Web]]), and the conviction to scale it.\n\n## Why it matters\n- Overnight, \"neural networks\" went from unfashionable to *the* method.\n- The scaling lesson — more data, more compute, better results — leads directly to [[Transformers]] and ultimately [[ChatGPT]].\n- Two of the three authors go on to found or lead the labs of the LLM era.",
      "sources": [
        { "title": "ImageNet Classification with Deep CNNs (NeurIPS 2012)", "url": "https://papers.nips.cc/paper_files/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html" }
      ]
    },
    {
      "id": "transformers", "date": "2017-06-12", "display": "2017", "title": "Transformers", "major": true,
      "tagline": "The architecture behind everything modern.",
      "content": "Eight Google researchers publish **\"Attention Is All You Need\"**, introducing the *Transformer* — an architecture that drops recurrence entirely and relies on **self-attention**: every token can directly look at every other token.\n\n## Why it matters\n- It parallelizes beautifully on GPUs → training can scale to internet-sized data.\n- It is the **\"T\" in GPT**. Every modern large language model, including [[ChatGPT]], is a descendant.\n- Its children conquered not just text but images ([[Vision Transformer]]), audio, code and biology.\n\n*Open this event's timeline to follow the lineage in detail.*",
      "sources": [
        { "title": "Attention Is All You Need (arXiv:1706.03762)", "url": "https://arxiv.org/abs/1706.03762" }
      ],
      "children": [
        {
          "id": "attention-paper", "date": "2017-06-12", "display": "Jun 2017", "title": "Attention Is All You Need", "major": true,
          "tagline": "The paper itself.",
          "content": "The paper that started it: attention layers + feed-forward blocks, no recurrence, trained on translation. Its famous title was a half-joke that became the most-cited sentence in modern AI.",
          "sources": [ { "title": "arXiv:1706.03762", "url": "https://arxiv.org/abs/1706.03762" } ]
        },
        {
          "id": "bert", "date": "2018-10-11", "display": "Oct 2018", "title": "BERT",
          "tagline": "Bidirectional pretraining conquers understanding tasks.",
          "content": "Google's **BERT** pretrains a Transformer on masked-word prediction over Wikipedia, then fine-tunes it for any task. It tops 11 benchmarks at once and powers Google Search within a year — the first mass deployment of Transformer language understanding.",
          "sources": [ { "title": "arXiv:1810.04805", "url": "https://arxiv.org/abs/1810.04805" } ]
        },
        {
          "id": "gpt-1", "date": "2018-06-11", "display": "Jun 2018", "title": "GPT-1",
          "tagline": "OpenAI bets on generative pretraining.",
          "content": "OpenAI's **GPT-1** takes the opposite bet from BERT: predict the *next* token, generatively, and scale it. At 117M parameters it is modest — but the line GPT-1 → GPT-2 → GPT-3 → [[ChatGPT]] is a straight application of the same recipe at growing scale."
        },
        {
          "id": "vision-transformer", "date": "2020-10-22", "display": "Oct 2020", "title": "Vision Transformer",
          "tagline": "Attention eats computer vision too.",
          "content": "**ViT** splits an image into patches and feeds them to a standard Transformer — no convolutions. Given enough data it beats the best CNNs, proving the architecture is general-purpose. This is the lineage behind GPT-4's image understanding ([[GPT-4V]]).",
          "sources": [ { "title": "arXiv:2010.11929", "url": "https://arxiv.org/abs/2010.11929" } ]
        }
      ]
    },
    {
      "id": "chatgpt", "date": "2022-11-30", "display": "2022", "title": "ChatGPT", "major": true,
      "tagline": "AI goes mainstream: 100M users in two months.",
      "content": "On **November 30, 2022**, OpenAI releases a \"research preview\" of a chatbot built on GPT-3.5. It reaches **1 million users in 5 days** and ~100 million in two months — the fastest-growing consumer product in history at the time.\n\n## What actually shipped\nUnder the hood it was not a new model but a new *interface*: a [[Transformers]]-based LLM fine-tuned with **RLHF** (reinforcement learning from human feedback) to follow instructions, wrapped in a plain chat box anyone could use.\n\n## Why it matters\n- It moved AI from research demos into **daily life** within weeks.\n- It triggered the industry pivot: Google declared \"code red\", Microsoft invested $10B in OpenAI, and every major lab reoriented around LLMs.\n- It restarted the [[The Turing Test]] debate in public, at dinner-table scale.\n- Its rapid version history — see [[GPT-4]] — became the cadence the whole industry marches to.\n\n*Open this event's timeline for the version-by-version story.*",
      "sources": [
        { "title": "Introducing ChatGPT — OpenAI", "url": "https://openai.com/blog/chatgpt" }
      ],
      "children": [
        {
          "id": "gpt-3-5", "date": "2022-11-30", "display": "Nov 2022", "title": "GPT-3.5", "major": true,
          "tagline": "The launch model.",
          "content": "The model behind the original launch — GPT-3 refined with instruction-following and RLHF. Free, fast, and good *enough* to astonish: the gap between \"research curiosity\" and \"useful assistant\" closed here."
        },
        {
          "id": "gpt-4", "date": "2023-03-14", "display": "Mar 2023", "title": "GPT-4", "major": true,
          "tagline": "The capability jump.",
          "content": "**GPT-4** lands four months after launch and resets expectations: top-decile scores on the bar exam, strong code generation, far fewer hallucinations, and (later) the ability to see images.\n\nIt also begins the *productization* era — system prompts, function calling, longer context — the raw material that [[GPT-4 Turbo]] and [[DevDay 2023]] turn into a platform.\n\n*This event has its own timeline — open it to follow GPT-4's evolution.*",
          "sources": [
            { "title": "GPT-4 Technical Report (arXiv:2303.08774)", "url": "https://arxiv.org/abs/2303.08774" }
          ],
          "children": [
            {
              "id": "gpt-4-launch", "date": "2023-03-14", "display": "Mar 2023", "title": "GPT-4 launch", "major": true,
              "tagline": "Top-decile bar exam, multimodal teased.",
              "content": "Launched March 14, 2023 alongside a technical report famous for what it *didn't* say — no parameter count, no architecture details. The era of competitive secrecy begins."
            },
            {
              "id": "gpt-4v", "date": "2023-09-25", "display": "Sep 2023", "title": "GPT-4V",
              "tagline": "The model gets eyes.",
              "content": "GPT-4 with vision rolls out: screenshots, charts, photos, handwriting. The conceptual ancestor is the [[Vision Transformer]] — patches in, tokens out, one architecture for everything."
            },
            {
              "id": "gpt-4-turbo", "date": "2023-11-06", "display": "Nov 2023", "title": "GPT-4 Turbo", "major": true,
              "tagline": "Cheaper, faster, 128K context.",
              "content": "Announced at OpenAI's first developer conference: a faster GPT-4 at a third of the price with a **128K-token context window** — entire books in a single prompt.\n\nThe platform story matters as much as the model — see [[DevDay 2023]] for what shipped around it.",
              "children": [
                {
                  "id": "devday-2023", "date": "2023-11-06", "display": "Nov 6, 2023", "title": "DevDay 2023", "major": true,
                  "tagline": "OpenAI's first developer conference.",
                  "content": "OpenAI's first DevDay packs a year of platform strategy into one keynote. The theme: GPT-4 stops being a chatbot and becomes **infrastructure**.\n\n*Open this event's timeline for the announcements, one by one.*",
                  "sources": [
                    { "title": "New models and developer products announced at DevDay — OpenAI", "url": "https://openai.com/blog/new-models-and-developer-products-announced-at-devday" }
                  ],
                  "children": [
                    {
                      "id": "context-128k", "date": "2023-11-06", "display": "Keynote", "title": "128K context window", "major": true,
                      "tagline": "Books-length prompts.",
                      "content": "Context jumps from 8K to **128K tokens** — about 300 pages. Whole codebases and contracts fit in one prompt, unlocking retrieval-light workflows."
                    },
                    {
                      "id": "custom-gpts", "date": "2023-11-06", "display": "Keynote", "title": "Custom GPTs",
                      "tagline": "Everyone can publish an assistant.",
                      "content": "Anyone can package instructions + files + tools into a shareable **GPT** — no code. The first mass-market experiment in personalized agents, and a precursor of [[The age of agents]]."
                    },
                    {
                      "id": "price-cuts", "date": "2023-11-06", "display": "Keynote", "title": "Price cuts",
                      "tagline": "3× cheaper input tokens.",
                      "content": "GPT-4 Turbo input tokens priced ~3× lower than GPT-4. The cost curve of intelligence keeps falling — the quiet enabler of every AI product business model."
                    }
                  ]
                },
                {
                  "id": "turbo-2024-04", "date": "2024-04-09", "display": "Apr 2024", "title": "Turbo 2024-04-09",
                  "tagline": "The refresh.",
                  "content": "A refreshed Turbo with vision built in and majorly improved instruction-following — the workhorse model until GPT-4o replaces it a month later."
                }
              ]
            },
            {
              "id": "gpt-4o", "date": "2024-05-13", "display": "May 2024", "title": "GPT-4o",
              "tagline": "Natively multimodal, realtime.",
              "content": "\"o\" for *omni*: one network handles text, vision and **realtime voice** with ~300ms latency — conversation at human speed. The assistant stops feeling like a terminal and starts feeling like a presence.",
              "sources": [ { "title": "Hello GPT-4o — OpenAI", "url": "https://openai.com/index/hello-gpt-4o/" } ]
            }
          ]
        },
        {
          "id": "reasoning-models", "date": "2025", "title": "Reasoning models", "major": true,
          "tagline": "Models that think before they answer.",
          "content": "The o-series and successors introduce **test-time reasoning**: the model deliberates in a hidden chain of thought before answering. Math, code and science benchmarks jump again — and the technique spreads industry-wide within months, feeding directly into [[The age of agents]]."
        }
      ]
    },
    {
      "id": "age-of-agents", "date": "2025", "title": "The age of agents", "major": true,
      "tagline": "From answering to acting.",
      "content": "The frontier shifts from *chat* to *action*: models that plan multi-step work, call tools, browse, write and run code, and operate computers — checked on by humans rather than driven by them.\n\n## Why it matters\n- The unit of value moves from \"a good answer\" to **\"a finished task.\"**\n- Interfaces invert: instead of you visiting [[ChatGPT]], agents visit your tools.\n- Built on two prior layers: [[Transformers]] for capability, [[Reasoning models]] for reliability.\n\n*Open the timeline to see the building blocks land.*",
      "children": [
        {
          "id": "tool-use", "date": "2024", "title": "Tool use matures",
          "tagline": "Function calling becomes standard.",
          "content": "Structured tool calling becomes a first-class capability across every major model — the hands that reasoning needed."
        },
        {
          "id": "computer-use", "date": "2025", "title": "Computer use",
          "tagline": "Models operate real software.",
          "content": "Models learn to drive real GUIs — clicking, typing, reading screens — turning any software into an API."
        },
        {
          "id": "multi-agent", "date": "2025", "title": "Multi-agent teams",
          "tagline": "Agents that delegate to agents.",
          "content": "Orchestrators spawn specialist sub-agents that research, write and review in parallel. Workflows start to look like *org charts*."
        }
      ]
    }
  ]
}
```

- [ ] **Step 3: Create timelines/the-web.json**

```json
{
  "id": "the-web",
  "title": "The Web",
  "tagline": "How a physics lab's filing problem became humanity's nervous system.",
  "updated": "2026-06-12",
  "events": [
    {
      "id": "arpanet", "date": "1969-10-29", "display": "1969", "title": "ARPANET", "major": true,
      "tagline": "The first packet-switched network goes live.",
      "content": "UCLA and Stanford exchange the first ARPANET message — intended to be *LOGIN*, it crashes after **\"LO\"**. Packet switching works, and the network that will become the Internet is born.",
      "sources": [ { "title": "ARPANET — Wikipedia", "url": "https://en.wikipedia.org/wiki/ARPANET" } ]
    },
    {
      "id": "email", "date": "1971", "title": "Email",
      "tagline": "The @ sign gets its job.",
      "content": "Ray Tomlinson sends the first networked email and picks **@** to separate user from machine. The network's first killer app — decades before the Web itself."
    },
    {
      "id": "tcp-ip", "date": "1983-01-01", "display": "1983", "title": "TCP/IP",
      "tagline": "One protocol to connect all networks.",
      "content": "ARPANET switches to **TCP/IP** on \"flag day\". Networks of networks can now interoperate — this is the moment *the* Internet, lowercase networks becoming one capital-I system, exists."
    },
    {
      "id": "www-proposal", "date": "1989-03-12", "display": "1989", "title": "The Web is proposed", "major": true,
      "tagline": "Tim Berners-Lee's memo: \"vague, but exciting.\"",
      "content": "At CERN, Tim Berners-Lee writes **\"Information Management: A Proposal\"** — hypertext documents, addressed by URL, fetched over the network. His boss scribbles *\"vague, but exciting\"* on the cover.\n\n*Open this event's timeline for the birth steps.*",
      "sources": [ { "title": "The original proposal (w3.org)", "url": "https://www.w3.org/History/1989/proposal.html" } ],
      "children": [
        {
          "id": "first-browser", "date": "1990-12-25", "display": "1990", "title": "First browser & server", "major": true,
          "tagline": "WorldWideWeb on a NeXT cube.",
          "content": "Berners-Lee writes the first browser/editor (*WorldWideWeb*) and the first server (*httpd*) on a NeXT machine over Christmas 1990. The whole Web runs on one desk."
        },
        {
          "id": "public-web", "date": "1991-08-06", "display": "1991", "title": "The Web goes public",
          "tagline": "The first website explains itself.",
          "content": "The project is announced publicly; `info.cern.ch` serves the first website — a page explaining what the World Wide Web is and how to join it."
        },
        {
          "id": "w3c", "date": "1994-10-01", "display": "1994", "title": "W3C founded",
          "tagline": "The Web gets a steward, not an owner.",
          "content": "Berners-Lee founds the **World Wide Web Consortium** at MIT and CERN agrees to release the Web's code royalty-free — the decision that kept the Web open."
        }
      ]
    },
    {
      "id": "mosaic", "date": "1993-04-22", "display": "1993", "title": "Mosaic", "major": true,
      "tagline": "The browser that showed images — and everyone the point.",
      "content": "NCSA **Mosaic** puts images inline with text and installs in minutes. The Web's population explodes from thousands to millions; its authors go on to found Netscape.",
      "sources": [ { "title": "Mosaic — Wikipedia", "url": "https://en.wikipedia.org/wiki/Mosaic_(web_browser)" } ]
    },
    {
      "id": "google", "date": "1998-09-04", "display": "1998", "title": "Google", "major": true,
      "tagline": "Search makes the Web usable; ads make it an economy.",
      "content": "Two Stanford students rank pages by their *links* (PageRank), and suddenly the exploding Web is navigable. The data and infrastructure born here later feed the deep-learning era — see [[artificial-intelligence/transformers|Transformers]], invented at Google.",
      "sources": [ { "title": "History of Google — Wikipedia", "url": "https://en.wikipedia.org/wiki/History_of_Google" } ]
    },
    {
      "id": "social-web", "date": "2004", "title": "The social Web",
      "tagline": "The Web learns who you are.",
      "content": "Facebook (2004), YouTube (2005), Twitter (2006): the Web's content becomes *us*. Attention becomes the commodity — and the training data this era produces later teaches machines to talk."
    }
  ]
}
```

- [ ] **Step 4: Create timelines/index.json**

```json
{
  "timelines": [
    {
      "id": "artificial-intelligence",
      "title": "Artificial Intelligence",
      "tagline": "From a 1950 thought experiment to machines that act on our behalf — the whole story, layer by layer.",
      "eventCount": 26,
      "updated": "2026-06-12"
    },
    {
      "id": "the-web",
      "title": "The Web",
      "tagline": "How a physics lab's filing problem became humanity's nervous system.",
      "eventCount": 10,
      "updated": "2026-06-12"
    }
  ]
}
```

- [ ] **Step 5: Smoke-check the JSON parses**

Run: `node -e "['index','artificial-intelligence','the-web'].forEach(f=>JSON.parse(require('fs').readFileSync('timelines/'+f+'.json','utf8'))); console.log('parse ok')"`
Expected: `parse ok`

- [ ] **Step 6: Commit**

```bash
git add SCHEMA.md timelines/
git commit -m "feat: add content schema, AI and Web timelines, library index"
```

---

### Task 4: tools/validate.js (TDD)

**Files:**
- Test: `tests/validate.test.js`
- Create: `tools/validate.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTimeline, validateIndex } from '../tools/validate.js';

const good = { id:'t', title:'T', tagline:'x', updated:'2026-06-12', events:[
  { id:'a', date:'1990', title:'A' },
  { id:'b', date:'1991-05', title:'B', children:[ { id:'c', date:'1991-05-02', title:'C' } ] }
]};

test('valid timeline has no errors', () => {
  assert.deepEqual(validateTimeline(good, 't'), []);
});

test('id must match filename', () => {
  assert.ok(validateTimeline(good, 'other').some(e => e.includes('id')));
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../tools/validate.js'`

- [ ] **Step 3: Write tools/validate.js**

```js
// Content validator. Library use: import { validateTimeline, validateIndex }.
// CLI use: `node tools/validate.js` — validates everything in timelines/.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE  = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const DAY   = /^\d{4}-\d{2}-\d{2}$/;
const WIKI  = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

function walk(events, fn, path=[]) {
  for (const ev of events || []) { fn(ev, path); if (ev.children) walk(ev.children, fn, [...path, ev.id]); }
}

export function countEvents(tl) { let n = 0; walk(tl.events, () => n++); return n; }

export function validateTimeline(tl, fileId) {
  const errs = [];
  const at = (p, id) => [...p, id].join('/');
  if (tl.id !== fileId) errs.push(`id "${tl.id}" must match filename "${fileId}"`);
  if (!KEBAB.test(tl.id || '')) errs.push(`id "${tl.id}" must be kebab-case`);
  for (const f of ['title','tagline']) if (typeof tl[f] !== 'string' || !tl[f]) errs.push(`missing ${f}`);
  if (!DAY.test(tl.updated || '')) errs.push(`updated "${tl.updated}" must be YYYY-MM-DD`);
  if (!Array.isArray(tl.events) || tl.events.length === 0) { errs.push('events must be a non-empty array'); return errs; }

  const titles = new Set();
  walk(tl.events, ev => titles.add((ev.title || '').toLowerCase()));
  const byPath = new Map();
  walk(tl.events, (ev, p) => byPath.set(at(p, ev.id), ev));

  const checkLevel = (events, p) => {
    const seen = new Set();
    for (const ev of events) {
      const here = at(p, ev.id);
      if (!KEBAB.test(ev.id || '')) errs.push(`${here}: id must be kebab-case`);
      if (seen.has(ev.id)) errs.push(`${here}: duplicate sibling id`);
      seen.add(ev.id);
      if (!DATE.test(ev.date || '')) errs.push(`${here}: date "${ev.date}" must be YYYY[-MM[-DD]]`);
      if (typeof ev.title !== 'string' || !ev.title) errs.push(`${here}: missing title`);
      if (ev.children !== undefined && (!Array.isArray(ev.children) || ev.children.length === 0))
        errs.push(`${here}: children must be a non-empty array when present`);
      if (ev.sources !== undefined) {
        if (!Array.isArray(ev.sources)) errs.push(`${here}: sources must be an array`);
        else for (const s of ev.sources)
          if (!s || typeof s.title !== 'string' || typeof s.url !== 'string' || !s.url.startsWith('http'))
            errs.push(`${here}: each source needs title and http(s) url`);
      }
      if (ev.children) checkLevel(ev.children, [...p, ev.id]);
    }
  };
  checkLevel(tl.events, []);

  walk(tl.events, (ev, p) => {
    for (const m of (ev.content || '').matchAll(WIKI)) {
      const target = m[1].trim();
      if (target.includes('/')) continue;            // cross-timeline: checked by CLI against real files
      if (!titles.has(target.toLowerCase())) errs.push(`${at(p, ev.id)}: wiki link [[${target}]] resolves to no title`);
    }
  });
  return errs;
}

export function validateIndex(index, timelinesById) {
  const errs = [];
  if (!Array.isArray(index.timelines)) return ['index.json: timelines must be an array'];
  for (const entry of index.timelines) {
    const tl = timelinesById[entry.id];
    if (!tl) { errs.push(`index.json: no file for "${entry.id}"`); continue; }
    const n = countEvents(tl);
    if (entry.eventCount !== n) errs.push(`index.json: ${entry.id} eventCount ${entry.eventCount} != actual ${n}`);
    if (entry.updated !== tl.updated) errs.push(`index.json: ${entry.id} updated mismatch`);
    if (entry.title !== tl.title) errs.push(`index.json: ${entry.id} title mismatch`);
  }
  const listed = new Set(index.timelines.map(t => t.id));
  for (const id of Object.keys(timelinesById)) if (!listed.has(id)) errs.push(`index.json: "${id}" exists but is not listed`);
  return errs;
}

function resolveCross(target, timelinesById) {
  const [tlId, ...segs] = target.split('/').filter(Boolean);
  const tl = timelinesById[tlId];
  if (!tl) return false;
  let nodes = tl.events;
  for (const seg of segs) {
    const hit = (nodes || []).find(e => e.id === seg);
    if (!hit) return false;
    nodes = hit.children;
  }
  return true;
}

// ---- CLI ----
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = new URL('../timelines/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json');
  const timelinesById = {};
  let errs = [];
  for (const f of files) {
    const id = f.replace(/\.json$/, '');
    try { timelinesById[id] = JSON.parse(readFileSync(new URL(f, dir), 'utf8')); }
    catch (e) { errs.push(`${f}: invalid JSON — ${e.message}`); }
  }
  for (const [id, tl] of Object.entries(timelinesById)) errs.push(...validateTimeline(tl, id).map(e => `${id}: ${e}`));
  for (const [id, tl] of Object.entries(timelinesById))
    walk(tl.events, (ev, p) => {
      for (const m of (ev.content || '').matchAll(WIKI)) {
        const t = m[1].trim();
        if (t.includes('/') && !resolveCross(t, timelinesById))
          errs.push(`${id}: ${[...p, ev.id].join('/')}: cross-timeline link [[${t}]] does not resolve`);
      }
    });
  try {
    const index = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
    errs.push(...validateIndex(index, timelinesById));
  } catch (e) { errs.push(`index.json: invalid JSON — ${e.message}`); }
  if (errs.length) { console.error(errs.map(e => '✗ ' + e).join('\n')); process.exit(1); }
  console.log(`✓ ${files.length} timeline(s) valid`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (6 tests)

- [ ] **Step 5: Validate the real content**

Run: `npm run validate`
Expected: `✓ 2 timeline(s) valid`. If it reports errors (typo'd wiki target, wrong eventCount), fix the content files — the validator is the source of truth.

- [ ] **Step 6: Commit**

```bash
git add tools/validate.js tests/validate.test.js
git commit -m "feat: content validator with schema, wiki-link and index checks (TDD)"
```

---

### Task 5: js/markdown.js (TDD)

**Files:**
- Test: `tests/markdown.test.js`
- Create: `js/markdown.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/markdown.js'`

- [ ] **Step 3: Write js/markdown.js** (port of the prototype renderer with the resolver injected)

```js
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function wikiLink(target, label, resolveWiki){
  target = target.trim();
  if (!resolveWiki(target)) return esc(label.trim());
  return '<a class="wl" data-wiki="' + esc(target) + '">' + esc(label.trim()) + '</a>';
}

function inline(s, resolveWiki){
  // placeholders keep later passes from re-processing link internals
  const slots = [];
  const stash = html => { slots.push(html); return ' ' + (slots.length - 1) + ' '; };
  s = s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (m,t,l) => stash(wikiLink(t, l, resolveWiki)));
  s = s.replace(/\[\[([^\]]+)\]\]/g,            (m,t)   => stash(wikiLink(t, t, resolveWiki)));
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,     (m,l,u) => stash('<a class="ext" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(l) + '</a>'));
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s.replace(/ (\d+) /g, (m,i) => slots[+i]);
}

export function mdToHtml(md, resolveWiki){
  const lines = (md || '').trim().split('\n');
  let out = '', para = [], list = null, quote = null;
  const flushP = () => { if (para.length){ out += '<p>' + inline(para.join(' '), resolveWiki) + '</p>'; para = []; } };
  const flushL = () => { if (list){ out += '<ul>' + list.map(i => '<li>' + inline(i, resolveWiki) + '</li>').join('') + '</ul>'; list = null; } };
  const flushQ = () => { if (quote){ out += '<blockquote>' + inline(quote.join(' '), resolveWiki) + '</blockquote>'; quote = null; } };
  for (const raw of lines){
    const l = raw.trim();
    if (!l){ flushP(); flushL(); flushQ(); continue; }
    if (l.startsWith('### '))      { flushP(); flushL(); flushQ(); out += '<h3>' + inline(l.slice(4), resolveWiki) + '</h3>'; }
    else if (l.startsWith('## ')) { flushP(); flushL(); flushQ(); out += '<h2>' + inline(l.slice(3), resolveWiki) + '</h2>'; }
    else if (l.startsWith('- '))  { flushP(); flushQ(); (list = list || []).push(l.slice(2)); }
    else if (l.startsWith('> '))  { flushP(); flushL(); (quote = quote || []).push(l.slice(2)); }
    else para.push(l);
  }
  flushP(); flushL(); flushQ();
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all markdown + validate tests)

- [ ] **Step 5: Commit**

```bash
git add js/markdown.js tests/markdown.test.js
git commit -m "feat: markdown renderer with injected wiki-link resolver (TDD)"
```

---

### Task 6: js/router.js (TDD)

**Files:**
- Test: `tests/router.test.js`
- Create: `js/router.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/router.js'`

- [ ] **Step 3: Write js/router.js**

```js
export function parseHash(hash){
  const segs = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  if (segs[0] === 't' && segs[1]) return { view:'timeline', id:segs[1], path:segs.slice(2) };
  return { view:'library' };
}
export function buildTimelineHash(id, pathIds){ return '#/t/' + [id, ...(pathIds || [])].join('/'); }
export function buildLibraryHash(){ return '#/'; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` → Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/router.js tests/router.test.js
git commit -m "feat: hash router (TDD)"
```

---

### Task 7: js/data.js (TDD for pure helpers)

**Files:**
- Test: `tests/data.test.js`
- Create: `js/data.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { indexTimeline, resolvePath, displayDate, getRead, markRead } from '../js/data.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` → Expected: FAIL — `Cannot find module '.../js/data.js'`

- [ ] **Step 3: Write js/data.js**

```js
const cache = { index:null, timelines:new Map() };

async function fetchJson(url, notFoundCode){
  let res;
  try { res = await fetch(url); }
  catch { throw { code:'network', url }; }
  if (res.status === 404) throw { code:'notfound', url };
  if (!res.ok) throw { code:'network', url };
  try { return await res.json(); }
  catch { throw { code:'badjson', url }; }
}

export async function loadIndex(){
  if (!cache.index) cache.index = await fetchJson('timelines/index.json');
  return cache.index;
}

export async function loadTimeline(id){
  if (!cache.timelines.has(id))
    cache.timelines.set(id, await fetchJson('timelines/' + encodeURIComponent(id) + '.json'));
  return cache.timelines.get(id);
}

export function indexTimeline(tl){
  const root = { id: tl.id, title: tl.title, tagline: tl.tagline, children: tl.events,
                 isRoot: true, parent: null, pathIds: [] };
  const byTitle = new Map(), byPath = new Map();
  (function walk(node){
    for (const ch of node.children || []){
      ch.parent = node;
      ch.pathIds = [...node.pathIds, ch.id];
      byTitle.set(ch.title.toLowerCase(), ch);
      byPath.set(ch.pathIds.join('/'), ch);
      walk(ch);
    }
  })(root);
  return { root, byTitle, byPath };
}

export function resolvePath(idx, segs){
  const chain = [idx.root];
  let node = idx.root;
  for (const seg of segs || []){
    const next = (node.children || []).find(c => c.id === seg);
    if (!next) break;
    chain.push(next); node = next;
  }
  return chain;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function displayDate(ev){
  if (ev.display) return ev.display;
  const [y, m, d] = (ev.date || '').split('-');
  if (d) return `${MONTHS[+m-1]} ${+d}, ${y}`;
  if (m) return `${MONTHS[+m-1]} ${y}`;
  return y || '';
}

const readKey = id => 'timeline:read:' + id;
export function getRead(timelineId, storage = localStorage){
  try { return new Set(JSON.parse(storage.getItem(readKey(timelineId)) || '[]')); }
  catch { return new Set(); }
}
export function markRead(timelineId, pathKey, storage = localStorage){
  const set = getRead(timelineId, storage);
  set.add(pathKey);
  storage.setItem(readKey(timelineId), JSON.stringify([...set]));
  return set;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` → Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/data.js tests/data.test.js
git commit -m "feat: data loading, timeline indexing, dates, read-state (TDD)"
```

---

### Task 8: Library page + app boot

**Files:**
- Create: `js/library.js`
- Modify: `js/app.js` (replace placeholder), `css/app.css` (append)

- [ ] **Step 1: Append library + level-shell styles to css/app.css**

```css
/* ===== levels (shared shell for library + viewer) ===== */
.level{ position:absolute; inset:0; overflow:auto;
        padding:clamp(26px,3.5vh,52px) clamp(26px,4vw,80px) 70px; scrollbar-gutter:stable both-edges; }
.level-in{ max-width:1200px; margin:0 auto; }

/* ===== library ===== */
.libhead{ margin:6px 0 26px; }
.libhead h1{ font-size:clamp(30px,2.4vw + 14px,48px); font-weight:700; letter-spacing:-.028em; margin:0; }
.libhead p{ font-size:clamp(14px,.4vw + 11px,17px); color:var(--muted); margin:10px 0 0; max-width:62ch; line-height:1.6; }
.libgrid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:18px; }
.libcard{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:22px 24px;
          cursor:pointer; transition:transform .18s, box-shadow .18s, border-color .18s; }
.libcard:hover{ transform:translateY(-2px); border-color:var(--accent);
                box-shadow:0 16px 36px -20px rgba(21,21,26,.35); }
.libcard h2{ font-size:19px; font-weight:700; letter-spacing:-.015em; margin:0; }
.libcard p{ font-size:13.5px; color:var(--soft); line-height:1.55; margin:8px 0 14px; }
.libcard .meta{ font-size:11.5px; font-weight:600; color:var(--muted); display:flex; gap:14px; }
.libcard .meta b{ color:var(--accent); font-weight:700; }
```

- [ ] **Step 2: Create js/library.js**

```js
import { els } from './state.js';
import { loadIndex } from './data.js';
import { buildTimelineHash } from './router.js';

export async function renderLibrary(){
  els.rail.hidden = true;
  els.seg.hidden = true;
  const index = await loadIndex();
  const lvl = document.createElement('div');
  lvl.className = 'level';
  const inner = document.createElement('div');
  inner.className = 'level-in';
  inner.innerHTML = '<div class="libhead"><h1>Timeline</h1>' +
    '<p>Beautiful, drillable timelines. Pick a topic and see where it came from — layer by layer.</p></div>';
  const grid = document.createElement('div');
  grid.className = 'libgrid';
  for (const t of index.timelines){
    const card = document.createElement('div');
    card.className = 'libcard';
    card.innerHTML = `<h2></h2><p></p><div class="meta"><span><b>${t.eventCount}</b> moments</span><span>updated ${t.updated}</span></div>`;
    card.querySelector('h2').textContent = t.title;
    card.querySelector('p').textContent = t.tagline;
    card.onclick = () => { location.hash = buildTimelineHash(t.id, []); };
    grid.appendChild(card);
  }
  inner.appendChild(grid);
  lvl.appendChild(inner);
  els.stage.replaceChildren(lvl);
  lvl.animate([{opacity:0, transform:'translateY(8px)'},{opacity:1, transform:'none'}],
              {duration:380, easing:'cubic-bezier(.2,.7,.2,1)'});
}
```

- [ ] **Step 3: Replace js/app.js with the routing boot**

```js
import { els, state } from './state.js';
import { parseHash } from './router.js';
import { renderLibrary } from './library.js';

els.stage = document.getElementById('stage');
els.rail  = document.getElementById('rail');
els.seg   = document.getElementById('seg');

async function route(){
  const parsed = parseHash(location.hash);
  if (parsed.view === 'library') { await renderLibrary(); return; }
  // timeline view arrives in Task 9
  console.log('timeline route', parsed);
}

window.addEventListener('hashchange', route);
route();
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:8080/#/`. Expected: "Timeline" heading, two cards (Artificial Intelligence — **26** moments; The Web — **10** moments), hover lift on cards. Clicking a card changes the hash to `#/t/artificial-intelligence` and logs `timeline route …` (viewer comes next). Back button returns to the library.

- [ ] **Step 5: Commit**

```bash
git add js/library.js js/app.js css/app.css
git commit -m "feat: library page and routing boot"
```

---

### Task 9: Viewer — vertical level rendering + navigation (no morph yet)

Port the prototype's level structure. Navigation works (instant swaps); the morph lands in Task 10.

**Files:**
- Create: `js/viewer.js`
- Modify: `js/app.js`, `css/app.css` (append)

- [ ] **Step 1: Append level/event styles to css/app.css** (ported from prototype, retokenized)

```css
/* ===== level header ===== */
.crumb{ font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted);
        font-weight:700; display:flex; align-items:center; gap:8px; flex-wrap:wrap; min-height:14px; }
.crumb span.c{ cursor:pointer; transition:color .15s; }
.crumb span.c:hover{ color:var(--accent); }
.crumb .sep{ color:var(--faint); }
.titlerow{ display:flex; align-items:center; gap:18px; margin-top:16px; }
.upcirc{ all:unset; cursor:pointer; width:42px; height:42px; border-radius:50%; background:#fff;
         border:1px solid var(--line); display:flex; align-items:center; justify-content:center;
         font-size:18px; color:var(--soft); flex:0 0 auto;
         box-shadow:0 2px 8px -4px rgba(21,21,26,.18); transition:all .18s; }
.upcirc:hover{ color:var(--accent); border-color:var(--accent); transform:translateY(-1px);
               box-shadow:0 6px 16px -6px rgba(53,72,232,.45); }
.lvtitle{ font-size:clamp(30px,2.4vw + 14px,48px); font-weight:700; letter-spacing:-.028em;
          margin:0; display:inline-block; transform-origin:left top; will-change:transform; }
.lvsub{ font-size:clamp(14px,.4vw + 11px,17px); color:var(--muted); margin:10px 0 0;
        line-height:1.6; max-width:62ch; }
.lvhead{ width:100%; }
.level.h .level-in{ max-width:none; }
.level.h .lvhead{ max-width:1200px; margin:0 auto; }

/* ===== vertical events ===== */
.events{ position:relative; margin-top:clamp(26px,3.5vh,44px); padding-left:34px; }
.events::before{ content:''; position:absolute; left:7px; top:12px; bottom:12px; width:2px; background:var(--line); }
.event{ position:relative; transition:opacity .3s; }
.events.reading .event:not(.open){ opacity:.55; }
/* dot language — one meaning: read state. hollow=unread · tint=read · solid+halo=reading now */
.marker{ position:absolute; left:-32px; top:17px; width:13px; height:13px; border-radius:50%;
         background:var(--paper); border:2px solid var(--faint); transition:all .2s; z-index:1; }
.event.seen .marker{ background:var(--accent-tint); }
.event.open .marker{ background:var(--accent); border-color:var(--accent); box-shadow:0 0 0 5px var(--halo); }
.event:hover .marker{ border-color:var(--accent); transform:scale(1.2); box-shadow:0 0 0 5px rgba(53,72,232,.12); }
.event.open .row{ background:#f2f0ea; }
.event.pulse .row{ animation:pulsebg 1.4s ease; }
@keyframes pulsebg{ 0%{background:rgba(53,72,232,.14)} 100%{background:transparent} }
.row{ cursor:pointer; padding:13px 16px; border-radius:14px; transition:background .18s; }
.row:hover{ background:#f2f0ea; }
.event.focused .row{ outline:2px solid var(--accent); outline-offset:-2px; }
.yr{ font-size:clamp(11px,.3vw + 9px,12.5px); font-weight:700; letter-spacing:.06em;
     color:var(--accent); text-transform:uppercase; }
.ti{ font-size:clamp(16px,.7vw + 11px,21px); font-weight:550; margin-top:3px;
     letter-spacing:-.012em; display:inline-block; transform-origin:left top; }
.event.major .ti{ font-weight:700; }
.tag{ font-size:12.5px; color:var(--muted); margin-top:3px; }
.kids{ display:inline-flex; align-items:center; gap:6px; margin-top:10px; font-size:11.5px;
       font-weight:700; color:var(--accent); background:var(--accent-soft); padding:6px 12px;
       border-radius:99px; transition:background .15s; }
.kids:hover{ background:rgba(53,72,232,.18); }
```

- [ ] **Step 2: Create js/viewer.js**

```js
import { state, els, handlers } from './state.js';
import { loadTimeline, indexTimeline, resolvePath, displayDate, getRead, markRead } from './data.js';
import { buildTimelineHash } from './router.js';
import { renderRail } from './rail.js';

export function here(){ return state.path[state.path.length - 1]; }
const pathKey = node => node.pathIds.join('/');

/* ---------- level construction ---------- */
function buildLevel(node){
  const lvl = document.createElement('div');
  lvl.className = 'level ' + state.layout;
  const w = document.createElement('div'); w.className = 'level-in'; lvl.appendChild(w);
  const head = document.createElement('div'); head.className = 'lvhead'; w.appendChild(head);

  const crumb = document.createElement('div'); crumb.className = 'crumb';
  state.path.forEach((n, i) => {
    if (i){ const s = document.createElement('span'); s.className = 'sep'; s.textContent = '/'; crumb.appendChild(s); }
    const c = document.createElement('span'); c.textContent = n.title;
    if (i < state.path.length - 1){ c.className = 'c'; c.onclick = () => handlers.goUpTo(i); }
    crumb.appendChild(c);
  });
  head.appendChild(crumb);

  const trow = document.createElement('div'); trow.className = 'titlerow';
  if (state.path.length > 1){
    const up = document.createElement('button'); up.className = 'upcirc';
    up.innerHTML = '↑'; up.title = 'Up to ' + state.path[state.path.length - 2].title + ' (Esc)';
    up.onclick = () => handlers.goUpTo(state.path.length - 2);
    trow.appendChild(up);
  }
  const h1 = document.createElement('h1'); h1.className = 'lvtitle'; h1.textContent = node.title;
  trow.appendChild(h1);
  head.appendChild(trow);
  const sub = document.createElement('p'); sub.className = 'lvsub'; sub.textContent = node.tagline || '';
  head.appendChild(sub);

  w.appendChild(state.layout === 'v' ? buildVertical(node) : buildHorizontal(node));
  return lvl;
}

function buildVertical(node){
  const read = getRead(state.timelineId);
  const evs = document.createElement('div'); evs.className = 'events';
  for (const ch of node.children || []){
    const ev = document.createElement('div');
    ev.className = 'event' + (ch.major ? ' major' : '') + (read.has(pathKey(ch)) ? ' seen' : '');
    ev.__node = ch;
    const mk = document.createElement('div'); mk.className = 'marker';
    const row = document.createElement('div'); row.className = 'row';
    const yr = document.createElement('div'); yr.className = 'yr'; yr.textContent = displayDate(ch);
    const ti = document.createElement('div'); ti.className = 'ti'; ti.textContent = ch.title;
    row.appendChild(yr); row.appendChild(ti);
    if (ch.tagline){ const tg = document.createElement('div'); tg.className = 'tag'; tg.textContent = ch.tagline; row.appendChild(tg); }
    if (ch.children){
      const pill = document.createElement('span'); pill.className = 'kids';
      pill.textContent = '▸ ' + ch.children.length + ' moments inside';
      pill.onclick = e => { e.stopPropagation(); handlers.drill(ch, ti); };
      row.appendChild(document.createElement('br')); row.appendChild(pill);
    }
    row.onclick = () => handlers.openReader(ch, ev);
    ev.appendChild(mk); ev.appendChild(row);
    evs.appendChild(ev);
  }
  return evs;
}

function buildHorizontal(node){            // full implementation in Task 13
  return buildVertical(node);
}

/* ---------- render & navigation ---------- */
export function renderCurrent(){
  const inc = buildLevel(here());
  els.stage.querySelectorAll('.level').forEach(l => l.remove());
  els.stage.appendChild(inc);
  state.cur = inc;
  state.sel = -1;
  renderRail();
}

export async function renderTimelineRoute(parsed){
  if (state.timelineId !== parsed.id){
    const tl = await loadTimeline(parsed.id);     // throws {code} — handled by app.js
    state.timelineId = parsed.id;
    state.idx = indexTimeline(tl);
  }
  els.rail.hidden = false;
  els.seg.hidden = false;
  const chain = resolvePath(state.idx, parsed.path);
  if (chain.length - 1 !== parsed.path.length){   // unknown tail — normalize URL to deepest valid
    history.replaceState(null, '', buildTimelineHash(parsed.id, chain.slice(1).map(n => n.id)));
  }
  state.path = chain;
  renderCurrent();                                 // morph replaces this in Task 10
}

/* ---------- handler wiring (instant versions; Task 10 adds morphs) ---------- */
handlers.drill = (node, fromEl) => {
  if (state.busy || !node.children) return;
  handlers.closeReader?.();
  location.hash = buildTimelineHash(state.timelineId, node.pathIds);
};
handlers.goUpTo = (i) => {
  if (state.busy || i >= state.path.length - 1) return;
  handlers.closeReader?.();
  location.hash = buildTimelineHash(state.timelineId, state.path[i].pathIds);
};
handlers.focusChild = (node) => {
  let evEl = null;
  state.cur.querySelectorAll('.event').forEach(e => { if (e.__node === node) evEl = e; });
  if (!evEl) return;
  evEl.scrollIntoView({ behavior:'smooth',
    block: state.layout === 'v' ? 'center' : 'nearest',
    inline: state.layout === 'h' ? 'center' : 'nearest' });
  evEl.classList.add('pulse'); setTimeout(() => evEl.classList.remove('pulse'), 1500);
  handlers.openReader(node, evEl);
};
handlers.markSeen = (node, evEl) => {
  markRead(state.timelineId, pathKey(node));
  if (evEl) evEl.classList.add('seen');
  renderRail();
};
```

- [ ] **Step 3: Wire the timeline route in js/app.js** (replace the file)

```js
import { els, state } from './state.js';
import { parseHash } from './router.js';
import { renderLibrary } from './library.js';
import { renderTimelineRoute } from './viewer.js';
import { buildLibraryHash } from './router.js';

els.stage = document.getElementById('stage');
els.rail  = document.getElementById('rail');
els.seg   = document.getElementById('seg');

function errorCard(err){
  const msg = err.code === 'notfound' ? 'That timeline doesn’t exist.'
            : err.code === 'badjson'  ? 'This timeline’s data file is malformed.'
            : 'Couldn’t load data — are you offline?';
  els.stage.innerHTML =
    '<div class="level"><div class="level-in"><div class="errcard">' +
    '<h2>Hmm.</h2><p>' + msg + '</p>' +
    '<a href="' + buildLibraryHash() + '">← Back to the library</a></div></div></div>';
  console.error(err);
}

async function route(){
  const parsed = parseHash(location.hash);
  try {
    if (parsed.view === 'library') await renderLibrary();
    else await renderTimelineRoute(parsed);
  } catch (err) { errorCard(err); }
}

window.addEventListener('hashchange', route);
route();
```

- [ ] **Step 4: Create a placeholder js/rail.js and js/panel.js so imports resolve** (full versions in Tasks 11–12)

`js/rail.js`:
```js
export function renderRail(){ /* Task 11 */ }
```
`js/panel.js`:
```js
import { handlers } from './state.js';
handlers.openReader = () => { /* Task 12 */ };
handlers.closeReader = () => { /* Task 12 */ };
```
And add to the **top of js/viewer.js**: `import './panel.js';`

- [ ] **Step 5: Append error-card styles to css/app.css**

```css
.errcard{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:34px 38px; max-width:440px; }
.errcard h2{ margin:0 0 8px; letter-spacing:-.02em; }
.errcard p{ color:var(--soft); margin:0 0 18px; line-height:1.6; }
.errcard a{ color:var(--accent); font-weight:600; text-decoration:none; }
```

- [ ] **Step 6: Verify in browser**

- `#/t/artificial-intelligence` → vertical timeline: breadcrumb "Artificial Intelligence", big title, 7 events on a spine, taglines, "▸ N moments inside" pills on Transformers/ChatGPT/Agents.
- Click ChatGPT's pill → URL becomes `#/t/artificial-intelligence/chatgpt`, level swaps (instantly — morph next task), ↑ button appears.
- Drill to DevDay (`…/chatgpt/gpt-4/gpt-4-turbo/devday-2023`), reload the page → deep link restores that level.
- `#/t/artificial-intelligence/chatgpt/zzz` → URL normalizes to `…/chatgpt`.
- `#/t/nope` → error card with "doesn't exist" + back link.

- [ ] **Step 7: Commit**

```bash
git add js/viewer.js js/rail.js js/panel.js js/app.js css/app.css
git commit -m "feat: vertical timeline viewer with routing, deep links, error cards"
```

---

### Task 10: Morph transitions

Replace instant swaps with the prototype's validated morphs. Direction is derived by comparing old/new paths; `state.pendingFrom` carries the clicked element's rect for the down-FLIP.

**Files:**
- Modify: `js/viewer.js`

- [ ] **Step 1: Add morph machinery to js/viewer.js** (add below `renderCurrent`, replacing the body of `renderTimelineRoute`'s tail and the two handlers)

```js
const EASE = 'cubic-bezier(.5,.05,.1,1)', SOFT = 'cubic-bezier(.2,.7,.2,1)';
const rowsOf = lvl => lvl.querySelectorAll('.event');

function morphDown(inc, out, fromRect){
  const title = inc.querySelector('.lvtitle'), sub = inc.querySelector('.lvsub'),
        cr = inc.querySelector('.crumb'), up = inc.querySelector('.upcirc');
  const evs = rowsOf(inc);
  evs.forEach(e => e.style.opacity = 0);
  if (fromRect){
    const last = title.getBoundingClientRect();
    const dx = fromRect.left - last.left, dy = fromRect.top - last.top;
    const sc = Math.max(.3, Math.min(1, fromRect.height / last.height));
    title.animate([{transform:`translate(${dx}px,${dy}px) scale(${sc})`},{transform:'none'}],
                  {duration:640, easing:EASE, fill:'both'});
  } else {
    title.animate([{opacity:0, transform:'translateY(10px)'},{opacity:1, transform:'none'}],
                  {duration:480, easing:SOFT, fill:'both'});
  }
  [cr, up].forEach(el => el && el.animate([{opacity:0},{opacity:1}], {duration:420, delay:240, fill:'both'}));
  sub && sub.animate([{opacity:0, transform:'translateY(8px)'},{opacity:1, transform:'none'}],
                     {duration:460, delay:300, easing:SOFT, fill:'both'});
  if (out){
    rowsOf(out).forEach((r,i) => r.animate(
      [{opacity:1},{opacity:0, transform: state.layout==='v' ? 'translateY(-14px)' : 'translateX(-20px)'}],
      {duration:300, delay:i*22, easing:'ease', fill:'both'}));
    out.querySelectorAll('.crumb,.titlerow,.lvsub').forEach(el =>
      el.animate([{opacity:1},{opacity:0}], {duration:260, fill:'both'}));
  }
  evs.forEach((e,i) => { e.style.opacity = '';
    e.animate([{opacity:0, transform: state.layout==='v' ? 'translateY(20px)' : 'translateX(36px)'},
               {opacity:1, transform:'none'}],
              {duration:500, delay:260 + i*65, easing:SOFT, fill:'both'}); });
}

function morphUp(inc, out, leavingNode){
  out.style.zIndex = 2;
  const outTitle = out.querySelector('.lvtitle');
  let target = null;
  rowsOf(inc).forEach(e => { if (e.__node === leavingNode) target = e.querySelector('.ti'); });
  rowsOf(inc).forEach(e => e.style.opacity = 0);
  const first = outTitle.getBoundingClientRect();
  const last = (target || inc.querySelector('.lvtitle')).getBoundingClientRect();
  const dx = last.left - first.left, dy = last.top - first.top;
  const sc = Math.max(.2, last.height / first.height);
  outTitle.animate([{transform:'none', opacity:1},
                    {transform:`translate(${dx}px,${dy}px) scale(${sc})`, opacity:.15}],
                   {duration:560, easing:EASE, fill:'both'});
  out.querySelectorAll('.lvsub,.crumb,.upcirc').forEach(el =>
    el.animate([{opacity:1},{opacity:0}], {duration:200, fill:'both'}));
  rowsOf(out).forEach((r,i) => r.animate([{opacity:1},{opacity:0, transform:'translateY(12px)'}],
    {duration:240, delay:i*16, fill:'both'}));
  inc.querySelector('.level-in').animate([{opacity:0},{opacity:1}], {duration:360, fill:'both'});
  rowsOf(inc).forEach((e,i) => { e.style.opacity = '';
    e.animate([{opacity:0, transform: state.layout==='v' ? 'translateY(-12px)' : 'translateX(-22px)'},
               {opacity:1, transform:'none'}],
              {duration:440, delay:140 + i*48, easing:SOFT, fill:'both'}); });
}

function transitionTo(newChain){
  const oldChain = state.path;
  state.path = newChain;
  const inc = buildLevel(newChain[newChain.length - 1]);
  els.stage.appendChild(inc);
  const out = state.cur;
  state.cur = inc; state.sel = -1;
  const extendsOld = newChain.length > oldChain.length &&
    oldChain.every((n, i) => newChain[i] === n);
  const shrinksOld = newChain.length < oldChain.length &&
    newChain.every((n, i) => oldChain[i] === n);
  state.busy = true;
  if (out && extendsOld)      morphDown(inc, out, state.pendingFrom);
  else if (out && shrinksOld) morphUp(inc, out, oldChain[oldChain.length - 1]);
  else if (out)               { inc.animate([{opacity:0, transform:'scale(.985)'},{opacity:1, transform:'none'}],
                                            {duration:380, easing:SOFT, fill:'both'});
                                out.animate([{opacity:1},{opacity:0}], {duration:240, fill:'both'}); }
  state.pendingFrom = null;
  setTimeout(() => { if (out) out.remove(); state.busy = false; renderRail(); }, out ? 860 : 0);
  if (!out) renderRail();
}
```

- [ ] **Step 2: Use it — replace the tail of `renderTimelineRoute` and the nav handlers**

In `renderTimelineRoute`, replace `state.path = chain; renderCurrent();` with:

```js
  if (!state.cur || !els.stage.contains(state.cur)) { state.path = chain; renderCurrent(); }
  else transitionTo(chain);
```

Replace `handlers.drill` and `handlers.goUpTo` with:

```js
handlers.drill = (node, fromEl) => {
  if (state.busy || !node.children) return;
  handlers.closeReader?.();
  state.pendingFrom = fromEl ? fromEl.getBoundingClientRect() : null;
  location.hash = buildTimelineHash(state.timelineId, node.pathIds);
};
handlers.goUpTo = (i) => {
  if (state.busy || i >= state.path.length - 1) return;
  handlers.closeReader?.();
  location.hash = buildTimelineHash(state.timelineId, state.path[i].pathIds);
};
```

(`renderCurrent` stays — it's the instant path for first load and layout toggles.)

- [ ] **Step 3: Verify in browser**

- Library → AI → drill ChatGPT: the words "ChatGPT" lift off the row and grow into the heading; siblings fade out staggered; children stagger in.
- Drill all the way to DevDay 2023 (5 levels), then walk back up via the ↑ button — title shrinks back into its originating row each time.
- Breadcrumb jump from DevDay straight to "Artificial Intelligence" (multi-level up) animates cleanly.
- Browser back/forward buttons animate with the correct direction.
- Mash the pill during an animation — nothing double-fires (`busy` guard).

- [ ] **Step 4: Commit**

```bash
git add js/viewer.js
git commit -m "feat: FLIP morph transitions for drill-down/up, direction from path diff"
```

---

### Task 11: Map rail

**Files:**
- Modify: `js/rail.js` (replace placeholder), `css/app.css` (append)

- [ ] **Step 1: Append rail styles to css/app.css**

```css
.rail-h{ display:flex; align-items:center; justify-content:space-between; padding:0 10px 12px; }
.rail-h .lb{ font-size:10.5px; font-weight:700; letter-spacing:.14em; color:var(--muted); }
.depth{ font-size:10px; font-weight:700; color:var(--accent); background:var(--accent-soft);
        border-radius:99px; padding:3px 9px; }
.legend{ display:flex; flex-wrap:wrap; gap:6px 14px; padding:2px 10px 14px; font-size:10.5px; color:var(--muted); }
.legend i{ display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:5px; }
.legend .du{ border:1.5px solid var(--faint); background:var(--paper); }
.legend .ds{ border:1.5px solid var(--faint); background:var(--accent-tint); }
.legend .do{ border:1.5px solid var(--accent); background:var(--accent); box-shadow:0 0 0 2px var(--halo); }
.rnode{ display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:9px; cursor:pointer;
        font-size:13px; color:var(--soft); position:relative; transition:background .15s,color .15s; }
.rnode:hover{ background:#f3f1eb; color:var(--ink); }
.rnode .tick{ width:7px; height:7px; border-radius:50%; border:1.5px solid var(--faint);
              flex:0 0 auto; transition:all .2s; background:var(--paper); }
.rnode.seen .tick{ background:var(--accent-tint); }
.rnode .nm{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rnode .more{ margin-left:auto; font-size:10px; font-weight:700; color:var(--accent); opacity:.85; flex:0 0 auto; }
.rnode.anc{ font-weight:600; color:var(--ink); }
.rnode.here{ background:var(--accent-soft); color:var(--ink); font-weight:700; }
.rnode.here .tick{ background:var(--accent); border-color:var(--accent); box-shadow:0 0 0 4px var(--halo); }
.rkids{ border-left:1.5px solid var(--line); margin-left:13px; padding-left:6px; }
```

- [ ] **Step 2: Replace js/rail.js**

```js
import { state, els, handlers } from './state.js';
import { getRead } from './data.js';

export function renderRail(){
  if (!state.idx || els.rail.hidden) return;
  const read = getRead(state.timelineId);
  const seen = n => n.isRoot ? false : read.has(n.pathIds.join('/'));
  els.rail.innerHTML = '';

  const h = document.createElement('div'); h.className = 'rail-h';
  h.innerHTML = '<span class="lb">YOU ARE HERE</span><span class="depth">Level ' + state.path.length + '</span>';
  els.rail.appendChild(h);
  const lg = document.createElement('div'); lg.className = 'legend';
  lg.innerHTML = '<span><i class="du"></i>unread</span><span><i class="ds"></i>read</span><span><i class="do"></i>reading now</span>';
  els.rail.appendChild(lg);

  let host = els.rail;
  state.path.forEach((n, i) => {
    const r = document.createElement('div');
    r.className = 'rnode ' + (i === state.path.length - 1 ? 'here' : 'anc') + (seen(n) ? ' seen' : '');
    r.innerHTML = '<span class="tick"></span><span class="nm"></span>' +
      (n.children ? '<span class="more">' + n.children.length + '</span>' : '');
    r.querySelector('.nm').textContent = n.title;
    if (i < state.path.length - 1) r.onclick = () => handlers.goUpTo(i);
    host.appendChild(r);
    const kid = document.createElement('div'); kid.className = 'rkids';
    host.appendChild(kid); host = kid;
    if (i === state.path.length - 1){
      for (const ch of n.children || []){
        const c = document.createElement('div');
        c.className = 'rnode' + (seen(ch) ? ' seen' : '');
        c.innerHTML = '<span class="tick"></span><span class="nm"></span>' +
          (ch.children ? '<span class="more">▸ ' + ch.children.length + '</span>' : '');
        c.querySelector('.nm').textContent = ch.title;
        c.onclick = () => {
          if (ch.children){
            let tEl = null;
            state.cur.querySelectorAll('.event').forEach(e => { if (e.__node === ch) tEl = e.querySelector('.ti'); });
            handlers.drill(ch, tEl);
          } else handlers.focusChild(ch);
        };
        host.appendChild(c);
      }
    }
  });
}
```

- [ ] **Step 3: Verify in browser**

Drill to GPT-4. Rail shows: AI (ancestor) → ChatGPT (ancestor) → **GPT-4** (highlighted "here") → its 4 children indented, "Level 3" badge, legend on top. Clicking "Artificial Intelligence" in the rail morphs up two levels. Rail hides below 980px width (resize to confirm).

- [ ] **Step 4: Commit**

```bash
git add js/rail.js css/app.css
git commit -m "feat: map rail with ancestry, children, read-state legend"
```

---

### Task 12: Reading panel (vertical right-sheet) + sources + wiki links

**Files:**
- Modify: `js/panel.js` (replace placeholder), `index.html` (add panel markup), `css/app.css` (append)

- [ ] **Step 1: Add panel markup to index.html** (inside `<main class="stage" id="stage">`, as its first child)

```html
      <div class="panel" id="panel">
        <button class="pclose" id="pclose">×</button>
        <div class="ph"><div class="yr" id="pyr"></div><div class="pt" id="pti"></div><div id="pmeta"></div></div>
        <div class="pb" id="pbody"></div>
      </div>
```

- [ ] **Step 2: Append panel + markdown styles to css/app.css**

```css
/* ===== reading panel — overlay, never reflows the timeline ===== */
.panel{ position:absolute; background:#fff; z-index:25; display:flex;
        transition:transform .5s var(--ease); visibility:hidden; }
.panel.vp,.panel.hp{ visibility:visible; }
.panel .ph .yr{ font-size:12px; }
.panel .ph .pt{ font-size:clamp(20px,1.1vw + 13px,28px); font-weight:700; letter-spacing:-.02em; margin-top:5px; }
.panel .pb{ flex:1; overflow:auto; padding:18px clamp(26px,3vw,52px) 26px; scrollbar-gutter:stable; }
.panel .kids{ cursor:pointer; border:none; margin-top:14px; font-family:var(--sans); }
.panel.vp{ top:0; right:0; bottom:0; width:clamp(420px,33vw,620px); border-left:1px solid var(--line);
           box-shadow:-28px 0 60px -42px rgba(21,21,26,.35); transform:translateX(112%); flex-direction:column; }
.panel.vp .ph{ padding:24px 28px 16px; border-bottom:1px solid var(--line); }
.panel.hp{ left:0; right:0; bottom:0; height:clamp(230px,30vh,380px); border-top:1px solid var(--line);
           border-radius:18px 18px 0 0; box-shadow:0 -28px 60px -42px rgba(21,21,26,.4); transform:translateY(112%); }
.panel.hp .ph{ width:clamp(240px,24vw,340px); flex:0 0 auto; padding:24px 30px; border-right:1px solid var(--line); }
.panel.openp{ transform:none; }
.pclose{ all:unset; cursor:pointer; position:absolute; top:14px; right:18px; font-size:20px;
         color:var(--muted); line-height:1; z-index:1; }
.pclose:hover{ color:var(--ink); }

/* ===== markdown reading ===== */
.md{ font-family:var(--serif); font-size:clamp(15px,.4vw + 12.5px,17.5px); line-height:1.72;
     color:#33322d; max-width:70ch; padding:6px 4px 14px; }
.md p{ margin:.85em 0; }
.md h2{ font-size:1.22em; margin:1.3em 0 .4em; letter-spacing:-.01em; }
.md h3{ font-size:1.05em; margin:1.1em 0 .35em; }
.md ul{ margin:.6em 0; padding-left:1.3em; }
.md li{ margin:.3em 0; }
.md blockquote{ margin:.9em 0; padding:.25em 1.1em; border-left:3px solid var(--accent);
                color:#56554e; font-style:italic; background:#f6f4ee; border-radius:0 10px 10px 0; }
.md code{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.85em;
          background:#f1efe9; padding:.15em .4em; border-radius:5px; }
.md a.ext{ color:var(--accent); text-decoration:underline; text-underline-offset:2px; }
.md a.wl{ color:var(--accent); font-weight:600; cursor:pointer; text-decoration:none;
          border-bottom:1.5px dashed rgba(53,72,232,.5); transition:background .15s,border-color .15s; }
.md a.wl:hover{ background:var(--accent-soft); border-bottom-color:var(--accent); }
.md a.wl::after{ content:'⤴'; font-size:.75em; margin-left:2px; opacity:.7; }

/* ===== sources ===== */
.srcs{ border-top:1px solid var(--line); margin-top:10px; padding-top:14px; max-width:70ch; }
.srcs .lb{ font-size:10.5px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
.srcs ul{ list-style:none; margin:8px 0 0; padding:0; }
.srcs li{ margin:5px 0; font-size:13px; }
.srcs a{ color:var(--soft); text-decoration:none; border-bottom:1px solid var(--line); }
.srcs a:hover{ color:var(--accent); border-bottom-color:var(--accent); }
```

- [ ] **Step 3: Replace js/panel.js**

```js
import { state, els, handlers } from './state.js';
import { mdToHtml } from './markdown.js';
import { displayDate, loadTimeline, indexTimeline, resolvePath } from './data.js';
import { buildTimelineHash } from './router.js';

function resolveWiki(target){
  if (target.includes('/')) return true;             // cross-timeline: validated at build time
  return state.idx.byTitle.has(target.toLowerCase());
}

function setReadingTarget(evEl){
  state.cur.querySelectorAll('.open').forEach(x => x.classList.remove('open'));
  const cont = state.cur.querySelector('.events,.htrack');
  if (cont) cont.classList.add('reading');
  if (evEl) evEl.classList.add('open');
}

handlers.openReader = (node, evEl) => {
  const panel = els.panel;
  const want = state.layout === 'v' ? 'vp' : 'hp';
  if (!panel.classList.contains(want)){
    panel.classList.remove('openp','vp','hp');
    panel.classList.add(want);
    void panel.offsetWidth;          // settle closed position so the slide-in animates from the right edge
  }
  document.getElementById('pyr').textContent = displayDate(node);
  document.getElementById('pti').textContent = node.title;
  document.getElementById('pmeta').innerHTML = node.children
    ? '<button class="kids" id="panelDrill">▸ open this timeline</button>' : '';
  let html = '<div class="md">' + mdToHtml(node.content || '*No notes yet.*', resolveWiki) + '</div>';
  if (node.sources && node.sources.length){
    html += '<div class="srcs"><div class="lb">Sources</div><ul>' +
      node.sources.map(s => '<li><a href="' + s.url.replace(/"/g,'&quot;') +
        '" target="_blank" rel="noopener"></a></li>').join('') + '</ul></div>';
  }
  const pb = document.getElementById('pbody');
  pb.innerHTML = html;
  if (node.sources) pb.querySelectorAll('.srcs a').forEach((a, i) => a.textContent = node.sources[i].title);
  pb.scrollTop = 0;
  panel.classList.add('openp');
  setReadingTarget(evEl);
  /* never move the timeline on a direct click; horizontal glides along the axis only */
  if (evEl && state.layout === 'h')
    evEl.scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' });
  handlers.markSeen(node, evEl);
  const pd = document.getElementById('panelDrill');
  if (pd) pd.onclick = () => handlers.drill(node, document.getElementById('pti'));
};

handlers.closeReader = () => {
  els.panel.classList.remove('openp');
  if (state.cur){
    state.cur.querySelectorAll('.open').forEach(x => x.classList.remove('open'));
    const cont = state.cur.querySelector('.events,.htrack');
    if (cont) cont.classList.remove('reading');
  }
};

/* wiki-link click delegation (same + cross timeline) */
async function followWiki(target, fromEl){
  if (!target.includes('/')){
    const node = state.idx.byTitle.get(target.toLowerCase());
    if (!node) return;
    if (node.children) handlers.drill(node, fromEl);
    else if (node.parent === state.path[state.path.length - 1]) handlers.focusChild(node);
    else {
      handlers.closeReader();
      state.pendingFrom = fromEl ? fromEl.getBoundingClientRect() : null;
      location.hash = buildTimelineHash(state.timelineId, node.parent.pathIds);
      setTimeout(() => handlers.focusChild(node), 900);
    }
    return;
  }
  const [tlId, ...segs] = target.split('/').filter(Boolean);   // cross-timeline
  handlers.closeReader();
  try {
    const idx = indexTimeline(await loadTimeline(tlId));
    const chain = resolvePath(idx, segs);
    const node = chain[chain.length - 1];
    const landTimeline = node.children ? node : node.parent;
    location.hash = buildTimelineHash(tlId, landTimeline.pathIds);
    if (!node.children) setTimeout(() => handlers.focusChild(node), 900);
  } catch { location.hash = buildTimelineHash(tlId, []); }
}

document.addEventListener('click', e => {
  const w = e.target.closest('.wl');
  if (w) followWiki(w.dataset.wiki, w);
});
document.getElementById('pclose')?.addEventListener('click', () => handlers.closeReader());
```

- [ ] **Step 4: Register the panel element in js/app.js** (with the other `els.` lines)

```js
els.panel = document.getElementById('panel');
```

And in `js/library.js`, first line of `renderLibrary()` add: `handlers.closeReader?.();` (import `handlers` from `./state.js`).

- [ ] **Step 5: Verify in browser**

- Click "The Turing Test" row → right sheet slides in: serif markdown with the blockquote, **Sources** footer with two working links. Timeline does not move or reflow. Marker goes solid+halo; other rows dim; rail dot tints after close.
- Click another row while open → content swaps in place.
- Inside ChatGPT's content click the [[Transformers]] wiki link → morphs into the Transformers timeline (the clicked word grows into the title).
- In AlexNet's content click "the Web" (cross-timeline) → The Web timeline opens at the WWW-proposal level with the event highlighted + panel open.
- × and Esc are wired in Task 15; for now × closes.

- [ ] **Step 6: Commit**

```bash
git add js/panel.js js/app.js js/library.js index.html css/app.css
git commit -m "feat: overlay reading panel with markdown, sources, wiki-link navigation"
```

---

### Task 13: Horizontal layout + layout toggle

**Files:**
- Modify: `js/viewer.js` (real `buildHorizontal`), `js/app.js` (toggle), `css/app.css` (append)

- [ ] **Step 1: Append horizontal styles to css/app.css**

```css
/* ===== horizontal mode — track is full-bleed; events spread to fill, scroll only on true overflow ===== */
.hwrap{ position:relative; margin-top:clamp(20px,3vh,38px); height:clamp(380px,52vh,560px);
        overflow-x:auto; overflow-y:hidden; cursor:grab; }
.hwrap.drag{ cursor:grabbing; }
.htrack{ position:relative; display:flex; align-items:center; justify-content:space-evenly;
         gap:clamp(40px,4.5vw,86px); height:100%; padding:0 60px; width:max-content; min-width:100%; }
.haxis{ position:absolute; left:30px; right:30px; top:50%; height:2px; background:var(--line); }
.hev{ position:relative; width:clamp(170px,13vw,236px); flex:0 0 auto; height:100%; }
.hev .marker{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); }
.hev:hover .marker{ transform:translate(-50%,-50%) scale(1.2); }
.hcard{ position:absolute; left:50%; transform:translateX(-50%); width:100%; text-align:center;
        cursor:pointer; padding:12px 13px; border-radius:14px; border:1px solid transparent; transition:all .18s; }
.hcard:hover{ background:#fff; border-color:var(--line); box-shadow:0 14px 30px -16px rgba(40,40,60,.4); }
.hev.open .hcard, .hev.open .hcard:hover{ background:#fff; border-color:var(--line);
        box-shadow:0 14px 30px -16px rgba(40,40,60,.4); }
.htrack.reading .event:not(.open){ opacity:.55; }
.hev.focused .hcard{ outline:2px solid var(--accent); outline-offset:-2px; }
.hev.up .hcard{ bottom:calc(50% + 22px); }
.hev.dn .hcard{ top:calc(50% + 22px); }
.hev .kids{ margin-top:8px; }
.hev.pulse .hcard{ animation:pulsebg 1.4s ease; }
```

- [ ] **Step 2: Replace `buildHorizontal` in js/viewer.js** (the Task-9 stub)

```js
function buildHorizontal(node){
  const read = getRead(state.timelineId);
  const wrap = document.createElement('div'); wrap.className = 'hwrap';
  const track = document.createElement('div'); track.className = 'htrack';
  const axis = document.createElement('div'); axis.className = 'haxis'; track.appendChild(axis);
  (node.children || []).forEach((ch, i) => {
    const ev = document.createElement('div');
    ev.className = 'hev event ' + (i % 2 ? 'dn' : 'up') + (ch.major ? ' major' : '') +
                   (read.has(pathKey(ch)) ? ' seen' : '');
    ev.__node = ch;
    const mk = document.createElement('div'); mk.className = 'marker';
    const card = document.createElement('div'); card.className = 'hcard';
    const yr = document.createElement('div'); yr.className = 'yr'; yr.textContent = displayDate(ch);
    const ti = document.createElement('div'); ti.className = 'ti'; ti.textContent = ch.title;
    card.appendChild(yr); card.appendChild(ti);
    if (ch.children){
      const pill = document.createElement('span'); pill.className = 'kids';
      pill.textContent = '▸ ' + ch.children.length + ' inside';
      pill.onclick = e => { e.stopPropagation(); handlers.drill(ch, ti); };
      card.appendChild(document.createElement('br')); card.appendChild(pill);
    }
    card.onclick = () => handlers.openReader(ch, ev);
    ev.appendChild(mk); ev.appendChild(card);
    track.appendChild(ev);
  });
  wrap.appendChild(track);
  /* drag + wheel — click/drag discrimination so card clicks always land */
  let down = false, moved = false, sx = 0, sl = 0;
  wrap.addEventListener('pointerdown', e => { down = true; moved = false; sx = e.clientX; sl = wrap.scrollLeft; });
  window.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - sx;
    if (!moved && Math.abs(dx) < 6) return;
    moved = true; wrap.classList.add('drag'); wrap.scrollLeft = sl - dx;
  });
  window.addEventListener('pointerup', () => { down = false; wrap.classList.remove('drag'); });
  wrap.addEventListener('click', e => { if (moved){ e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  wrap.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)){ wrap.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive:false });
  return wrap;
}
```

- [ ] **Step 3: Add the layout toggle to js/app.js** (after the `els.` lines)

```js
import { renderCurrent } from './viewer.js';
import { handlers } from './state.js';   // merge into existing state.js import

document.querySelectorAll('#seg button').forEach(b => {
  b.onclick = () => {
    if (state.busy || b.dataset.l === state.layout) return;
    document.querySelectorAll('#seg button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    state.layout = b.dataset.l;
    handlers.closeReader?.();
    els.panel.classList.remove('vp','hp');
    renderCurrent();
    state.cur.animate([{opacity:0, transform:'scale(.985)'},{opacity:1, transform:'none'}],
                      {duration:380, easing:'cubic-bezier(.2,.7,.2,1)', fill:'both'});
  };
});
```

- [ ] **Step 4: Verify in browser**

- Toggle Horizontal on the AI root: 7 events spread edge-to-edge across the full window (no scrollbar on a wide monitor), alternating above/below the axis. Header stays in its centered column.
- Click a card → **bottom sheet** opens; the card glides to horizontal center; timeline never shifts vertically.
- Drag to pan; click immediately after a drag — clicks still land (discrimination works).
- Drill ChatGPT in horizontal — morph works; children stagger in horizontally.
- Toggle back to Vertical mid-timeline — same level re-renders, read panel closed.

- [ ] **Step 5: Commit**

```bash
git add js/viewer.js js/app.js css/app.css
git commit -m "feat: full-bleed horizontal layout with bottom-sheet reading and layout toggle"
```

---

### Task 14: ⌘K search

**Files:**
- Test: `tests/search.test.js`
- Create: `js/search.js`
- Modify: `index.html` (overlay markup), `js/app.js` (init), `css/app.css` (append)

- [ ] **Step 1: Write the failing test for the scorer**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` → Expected: FAIL — `Cannot find module '.../js/search.js'`

- [ ] **Step 3: Create js/search.js**

```js
import { state, els, handlers } from './state.js';
import { displayDate } from './data.js';

export function searchNodes(idx, query){
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const node of idx.byPath.values()){
    const title = node.title.toLowerCase();
    const tag = (node.tagline || '').toLowerCase();
    let score = null;
    if (title.startsWith(q)) score = 0;
    else if (title.includes(q)) score = 1;
    else if (tag.includes(q) || displayDate(node).toLowerCase().includes(q)) score = 2;
    if (score !== null) out.push({ node, score });
  }
  return out.sort((a, b) => a.score - b.score ||
                            a.node.pathIds.length - b.node.pathIds.length ||
                            a.node.title.localeCompare(b.node.title)).slice(0, 12);
}

/* ---------- palette UI ---------- */
export function initSearch(){
  const sd = els.search, input = sd.querySelector('input'), list = sd.querySelector('.sk-list');
  let results = [], cursor = 0;

  function open(){ if (!state.idx) return; sd.classList.add('on'); input.value = ''; render(); input.focus(); }
  function close(){ sd.classList.remove('on'); }
  function render(){
    results = searchNodes(state.idx, input.value);
    cursor = Math.min(cursor, Math.max(0, results.length - 1));
    list.innerHTML = results.length ? '' : '<div class="sk-empty">No moments match.</div>';
    results.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'sk-row' + (i === cursor ? ' cur' : '');
      const crumb = [state.idx.root.title, ...r.node.pathIds.slice(0, -1)].join(' / ');
      row.innerHTML = '<div><div class="sk-t"></div><div class="sk-c"></div></div><div class="sk-d"></div>';
      row.querySelector('.sk-t').textContent = r.node.title;
      row.querySelector('.sk-c').textContent = crumb;
      row.querySelector('.sk-d').textContent = displayDate(r.node);
      row.onclick = () => go(r.node);
      list.appendChild(row);
    });
  }
  function go(node){
    close();
    if (node.children) handlers.drill(node, null);
    else {
      const target = node.parent;
      if (target === state.path[state.path.length - 1]) handlers.focusChild(node);
      else {
        import('./router.js').then(({ buildTimelineHash }) => {
          location.hash = buildTimelineHash(state.timelineId, target.pathIds);
          setTimeout(() => handlers.focusChild(node), 900);
        });
      }
    }
  }
  input.addEventListener('input', () => { cursor = 0; render(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown'){ cursor = Math.min(results.length - 1, cursor + 1); render(); e.preventDefault(); }
    if (e.key === 'ArrowUp'){ cursor = Math.max(0, cursor - 1); render(); e.preventDefault(); }
    if (e.key === 'Enter' && results[cursor]) go(results[cursor].node);
    if (e.key === 'Escape') close();
    e.stopPropagation();
  });
  sd.addEventListener('click', e => { if (e.target === sd) close(); });
  window.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); open(); }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` → Expected: PASS

- [ ] **Step 5: Add overlay markup to index.html** (before `</body>`, after the `.app` div)

```html
  <div class="sk" id="search">
    <div class="sk-box">
      <input type="text" placeholder="Jump to any moment…  (Esc to close)">
      <div class="sk-list"></div>
    </div>
  </div>
```

Append styles to css/app.css:

```css
/* ===== ⌘K palette ===== */
.sk{ position:fixed; inset:0; background:rgba(21,21,26,.32); backdrop-filter:blur(3px);
     z-index:60; display:none; }
.sk.on{ display:block; }
.sk-box{ width:min(620px,92vw); margin:12vh auto 0; background:#fff; border-radius:16px;
         box-shadow:0 40px 90px -30px rgba(21,21,26,.55); overflow:hidden; }
.sk-box input{ width:100%; border:none; outline:none; font:600 16px var(--sans);
               padding:18px 22px; border-bottom:1px solid var(--line); color:var(--ink); }
.sk-list{ max-height:46vh; overflow:auto; padding:8px; }
.sk-row{ display:flex; justify-content:space-between; align-items:center; gap:14px;
         padding:10px 14px; border-radius:10px; cursor:pointer; }
.sk-row:hover,.sk-row.cur{ background:var(--accent-soft); }
.sk-t{ font-size:14.5px; font-weight:600; }
.sk-c{ font-size:11px; color:var(--muted); margin-top:2px; }
.sk-d{ font-size:11.5px; font-weight:700; color:var(--accent); white-space:nowrap; }
.sk-empty{ padding:18px; color:var(--muted); font-size:13.5px; text-align:center; }
```

- [ ] **Step 6: Initialize in js/app.js**

```js
import { initSearch } from './search.js';
els.search = document.getElementById('search');
initSearch();
```

- [ ] **Step 7: Verify in browser**

Open the AI timeline, hit ⌘K (Ctrl+K on non-Mac): palette opens. Type "dev" → "DevDay 2023" with crumb "Artificial Intelligence / chatgpt / gpt-4 / gpt-4-turbo". Enter → morphs to DevDay's level. ⌘K → "turing" → Enter → navigates to root with Turing's panel open and row pulsed. Esc and backdrop-click close it.

- [ ] **Step 8: Commit**

```bash
git add js/search.js tests/search.test.js index.html js/app.js css/app.css
git commit -m "feat: cmd-K search palette across all timeline depths (scorer TDD)"
```

---

### Task 15: Keyboard navigation + hint bar

**Files:**
- Modify: `js/app.js`, `index.html` (hint bar), `css/app.css` (append)

- [ ] **Step 1: Add hint bar markup** (inside `.stage`, after the panel div)

```html
      <div class="hintbar" id="hint"></div>
```

Append styles:

```css
.hintbar{ position:absolute; bottom:14px; right:20px; z-index:20; font-size:11px; color:var(--muted);
          background:rgba(255,255,255,.85); backdrop-filter:blur(6px); border:1px solid var(--line);
          border-radius:99px; padding:6px 14px; }
.hintbar:empty{ display:none; }
kbd{ font-family:var(--sans); font-size:10px; font-weight:700; border:1px solid var(--faint);
     border-bottom-width:2px; border-radius:5px; padding:1px 5px; background:#fff; color:var(--soft); }
```

- [ ] **Step 2: Add keyboard handling + hint rendering to js/app.js**

```js
els.hint = document.getElementById('hint');

export function renderHint(){
  if (!state.idx){ els.hint.innerHTML = ''; return; }
  const move = state.layout === 'v' ? '<kbd>↑</kbd><kbd>↓</kbd>' : '<kbd>←</kbd><kbd>→</kbd>';
  els.hint.innerHTML = move + ' move &nbsp; <kbd>Enter</kbd> read &nbsp; <kbd>⇧Enter</kbd> open timeline' +
                       ' &nbsp; <kbd>Esc</kbd> up &nbsp; <kbd>⌘K</kbd> search';
}

window.addEventListener('keydown', e => {
  if (state.busy || !state.idx || !state.cur) return;
  if (els.search.classList.contains('on')) return;
  const evs = [...state.cur.querySelectorAll('.event')];
  const fwd = state.layout === 'v' ? 'ArrowDown' : 'ArrowRight';
  const bck = state.layout === 'v' ? 'ArrowUp' : 'ArrowLeft';
  if (e.key === fwd || e.key === bck){
    e.preventDefault();
    state.sel = e.key === fwd ? Math.min(evs.length - 1, state.sel + 1) : Math.max(0, state.sel - 1);
    evs.forEach((x, i) => x.classList.toggle('focused', i === state.sel));
    evs[state.sel]?.scrollIntoView({ behavior:'smooth', block:'center', inline:'center' });
  }
  if (e.key === 'Enter' && evs[state.sel]){
    const node = evs[state.sel].__node;
    if (e.shiftKey && node.children) handlers.drill(node, evs[state.sel].querySelector('.ti'));
    else handlers.openReader(node, evs[state.sel]);
  }
  if (e.key === 'Escape'){
    if (els.panel.classList.contains('openp')) handlers.closeReader();
    else if (state.path.length > 1) handlers.goUpTo(state.path.length - 2);
  }
});
```

Call `renderHint()` at the end of `route()` (both branches render before it runs) and inside the layout-toggle click handler after `renderCurrent()`. In `renderLibrary()` the hint clears itself because `state.idx` check — set `state.idx = null; state.timelineId = null;` at the top of `renderLibrary()` so returning to the library resets state (import `state` there).

- [ ] **Step 3: Verify in browser**

- AI timeline: ↓↓ walks focus down rows with the outline ring; Enter opens the panel; ⇧Enter on ChatGPT drills; Esc closes panel, second Esc goes up.
- Horizontal mode: ←/→ move, hint bar text switches to ←/→.
- Library: hint bar hidden; keyboard does nothing harmful.
- ⌘K open: arrows navigate results only (stage keyboard suppressed).

- [ ] **Step 4: Commit**

```bash
git add js/app.js index.html css/app.css
git commit -m "feat: keyboard navigation and hint bar"
```

---

### Task 16: README, final QA, deploy

**Files:**
- Create: `README.md`
- Modify: none (QA + optional deploy)

- [ ] **Step 1: Create README.md**

````markdown
# Timeline

Beautiful, drillable timelines — learn anything by seeing where it came from, layer by layer.

**Live:** https://app4a.github.io/timeline/ (after Pages is enabled)

## Develop

```bash
npm run serve     # http://localhost:8080 (ES modules need a server)
npm test          # node --test — markdown, router, data, search, validator
npm run validate  # checks every file in timelines/ against SCHEMA.md rules
```

No dependencies, no build step. `js/` are plain ES modules; `css/app.css` holds all styles
with design tokens at the top.

## Add a timeline

1. Read `SCHEMA.md` (or paste it into an LLM with "write me a timeline about X").
2. Save the result as `timelines/<id>.json`, add an entry to `timelines/index.json`.
3. `npm run validate` until clean. Done — it's on the library page.

## Architecture notes

- Hash routes: `#/` library · `#/t/<timeline>/<node>/…` every drill level is shareable.
- Read-state lives in `localStorage` (`timeline:read:<id>`).
- The JSON schema is the future read-API/MCP contract — serve the files, that's the API.
````

- [ ] **Step 2: Run the full check suite**

Run: `npm test && npm run validate`
Expected: all tests pass, `✓ 2 timeline(s) valid`.

- [ ] **Step 3: Full manual QA pass** (against `http://localhost:8080`)

Walk this list top to bottom; fix anything that fails before committing:

1. Library loads; two cards; counts 26 and 10.
2. Card → AI timeline; morph-free first render; rail + legend correct.
3. Drill ChatGPT → GPT-4 → GPT-4 Turbo → DevDay 2023 (Level 5); morphs clean at every step; rail tracks; URL deepens.
4. Reload at DevDay deep link → restores; ↑ walks back up with reverse morphs.
5. Reading: open several events; no timeline movement; dots hollow→tint→solid+halo correctly; dim at 55%; sources links open in new tabs.
6. Wiki links: [[Transformers]] morph-from-word; [[GPT-4V]] leaf jump with pulse; AlexNet → "the Web" cross-timeline jump; The Web → "Transformers" back.
7. Horizontal: full-bleed spread, bottom sheet, drag vs click, axis centering, drill morph.
8. ⌘K: nested results with crumbs, Enter navigation both to branches and leaves.
9. Keyboard: arrows/Enter/⇧Enter/Esc in both layouts.
10. Errors: `#/t/nope` card; kill the server and click a library card → network card.
11. Resize: 27" full-width spread; ~1000px rail collapses; ~400px (responsive mode) vertical still readable.
12. Console: zero errors across all of the above.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README with develop/author/deploy instructions"
```

- [ ] **Step 5: Deploy to GitHub Pages (requires user's gh auth — confirm with user before running)**

```bash
gh repo create app4a/timeline --public --source=. --push
gh api repos/app4a/timeline/pages -X POST -f build_type=legacy -f "source[branch]=master" -f "source[path]=/"
```

Then open `https://app4a.github.io/timeline/` (Pages takes a minute on first publish) and spot-check QA items 1–3.

- [ ] **Step 6: Final state check**

Run: `git status` → expected: clean tree, all commits on `master`.

---

## Self-review (done at plan-writing time)

- **Spec coverage:** library ✓ (T8) · viewer vertical ✓ (T9) · morph ✓ (T10) · rail ✓ (T11) · reading panel/sources/wiki/cross-timeline ✓ (T12) · horizontal ✓ (T13) · ⌘K ✓ (T14) · keyboard/hints ✓ (T15) · error cards ✓ (T9/T15) · read-state localStorage ✓ (T7/T12) · schema+SCHEMA.md ✓ (T3) · validator ✓ (T4) · brand/logo/favicon/fonts/palette ✓ (T1/T2) · deploy ✓ (T16). Deferred items correctly absent.
- **Placeholder scan:** the only intentional stubs are Task 9's rail/panel placeholder files and `buildHorizontal` delegating to `buildVertical` — each is explicitly replaced in Tasks 11/12/13.
- **Type consistency:** `handlers.{drill,goUpTo,focusChild,openReader,closeReader,markSeen}`, `state.{layout,timelineId,idx,path,busy,sel,pendingFrom,cur}`, `idx.{root,byTitle,byPath}`, `pathIds`/`pathKey` verified consistent across Tasks 7–15. `countEvents` lives in `tools/validate.js` (only the validator needs it); `data.js` does not export it — the contract block reflects actual usage.
