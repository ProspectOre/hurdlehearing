#!/usr/bin/env node
// Generates decorative inline SVG for the site into src/svg/motifs.json.
// Every SVG uses currentColor only (the page sets color via CSS), no width/height,
// viewBox + aria-hidden + focusable="false". Coordinates are generated and rounded.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const r1 = (n) => Math.round(n * 10) / 10;
const svg = (viewBox, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${extra} aria-hidden="true" focusable="false">${body}</svg>`;

// ---------- 1. audiogram ----------
function audiogram() {
  const W = 640, H = 400, padX = 40, padY = 24;
  const freqs = 7; // 125 (implied edge), 250, 500, 1k, 2k, 4k, 8k → 7 columns
  const colX = (i) => r1(padX + (i * (W - 2 * padX)) / (freqs - 1));
  const rowY = (i) => r1(padY + (i * (H - 2 * padY)) / 11); // 12 lines, 0..110 dB at 10 dB steps
  const dbY = (db) => r1(padY + (db / 110) * (H - 2 * padY));
  let out = '';
  // vertical frequency lines
  out += '<g stroke="currentColor" stroke-width="1" opacity="0.35">';
  for (let i = 0; i < freqs; i++) out += `<line x1="${colX(i)}" y1="${padY}" x2="${colX(i)}" y2="${H - padY}"/>`;
  out += '</g>';
  // horizontal dB lines
  out += '<g stroke="currentColor" stroke-width="1" opacity="0.25">';
  for (let i = 0; i < 12; i++) out += `<line x1="${padX}" y1="${rowY(i)}" x2="${W - padX}" y2="${rowY(i)}"/>`;
  out += '</g>';
  // speech banana: closed smooth region from upper-left to lower-right through the mid grid
  const top = [[colX(0), dbY(22)], [colX(1), dbY(16)], [colX(2), dbY(18)], [colX(3), dbY(24)], [colX(4), dbY(30)], [colX(5), dbY(38)], [colX(6), dbY(46)]];
  const bot = [[colX(6), dbY(70)], [colX(5), dbY(66)], [colX(4), dbY(60)], [colX(3), dbY(56)], [colX(2), dbY(52)], [colX(1), dbY(50)], [colX(0), dbY(48)]];
  const smooth = (pts) => {
    let d = '';
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const cx = r1((x0 + x1) / 2);
      d += ` C ${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
    }
    return d;
  };
  const banana = `M ${top[0][0]} ${top[0][1]}${smooth(top)} C ${r1(colX(6) + 30)} ${r1(dbY(52))} ${r1(colX(6) + 30)} ${r1(dbY(64))} ${bot[0][0]} ${bot[0][1]}${smooth(bot)} C ${r1(colX(0) - 30)} ${r1(dbY(42))} ${r1(colX(0) - 30)} ${r1(dbY(30))} ${top[0][0]} ${top[0][1]} Z`;
  out += `<path d="${banana}" fill="currentColor" opacity="0.12"/>`;
  // right-ear threshold: mild-to-moderate high-frequency loss, 20 dB → 55 dB
  const dbs = [20, 20, 25, 30, 40, 50, 55];
  const pts = dbs.map((db, i) => [colX(i), dbY(db)]);
  out += `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
  out += '<g fill="none" stroke="currentColor" stroke-width="3" opacity="0.9">';
  for (const [x, y] of pts) out += `<circle cx="${x}" cy="${y}" r="5"/>`;
  out += '</g>';
  return svg('0 0 640 400', out);
}

// ---------- 2. arcs ----------
function arcs() {
  let out = '<g fill="currentColor">';
  const radii = [80, 136, 192, 248, 304, 360];
  radii.forEach((rad, i) => {
    const t = i / (radii.length - 1);
    const opacity = r1((0.9 - 0.55 * t) * 100) / 100;
    const dotR = r1(7 - 3 * t);
    const arcLen = (Math.PI / 2) * rad;
    const n = Math.max(3, Math.round(arcLen / 22));
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * (Math.PI / 2);
      const x = r1(rad * Math.cos(a)), y = r1(rad * Math.sin(a));
      if (x > 400 || y > 400) continue;
      out += `<circle cx="${x}" cy="${y}" r="${dotR}" opacity="${opacity}"/>`;
    }
  });
  out += '</g>';
  return svg('0 0 400 400', out);
}

// ---------- 3. wave ----------
function wave() {
  const W = 1200, mid = 40, amp = 18, periods = 3, steps = 96;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = r1((i / steps) * W);
    const y = r1(mid - amp * Math.sin((i / steps) * periods * 2 * Math.PI));
    pts.push([x, y]);
  }
  // smooth with quadratic midpoints
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[i + 1];
    d += ` Q ${x} ${y} ${r1((x + nx) / 2)} ${r1((y + ny) / 2)}`;
  }
  d += ` L ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
  return svg('0 0 1200 80', `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>`, ' preserveAspectRatio="none"');
}

// ---------- 4. maps ----------
function map(variant) {
  const W = 480, H = 240, rot = variant === 'ag' ? 8 : 0;
  const cx = W / 2, cy = H / 2;
  const rotate = rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : '';
  let out = `<rect width="${W}" height="${H}" fill="currentColor" opacity="0.06"/>`;
  // streets: 4 horizontal-ish, 4 vertical-ish, drawn oversize so rotation leaves no gaps
  out += `<g${rotate} stroke="currentColor" stroke-width="6" stroke-linecap="round" opacity="0.18">`;
  const hy = variant === 'ag' ? [38, 92, 150, 206] : [44, 98, 146, 200];
  const vx = variant === 'ag' ? [70, 150, 250, 380] : [80, 180, 270, 400];
  hy.forEach((y, i) => { const tilt = variant === 'ag' ? (i % 2 ? 6 : -4) : (i % 2 ? -3 : 3); out += `<line x1="-60" y1="${r1(y - tilt)}" x2="${W + 60}" y2="${r1(y + tilt)}"/>`; });
  vx.forEach((x, i) => { const tilt = variant === 'ag' ? (i % 2 ? -5 : 4) : (i % 2 ? 4 : -2); out += `<line x1="${r1(x - tilt)}" y1="-60" x2="${r1(x + tilt)}" y2="${H + 60}"/>`; });
  out += '</g>';
  // two avenues
  out += `<g${rotate} stroke="currentColor" stroke-width="10" stroke-linecap="round" opacity="0.22">`;
  if (variant === 'ag') out += `<line x1="-60" y1="124" x2="${W + 60}" y2="118"/><line x1="318" y1="-60" x2="326" y2="${H + 60}"/>`;
  else out += `<line x1="-60" y1="120" x2="${W + 60}" y2="126"/><line x1="228" y1="-60" x2="224" y2="${H + 60}"/>`;
  out += '</g>';
  // blocks
  out += `<g${rotate} fill="currentColor" opacity="0.08">`;
  const blocks = variant === 'ag'
    ? [[86, 50, 52, 30], [162, 50, 76, 30], [86, 160, 52, 36], [262, 160, 44, 36], [396, 100, 60, 40], [162, 100, 76, 12]]
    : [[92, 54, 76, 32], [192, 54, 66, 32], [92, 156, 76, 32], [284, 156, 104, 32], [284, 54, 104, 54], [412, 156, 50, 32]];
  for (const [x, y, w, h] of blocks) out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`;
  out += '</g>';
  // pin with ring at ~(300,120)
  const px = 300, py = 120;
  out += `<circle cx="${px}" cy="${py}" r="22" fill="none" stroke="currentColor" stroke-width="2" opacity="0.5"/>`;
  out += `<path d="M ${px} ${py + 14} C ${px - 4} ${py + 6} ${px - 12} ${py - 2} ${px - 12} ${py - 8} A 12 12 0 0 1 ${px + 12} ${py - 8} C ${px + 12} ${py - 2} ${px + 4} ${py + 6} ${px} ${py + 14} Z" fill="currentColor" opacity="0.95"/>`;
  out += `<circle cx="${px}" cy="${py - 8}" r="4.5" fill="currentColor" opacity="0.95"/>`;
  // inner circle drawn lighter by masking with a background-colored dot is not possible with currentColor only,
  // so the inner circle is a ring instead: a small stroked circle reads as the pin's eye.
  out = out.replace(`<circle cx="${px}" cy="${py - 8}" r="4.5" fill="currentColor" opacity="0.95"/>`, `<circle cx="${px}" cy="${py - 8}" r="4" fill="none" stroke="currentColor" stroke-width="2" opacity="0.95"/>`);
  return svg(`0 0 ${W} ${H}`, out);
}

// ---------- 5. icons ----------
const ICON = (body, fill = false) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true" focusable="false">${body}</svg>`;
const icons = {
  phone: ICON('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
  ear: ICON('<path d="M6 8.5a6 6 0 0 1 12 0c0 3-2 4-2 6.5a3 3 0 0 1-3 3"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3.5"/><path d="M6 8.5v2"/>'),
  wrench: ICON('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9L6.7 20.3a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/>'),
  ring: ICON('<circle cx="12" cy="12" r="2.5"/><path d="M8.5 8.5a5 5 0 0 0 0 7"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.5 5.5a9 9 0 0 0 0 13"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>'),
  drop: ICON('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
  shield: ICON('<path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z"/>'),
  signal: ICON('<path d="M4 12h2l2-6 3 12 3-9 2 4h4"/>'),
  clipboard: ICON('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 4h6"/><path d="M9 10h6"/><path d="M9 14h6"/><path d="M9 18h4"/>'),
  pin: ICON('<path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),
  calendar: ICON('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>'),
  'id-card': ICON('<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M4.5 17c.5-2 2-3 3.5-3s3 1 3.5 3"/><path d="M14 10h5"/><path d="M14 14h5"/>'),
  dollar: ICON('<path d="M12 2v20"/><path d="M17 6.5c-.7-1.5-2.5-2.5-5-2.5-3 0-5 1.5-5 3.5s2 3 5 3.5 5 1.5 5 3.5-2 3.5-5 3.5c-2.5 0-4.3-1-5-2.5"/>'),
  clock: ICON('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  'chevron-right': ICON('<path d="m9 6 6 6-6 6"/>'),
  quote: ICON('<path d="M10 6H5.5A2.5 2.5 0 0 0 3 8.5V13a2 2 0 0 0 2 2h3v1.5A2.5 2.5 0 0 1 5.5 19H5v2h.5A4.5 4.5 0 0 0 10 16.5V6z"/><path d="M21 6h-4.5A2.5 2.5 0 0 0 14 8.5V13a2 2 0 0 0 2 2h3v1.5a2.5 2.5 0 0 1-2.5 2.5H16v2h.5a4.5 4.5 0 0 0 4.5-4.5V6z"/>', true),
};

// ---------- write + validate ----------
const motifs = { audiogram: audiogram(), arcs: arcs(), wave: wave(), 'map-sm': map('sm'), 'map-ag': map('ag'), icons };
const outDir = join(root, 'src', 'svg');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'motifs.json');
const json = JSON.stringify(motifs, null, 0);
writeFileSync(outPath, json + '\n');

// validation: balanced tags, no hex colors, required attributes, no width/height on root
const problems = [];
const check = (name, s) => {
  const opens = (s.match(/<([a-zA-Z][\w-]*)(\s[^>]*)?(?<!\/)>/g) || []).length;
  const closes = (s.match(/<\/[a-zA-Z][\w-]*>/g) || []).length;
  if (opens !== closes) problems.push(`${name}: unbalanced tags (${opens} open, ${closes} close)`);
  if (/#[0-9a-fA-F]{3,8}\b/.test(s)) problems.push(`${name}: hex color found`);
  if (!/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[^"]+"/.test(s)) problems.push(`${name}: root missing xmlns/viewBox`);
  if (!/aria-hidden="true" focusable="false"/.test(s)) problems.push(`${name}: missing aria-hidden/focusable`);
  if (/<svg[^>]*\s(width|height)=/.test(s)) problems.push(`${name}: root has width/height`);
  if (/NaN|undefined/.test(s)) problems.push(`${name}: NaN/undefined in markup`);
};
for (const [k, v] of Object.entries(motifs)) {
  if (k === 'icons') for (const [ik, iv] of Object.entries(v)) check(`icons.${ik}`, iv);
  else check(k, v);
}
const sizes = Object.fromEntries(Object.entries(motifs).map(([k, v]) => [k, k === 'icons' ? Object.fromEntries(Object.entries(v).map(([i, s]) => [i, Buffer.byteLength(s)])) : Buffer.byteLength(v)]));
console.log(`wrote ${outPath} (${Buffer.byteLength(json)} bytes)`);
console.log(JSON.stringify(sizes, null, 1));
if (problems.length) { console.error('PROBLEMS:\n' + problems.join('\n')); process.exit(1); }
console.log('validation ok: balanced tags, no hex, attributes present, no root width/height');
