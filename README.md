# Hurdle Hearing & Audiology — website

Static, information-first site for a Doctor of Audiology practice in Santa Maria and Arroyo Grande, California. Built from verified design tokens; every page passes an accessibility gate before it deploys.

## Run

```sh
npm ci
npx playwright install chromium   # once, for the gate
npm run check                     # tokens → build → gate
npm run serve                     # http://127.0.0.1:8787/
```

`npm run build` writes `dist/` with a `noindex` meta (demo). `npm run build:public` drops it for launch.

## Where things live

- `src/data.json` — every fact on the site: offices, hours, phones, services, insurers, VA steps, copy strings. Change hours here, nowhere else.
- `src/pages/*.html` — one body per page. Sections carry `data-budget="<words>"`; the build fails if a section goes over.
- `src/shell.html` — header, footer, menu, call bar, all CSS. Colors only through `var(--token)`; the build fails on a hand-typed hex.
- `src/hours.js` — live open/closed status in Pacific time; the static hours table is always present.
- `design/tokens.json` — the palette in OKLCH. `npm run tokens` verifies every pair (WCAG 2 and APCA), simulates color-vision deficiency and grayscale, and exports the hex the build uses.
- `assets/fonts` — self-hosted Instrument Sans and Atkinson Hyperlegible Next (variable, latin). No third-party requests at runtime.
- `scripts/gate.mjs` — Playwright + axe on every page at 1440 and 390: zero violations, no horizontal scroll, hours logic and phone menu checked.

## Deploy

Push to `main` → GitHub Actions runs tokens, build, gate, then deploys `dist/` to GitHub Pages. A failing gate blocks the deploy.

## Owner-confirm

Text marked `(owner-confirm)` on the pages is awaiting Dr. Hurdle's confirmation. Search `owner-confirm` in `src/` to find them all.
