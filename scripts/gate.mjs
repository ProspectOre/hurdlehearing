#!/usr/bin/env node
// Release gate for dist/: every page at 1440 and 390 must have no horizontal scroll and zero axe violations;
// the hours logic must answer fixed test times correctly; the phone menu must work by keyboard.
import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const pages = readdirSync(dist).filter((f) => f.endsWith('.html'));
if (!pages.length) { console.error('dist/ is empty: run npm run build'); process.exit(1); }

// tiny static server so relative assets and fonts resolve like production
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript', png: 'image/png', jpg: 'image/jpeg', woff2: 'font/woff2', txt: 'text/plain' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html');
  try { const b = await readFile(join(dist, p)); res.setHeader('content-type', types[p.split('.').pop()] || 'application/octet-stream'); res.end(b); }
  catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
let failures = 0;
const fail = (m) => { failures++; console.error('FAIL ' + m); };
for (const f of pages) {
  for (const [w, h, name] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(base + f, { waitUntil: 'networkidle' });
    const sw = await page.evaluate(() => document.scrollingElement.scrollWidth);
    if (sw > w) {
      const culprits = await page.evaluate((vw) => [...document.querySelectorAll('body *')].map((el) => { const r = el.getBoundingClientRect(); return { right: Math.round(r.right), w: Math.round(r.width), tag: el.tagName.toLowerCase(), cls: el.className && el.className.baseVal === undefined ? String(el.className).slice(0, 40) : '', text: (el.textContent || '').trim().slice(0, 40) }; }).filter((x) => x.right > vw).sort((a, b) => b.right - a.right).slice(0, 6), w);
      fail(`${f} ${name}: horizontal scroll (${sw} > ${w}) ${JSON.stringify(culprits)}`);
    }
    const res = await new AxeBuilder({ page }).analyze();
    if (res.violations.length) fail(`${f} ${name}: axe ${res.violations.map((v) => `${v.id}(${v.nodes.length})`).join(' ')}`);
    if (name === 'phone' && f === 'index.html') {
      await page.click('#menu-open');
      const openState = await page.evaluate(() => document.getElementById('mobile-menu').getAttribute('data-open') + '/' + document.activeElement.id);
      if (openState !== 'true/menu-close') fail(`menu open state ${openState}`);
      await page.keyboard.press('Escape');
      const closed = await page.evaluate(() => document.getElementById('mobile-menu').getAttribute('data-open') + '/' + document.activeElement.id);
      if (closed !== 'false/menu-open') fail(`menu close state ${closed}`);
    }
    if (name === 'desktop' && f === 'index.html') {
      const t = await page.evaluate(() => [
        window.hhStatus('ag', new Date('2026-09-07T17:00:00Z')).open,           // Monday 10:00 Pacific → open
        window.hhStatus('ag', new Date('2026-09-09T17:00:00Z')).text,           // Wednesday → closed, opens Thursday
        window.hhStatus('sm', new Date('2026-09-11T20:30:00Z')).text,           // Friday 13:30 Pacific → closed, opens Monday
      ]);
      if (t[0] !== true) fail('hours: Arroyo Grande Monday 10:00 should be open');
      if (!/tomorrow 9 AM/.test(t[1])) fail(`hours: Arroyo Grande Wednesday → "${t[1]}"`);
      if (!/Monday 9 AM/.test(t[2])) fail(`hours: Santa Maria Friday afternoon → "${t[2]}"`);
    }
    await ctx.close();
    console.log(`ok   ${f} ${name}`);
  }
}
await browser.close(); server.close();
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log(`gate passed: ${pages.length} pages, both viewports, hours and menu checks`);
