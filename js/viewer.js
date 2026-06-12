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
  /* drag + wheel — with click/drag discrimination so card clicks always land */
  let down = false, moved = false, sx = 0, sl = 0;
  wrap.addEventListener('pointerdown', e => { down = true; moved = false; sx = e.clientX; sl = wrap.scrollLeft; });
  window.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - sx;
    if (!moved && Math.abs(dx) < 6) return;
    moved = true; wrap.classList.add('drag'); wrap.scrollLeft = sl - dx;
  });
  window.addEventListener('pointerup', () => { down = false; wrap.classList.remove('drag'); setTimeout(() => { moved = false; }, 0); });
  wrap.addEventListener('click', e => { if (moved){ e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  wrap.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)){ wrap.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive:false });
  return wrap;
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
  if (!state.cur || !els.stage.contains(state.cur)) { state.path = chain; renderCurrent(); }
  else transitionTo(chain);
}

/* ---------- handler wiring (instant versions; Task 10 adds morphs) ---------- */
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
