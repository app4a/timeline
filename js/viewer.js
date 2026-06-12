import './panel.js';
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
