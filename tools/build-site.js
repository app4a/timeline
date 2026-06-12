// Static site generator: every timeline node becomes a crawlable page.
// Templates here (TDD'd); the emit pipeline (main) is appended in the next task.
import { mdToHtml } from '../js/markdown.js';

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function walkFind(tl, pathIds){
  let node = { title: tl.title, tagline: tl.tagline, children: tl.events, isRoot: true };
  const chain = [node];
  for (const seg of pathIds){
    node = (node.children || []).find(e => e.id === seg);
    if (!node) throw new Error('bad path ' + pathIds.join('/'));
    chain.push(node);
  }
  return chain;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function displayDate(ev){
  if (ev.display) return ev.display;
  const [y, m, d] = (ev.date || '').split('-');
  if (d) return `${MONTHS[+m-1]} ${+d}, ${y}`;
  if (m) return `${MONTHS[+m-1]} ${y}`;
  return y || '';
}

function head(shell, { title, desc, canonical, base, jsonld }){
  return shell
    .replace(/<base href="[^"]*">/, `<base href="${base}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace('</head>', `<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>`);
}

function inject(shell, staticHtml){
  return shell.replace(/(<main class="stage" id="stage">)/, `$1
<div class="level v ssg"><div class="level-in">${staticHtml}</div></div>`);
}

function breadcrumbLd(site, base, tl, chain){
  return { '@context':'https://schema.org', '@type':'BreadcrumbList',
    itemListElement: chain.map((n, i) => ({ '@type':'ListItem', position: i + 1, name: n.title,
      item: site + base + (i === 0 ? `t/${tl.id}/` : `t/${tl.id}/${chain.slice(1, i + 1).map(x => x.id).join('/')}/`) })) };
}

export function nodePage(shell, tl, pathIds, { site, base }){
  const chain = walkFind(tl, pathIds);
  const node = chain[chain.length - 1];
  const urlPath = `t/${tl.id}/` + (pathIds.length ? pathIds.join('/') + '/' : '');
  const canonical = site + base + urlPath;
  const isLeaf = !node.isRoot && !node.children;
  const title = node.isRoot ? `${tl.title} · Timeline` : `${node.title} — ${tl.title} · Timeline`;
  const desc = node.tagline || tl.tagline;
  const ld = [breadcrumbLd(site, base, tl, chain)];
  let body;
  if (isLeaf){
    ld.push({ '@context':'https://schema.org', '@type':'Article', headline: node.title,
      description: desc, dateModified: tl.updated, mainEntityOfPage: canonical });
    body = `<article class="md"><h1>${esc(node.title)}</h1><p><b>${esc(displayDate(node))}</b> · part of <a href="${base}${`t/${tl.id}/` + pathIds.slice(0, -1).join('/')}${pathIds.length > 1 ? '/' : ''}">${esc(chain[chain.length - 2].title)}</a></p>
${mdToHtml(node.content || '', () => false)}
${node.sources?.length ? '<h2>Sources</h2><ul>' + node.sources.map(s => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a></li>`).join('') + '</ul>' : ''}</article>`;
  } else {
    body = `<h1>${esc(node.title)}</h1><p>${esc(desc)}</p><ol class="ssg-events">` +
      (node.children || []).map(ch =>
        `<li><a href="${base}${urlPath}${ch.id}/"><b>${esc(displayDate(ch))}</b> — ${esc(ch.title)}</a>${ch.tagline ? ` <span>${esc(ch.tagline)}</span>` : ''}</li>`).join('') +
      `</ol>`;
  }
  return inject(head(shell, { title, desc, canonical, base, jsonld: ld }), body);
}

export function libraryPage(shell, index, { site, base }){
  const body = `<h1>Timeline</h1><p>Beautiful, drillable timelines.</p><ul class="ssg-lib">` +
    index.timelines.map(t => `<li><a href="${base}t/${t.id}/">${esc(t.title)}</a> — ${esc(t.tagline)} (${t.eventCount} moments)</li>`).join('') + '</ul>';
  const ld = { '@context':'https://schema.org', '@type':'WebSite', name:'Timeline', url: site + base };
  return inject(head(shell, { title:'Timeline — learn anything, layer by layer',
    desc:'Beautiful, drillable timelines. Understand any topic by seeing where it came from.',
    canonical: site + base, base, jsonld: ld }), body);
}

export function sitemap(timelines, { site, base }){
  const urls = [`${site}${base}`];
  const lastmods = { [`${site}${base}`]: timelines.map(t => t.updated).sort().pop() };
  for (const tl of timelines){
    const add = (pathIds) => { const u = `${site}${base}t/${tl.id}/` + (pathIds.length ? pathIds.join('/') + '/' : '');
      urls.push(u); lastmods[u] = tl.updated; };
    add([]);
    (function walk(evs, p){ for (const e of evs || []){ add([...p, e.id]); walk(e.children, [...p, e.id]); } })(tl.events, []);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${lastmods[u]}</lastmod></url>`).join('\n')}
</urlset>\n`;
}
