#!/usr/bin/env node
// Hurdle Hearing token verifier. Reads tokens.json (OKLCH), exports hex/CSS,
// checks WCAG 2 ratios and APCA-W3 (0.1.9 constants) for every allowed pair,
// simulates protanopia / deuteranopia / tritanopia (Machado 2009) and
// grayscale, and fails if any pair or brand-hue separation misses its target.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS_PATH = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(here, '..', 'design', 'tokens.json');
const PREFIX = process.argv[3] || '';
const T = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));

// ---------- color math ----------
const clamp01 = (x) => Math.max(0, Math.min(1, x));
function oklchToOklab(L, C, h) { const r = (h * Math.PI) / 180; return [L, C * Math.cos(r), C * Math.sin(r)]; }
function oklabToLinearSrgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}
function linearSrgbToOklab([r, g, b]) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}
const gam = (x) => { x = clamp01(x); return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055; };
const lin = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
function oklchToSrgb(L, C, h) { return oklabToLinearSrgb(oklchToOklab(L, C, h)).map(gam); }
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const inGamut = (L, C, h) => oklabToLinearSrgb(oklchToOklab(L, C, h)).every((v) => v >= -0.0005 && v <= 1.0005);

// WCAG 2.x
function relLum(rgb) { const [r, g, b] = rgb.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
function wcag(fg, bg) { const a = relLum(fg), b = relLum(bg); const hi = Math.max(a, b), lo = Math.min(a, b); return (hi + 0.05) / (lo + 0.05); }

// APCA-W3 0.1.9 (SA98G constants)
function apcaY(rgb) { const [r, g, b] = rgb.map((v) => clamp01(v) ** 2.4); return 0.2126729 * r + 0.7151522 * g + 0.0721750 * b; }
function apca(fg, bg) {
  const blkThrs = 0.022, blkClmp = 1.414, deltaYmin = 0.0005, loClip = 0.1;
  const normBG = 0.56, normTXT = 0.57, revTXT = 0.62, revBG = 0.65, scale = 1.14, offset = 0.027;
  let Ytxt = apcaY(fg), Ybg = apcaY(bg);
  const sc = (Y) => (Y > blkThrs ? Y : Y + (blkThrs - Y) ** blkClmp);
  Ytxt = sc(Ytxt); Ybg = sc(Ybg);
  if (Math.abs(Ybg - Ytxt) < deltaYmin) return 0;
  let sapc;
  if (Ybg > Ytxt) { sapc = (Ybg ** normBG - Ytxt ** normTXT) * scale; return sapc < loClip ? 0 : (sapc - offset) * 100; }
  sapc = (Ybg ** revBG - Ytxt ** revTXT) * scale; return sapc > -loClip ? 0 : (sapc + offset) * 100;
}

// Machado 2009 severity 1.0 matrices (linear RGB)
const CVD = {
  protanopia:   [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia:   [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
function simulate(rgb, M) { const l = rgb.map(lin); return [0, 1, 2].map((i) => gam(M[i][0] * l[0] + M[i][1] * l[1] + M[i][2] * l[2])); }
function grayscale(rgb) { const y = relLum(rgb); const g = gam(y); return [g, g, g]; }
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const labOf = (rgb) => linearSrgbToOklab(rgb.map(lin));

// ---------- compute ----------
const names = Object.keys(T.colors);
const rgb = {}, hex = {}, problems = [];
for (const n of names) {
  const { L, C, h } = T.colors[n];
  if (!inGamut(L, C, h)) problems.push(`out_of_gamut ${n} oklch(${L} ${C} ${h})`);
  rgb[n] = oklchToSrgb(L, C, h); hex[n] = toHex(rgb[n]);
}

const rows = [];
for (const [fg, bg, kind] of T.pairs) {
  const t = T.targets[kind];
  const w = wcag(rgb[fg], rgb[bg]), a = Math.abs(apca(rgb[fg], rgb[bg]));
  const pass = w >= t.wcag && a >= t.apca;
  if (!pass) problems.push(`pair_fail ${fg} on ${bg} (${kind}) wcag=${w.toFixed(2)} apca=${a.toFixed(1)} target ${t.wcag}:1 / Lc ${t.apca}`);
  rows.push({ fg, bg, kind, wcag: w, apca: a, pass });
}
const banned = T.banned.map(([fg, bg, why]) => ({ fg, bg, why, wcag: wcag(rgb[fg], rgb[bg]) }));

const sims = { normal: (c) => c, ...Object.fromEntries(Object.entries(CVD).map(([k, M]) => [k, (c) => simulate(c, M)])), grayscale };
const sep = [];
for (const [a, b] of T.separability.pairs) {
  for (const [sim, f] of Object.entries(sims)) {
    const A = labOf(f(rgb[a])), B = labOf(f(rgb[b]));
    const de = dE(A, B), dl = Math.abs(A[0] - B[0]);
    const ok = sim === 'grayscale' ? dl >= T.separability.minDeltaL : de >= T.separability.minDeltaE;
    if (!ok) problems.push(`separability_fail ${a} vs ${b} under ${sim} dE=${de.toFixed(3)} dL=${dl.toFixed(3)}`);
    sep.push({ a, b, sim, de, dl, ok });
  }
}

// ---------- exports ----------
const css = [':root {', ...names.map((n) => { const c = T.colors[n]; return `  --color-${n}: ${hex[n]}; /* oklch(${(c.L * 100).toFixed(0)}% ${c.C} ${c.h}) ${c.role} */`; }), '}', ''].join('\n');
writeFileSync(join(here, '..', 'design', PREFIX + 'tokens.css'), css);
writeFileSync(join(here, '..', 'design', PREFIX + 'tokens.hex.json'), JSON.stringify(Object.fromEntries(names.map((n) => [n, { ...T.colors[n], hex: hex[n] }])), null, 2));

const f2 = (x) => x.toFixed(2), f1 = (x) => x.toFixed(1);
const report = [];
report.push(`# Contrast report — ${T.meta.name} v${T.meta.version} (${new Date().toISOString().slice(0, 10)})`, '');
report.push('Method: OKLCH → sRGB; WCAG 2.x ratio; APCA-W3 0.1.9 Lc; Machado 2009 CVD simulation; grayscale via relative luminance.', '');
report.push('## Tokens', '', '| token | oklch | hex | role |', '|---|---|---|---|');
for (const n of names) { const c = T.colors[n]; report.push(`| ${n} | ${(c.L * 100).toFixed(0)}% ${c.C} ${c.h} | ${hex[n]} | ${c.role} |`); }
report.push('', '## Pairs (foreground on background)', '', '| fg | bg | use | WCAG | APCA Lc | target | result |', '|---|---|---|---|---|---|---|');
for (const r of rows) { const t = T.targets[r.kind]; report.push(`| ${r.fg} | ${r.bg} | ${r.kind} | ${f2(r.wcag)}:1 | ${f1(r.apca)} | ${t.wcag}:1 / Lc ${t.apca} | ${r.pass ? 'pass' : 'FAIL'} |`); }
report.push('', '## Banned pairs (documented so no one re-adds them)', '', '| fg | bg | measured | why |', '|---|---|---|---|');
for (const b of banned) report.push(`| ${b.fg} | ${b.bg} | ${f2(b.wcag)}:1 | ${b.why} |`);
report.push('', '## Brand-hue separability under simulation', '', '| pair | simulation | ΔE (OKLab) | ΔL | result |', '|---|---|---|---|---|');
for (const s of sep) report.push(`| ${s.a} vs ${s.b} | ${s.sim} | ${s.de.toFixed(3)} | ${s.dl.toFixed(3)} | ${s.ok ? 'pass' : 'FAIL'} |`);
report.push('', '## Simulated hex (for the CVD strip on the palette artboard)', '', '| token | normal | protanopia | deuteranopia | tritanopia | grayscale |', '|---|---|---|---|---|---|');
for (const n of names) report.push(`| ${n} | ${hex[n]} | ${toHex(sims.protanopia(rgb[n]))} | ${toHex(sims.deuteranopia(rgb[n]))} | ${toHex(sims.tritanopia(rgb[n]))} | ${toHex(grayscale(rgb[n]))} |`);
report.push('', problems.length ? `## Problems (${problems.length})\n\n${problems.map((p) => '- ' + p).join('\n')}` : '## Problems\n\nNone. Every pair meets its target and every brand-hue pair stays separable.');
writeFileSync(join(here, '..', 'design', PREFIX + 'contrast-report.md'), report.join('\n') + '\n');
writeFileSync(join(here, '..', 'design', PREFIX + 'simulated.json'), JSON.stringify(Object.fromEntries(names.map((n) => [n, Object.fromEntries(Object.entries(sims).map(([k, f]) => [k, toHex(f(rgb[n]))]))])), null, 2));

writeFileSync(join(here, '..', 'design', PREFIX + 'results.json'), JSON.stringify({ tokens: Object.fromEntries(names.map((n) => [n, { ...T.colors[n], hex: hex[n] }])), targets: T.targets, pairs: rows, banned, separability: sep, simulated: Object.fromEntries(names.map((n) => [n, Object.fromEntries(Object.entries(sims).map(([k, f]) => [k, toHex(f(rgb[n]))]))])) }, null, 2));
console.log(`${names.length} tokens, ${rows.length} pairs, ${sep.length} separability checks`);
for (const r of rows) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.fg.padEnd(11)} on ${r.bg.padEnd(11)} ${r.kind.padEnd(7)} ${f2(r.wcag).padStart(5)}:1  Lc ${f1(r.apca).padStart(5)}`);
if (problems.length) { console.error('\nPROBLEMS:\n' + problems.join('\n')); process.exit(1); }
console.log('all targets met; wrote tokens.css, tokens.hex.json, simulated.json, contrast-report.md');
