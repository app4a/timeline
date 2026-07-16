import { state, els, handlers, navigate, BASE } from './state.js';
import { mdToHtml } from './markdown.js';
import { displayDate, loadTimeline, indexTimeline, resolvePath } from './data.js';
import { buildTimelinePath } from './router.js';

function resolveWiki(target){
  if (target.includes('/')) return true;             // cross-timeline: validated at build time
  return state.idx.byTitle.has(target.toLowerCase());
}

function setReadingTarget(evEl){
  state.cur.querySelectorAll('.open').forEach(x => { x.classList.remove('open'); x.removeAttribute('aria-current'); });
  const cont = state.cur.querySelector('.events,.htrack');
  if (cont) cont.classList.add('reading');
  if (evEl){ evEl.classList.add('open'); evEl.setAttribute('aria-current', 'true'); }
}

handlers.openReader = (node, evEl, opts = {}) => {
  if (state.busy) return;
  if (!node.children && node.pathIds){
    const url = buildTimelinePath(state.timelineId, node.pathIds, BASE);
    if (location.pathname !== url){
      // sibling nav only replaces once a reading entry actually exists — a branch-first
      // session must still push its first leaf, or Back would skip the level entirely
      if (opts.replace && state.readerPushed) history.replaceState(null, '', url);
      else { history.pushState(null, '', url); state.readerPushed = true; }
    }
  } else if (node.children && opts.replace && state.path.length){  // branch sibling: URL falls back to the level
    const url = buildTimelinePath(state.timelineId, state.path[state.path.length - 1].pathIds, BASE);
    if (location.pathname !== url) history.replaceState(null, '', url);
  }
  const panel = els.panel;
  const want = state.layout === 'v' ? 'vp' : 'hp';
  if (!panel.classList.contains(want)){
    panel.classList.remove('openp','vp','hp');
    panel.classList.add(want);
    void panel.offsetWidth;          // settle closed position so the slide-in animates from the correct edge
  }
  document.getElementById('pyr').textContent = displayDate(node);
  document.getElementById('pti').textContent = node.title;
  document.getElementById('pmeta').innerHTML = node.children
    ? '<button class="kids" id="panelDrill">▸ open this timeline</button>' : '';
  let html = '<div class="md">' + mdToHtml(node.content || '*No notes yet.*', resolveWiki) + '</div>';
  if (node.sources && node.sources.length){
    html += '<div class="srcs"><div class="lb">Sources</div><ul>' +
      node.sources.map(s => '<li><a href="' + s.url.replace(/"/g,'&quot;') +
        '" target="_blank" rel="noopener"></a></li>').join('') + '</ul></div>';
  }
  const pb = document.getElementById('pbody');
  pb.innerHTML = html;
  if (node.sources) pb.querySelectorAll('.srcs a').forEach((a, i) => a.textContent = node.sources[i].title);
  pb.scrollTop = 0;
  panel.classList.add('openp');
  const mobile = matchMedia('(max-width:700px)').matches;   // full-screen sheet behaves like a dialog
  panel.setAttribute('role', mobile ? 'dialog' : 'complementary');
  if (mobile) panel.setAttribute('aria-modal', 'true'); else panel.removeAttribute('aria-modal');
  state.readingNode = node;
  setReadingTarget(evEl);
  /* never move the timeline on a direct click — the item is already under the cursor.
     horizontal mode glides along the axis only, the one motion that aids orientation. */
  if (evEl && state.layout === 'h') evEl.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
  handlers.markSeen(node, evEl);
  renderPanelNav(node);
  const pd = document.getElementById('panelDrill');
  if (pd) pd.onclick = () => handlers.drill(node, document.getElementById('pti'));
};

/* re-apply the reading highlight after a level rebuild (e.g. quieter-run expansion) */
handlers.remarkReading = () => {
  if (!state.readingNode || !els.panel.classList.contains('openp')) return;
  let evEl = null;
  state.cur.querySelectorAll('.event').forEach(e => { if (e.__node === state.readingNode) evEl = e; });
  setReadingTarget(evEl);
};

/* chronological prev/next among the current level's moments — reading becomes a flow */
function renderPanelNav(node){
  const nav = document.getElementById('pnav');
  const sibs = node.parent ? node.parent.children : null;
  if (!nav) return;
  if (!sibs || sibs.length < 2){ nav.hidden = true; return; }
  const i = sibs.indexOf(node);
  nav.hidden = false;
  document.getElementById('pcount').textContent = (i + 1) + ' of ' + sibs.length;
  const goTo = j => {
    const target = sibs[j];
    if (!target) return;
    const find = () => {
      let el = null;
      state.cur?.querySelectorAll('.event').forEach(e => { if (e.__node === target) el = e; });
      return el;
    };
    let evEl = find();
    if (!evEl){ handlers.revealChild?.(target); evEl = find(); }   // target inside a collapsed run
    handlers.openReader(target, evEl, { replace: true });
    if (evEl && state.layout === 'v') evEl.scrollIntoView({ behavior:'smooth', block:'nearest' });
  };
  const prev = document.getElementById('pprev'), next = document.getElementById('pnext');
  prev.disabled = i <= 0; next.disabled = i >= sibs.length - 1;
  if (prev.disabled && document.activeElement === prev) next.focus();   // don't strand keyboard focus
  if (next.disabled && document.activeElement === next) prev.focus();
  prev.onclick = () => goTo(i - 1);
  next.onclick = () => goTo(i + 1);
}

handlers.closeReader = () => {
  els.panel.classList.remove('openp');
  state.readingNode = null;
  if (state.cur){
    state.cur.querySelectorAll('.open').forEach(x => x.classList.remove('open'));
    const cont = state.cur.querySelector('.events,.htrack');
    if (cont) cont.classList.remove('reading');
  }
  if (state.readerPushed){ state.readerPushed = false; history.back(); }
  else if (state.idx && !state.busy && state.path.length){
    const url = buildTimelinePath(state.timelineId, state.path[state.path.length - 1].pathIds, BASE);
    if (location.pathname !== url) history.replaceState(null, '', url);
  }
};

/* wiki-link click delegation (same + cross timeline) */
async function followWiki(target, fromEl){
  const pushJump = () => {
    const originTitle = document.getElementById('pti')?.textContent || state.path[state.path.length - 1].title;
    state.jumpStack.push({ title: originTitle, url: location.pathname });
    if (state.jumpStack.length > 5) state.jumpStack.shift();
    state.clearJumpOnRoute = false;
  };
  if (!target.includes('/')){
    const node = state.idx.byTitle.get(target.toLowerCase());
    if (!node) return;
    if (node.children){
      pushJump();
      handlers.drill(node, fromEl);
    } else if (node.parent === state.path[state.path.length - 1]){
      pushJump();
      handlers.focusChild(node);
      handlers.renderJumpChip?.();
    }
    else {
      state.readerPushed = false;
      handlers.closeReader();
      state.pendingFrom = fromEl ? fromEl.getBoundingClientRect() : null;
      pushJump();
      navigate(buildTimelinePath(state.timelineId, node.parent.pathIds, BASE));
      setTimeout(() => handlers.focusChild(node), 900);
    }
    return;
  }
  const [tlId, ...segs] = target.split('/').filter(Boolean);   // cross-timeline
  state.readerPushed = false;
  handlers.closeReader();
  try {
    const idx = indexTimeline(await loadTimeline(tlId));
    const chain = resolvePath(idx, segs);
    const node = chain[chain.length - 1];
    const landTimeline = node.children ? node : node.parent;
    pushJump();
    navigate(buildTimelinePath(tlId, landTimeline.pathIds, BASE));
    if (!node.children) setTimeout(() => handlers.focusChild(node), 900);
  } catch {
    pushJump();
    navigate(buildTimelinePath(tlId, [], BASE));
  }
}

document.addEventListener('click', e => {
  const w = e.target.closest('.wl');
  if (w) followWiki(w.dataset.wiki, w);
});
document.getElementById('pclose')?.addEventListener('click', () => handlers.closeReader());

/* mobile sheet: swipe down on the header to dismiss */
(() => {
  const panel = document.getElementById('panel');
  const ph = panel?.querySelector('.ph');
  if (!ph) return;
  let startY = null, dy = 0;
  ph.addEventListener('touchstart', e => {
    if (!matchMedia('(max-width:700px)').matches) return;
    startY = e.touches[0].clientY; dy = 0;
    panel.style.transition = 'none';
  }, { passive: true });
  ph.addEventListener('touchmove', e => {
    if (startY === null) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  ph.addEventListener('touchend', () => {
    if (startY === null) return;
    panel.style.transition = '';
    panel.style.transform = '';
    if (dy > 90) handlers.closeReader();
    startY = null;
  });
})();
