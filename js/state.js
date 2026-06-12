export const BASE = typeof document === 'undefined' ? '/'   // node (tests) — browser uses <base href>
  : new URL(document.baseURI).pathname.replace(/index\.html$/, '');
export const state = { layout:'v', timelineId:null, idx:null, path:[], busy:false, sel:-1,
                       pendingFrom:null, readerPushed:false, jumpStack:[] };
export const els = {};
export const handlers = {};
export function navigate(url, { replace = false } = {}){
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  handlers.route?.();
}
