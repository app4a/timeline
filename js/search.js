import { state, els, handlers, navigate, BASE } from './state.js';
import { displayDate } from './data.js';
import { buildTimelinePath } from './router.js';

export function searchNodes(idx, query){
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const node of idx.byPath.values()){
    const title = node.title.toLowerCase();
    const tag = (node.tagline || '').toLowerCase();
    let score = null;
    if (title.startsWith(q)) score = 0;
    else if (title.includes(q)) score = 1;
    else if (tag.includes(q) || displayDate(node).toLowerCase().includes(q)) score = 2;
    if (score !== null) out.push({ node, score });
  }
  return out.sort((a, b) => a.score - b.score ||
                            a.node.pathIds.length - b.node.pathIds.length ||
                            a.node.title.localeCompare(b.node.title)).slice(0, 12);
}

/* ---------- palette UI ---------- */
export function initSearch(){
  const sd = els.search, input = sd.querySelector('input'), list = sd.querySelector('.sk-list');
  let results = [], cursor = 0;

  function open(){ if (!state.idx) return; sd.classList.add('on'); input.value = ''; render(); input.focus(); }
  function close(){ sd.classList.remove('on'); }
  function render(){
    results = searchNodes(state.idx, input.value);
    cursor = Math.min(cursor, Math.max(0, results.length - 1));
    list.innerHTML = results.length ? '' : '<div class="sk-empty">No moments match.</div>';
    results.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'sk-row' + (i === cursor ? ' cur' : '');
      const parents = []; for (let p = r.node.parent; p; p = p.parent) parents.unshift(p.title);
      const crumb = parents.join(' / ');
      row.innerHTML = '<div><div class="sk-t"></div><div class="sk-c"></div></div><div class="sk-d"></div>';
      row.querySelector('.sk-t').textContent = r.node.title;
      row.querySelector('.sk-c').textContent = crumb;
      row.querySelector('.sk-d').textContent = displayDate(r.node);
      row.onclick = () => go(r.node);
      list.appendChild(row);
    });
  }
  function go(node){
    close();
    if (node.children){
      state.jumpStack.push({ title: state.path[state.path.length - 1].title, url: location.pathname });
      if (state.jumpStack.length > 5) state.jumpStack.shift();
      state.clearJumpOnRoute = false;
      handlers.drill(node, null);
    } else {
      const target = node.parent;
      if (target === state.path[state.path.length - 1]) handlers.focusChild(node);
      else {
        state.jumpStack.push({ title: state.path[state.path.length - 1].title, url: location.pathname });
        if (state.jumpStack.length > 5) state.jumpStack.shift();
        state.clearJumpOnRoute = false;
        navigate(buildTimelinePath(state.timelineId, target.pathIds, BASE));
        setTimeout(() => handlers.focusChild(node), 900);
      }
    }
  }
  input.addEventListener('input', () => { cursor = 0; render(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown'){ cursor = Math.min(results.length - 1, cursor + 1); render(); e.preventDefault(); }
    if (e.key === 'ArrowUp'){ cursor = Math.max(0, cursor - 1); render(); e.preventDefault(); }
    if (e.key === 'Enter' && results[cursor]) go(results[cursor].node);
    if (e.key === 'Escape') close();
    e.stopPropagation();
  });
  sd.addEventListener('click', e => { if (e.target === sd) close(); });
  window.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); open(); }
  });
}
