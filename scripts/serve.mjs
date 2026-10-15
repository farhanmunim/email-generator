// Tiny static file server for local development (no dependencies).
// Applies the same headers as public/_headers so CSP problems show up locally.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const port = Number(process.env.PORT) || 8788;
const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

let csp = '';
try {
  const headers = await readFile(join(root, '_headers'), 'utf8');
  csp = /Content-Security-Policy:\s*(.+)/.exec(headers)?.[1]?.trim() || '';
} catch { /* optional */ }

createServer(async (req, res) => {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (path === '/api/send-test') {
      // Mirrors the Pages Function when it is not configured (see functions/api/send-test.js).
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ enabled: false }));
    }
    if (path.endsWith('/')) path += 'index.html';
    const file = join(root, path);
    if (!file.startsWith(root)) throw new Error('forbidden');
    if (!(await stat(file)).isFile()) throw new Error('nf');
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', ...(csp && { 'Content-Security-Policy': csp }) });
    res.end(await readFile(file));
  } catch {
    // Like Cloudflare Pages: serve 404.html with a real 404 status.
    const body = await readFile(join(root, '404.html')).catch(() => 'Not found');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
