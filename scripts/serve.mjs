// Minimal static server for dist/, mounted under a base path like GitHub Pages.
// Usage: node scripts/serve.mjs --port 4329 --base /dayline/
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => (cur.startsWith('--') ? [...acc, [cur.slice(2), arr[i + 1]]] : acc), []),
);
const port = Number(args.port ?? 4329);
const base = `/${String(args.base ?? '/').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
const root = normalize(join(process.cwd(), 'dist'));

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.wasm': 'application/wasm', '.pf_meta': 'application/octet-stream', '.txt': 'text/plain',
};

async function tryFile(path) {
  try {
    const s = await stat(path);
    if (s.isDirectory()) return tryFile(join(path, 'index.html'));
    return path;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === base.slice(0, -1)) pathname = base;
  if (!pathname.startsWith(base)) {
    res.writeHead(404).end('Not found');
    return;
  }
  const file = normalize(join(root, pathname.slice(base.length)));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  const found = await tryFile(file);
  if (!found) {
    const notFound = await tryFile(join(root, '404.html'));
    res.writeHead(404, { 'content-type': types['.html'] });
    res.end(notFound ? await readFile(notFound) : 'Not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(found)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(await readFile(found));
}).listen(port, () => console.log(`Serving dist at http://localhost:${port}${base}`));
