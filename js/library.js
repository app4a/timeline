import { els, state, handlers, navigate, BASE } from './state.js';
import { loadIndex, getProgress, getLast } from './data.js';
import { buildTimelinePath } from './router.js';

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
    const prog = getProgress(t.id, t.eventCount);
    if (prog.read > 0){
      const bar = document.createElement('div'); bar.className = 'prog';
      bar.innerHTML = '<div class="bar"><i></i></div><span></span><a class="cont">Continue →</a>';
      bar.querySelector('i').style.width = prog.pct + '%';
      bar.querySelector('span').textContent = prog.pct + '% read';
      bar.querySelector('.cont').onclick = e => {
        e.stopPropagation();
        const last = getLast(t.id);
        navigate(buildTimelinePath(t.id, last ? last.split('/') : [], BASE));
      };
      card.appendChild(bar);
    }
    card.onclick = () => navigate(buildTimelinePath(t.id, [], BASE));
    grid.appendChild(card);
  }
  inner.appendChild(grid);
  lvl.appendChild(inner);
  els.stage.querySelectorAll('.level').forEach(l => l.remove());
  els.stage.appendChild(lvl);
  lvl.animate([{opacity:0, transform:'translateY(8px)'},{opacity:1, transform:'none'}],
              {duration:380, easing:'cubic-bezier(.2,.7,.2,1)'});
}
