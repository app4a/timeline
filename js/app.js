import { els, state, handlers } from './state.js';
import { parseHash, buildLibraryHash } from './router.js';
import { renderLibrary } from './library.js';
import { renderTimelineRoute, renderCurrent } from './viewer.js';
import { initSearch } from './search.js';

els.stage = document.getElementById('stage');
els.rail  = document.getElementById('rail');
els.seg   = document.getElementById('seg');
els.panel = document.getElementById('panel');
els.search = document.getElementById('search');
els.hint = document.getElementById('hint');

function renderHint(){
  if (!state.idx){ els.hint.innerHTML = ''; return; }
  const move = state.layout === 'v' ? '<kbd>↑</kbd><kbd>↓</kbd>' : '<kbd>←</kbd><kbd>→</kbd>';
  els.hint.innerHTML = move + ' move &nbsp; <kbd>Enter</kbd> read &nbsp; <kbd>⇧Enter</kbd> open timeline' +
                       ' &nbsp; <kbd>Esc</kbd> up &nbsp; <kbd>⌘K</kbd> search';
}

window.addEventListener('keydown', e => {
  if (state.busy || !state.idx || !state.cur) return;
  if (els.search.classList.contains('on')) return;
  const evs = [...state.cur.querySelectorAll('.event')];
  const fwd = state.layout === 'v' ? 'ArrowDown' : 'ArrowRight';
  const bck = state.layout === 'v' ? 'ArrowUp' : 'ArrowLeft';
  if (e.key === fwd || e.key === bck){
    e.preventDefault();
    state.sel = e.key === fwd ? Math.min(evs.length - 1, state.sel + 1) : Math.max(0, state.sel - 1);
    evs.forEach((x, i) => x.classList.toggle('focused', i === state.sel));
    evs[state.sel]?.scrollIntoView({ behavior:'smooth', block:'center', inline:'center' });
  }
  if (e.key === 'Enter' && evs[state.sel]){
    const node = evs[state.sel].__node;
    if (e.shiftKey && node.children) handlers.drill(node, evs[state.sel].querySelector('.ti'));
    else handlers.openReader(node, evs[state.sel]);
  }
  if (e.key === 'Escape'){
    if (els.panel.classList.contains('openp')) handlers.closeReader();
    else if (state.path.length > 1) handlers.goUpTo(state.path.length - 2);
  }
});

document.querySelectorAll('#seg button').forEach(b => {
  b.onclick = () => {
    if (state.busy || b.dataset.l === state.layout) return;
    document.querySelectorAll('#seg button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    state.layout = b.dataset.l;
    handlers.closeReader?.();
    els.panel.classList.remove('vp','hp');
    renderCurrent();
    renderHint();
    state.cur.animate([{opacity:0, transform:'scale(.985)'},{opacity:1, transform:'none'}],
                      {duration:380, easing:'cubic-bezier(.2,.7,.2,1)', fill:'both'});
  };
});

function errorCard(err){
  const msg = err.code === 'notfound' ? 'That timeline doesn’t exist.'
            : err.code === 'badjson'  ? 'This timeline’s data file is malformed.'
            : 'Couldn’t load data — are you offline?';
  const lvl = document.createElement('div');
  lvl.className = 'level';
  lvl.innerHTML = '<div class="level-in"><div class="errcard">' +
    '<h2>Hmm.</h2><p>' + msg + '</p>' +
    '<a href="' + buildLibraryHash() + '">← Back to the library</a></div></div>';
  els.stage.querySelectorAll('.level').forEach(l => l.remove());
  els.stage.appendChild(lvl);
  console.error(err);
}

async function route(){
  const parsed = parseHash(location.hash);
  try {
    if (parsed.view === 'library') await renderLibrary();
    else await renderTimelineRoute(parsed);
  } catch (err) { errorCard(err); }
  renderHint();
}

initSearch();
window.addEventListener('hashchange', route);
route();
