import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const sea = JSON.parse(readFileSync('design/tokens.hex.json','utf8')).sea.hex;
const logo = 'data:image/png;base64,' + readFileSync('assets/img/logo-white.png').toString('base64');
const b = await chromium.launch();
for (const size of [32, 180, 512]) {
  const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await p.setContent(`<body style="margin:0;background:${sea};display:grid;place-items:center;width:${size}px;height:${size}px"><img src="${logo}" style="width:${Math.round(size*0.8)}px;object-fit:contain"></body>`);
  await p.screenshot({ path: `assets/img/favicon-${size}.png`, omitBackground: false });
  await p.close();
}
await b.close(); console.log('favicons written');
