// Regenerates public/og-image.jpg (1200×630) and apple-touch-icon.png.
// Not part of the deployed site and not a project dependency. Requires Playwright with Chromium:
//   npm i --no-save playwright && node scripts/assets/build-assets.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const browser = await chromium.launch();

let page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
await page.goto(`file://${root}scripts/assets/og-image.html`);
await page.screenshot({ path: `${root}public/og-image.jpg`, type: 'jpeg', quality: 88 });

const icon = (size, rounded) => `<body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><rect width="32" height="32" ${rounded ? 'rx="8"' : ''} fill="#4f46e5"/><g transform="translate(16 16) scale(.833) translate(-12 -12)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></g></svg></body>`;
// The favicon itself is an inline data: URI in the HTML <head> (same logo as the UI); only the Apple touch icon is a file.
for (const [file, size, rounded] of [['apple-touch-icon.png', 180, false]]) {
  page = await (await browser.newContext({ viewport: { width: size, height: size } })).newPage();
  await page.setContent(icon(size, rounded));
  await page.screenshot({ path: `${root}public/${file}`, omitBackground: rounded });
}
await browser.close();
