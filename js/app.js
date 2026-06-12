import { els, state } from './state.js';
import { parseHash } from './router.js';
import { renderLibrary } from './library.js';

els.stage = document.getElementById('stage');
els.rail  = document.getElementById('rail');
els.seg   = document.getElementById('seg');

async function route(){
  const parsed = parseHash(location.hash);
  if (parsed.view === 'library') { await renderLibrary(); return; }
  // timeline view arrives in Task 9
  console.log('timeline route', parsed);
}

window.addEventListener('hashchange', route);
route();
