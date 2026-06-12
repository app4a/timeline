# Timeline Phase 2 — Publish & Author

**Date:** 2026-06-12 · **Status:** Approved pending user review · **Builds on:** `2026-06-12-timeline-design.md` (MVP, shipped on master)

## Purpose

Make Timeline **public, findable, and authorable**: every moment gets a real URL that Google can index and a person can bookmark; navigation always has a way back; and creating or updating a timeline is one conversation with Claude that ends in a live URL.

## Decisions log

| Decision | Choice |
|---|---|
| SEO architecture | **Full SSG** — a static page per node, real path URLs replace hash routes |
| Build/deploy | **GitHub Actions** on push to master: test → validate → generate → deploy to Pages |
| Authoring | **Repo skill** (`timeline-author`) end-to-end; **no MCP server yet**, but the pipeline is factored as scripts an MCP can wrap 1:1 later |
| Domain | GitHub Pages default: `https://app4a.github.io/timeline/` |
| Launch sequencing | Deploy only after SSG lands (Google never sees hash URLs) |
| Workflow | Work directly on `master`; no worktrees/branches |

## 1 · URL model (replaces hash routing)

- `BASE/` — library
- `BASE/t/<timeline-id>/` — timeline root level
- `BASE/t/<timeline-id>/<node-id>/…/` — **every node has a URL**, any depth
  - **Branch node** URL renders that node's timeline level (its children listed)
  - **Leaf node** URL renders its parent's level with the reading panel open on it — the bookmark captures the exact reading state (requirement #4)
- `BASE` is `/timeline/` on Pages and `/` locally; the generator writes `<base href>` and the app reads it — one constant, no duplicated config.
- **Reading state is history state:** opening an event's panel `pushState`s to that node's URL; closing is `history.back()` (or × → back). Browser Back therefore always "undoes" the last navigation — panel, drill, or jump.
- **Old hash URLs redirect:** on boot, a `#/t/…` hash is translated to its path URL via `location.replace` (keeps any pre-launch links alive; cheap insurance).
- The SPA keeps working exactly as today — it boots on every generated page, reads `location.pathname`, and takes over with the interactive view (morphs, rail, search, keyboard).

## 2 · Static site generator — `tools/build-site.js` (node, zero deps)

Input: `timelines/*.json` + `index.json`. Output: `_site/` (never committed; CI artifact only; `_site/` gitignored).

Per page (every node + library):
- Full crawlable HTML: level pages = intro + child list (dates, titles, taglines, links to child URLs); leaf pages = the event rendered as a complete `<article>` — **reusing `js/markdown.js` in node** (it is already a pure ESM module) — plus its sources list.
- `<title>` = `<node title> — <timeline title> · Timeline`; meta description = tagline; canonical URL; Open Graph tags; JSON-LD (`BreadcrumbList` + `Article`).
- The same topbar/branding, stylesheet, and the SPA `<script>` mount so the page hydrates into the interactive app.

Site-wide: `sitemap.xml` (every node URL, `lastmod` from the timeline's `updated`), `robots.txt`, `404.html` (boots the app, soft-lands on the library with the error card).

Local flow: `npm run build` → `_site/`; `npm run serve:site` previews it.

## 3 · App changes

- `js/router.js`: `parsePath(pathname)` / `buildTimelinePath(id, pathIds)` replace the hash functions (tests updated); `popstate` replaces `hashchange`; all internal navigation uses `pushState`.
- **Reader-in-URL:** `openReader` pushes the node URL; `closeReader` via UI = `history.back()`. Deep-loading a leaf URL opens its parent level + panel + pulse (existing `focusChild` path).
- **Return chip (requirement #3):** wiki-link and search jumps push onto `state.jumpStack` ({title of origin}); a floating chip "← Back to <origin>" appears (bottom-left, dismissible ×) and `history.back()`s on click. Stack max 5; chip shows the latest origin; cleared on manual navigation (breadcrumb/rail/up/library). Esc semantics unchanged (close panel → up a level).

## 4 · CI/CD — `.github/workflows/deploy.yml`

On every push to master: checkout → node 20 → `npm test` → `npm run validate` → `node tools/build-site.js` → upload Pages artifact → deploy. Pages source = GitHub Actions. A failed validate/test blocks deploy — the content gate is now enforced server-side too. This is what makes requirement #2 "automatic": authoring ends at `git push`; everything else is machinery.

## 5 · Authoring skill — `.claude/skills/timeline-author/SKILL.md`

Triggers: "build/create a timeline about X", "add … to the X timeline", "update the X timeline".

Workflow the skill encodes:
1. **Scope** with the user: angle, depth, audience; target ≥20 moments for a standalone topic, nested 2–4 levels where the story has layers.
2. **Research with sources**: WebSearch/WebFetch for history; `gh api` for GitHub-history topics (releases, tags, CHANGELOG). Every major claim needs a source URL; dates verified against at least one source.
3. **Author** schema JSON (per `SCHEMA.md`): archival/editorial tone, taglines, `major` flags, "Why it matters" sections, wiki-links between related moments, cross-timeline links where genuine.
4. **Gate**: `npm run validate` until clean; `npm test`.
5. **Publish**: update `timelines/index.json` (+`eventCount` from validator output), commit on master, push.
6. **Confirm**: `gh run watch` the deploy, then return the live URL(s).

**MCP-ready seams** (the "minimum effort later" requirement): the skill performs no logic of its own — it orchestrates `tools/validate.js`, `tools/build-site.js`, and git. A future MCP server exposes the same operations as tools — `validate_timeline(json)`, `write_timeline(id, json)`, `publish()` — each a thin wrapper over those scripts. The schema (SCHEMA.md) is already the contract; nothing about content needs redesign.

## 6 · SEO operational notes

- Generated pages give Google real URLs, real content, structured data, and a sitemap — that achieves *indexed and eligible*. **Ranking position is not guaranteeable** by any architecture; it depends on competition and inbound links. Expectations set accordingly.
- One-time manual step (user): verify the site in Google Search Console (HTML-file method works on Pages — the generator can emit the verification file) and submit `sitemap.xml`. Documented in README.

## 7 · Acceptance tests (from the user)

**T1 — conversational flow:** in a Claude Code session: explore a topic via Q&A, progressively deeper, then "build a timeline of this" → the skill researches, authors ≥20 moments with sources, validates, pushes — and replies with the live URL. (Topic chosen at test time.)

**T2 — three production timelines** authored via the skill:
1. **Steve Jobs** — biography (childhood → Apple I/II → ouster → NeXT/Pixar → return → iPod/iPhone/iPad → death/legacy), nested where life chapters have inner stories.
2. **Claude** — Anthropic the company + the Claude model line (founding → safety research → Claude 1/2/3/3.5/4 era → ecosystem), sourced from primary announcements.
3. **React** — built from the official GitHub history (`facebook/react` releases/CHANGELOG): open-sourcing → key versions (0.14 split, 15, 16 Fiber, 16.8 Hooks, 17, 18 concurrent, 19) → ecosystem moments.

**Launch checklist:** repo public on GitHub, Actions deploy green, library + all node URLs live, sitemap valid, old-hash redirect works, return chip and bookmarkable reader verified on the live site.

## 8 · Out of scope (phase 2)

MCP server build (seams only), custom domain, library-wide ⌘K, auto-update routines (e.g. monthly React releases — natural phase 3), comments/social, analytics.
