// Regenerates public/og-image.jpg (1200×630), favicon-32.png and apple-touch-icon.png.
// Not part of the deployed site and not a project dependency. Requires Playwright with Chromium:
//   npm i --no-save playwright && node scripts/assets/build-assets.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const browser = await chromium.launch();

let page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
await page.goto(`file://${root}scripts/assets/og-image.html`);
await page.screenshot({ path: `${root}public/og-image.jpg`, type: 'jpeg', quality: 88 });

const icon = (size, rounded) => `<body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><rect width="32" height="32" ${rounded ? 'rx="8"' : ''} fill="#4f46e5"/><rect x="7" y="8" width="18" height="16" rx="2" fill="none" stroke="#fff" stroke-width="2"/><path d="m8 10 8 6 8-6" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></body>`;
for (const [file, size, rounded] of [['favicon-32.png', 32, true], ['apple-touch-icon.png', 180, false]]) {
  page = await (await browser.newContext({ viewport: { width: size, height: size } })).newPage();
  await page.setContent(icon(size, rounded));
  await page.screenshot({ path: `${root}public/${file}`, omitBackground: rounded });
}
await browser.close();
