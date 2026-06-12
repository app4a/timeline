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

- Hash routes: `#/` library · `#/t/<timeline>/<node>/…` — every drill level is shareable.
- Read-state lives in `localStorage` (`timeline:read:<id>`).
- The JSON schema is the future read-API/MCP contract — serve the files, that's the API.
- Reading opens in an overlay panel; the timeline never reflows or scrolls underneath you.
- Keyboard: arrows move · Enter read · ⇧Enter drill · Esc up · ⌘K search.

## Known MVP limits

- ⌘K searches the open timeline (library-wide search later).
- Even event spacing (a time-proportional toggle is a future idea).
- Quiz mode, compare lanes, dark mode, in-app editing: deferred by design.
