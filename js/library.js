import { els, state, handlers, navigate, BASE } from './state.js';
import { loadIndex, loadTimeline, getProgress, getLast, getRead } from './data.js';
import { buildTimelinePath } from './router.js';

/* mini-spine: era span + top-level major dots, positioned proportionally by year */
function miniSpine(t, tl){
  const read = getRead(t.id);
  const years = tl.events.map(e => parseInt((e.date || '').slice(0, 4), 10)).filter(Number.isFinite);
  if (!years.length) return null;
  const min = Math.min(...years), max = Math.max(...years), span = Math.max(1, max - min);
  const el = document.createElement('div'); el.className = 'spine';
  const line = document.createElement('i'); el.appendChild(line);
  for (const e of tl.events){
    if (!e.major) continue;
    const y = parseInt((e.date || '').slice(0, 4), 10);
    if (!Number.isFinite(y)) continue;
    const dot = document.createElement('b');
    dot.style.left = (4 + ((y - min) / span) * 92) + '%';
    if (read.has(e.id)) dot.classList.add('seen');
    dot.title = displayYear(y) + ' — ' + e.title;
    el.appendChild(dot);
  }
  const a = document.createElement('span'); a.className = 'y0'; a.textContent = displayYear(min);
  const b = document.createElement('span'); b.className = 'y1'; b.textContent = displayYear(max);
  el.appendChild(a); el.appendChild(b);
  return el;
}
const displayYear = y => String(y);

export async function renderLibrary(){
  state.readerPushed = false;
  handlers.closeReader?.();
  state.idx = null;
  state.timelineId = null;
  els.rail.hidden = true;
  els.seg.hidden = true;
  const index = await loadIndex();
  const lvl = document.createElement('div');
  lvl.className = 'level';
  const inner = document.createElement('div');
  inner.className = 'level-in';
  inner.innerHTML = '<div class="libhead"><h1>Timeline</h1>' +
    '<p>Beautiful, drillable timelines. Pick a topic and see where it came from — layer by layer.</p></div>';
  const grid = document.createElement('div');
  grid.className = 'libgrid';
  for (const t of index.timelines){
    const card = document.createElement('div');
    card.className = 'libcard';
    card.innerHTML = `<h2></h2><p></p><div class="meta"><span><b>${t.eventCount}</b> moments</span><span>updated ${t.updated}</span></div>`;
    card.querySelector('h2').textContent = t.title;
    card.querySelector('p').textContent = t.tagline;
    loadTimeline(t.id).then(tl => {
      const sp = miniSpine(t, tl);
      if (sp && card.isConnected) card.insertBefore(sp, card.querySelector('.meta'));
    }).catch(() => {});
    const prog = getProgress(t.id, t.eventCount);
    if (prog.read > 0){
      const bar = document.createElement('div'); bar.className = 'prog';
      bar.innerHTML = '<div class="bar"><i></i></div><span></span><a class="cont">Continue →</a>';
      bar.querySelector('i').style.width = prog.pct + '%';
      bar.querySelector('span').textContent = prog.pct + '% read';
      const last = getLast(t.id);
      const contUrl = buildTimelinePath(t.id, last ? last.split('/') : [], BASE);
      const cont = bar.querySelector('.cont');
      cont.href = contUrl;                       // real link: focusable, cmd-clickable
      cont.onclick = e => {
        if (e.metaKey || e.ctrlKey || e.altKey || e.button !== 0){ e.stopPropagation(); return; }
        e.preventDefault(); e.stopPropagation();
        navigate(contUrl);
      };
      card.appendChild(bar);
    }
    card.onclick = () => navigate(buildTimelinePath(t.id, [], BASE));
    card.tabIndex = 0; card.setAttribute('role', 'link');
    card.addEventListener('keydown', e => {
      if (e.target !== card) return;
      if (e.key === 'Enter'){ e.preventDefault(); navigate(buildTimelinePath(t.id, [], BASE)); }
    });
    grid.appendChild(card);
  }
  inner.appendChild(grid);
  lvl.appendChild(inner);
  els.stage.querySelectorAll('.level').forEach(l => l.remove());
  els.stage.appendChild(lvl);
  const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  lvl.animate([{opacity:0, transform:'translateY(8px)'},{opacity:1, transform:'none'}],
              {duration: rm ? 1 : 380, easing:'cubic-bezier(.2,.7,.2,1)'});
}
