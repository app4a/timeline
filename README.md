# Timeline

Beautiful, drillable timelines — learn anything by seeing where it came from, layer by layer.

**Live:** https://app4a.github.io/timeline/ (after Pages is enabled)

## Develop

```bash
npm run serve       # http://localhost:8080 — SPA-fallback dev server (path routes like /t/ai/ work)
npm run build       # generate _site/ — static per-node pages, sitemap, robots, 404
npm run serve:site  # serve _site/ locally (preview the built output)
npm test            # node --test — markdown, router, data, search, validator
npm run validate    # checks every file in timelines/ against SCHEMA.md rules
```

No npm dependencies. `js/` are plain ES modules; `css/app.css` holds all styles with design
tokens at the top.

## Add a timeline

1. Read `SCHEMA.md` (or paste it into an LLM with "write me a timeline about X").
2. Save the result as `timelines/<id>.json`, add an entry to `timelines/index.json`.
3. `npm run validate` until clean. Done — it's on the library page.

## Architecture notes

- Path routes: `/` library · `/t/<timeline>/<node>/…/` — every drill level is shareable and bookmarkable.
- Read-state lives in `localStorage` (`timeline:read:<id>`).
- The JSON schema is the future read-API/MCP contract — serve the files, that's the API.
- Reading opens in an overlay panel; the timeline never reflows or scrolls underneath you.
- Keyboard: arrows move · Enter read · ⇧Enter drill · Esc up · ⌘K search.

## SEO & deploy

GitHub Actions auto-deploys `_site/` to GitHub Pages on every push to master.

**One-time setup — Google Search Console:**
1. Verify site ownership using the HTML-file method: download the verification file from Search Console and drop it in the repo root. Any root-level `.html` verification file is automatically copied to `_site/` by the generator (add a `cpSync` line for it in `tools/build-site.js` when doing so).
2. Submit the sitemap at `https://app4a.github.io/timeline/sitemap.xml`.

## Author with Claude

In Claude Code, say: **build a timeline about X** — the `timeline-author` skill researches,
authors, validates, and publishes; you get the live URL back.

## Known MVP limits

- ⌘K searches the open timeline (library-wide search later).
- Even event spacing (a time-proportional toggle is a future idea).
- Quiz mode, compare lanes, dark mode, in-app editing: deferred by design.
