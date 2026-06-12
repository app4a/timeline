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
