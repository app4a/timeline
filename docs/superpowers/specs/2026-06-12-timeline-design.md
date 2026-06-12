# Timeline — MVP Design

**Date:** 2026-06-12 · **Status:** Approved pending user review · **Working name:** Timeline (final name open)

## Purpose

A free, static website of beautiful, drillable timelines. Anyone can deeply understand any topic — history, technology, a company, a person — by seeing where it came from: top-level moments first, then zooming into the timeline *inside* any moment, layer by layer, as deep as the content goes.

Primary use cases: learning a topic, teaching/explaining a topic, and recording the evolution of anything.

## Decisions log

| Decision | Choice |
|---|---|
| Visual direction | Calm, text-first timeline; elegance lives in motion (morph transitions), not decoration |
| Default layout | **Vertical** stream; horizontal toggle one click away |
| Drill animation | **Morph** (shared-element FLIP: clicked title grows into the child timeline's heading); slide rejected; 3D depth-flow rejected as "too much" |
| Content storage | **Static JSON files** in the repo; no backend |
| MVP extras | **Sources per event** + **⌘K search**; quiz mode, compare lanes, in-app editor all deferred |
| Site scope | **Library page + viewer** (multiple timelines from day one) |
| Stack | Vanilla HTML/CSS/JS, no framework, no build step |
| Hosting | GitHub Pages, hash routing |
| Git workflow | Work directly on `master`; no worktrees, no feature branches |

The validated interaction prototype is preserved at `docs/superpowers/specs/2026-06-12-timeline-prototype.html` (open in a browser). Implementation ports it, not reinvents it.

## Goals / non-goals

**Goals (MVP)**

1. Read: render a nested timeline elegantly at any depth, on any screen from phone to 27" monitor.
2. Navigate: drill down/up with morph transitions; always know where you are (map rail, breadcrumb, deep links).
3. Learn: long-form markdown per event, wiki-links between topics, read-progress tracking, sources for credibility, ⌘K to jump anywhere.
4. Author: a documented JSON schema good enough that a human or an LLM can write a complete timeline file with no tooling.

**Non-goals (MVP)** — accounts, backend, in-app editing, quiz mode, compare lanes, time-proportional spacing, the API/MCP server itself (the schema is designed for it; the server is phase 2).

## Architecture

- **Single-page app** at the repo root: `index.html` + `css/` + `js/`. No build step; ES modules served as-is.
- **Hash routing** (works on GitHub Pages with zero config):
  - `#/` → library
  - `#/t/<timeline-id>` → timeline root
  - `#/t/<timeline-id>/<node-id>/<node-id>/…` → a drilled level; every level is shareable/bookmarkable
- **Data loading:** `fetch('timelines/index.json')` for the library; `fetch('timelines/<id>.json')` per timeline, cached in memory.
- **No dependencies.** Animations via Web Animations API. Markdown via the small in-house renderer from the prototype (headings, bold/italic/code, lists, blockquotes, external links, wiki-links). If markdown needs grow, swap in `marked` from a CDN — decision deferred until felt.

## Data model

One JSON file per timeline. Events nest arbitrarily deep — an event with `children` *is* a timeline.

```jsonc
// timelines/artificial-intelligence.json
{
  "id": "artificial-intelligence",     // matches filename; kebab-case
  "title": "Artificial Intelligence",
  "tagline": "From a 1950 thought experiment to machines that act on our behalf.",
  "updated": "2026-06-12",
  "events": [
    {
      "id": "chatgpt",                 // unique within its parent; route segment
      "date": "2022-11-30",            // ISO date for sorting; precision: YYYY | YYYY-MM | YYYY-MM-DD
      "display": "Nov 2022",           // optional display override; derived from date if absent
      "title": "ChatGPT",
      "tagline": "AI goes mainstream: 100M users in two months.",
      "major": true,                   // bolder title; default false
      "content": "Markdown. Supports [[wiki links]] and [[target|custom label]].",
      "sources": [                     // optional
        { "title": "OpenAI announcement", "url": "https://openai.com/blog/chatgpt" }
      ],
      "children": [ /* same shape, recursively */ ]
    }
  ]
}
```

```jsonc
// timelines/index.json — the library manifest
{ "timelines": [
  { "id": "artificial-intelligence", "title": "Artificial Intelligence",
    "tagline": "…", "eventCount": 31, "updated": "2026-06-12" }
] }
```

**Wiki-link resolution:** `[[Title]]` matches event titles case-insensitively within the current timeline first; unresolved links render as plain text (never broken). Cross-timeline links use `[[timeline-id/event-id|label]]`. Linking to a node with children opens its timeline (morph from the clicked word); linking to a leaf opens its parent level with that event's panel open and row pulse-highlighted.

**Authoring:** `SCHEMA.md` at the repo root documents every field with a complete example — written so it can be pasted into any LLM as the authoring prompt. This file is the phase-2 API/MCP contract.

## Viewer UX (as validated in the prototype)

**Layouts.** Vertical (default): spine left, full-width rows, reading column capped ~1200px. Horizontal: header in a centered column, track full-bleed across the screen; events distribute evenly across available width and only scroll when they truly overflow. Even spacing (not time-proportional) in both — a time-scale toggle is a deferred idea.

**Drill down/up.**
- Down: clicked event's title FLIP-morphs into the level heading; old rows stagger out, children stagger in; breadcrumb/subtitle fade in late.
- Up: heading shrinks back into its row in the parent. Triggers: round ↑ button beside the title, any breadcrumb ancestor, map-rail ancestor, Esc.
- One `busy` flag serializes transitions.

**Orientation.** Left map rail ("YOU ARE HERE"): ancestor chain → current level highlighted → its children, with per-node read-state dots, child counts, and a depth badge. Rail hidden under 980px (breadcrumb carries orientation alone).

**Reading.** Clicking an event opens an overlay panel — right sheet in vertical, bottom sheet in horizontal — with serif-set markdown, the event's sources listed at the foot, and an "open the <title> timeline" button when children exist. **The timeline never reflows or scrolls when reading opens**: overlays + reserved scrollbar gutters; a direct click never moves the timeline (the item is already under the cursor); horizontal mode glides the clicked item to center along the axis only. Arrivals from links/rail/keyboard (possibly off-screen) do center smoothly. Other events dim to 55% while reading.

**Dot language** (one meaning per channel): hollow = unread · tinted = read · solid + halo = reading now. Importance is title weight only. A three-item legend sits in the rail.

**Keyboard.** ↑/↓ (vertical) or ←/→ (horizontal) move selection · Enter read · ⇧Enter drill · Esc close panel, then up a level. Hint bar bottom-right.

**⌘K search.** Overlay palette; fuzzy-matches title/tagline/date across every level of the open timeline (and timeline names from the library); Enter navigates via the same morph/centering rules. From the library, searches timeline names.

**Read state.** Visited event ids per timeline in `localStorage` (`timeline:read:<id>` → array of node paths). Survives reload; no server.

## Library page

A minimal grid of cards (title, tagline, event count, updated date) from `index.json`. Click → viewer for that timeline. Same motion language (card morphs toward the timeline heading). MVP content: the AI timeline as flagship, schema-example second timeline optional.

## Error handling

- Unknown timeline id / fetch failure → friendly inline error card with a link back to the library.
- Malformed JSON → error card naming the file; console gets the parse error.
- Unknown route segment → fall back to the deepest valid ancestor level.
- Unresolved wiki link → plain text.

## Validation & testing

- `tools/validate.js` (node, zero deps): checks every file in `timelines/` against the schema — required fields, id uniqueness among siblings, date format, wiki-link resolvability, index.json consistency. Run manually pre-commit; later becomes CI and the phase-2 API validator.
- Interaction/visual QA stays manual (Chrome, Safari, Firefox, iOS Safari).

## Phase 2 (designed-for, not built)

- **Read API:** already exists — the JSON files at stable URLs.
- **MCP server / write API:** tools (`create_timeline`, `add_event`, `update_event`) that emit schema-shaped JSON and open PRs against the repo (or write files locally). Schema unchanged from MVP.
- **"Expand with AI":** button on any node sending title+context to an LLM to draft children.
- Other deferred ideas: quiz mode over visited nodes, compare lanes, time-proportional spacing, density auto-zoom, library-wide search.

## Repo layout

```
timeline/
  index.html
  css/app.css
  js/            (app.js, router.js, data.js, markdown.js, viewer.js, rail.js, panel.js, search.js)
  timelines/index.json
  timelines/artificial-intelligence.json
  SCHEMA.md
  tools/validate.js
  docs/superpowers/specs/   (this doc + prototype)
```

## Open items (explicitly not blockers)

1. Final product name + domain (GitHub Pages default URL fine for launch).
2. Whether the AI timeline's MVP content is the prototype's ~31 events or expanded further before launch.
