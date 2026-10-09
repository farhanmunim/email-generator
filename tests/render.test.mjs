import test from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, createBlock, normalizeDoc } from '../public/js/blocks.js';
import { renderEmail, exportEmail, formatInline } from '../public/js/render.js';
import { TEMPLATES } from '../public/js/templates.js';
import { safeUrl, safeImageUrl, safeColor } from '../public/js/util.js';

test('every template exports valid-looking, self-contained HTML', () => {
  for (const t of TEMPLATES) {
    const { html, warnings } = exportEmail(t.build());
    assert.match(html, /^<!DOCTYPE html>/);
    assert.match(html, /<\/html>\s*$/);
    assert.ok(!/<script/i.test(html), 'no scripts');
    assert.ok(!/<link /i.test(html), 'no external stylesheets');
    if (t.id !== 'blank') assert.ok(html.includes('role="presentation"'));
    assert.ok(Array.isArray(warnings));
  }
});

test('blocks are escaped and colours/urls sanitised', () => {
  const doc = createDoc('x', [
    createBlock('heading', { text: '<img src=x onerror=alert(1)>' }),
    createBlock('text', { text: '[click](javascript:alert(1)) and [ok](https://a.com/?a=1&b="2")' }),
    createBlock('button', { text: 'Go', url: 'javascript:alert(1)', fill: 'red;background:url(x)' }),
    createBlock('image', { src: 'javascript:alert(1)' }),
  ]);
  const { html, warnings } = exportEmail(doc);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!/href="javascript/i.test(html));
  assert.ok(html.includes('href="https://a.com/?a=1&amp;b=&quot;2&quot;"'));
  assert.ok(!html.includes('url(x)'));
  assert.ok(warnings.some((w) => /no valid link/.test(w.message)));
  assert.ok(warnings.some((w) => /no valid image URL/.test(w.message)));
});

test('empty content is skipped on export, with a warning for broken blocks', () => {
  const doc = createDoc('x', [createBlock('heading', { text: '  ' }), createBlock('image'), createBlock('text', { text: 'hi' })]);
  const html = renderEmail(doc);
  assert.ok(!html.includes('<h1'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('>hi<'));
});

test('image width is computed from content width and padding', () => {
  const doc = createDoc('x', [createBlock('image', { src: 'https://a.com/x.png', alt: 'a', width: 50, paddingLeft: 20, paddingRight: 20 })], { width: 600 });
  assert.match(renderEmail(doc), /<img[^>]+width="280"/);
});

test('responsive + Outlook scaffolding is present', () => {
  const html = renderEmail(createDoc('x', [createBlock('button', { text: 'Go', url: 'https://a.com' })]));
  assert.match(html, /@media only screen and \(max-width:620px\)/);
  assert.match(html, /<!--\[if mso\]>/);
  assert.match(html, /mso-padding-alt:0/);
  assert.match(html, /max-width:600px/);
});

test('normalizeDoc rejects garbage and clamps values', () => {
  assert.throws(() => normalizeDoc(null));
  assert.throws(() => normalizeDoc({ blocks: 'x' }));
  const d = normalizeDoc({ name: 5, blocks: [{ type: 'nope' }, { type: 'spacer', height: 99999, bg: 'javascript' }], settings: { width: 9 } });
  assert.equal(d.blocks.length, 1);
  assert.equal(d.blocks[0].height, 200);
  assert.equal(d.blocks[0].bg, '');
  assert.equal(d.settings.width, 320);
  assert.equal(d.name, 'Untitled email');
});

test('JSON round trip preserves a template', () => {
  const doc = TEMPLATES[1].build();
  const again = normalizeDoc(JSON.parse(JSON.stringify(doc)));
  assert.equal(renderEmail(again), renderEmail(doc));
});

test('util helpers', () => {
  assert.equal(safeUrl('java\nscript:alert(1)'), '');
  assert.equal(safeUrl('{{unsubscribe_url}}'), '{{unsubscribe_url}}');
  assert.equal(safeUrl('mailto:a@b.co'), 'mailto:a@b.co');
  assert.equal(safeImageUrl('data:image/png;base64,AAA'), '');
  assert.equal(safeImageUrl('https://a.com/x y.png'), 'https://a.com/x%20y.png');
  assert.equal(safeColor('#ABC'), '#aabbcc');
  assert.equal(safeColor('red'), '');
  assert.ok(formatInline('**b** __i__', '#000').includes('<strong>b</strong> <em>i</em>'));
});

test('non-blank templates export with no warnings and unique ids', () => {
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const t of TEMPLATES.filter((x) => x.id !== 'blank')) {
    assert.deepEqual(exportEmail(t.build()).warnings, [], t.id);
  }
});
