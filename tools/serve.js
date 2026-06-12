// Zero-dep static server with SPA fallback for path-routed dev.
// Usage: node tools/serve.js [--dir _site] [--port 8080]
import { createServer as httpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.xml':'application/xml; charset=utf-8',
  '.txt':'text/plain; charset=utf-8', '.ico':'image/x-icon', '.webmanifest':'application/json' };

export function createServer(root){
  return httpServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      const tryFiles = [];
      if (p.endsWith('/')) tryFiles.push(join(root, p, 'index.html'));
      else if (!extname(p)) tryFiles.push(join(root, p, 'index.html'), join(root, p));
      else tryFiles.push(join(root, p));
      tryFiles.push(join(root, 'index.html'));                  // SPA fallback
      const withExt = extname(p) && !p.endsWith('/');
      for (const [i, f] of tryFiles.entries()){
        const isFallback = i === tryFiles.length - 1;
        if (isFallback && withExt) break;                       // real assets 404 honestly
        try {
          const body = await readFile(f);
          res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream',
                               'cache-control': 'no-cache' });
          res.end(body);
          return;
        } catch { /* try next */ }
      }
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
    } catch { res.writeHead(500); res.end(); }
  });
}

if (import.meta.url === `file://${process.argv[1]}`){
  const args = process.argv.slice(2);
  const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : '.';
  const port = args.includes('--port') ? +args[args.indexOf('--port') + 1] : 8080;
  createServer(dir).listen(port, () => console.log(`serving ${dir} on http://localhost:${port}`));
}
