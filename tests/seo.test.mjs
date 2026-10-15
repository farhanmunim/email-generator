// Baseline SEO / metadata / semantics checks for every public page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC = new URL('../public/', import.meta.url).pathname;
const ORIGIN = 'https://email-generator.farhan.app';
const APP = 'Email Template Builder';
const read = (f) => readFileSync(join(PUBLIC, f), 'utf8');
const pages = { 'index.html': read('index.html'), '404.html': read('404.html') };

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const attr = (tag, name) => { const m = new RegExp(`${name}="([^"]*)"`).exec(tag); return m ? decode(m[1]) : null; };
const metas = (html) => [...html.matchAll(/<meta\b[^>]*>/g)].map((m) => m[0]);
const meta = (html, key, val) => {
  const tag = metas(html).find((t) => attr(t, key) === val);
  return tag ? attr(tag, 'content') : null;
};

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

for (const [file, html] of Object.entries(pages)) {
  test(`${file}: core metadata`, () => {
    assert.match(html, /^<!DOCTYPE html>/);
    assert.match(html, /<html lang="en-GB">/);
    assert.match(html, /<meta charset="utf-8">/i);
    assert.ok(meta(html, 'name', 'viewport')?.includes('width=device-width'));
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
    assert.ok(title && decode(title).length >= 10 && decode(title).length <= 60, `title length: ${title}`);
    const desc = meta(html, 'name', 'description');
    assert.ok(desc && desc.length >= 70 && desc.length <= 160, `description length ${desc?.length}`);
    assert.ok(meta(html, 'name', 'theme-color'));
    assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,%3Csvg[^"]+" type="image\/svg\+xml">/, 'inline SVG favicon');
    assert.match(html, /<link rel="apple-touch-icon"/);
    assert.equal(meta(html, 'name', 'author'), 'farhan.app');
    assert.ok(decode(title).endsWith(' — farhan.app'), 'title has the farhan.app suffix');
    assert.ok(desc.endsWith('. Built by Farhan — farhan.app'), 'description ends with the farhan.app credit');
    assert.equal((html.match(/<h1\b/g) || []).length, 1, 'exactly one h1');
  });
}

test('titles and descriptions are unique across pages', () => {
  const titles = Object.values(pages).map((h) => /<title>([^<]+)/.exec(h)[1]);
  const descs = Object.values(pages).map((h) => meta(h, 'name', 'description'));
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(new Set(descs).size, descs.length);
});

test('index.html: canonical, robots, Open Graph and Twitter cards', () => {
  const html = pages['index.html'];
  const canonical = attr(/<link rel="canonical"[^>]*>/.exec(html)[0], 'href');
  assert.equal(canonical, `${ORIGIN}/`);
  assert.equal(`${ORIGIN}/`, `${meta(html, 'property', 'og:url')}/`, 'og:url matches canonical');
  assert.equal(decode(/<title>([^<]+)/.exec(html)[1]), `${APP} — farhan.app`);
  assert.match(meta(html, 'name', 'robots'), /index/);
  assert.ok(!/noindex/.test(meta(html, 'name', 'robots')));
  const title = decode(/<title>([^<]+)/.exec(html)[1]);
  const desc = meta(html, 'name', 'description');
  assert.equal(meta(html, 'property', 'og:title'), title);
  const ogDesc = meta(html, 'property', 'og:description');
  assert.ok(ogDesc && ogDesc.length >= 40 && !/Built by/.test(ogDesc), 'og:description is the one-liner');
  assert.equal(meta(html, 'property', 'og:type'), 'website');
  assert.equal(meta(html, 'property', 'og:url'), ORIGIN);
  assert.equal(meta(html, 'property', 'og:site_name'), APP);
  assert.equal(meta(html, 'property', 'og:locale'), 'en_GB');
  const image = meta(html, 'property', 'og:image');
  assert.match(image, new RegExp(`^${ORIGIN}/[\\w.-]+\\.jpg$`), 'absolute https image on production domain');
  assert.equal(meta(html, 'property', 'og:image:width'), '1200');
  assert.equal(meta(html, 'property', 'og:image:height'), '630');
  assert.ok(meta(html, 'property', 'og:image:alt'));
  assert.equal(meta(html, 'name', 'twitter:card'), 'summary');
  assert.equal(meta(html, 'name', 'twitter:title'), title);
  assert.equal(meta(html, 'name', 'twitter:description'), desc);
  assert.equal(meta(html, 'name', 'twitter:image'), image);
  // the image file referenced by production metadata really exists and is 1200 x 630
  const file = join(PUBLIC, new URL(image).pathname);
  assert.ok(existsSync(file), 'og image file exists');
  assert.deepEqual(jpegSize(readFileSync(file)), { w: 1200, h: 630 });
  assert.ok(readFileSync(file).length < 300 * 1024, 'og image is a reasonable size');
});

test('footer: About · Privacy · Source · tagline · Built by, in order', () => {
  const html = pages['index.html'];
  const footer = /<footer class="site-footer">([\s\S]*?)<\/footer>/.exec(html)[1];
  const items = [...footer.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
  assert.deepEqual(items, ['About', 'Privacy', 'Source', 'Runs in your browser', 'Built by Farhan']);
  assert.match(footer, /<button type="button" class="link-btn" id="btn-about">/);
  assert.match(footer, /<button type="button" class="link-btn" id="btn-privacy">/);
  assert.match(footer, /href="https:\/\/github\.com\/farhanmunim\/email-generator"/);
  assert.match(footer, /Built by <a href="https:\/\/farhan\.app">Farhan<\/a>/);
  // the footer sits before the mobile nav so it can never overlap it
  assert.ok(html.indexOf('class="site-footer"') < html.indexOf('class="mobile-nav"'));
});

test('About modal has the required sections in order', () => {
  const html = pages['index.html'];
  const modal = /<dialog id="about-dialog"[\s\S]*?<\/dialog>/.exec(html)[0];
  const heads = [...modal.matchAll(/<h([23])[^>]*>([^<]+)<\/h\1>/g)].map((m) => m[2]);
  assert.deepEqual(heads, [`About ${APP}`, 'Privacy', 'Source', 'Developer', 'Support']);
  assert.match(modal, /cookieless/);
  assert.match(modal, /href="https:\/\/buymeacoffee\.com\/farhan\.app"/);
  assert.match(modal, /Farhan Munim/);
  assert.ok(existsSync(new URL('../LICENSE', import.meta.url).pathname), 'LICENSE file exists for the stated licence');
});

test('404.html is noindex and links home', () => {
  const html = pages['404.html'];
  assert.match(meta(html, 'name', 'robots'), /noindex/);
  assert.match(html, /<a href="\/">/);
  assert.equal(meta(html, 'name', 'author'), 'farhan.app');
  assert.ok(/<title>[^<]*— farhan\.app<\/title>/.test(html));
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/);
  assert.match(html, /Built by <a href="https:\/\/farhan\.app">Farhan<\/a>/);
  assert.ok(!/rel="canonical"/.test(html));
});

test('JSON-LD is valid and matches visible content', () => {
  const html = pages['index.html'];
  const raw = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1];
  const data = JSON.parse(raw);
  assert.equal(data['@graph'][1].author.url, 'https://farhan.app');
  const types = data['@graph'].map((n) => n['@type']);
  assert.deepEqual(types, ['WebSite', 'WebApplication']);
  const app = data['@graph'][1];
  assert.equal(app.url, `${ORIGIN}/`);
  assert.ok(meta(html, 'name', 'description').startsWith(app.description.replace(/\.$/, '')));
  assert.ok(!('aggregateRating' in app) && !('review' in app), 'no invented ratings or reviews');
  assert.equal(app.offers.price, '0');
});

test('index.html: semantic structure and accessibility basics', () => {
  const html = pages['index.html'];
  for (const tag of ['header', 'main', 'nav', 'aside', 'section', 'footer']) assert.match(html, new RegExp(`<${tag}\\b`), tag);
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  // heading levels never skip downwards (h1 -> h2 -> h3 ...)
  let prev = 0;
  for (const m of html.matchAll(/<h([1-6])\b/g)) {
    const level = Number(m[1]);
    assert.ok(level <= prev + 1, `heading level jumps from h${prev} to h${level}`);
    prev = level;
  }
  // every <img> has alt; no duplicate ids
  for (const img of html.matchAll(/<img\b[^>]*>/g)) assert.match(img[0], /\balt=/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], 'duplicate ids');
  assert.match(html, /class="skip-link"/);
  assert.match(html, /<noscript>[\s\S]*<h2>/, 'noscript fallback has meaningful content');
});

test('robots.txt and sitemap.xml point at the production domain', () => {
  const robots = read('robots.txt');
  assert.match(robots, /User-agent: \*/);
  assert.ok(!/^Disallow:\s*\/\s*$/m.test(robots), 'does not block the whole site');
  assert.match(robots, new RegExp(`Sitemap: ${ORIGIN}/sitemap\\.xml`));
  const sitemap = read('sitemap.xml');
  assert.match(sitemap, new RegExp(`<loc>${ORIGIN}/</loc>`));
});

test('every local file referenced from index.html exists', () => {
  const html = pages['index.html'];
  const refs = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((m) => m[1]).filter((r) => !r.startsWith('http') && !r.startsWith('//'));
  assert.ok(refs.length >= 3);
  for (const ref of refs) assert.ok(existsSync(join(PUBLIC, ref)), `missing ${ref}`);
});
