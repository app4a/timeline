const cache = { index:null, timelines:new Map() };

async function fetchJson(url, notFoundCode){
  let res;
  try { res = await fetch(url); }
  catch { throw { code:'network', url }; }
  if (res.status === 404) throw { code:'notfound', url };
  if (!res.ok) throw { code:'network', url };
  try { return await res.json(); }
  catch { throw { code:'badjson', url }; }
}

export async function loadIndex(){
  if (!cache.index) cache.index = await fetchJson('timelines/index.json');
  return cache.index;
}

export async function loadTimeline(id){
  if (!cache.timelines.has(id))
    cache.timelines.set(id, await fetchJson('timelines/' + encodeURIComponent(id) + '.json'));
  return cache.timelines.get(id);
}

export function indexTimeline(tl){
  const root = { id: tl.id, title: tl.title, tagline: tl.tagline, children: tl.events,
                 isRoot: true, parent: null, pathIds: [] };
  const byTitle = new Map(), byPath = new Map();
  (function walk(node){
    for (const ch of node.children || []){
      ch.parent = node;
      ch.pathIds = [...node.pathIds, ch.id];
      byTitle.set(ch.title.toLowerCase(), ch);
      byPath.set(ch.pathIds.join('/'), ch);
      walk(ch);
    }
  })(root);
  return { root, byTitle, byPath };
}

export function resolvePath(idx, segs){
  const chain = [idx.root];
  let node = idx.root;
  for (const seg of segs || []){
    const next = (node.children || []).find(c => c.id === seg);
    if (!next) break;
    chain.push(next); node = next;
  }
  return chain;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function displayDate(ev){
  if (ev.display) return ev.display;
  const [y, m, d] = (ev.date || '').split('-');
  if (d) return `${MONTHS[+m-1]} ${+d}, ${y}`;
  if (m) return `${MONTHS[+m-1]} ${y}`;
  return y || '';
}

const readKey = id => 'timeline:read:' + id;
const lastKey = id => 'timeline:last:' + id;
export function getRead(timelineId, storage = localStorage){
  try { return new Set(JSON.parse(storage.getItem(readKey(timelineId)) || '[]')); }
  catch { return new Set(); }
}
export function markRead(timelineId, pathKey, storage = localStorage){
  const set = getRead(timelineId, storage);
  set.add(pathKey);
  storage.setItem(readKey(timelineId), JSON.stringify([...set]));
  storage.setItem(lastKey(timelineId), pathKey);
  return set;
}
export function getLast(timelineId, storage = localStorage){
  return storage.getItem(lastKey(timelineId));
}
export function getProgress(timelineId, total, storage = localStorage){
  const read = Math.min(getRead(timelineId, storage).size, total);  // stale keys never overflow the bar
  return { read, total, pct: total ? Math.round(read / total * 100) : 0 };
}
