export const BASE = typeof document === 'undefined' ? '/'   // node (tests) — browser uses <base href>
  : new URL(document.baseURI).pathname.replace(/index\.html$/, '');
export const state = { layout:'v', timelineId:null, idx:null, path:[], busy:false, sel:-1,
                       pendingFrom:null, readerPushed:false, jumpStack:[], clearJumpOnRoute:true,
                       expandedRuns:new Map(), readingNode:null };   // levelKey -> Set<eventId> (session-only)
export const els = {};
export const handlers = {};
export function navigate(url, { replace = false } = {}){
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  handlers.route?.();
}
