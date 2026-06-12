export function parseHash(hash){
  const segs = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  if (segs[0] === 't' && segs[1]) return { view:'timeline', id:segs[1], path:segs.slice(2) };
  return { view:'library' };
}
export function buildTimelineHash(id, pathIds){ return '#/t/' + [id, ...(pathIds || [])].join('/'); }
export function buildLibraryHash(){ return '#/'; }
