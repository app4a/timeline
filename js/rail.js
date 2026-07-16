import { state, els, handlers } from './state.js';
import { getRead } from './data.js';

export function renderRail(){
  if (!state.idx || els.rail.hidden) return;
  const read = getRead(state.timelineId);
  const seen = n => n.isRoot ? false : read.has(n.pathIds.join('/'));
  els.rail.innerHTML = '';

  const h = document.createElement('div'); h.className = 'rail-h';
  h.innerHTML = '<span class="lb">YOU ARE HERE</span><span class="depth">Level ' + state.path.length + '</span>';
  els.rail.appendChild(h);
  const lg = document.createElement('div'); lg.className = 'legend';
  lg.innerHTML = '<span><i class="du"></i>unread</span><span><i class="ds"></i>read</span><span><i class="do"></i>reading now</span>';
  els.rail.appendChild(lg);

  // reading progress across the whole timeline (only moments that still exist count)
  const total = state.idx.byPath.size;
  const readCount = [...read].filter(k => state.idx.byPath.has(k)).length;
  const prog = document.createElement('div'); prog.className = 'railprog';
  prog.innerHTML = '<div class="bar"><i></i></div><span></span>';
  prog.querySelector('i').style.width = (total ? Math.round(readCount / total * 100) : 0) + '%';
  prog.querySelector('span').textContent = readCount + ' of ' + total + ' read';
  els.rail.appendChild(prog);

  let host = els.rail;
  state.path.forEach((n, i) => {
    const r = document.createElement('div');
    r.className = 'rnode ' + (i === state.path.length - 1 ? 'here' : 'anc') + (seen(n) ? ' seen' : '');
    r.innerHTML = '<span class="tick"></span><span class="nm"></span>' +
      (n.children ? '<span class="more">' + n.children.length + '</span>' : '');
    r.querySelector('.nm').textContent = n.title;
    if (i < state.path.length - 1) r.onclick = () => handlers.goUpTo(i);
    host.appendChild(r);
    const kid = document.createElement('div'); kid.className = 'rkids';
    host.appendChild(kid); host = kid;
    if (i === state.path.length - 1){
      for (const ch of n.children || []){
        const c = document.createElement('div');
        c.className = 'rnode' + (seen(ch) ? ' seen' : '');
        c.innerHTML = '<span class="tick"></span><span class="nm"></span>' +
          (ch.children ? '<span class="more">▸ ' + ch.children.length + '</span>' : '');
        c.querySelector('.nm').textContent = ch.title;
        c.onclick = () => {
          if (ch.children){
            let tEl = null;
            state.cur.querySelectorAll('.event').forEach(e => { if (e.__node === ch) tEl = e.querySelector('.ti'); });
            handlers.drill(ch, tEl);
          } else handlers.focusChild(ch);
        };
        host.appendChild(c);
      }
    }
  });
}
