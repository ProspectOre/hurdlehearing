#!/usr/bin/env node
// Serves dist/ locally: npm run serve → http://127.0.0.1:8787/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const types = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', png: 'image/png', jpg: 'image/jpeg', woff2: 'font/woff2', txt: 'text/plain' };
createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html');
  try { const b = await readFile(join(dist, p)); res.setHeader('content-type', types[p.split('.').pop()] || 'application/octet-stream'); res.end(b); }
  catch { res.statusCode = 404; res.end(await readFile(join(dist, '404.html')).catch(() => 'not found')); }
}).listen(8787, () => console.log('http://127.0.0.1:8787/'));
