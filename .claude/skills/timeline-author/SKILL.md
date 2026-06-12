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
