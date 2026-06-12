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
