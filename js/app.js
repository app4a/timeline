import { els, state } from './state.js';
import { parseHash, buildLibraryHash } from './router.js';
import { renderLibrary } from './library.js';
import { renderTimelineRoute } from './viewer.js';

els.stage = document.getElementById('stage');
els.rail  = document.getElementById('rail');
els.seg   = document.getElementById('seg');

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

window.addEventListener('hashchange', route);
route();
