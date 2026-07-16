# Phase 3 — UI Polish Implementation Plan

**Goal:** the 11 UI improvements approved in conversation, shipped as small independent commits (each rollback-able), browser-verified progressively, with a final adversarial review before a single deploy push.

**Rules:** master only · zero deps · tests stay green at every commit · no changes to the drill/morph metaphor or visual language · SSG stays in sync (css/js are copied by the generator; index.html is the shell).

## Commit groups (in order)

| # | Group | Files | Notes |
|---|---|---|---|
| A | Surface-token refactor | css/app.css | Pure refactor: literal `#fff`/hover/inset colors → `--surface/--hover/--inset/--tint-bg/--glass/--md-ink/--md-soft` tokens. No visual change. Prerequisite for dark mode. |
| B | Dark mode (auto) | css/app.css, index.html | `prefers-color-scheme: dark` token overrides + `:root[data-theme=dark]` override hook (enables testing + future manual toggle). `color-scheme` set per theme. No toggle UI (YAGNI). |
| C | Wide-screen measure | css/app.css | Reading column and panel widen on large screens (larger clamp caps); composition centered. CSS only, no motion. |
| D | Decade markers | js/viewer.js, css/app.css | When the decade changes between consecutive events, a quiet divider label ("1980s") appears on the spine (vertical) / axis (horizontal). Ordinal-honest (no fake proportionality). Time-proportional spacing stays deferred. |
| E | Panel prev/next | js/panel.js, css/app.css | ‹ › controls + "N of M" counter in the panel header; navigates chronologically among the current level's events. Sibling navigation uses `replaceState` (one reading entry in history); first open still pushes. |
| F | Progress | js/data.js (+test), js/rail.js, js/library.js, css/app.css | `markRead` also stores `timeline:last:<id>`; new `getProgress(timelineId, total, storage)` helper (TDD). Rail header shows "N/M read"; library cards show progress + "Continue →" to the last-read moment. |
| G | Density collapse | js/density.js (new, TDD), js/viewer.js, css/app.css | Pure `groupEvents(children, readSet?)`: on levels with >10 events, runs of ≥3 consecutive minor events collapse to "+ N quieter moments" pill; click expands (per-level, in-memory). `focusChild` auto-expands when the target is hidden. |
| H | Reduced motion + ARIA | js/viewer.js, js/app.js, css/app.css, index.html | `prefers-reduced-motion` → morph durations collapse to ~1ms + CSS transition kill; ARIA roles/labels on rail/panel/events; visually-hidden `aria-live` region announcing level changes. |
| I | Mobile sheet | css/app.css, js/panel.js | ≤700px: panel becomes full-screen sheet with drag-handle; swipe-down dismiss (touch on header). |
| J | Library mini-spines | js/library.js, css/app.css | Cards render a small spine strip: era span + major dots (+ read tint) computed from the fetched timelines (Promise.all of loadTimeline — small static files). |
| K | ⌘K pill + og:image | index.html, js/app.js, js/search.js, assets/, tools/build-site.js (+tests) | Topbar ⌘K button (visible on timeline views) opening the palette; static branded `assets/og-card.png` (1200×630 via qlmanage) + `og:image`/`twitter:card` metas in the generator (tests extended). |

## Verification cadence
- Every group: `npm test` green + `node --check` on touched js + targeted browser check (dev server, real Chrome). Dark via `data-theme` override.
- After K: `npm run build` + serve `_site` locally + spot-check hydration.
- Final: multi-agent adversarial review workflow (spec coverage, a11y, dark-mode/CSS regression, interaction regression); fix findings; single `git push` (one deploy); live QA.
