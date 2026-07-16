/* Density grouping: on dense levels, runs of consecutive minor events collapse behind
   a "+ N quieter moments" expander so the spine tells the story majors-first.
   Pure function — the viewer renders whatever this returns. */

const THRESHOLD = 10;   // levels with more events than this may collapse
const MIN_RUN = 3;      // only runs of at least this many consecutive minors collapse

export function groupEvents(children, expanded = new Set()){
  const items = children || [];
  if (items.length <= THRESHOLD) return [{ type: 'events', items }];

  const groups = [];
  let visible = [], run = [];
  const flushVisible = () => { if (visible.length){ groups.push({ type: 'events', items: visible }); visible = []; } };
  const flushRun = () => {
    if (!run.length) return;
    const isExpanded = run.some(x => expanded.has(x.id));
    if (run.length >= MIN_RUN && !isExpanded){ flushVisible(); groups.push({ type: 'collapsed', items: run }); }
    else visible.push(...run);
    run = [];
  };
  for (const ch of items){
    if (ch.major){ flushRun(); visible.push(ch); }
    else run.push(ch);
  }
  flushRun(); flushVisible();

  // if nothing actually collapsed, present as a single plain group
  if (groups.every(g => g.type === 'events'))
    return [{ type: 'events', items }];
  return groups;
}
