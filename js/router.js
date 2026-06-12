export function stripBase(pathname, base){
  if (base !== '/' && pathname.startsWith(base)) pathname = pathname.slice(base.length - 1);
  return pathname || '/';
}
export function parsePath(pathname, base){
  const p = stripBase(pathname || '/', base).replace(/index\.html$/, '');
  const segs = p.split('/').filter(Boolean);
  if (segs[0] === 't' && segs[1]) return { view: 'timeline', id: segs[1], path: segs.slice(2) };
  return { view: 'library' };
}
export function buildTimelinePath(id, pathIds, base){
  return base + 't/' + [id, ...(pathIds || [])].join('/') + '/';
}
export function buildLibraryPath(base){ return base; }
