#!/usr/bin/env node
// Builds the static site into dist/ from src/ (shell, pages, data, hours) and design/ (verified tokens).
// Gates: every placeholder filled, no hand-typed hex in CSS, per-section word budgets.
// Usage: node scripts/build.mjs [page.html ...]   env NOINDEX=1 adds a robots noindex meta (demo default).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => join(root, 'src', p);
const D = JSON.parse(readFileSync(src('data.json'), 'utf8'));
const hexPath = join(root, 'design', 'tokens.hex.json');
if (!existsSync(hexPath)) { console.error('design/tokens.hex.json missing: run `npm run tokens` first'); process.exit(1); }
const TOK = JSON.parse(readFileSync(hexPath, 'utf8'));
const shell = readFileSync(src('shell.html'), 'utf8');
const hoursJs = readFileSync(src('hours.js'), 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const NEEDED = ['paper', 'paper-2', 'linen', 'ink', 'ink-2', 'ink-3', 'sea', 'sea-text', 'sea-tint', 'sea-deep', 'gold-text', 'gold', 'gold-bright', 'link', 'ok', 'warn', 'err'];
for (const t of NEEDED) if (!TOK[t]) throw new Error(`tokens.hex.json missing ${t}`);
const tokensCss = '  :root { ' + NEEDED.map((t) => `--${t}: ${TOK[t].hex};`).join(' ') + ' }';
const NOINDEX = process.env.NOINDEX !== '0';

const DESCRIPTIONS = {
  'home.html': 'Hearing care from a Doctor of Audiology in Santa Maria and Arroyo Grande, California. Evaluations, hearing aids, repairs, tinnitus, and VA Community Care.',
  'first-visit.html': 'What happens at your first hearing visit, what to bring, and what it costs.',
  'services.html': 'Hearing evaluations, hearing aids, repairs and batteries, tinnitus, earwax removal, custom earmolds, assistive listening devices.',
  'veterans.html': 'How a VA Community Care referral for hearing care works, and what Hurdle Hearing does for veterans.',
  'locations.html': 'Two offices on the Central Coast: Santa Maria and Arroyo Grande, with hours and directions.',
  'location-santa-maria.html': 'Santa Maria office: hours, directions, parking, and accessibility.',
  'location-arroyo-grande.html': 'Arroyo Grande office: hours, directions, parking, and accessibility.',
  'insurance.html': 'Insurance plans billed, what is usually covered, and how to pay for hearing aids.',
  'about.html': 'Three generations of ear care in Santa Maria since 1952, and why a Doctor of Audiology.',
  'accessibility.html': 'Accessibility statement for the Hurdle Hearing website and offices.',
  'privacy.html': 'Website privacy and the Notice of Privacy Practices.',
  '404.html': 'Page not found.',
};

const sm = D.offices.find((o) => o.id === 'sm'), ag = D.offices.find((o) => o.id === 'ag');
const officeBlock = (o) => `
      <div class="office-block">
        <h3>${o.name}</h3>
        <p>${o.address1}<br>${o.address2}</p>
        <p class="num"><a class="tel" href="tel:${o.tel}">${o.phone}</a></p>
        <p class="status num" data-status="${o.id}" hidden></p>
        <table class="hours num">${o.hoursRows.map(([d, h]) => `<tr><td>${d}</td><td>${h}</td></tr>`).join('')}</table>
        <p class="muted small">${o.access}</p>
        <p class="office-links"><a href="${o.page}">Details and directions</a></p>
      </div>`;
const heroOffice = (o) => `<div class="office-line with-name" data-nocount><strong>${o.name}</strong><a class="tel" href="tel:${o.tel}">${o.phone}</a><span class="status" data-status="${o.id}">${o.hoursShort}</span></div>`;
const footOffice = (o) => `<div><h3>${o.name}</h3><ul class="num"><li>${o.address1}</li><li>${o.address2}</li><li><a href="tel:${o.tel}">${o.phone}</a></li><li>Fax ${o.fax}</li><li>${o.hoursShort}</li></ul></div>`;
const fill = (s, map) => Object.entries(map).reduce((acc, [k, v]) => acc.split(k).join(v), s);
const common = {
  __NAME__: esc(D.practice.name), __DOCTOR__: D.practice.doctor, __EMAIL__: D.practice.email,
  __SM_TEL__: sm.tel, __SM_PHONE__: sm.phone, __AG_TEL__: ag.tel, __AG_PHONE__: ag.phone,
  __CREDENTIALS__: D.practice.credentialLine, __LICENCE__: D.practice.licence + (D.practice.licenceOwnerConfirm ? ' (owner-confirm)' : ''),
  __LOGO__: 'assets/img/logo-white.png', __PHOTO__: 'assets/img/dr-hurdle.jpg',
  __HERO_OFFICES__: D.offices.map(heroOffice).join('\n        '),
  __OFFICE_BLOCKS__: D.offices.map(officeBlock).join(''),
  __FOOT_OFFICES__: D.offices.map(footOffice).join(''),
  __INTENTS__: D.intents.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join(''),
  __FIRST_VISIT__: D.firstVisit.map((t) => `<li><span>${t}</span></li>`).join(''),
  __SERVICES__: D.services.slice(0, 6).map(([n, t]) => `<li><strong>${n}</strong><span>${t}</span></li>`).join(''),
  __VA_STEPS__: D.vaSteps.map((t) => `<li><span>${t}</span></li>`).join(''),
  __INSURERS__: D.insurers.slice(0, -1).join(', ') + ', and ' + D.insurers.slice(-1),
  __REVIEW__: D.review.text, __REVIEW_SOURCE__: D.review.source,
  __OFFICES_JSON__: JSON.stringify(D.offices.map((o) => ({ id: o.id, hours: o.hours }))),
  __HOURS_JS__: hoursJs, __TOKENS__: tokensCss,
};

const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'assets'), join(dist, 'assets'), { recursive: true });
cpSync(src('robots.txt'), join(dist, 'robots.txt'));
writeFileSync(join(dist, '.nojekyll'), '');

const only = process.argv.slice(2).filter((a) => a.endsWith('.html'));
const pages = readdirSync(src('pages')).filter((f) => f.endsWith('.html') && (only.length === 0 || only.includes(f)));
let failed = false;
const text = (s) => s.replace(/<(\w+)[^>]*\bdata-nocount\b[^>]*>[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
for (const f of pages) {
  const body = readFileSync(src(`pages/${f}`), 'utf8');
  const title = (body.match(/<!-- title: (.*?) -->/) || [, D.practice.name])[1];
  const desc = (body.match(/<!-- description: (.*?) -->/) || [, DESCRIPTIONS[f] || DESCRIPTIONS['home.html']])[1];
  const current = f === 'home.html' ? 'index.html' : f;
  const nav = D.nav.map(([h, t]) => `<a href="${h}"${h === current ? ' aria-current="page"' : ''}>${esc(t)}</a>`).join('');
  const mobileNav = D.nav.map(([h, t]) => `<a class="item" href="${h}">${esc(t)}</a>`).join('');
  const footNav = D.nav.map(([h, t]) => `<li><a href="${h}">${esc(t)}</a></li>`).join('');
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    NOINDEX ? '<meta name="robots" content="noindex, nofollow">' : '',
    `<meta name="theme-color" content="${TOK.paper.hex}">`,
    '<link rel="icon" href="assets/img/favicon-32.png" sizes="32x32">',
    '<link rel="apple-touch-icon" href="assets/img/favicon-180.png">',
    '<link rel="stylesheet" href="assets/fonts/fonts.css">',
  ].filter(Boolean).join('\n');
  const inner = fill(shell, { ...common, __HEAD__: head, __NAV__: nav, __MOBILE_NAV__: mobileNav, __FOOT_NAV__: footNav, __PAGE__: fill(body, common) });
  const idx = inner.indexOf('<style>');
  const finalHtml = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + inner.slice(0, idx).trim() + '\n</head>\n<body>\n' + inner.slice(idx).trim() + '\n</body>\n</html>\n';
  const left = finalHtml.match(/__[A-Z_]+__/g);
  if (left) { console.error(`${f}: unfilled placeholders ${[...new Set(left)].join(', ')}`); failed = true; }
  const styleOnly = (finalHtml.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n').replace(tokensCss, '');
  const hexes = styleOnly.match(/#[0-9a-fA-F]{3,8}\b/g);
  if (hexes) { console.error(`${f}: hand-typed colors in CSS: ${[...new Set(hexes)].join(' ')}`); failed = true; }
  const filledBody = fill(body, common);
  for (const m of filledBody.matchAll(/<section[^>]*id="([^"]*)"[^>]*data-budget="(\d+)"[^>]*>([\s\S]*?)<\/section>/g)) {
    const words = text(m[3]).split(' ').filter(Boolean).length; const over = words > Number(m[2]);
    if (over) { console.error(`${f} · ${m[1]}: ${words} words, budget ${m[2]}  OVER`); failed = true; }
  }
  const heroM = filledBody.match(/<section class="hero"[^>]*data-budget="(\d+)"[^>]*>([\s\S]*?)<\/section>/);
  if (heroM) { const w = text(heroM[2]).split(' ').filter(Boolean).length; if (w > Number(heroM[1])) { console.error(`${f} · hero: ${w} words, budget ${heroM[1]}  OVER`); failed = true; } }
  writeFileSync(join(dist, current), finalHtml);
  console.log(`wrote dist/${current} (${Math.round(finalHtml.length / 1024)} KB)${NOINDEX ? ' noindex' : ''}`);
}
if (failed) { console.error('BUILD FAILED'); process.exit(1); }
