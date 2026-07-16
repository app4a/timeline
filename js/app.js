import { els, state, handlers, navigate, BASE } from './state.js';
import { parsePath, buildLibraryPath } from './router.js';
import { renderLibrary } from './library.js';
import { renderTimelineRoute, renderCurrent } from './viewer.js';
import { initSearch } from './search.js';

els.stage = document.getElementById('stage');
els.rail  = document.getElementById('rail');
els.seg   = document.getElementById('seg');
els.panel = document.getElementById('panel');
els.search = document.getElementById('search');
els.hint = document.getElementById('hint');
els.jumpchip = document.getElementById('jumpchip');
els.live = document.getElementById('live');

export function renderJumpChip(){
  const top = state.jumpStack[state.jumpStack.length - 1];
  els.jumpchip.hidden = !top;
  if (top) document.getElementById('jumpchipname').textContent = top.title;
}
handlers.renderJumpChip = renderJumpChip;
els.jumpchip.addEventListener('click', e => {
  if (e.target.id === 'jumpchipx'){ state.jumpStack = []; renderJumpChip(); return; }
  const top = state.jumpStack.pop();
  renderJumpChip();
  if (top){ state.clearJumpOnRoute = false; navigate(top.url); }
});

document.querySelector('.brand').addEventListener('click', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  navigate(buildLibraryPath(BASE));
});

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
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.cur.animate([{opacity:0, transform:'scale(.985)'},{opacity:1, transform:'none'}],
                      {duration: rm ? 1 : 380, easing:'cubic-bezier(.2,.7,.2,1)', fill:'both'});
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
    '<a href="' + buildLibraryPath(BASE) + '">← Back to the library</a></div></div>';
  els.stage.querySelectorAll('.level').forEach(l => l.remove());
  els.stage.appendChild(lvl);
  state.cur = null; state.sel = -1;
  state.idx = null; state.timelineId = null; state.path = [];
  els.rail.hidden = true; els.seg.hidden = true;
  console.error(err);
}

async function route(){
  const parsed = parsePath(location.pathname, BASE);
  try {
    if (parsed.view === 'library') await renderLibrary();
    else await renderTimelineRoute(parsed);
  } catch (err) { errorCard(err); }
  renderHint();
  els.live.textContent = state.idx
    ? state.path[state.path.length - 1].title + ' — ' + (state.path[state.path.length - 1].children?.length || 0) + ' moments, level ' + state.path.length
    : 'Library';
  if (state.clearJumpOnRoute) { state.jumpStack = []; }
  state.clearJumpOnRoute = true;          // default; jump initiators set it false just before navigate
  renderJumpChip();
}

handlers.route = route;

initSearch();
window.addEventListener('popstate', route);

const legacy = location.hash.match(/^#\/t\/(.+)$/);
if (legacy) location.replace(BASE + 't/' + legacy[1].replace(/\/+$/, '') + '/');
else route();
