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

document.querySelectorAll('#seg button').forEach(b => {
  b.onclick = () => {
    if (state.busy || b.dataset.l === state.layout) return;
    document.querySelectorAll('#seg button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    state.layout = b.dataset.l;
    handlers.closeReader?.();
    els.panel.classList.remove('vp','hp');
    renderCurrent();
    state.cur.animate([{opacity:0, transform:'scale(.985)'},{opacity:1, transform:'none'}],
                      {duration:380, easing:'cubic-bezier(.2,.7,.2,1)', fill:'both'});
  };
});

function errorCard(err){
  const msg = err.code === 'notfound' ? 'That timeline doesn’t exist.'
            : err.code === 'badjson'  ? 'This timeline’s data file is malformed.'
            : 'Couldn’t load data — are you offline?';
  els.stage.innerHTML =
    '<div class="level"><div class="level-in"><div class="errcard">' +
    '<h2>Hmm.</h2><p>' + msg + '</p>' +
    '<a href="' + buildLibraryHash() + '">← Back to the library</a></div></div></div>';
  console.error(err);
}

async function route(){
  const parsed = parseHash(location.hash);
  try {
    if (parsed.view === 'library') await renderLibrary();
    else await renderTimelineRoute(parsed);
  } catch (err) { errorCard(err); }
}

initSearch();
window.addEventListener('hashchange', route);
route();
