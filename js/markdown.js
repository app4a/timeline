function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function wikiLink(target, label, resolveWiki){
  target = target.trim();
  if (!resolveWiki(target)) return esc(label.trim());
  return '<a class="wl" data-wiki="' + esc(target) + '">' + esc(label.trim()) + '</a>';
}

function inline(s, resolveWiki){
  // placeholders keep later passes from re-processing link internals
  const slots = [];
  const stash = html => { slots.push(html); return ' ' + (slots.length - 1) + ' '; };
  s = s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (m,t,l) => stash(wikiLink(t, l, resolveWiki)));
  s = s.replace(/\[\[([^\]]+)\]\]/g,            (m,t)   => stash(wikiLink(t, t, resolveWiki)));
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,     (m,l,u) => stash('<a class="ext" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(l) + '</a>'));
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s.replace(/ (\d+) /g, (m,i) => slots[+i]);
}

export function mdToHtml(md, resolveWiki){
  const lines = (md || '').trim().split('\n');
  let out = '', para = [], list = null, quote = null;
  const flushP = () => { if (para.length){ out += '<p>' + inline(para.join(' '), resolveWiki) + '</p>'; para = []; } };
  const flushL = () => { if (list){ out += '<ul>' + list.map(i => '<li>' + inline(i, resolveWiki) + '</li>').join('') + '</ul>'; list = null; } };
  const flushQ = () => { if (quote){ out += '<blockquote>' + inline(quote.join(' '), resolveWiki) + '</blockquote>'; quote = null; } };
  for (const raw of lines){
    const l = raw.trim();
    if (!l){ flushP(); flushL(); flushQ(); continue; }
    if (l.startsWith('### '))      { flushP(); flushL(); flushQ(); out += '<h3>' + inline(l.slice(4), resolveWiki) + '</h3>'; }
    else if (l.startsWith('## ')) { flushP(); flushL(); flushQ(); out += '<h2>' + inline(l.slice(3), resolveWiki) + '</h2>'; }
    else if (l.startsWith('- '))  { flushP(); flushQ(); (list = list || []).push(l.slice(2)); }
    else if (l.startsWith('> '))  { flushP(); flushL(); (quote = quote || []).push(l.slice(2)); }
    else para.push(l);
  }
  flushP(); flushL(); flushQ();
  return out;
}
