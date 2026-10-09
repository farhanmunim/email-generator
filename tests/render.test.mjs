import test from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, createBlock, normalizeDoc } from '../public/js/blocks.js';
import { renderEmail, exportEmail, formatInline, renderPlainText, runChecks } from '../public/js/render.js';
import { TEMPLATES } from '../public/js/templates.js';
import { safeUrl, safeImageUrl, safeColor, tagUrl } from '../public/js/util.js';

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

test('new blocks render, escape and stack on mobile', () => {
  const doc = createDoc('x', [
    createBlock('columns', { c1Title: '<b>x</b>', c1Url: 'https://a.com/1', c1Image: 'https://i.com/a.png', c1Alt: 'a' }),
    createBlock('quote', { quote: '<i>q</i>' }),
    createBlock('social', { x: 'https://x.com/a', facebook: 'javascript:alert(1)' }),
    createBlock('footer', { unsubscribeUrl: '{{ unsubscribe_url }}' }),
  ]);
  const html = renderEmail(doc);
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;') && html.includes('&lt;i&gt;q&lt;/i&gt;'));
  assert.ok(!/javascript:/i.test(html) && !html.includes('Facebook'));
  assert.ok(html.includes('class="em-col em-col-l"') && html.includes('.em-col{display:block!important'));
  assert.ok(html.includes('href="{{ unsubscribe_url }}"'), 'merge tag keeps its spaces');
});

test('UTM tagging respects existing params, merge tags and unsubscribe links', () => {
  const settings = { utmEnabled: true, utmSource: 'news', utmMedium: 'email', utmCampaign: 'spring sale' };
  assert.equal(tagUrl('https://a.com/p?utm_source=x#f', settings), 'https://a.com/p?utm_source=x&utm_medium=email&utm_campaign=spring+sale#f');
  assert.equal(tagUrl('{{ url }}', settings), '{{ url }}');
  assert.equal(tagUrl('https://a.com/unsubscribe', settings), 'https://a.com/unsubscribe');
  assert.equal(tagUrl('mailto:a@b.co', settings), 'mailto:a@b.co');
  assert.equal(tagUrl('https://a.com/', { ...settings, utmEnabled: false }), 'https://a.com/');
  const doc = createDoc('x', [createBlock('button', { text: 'Go', url: 'https://a.com' }), createBlock('text', { text: '[l](https://b.com)' })], settings);
  const html = renderEmail(doc);
  assert.ok(html.includes('https://a.com/?utm_source=news') && html.includes('https://b.com/?utm_source=news'));
});

test('tracking pixel only accepts https URLs or merge tags', () => {
  const withPixel = (px) => renderEmail(createDoc('x', [createBlock('text')], { trackingPixel: px }));
  assert.match(withPixel('https://t.example.com/p.gif?id=1&x=2'), /<img src="https:\/\/t\.example\.com\/p\.gif\?id=1&amp;x=2" width="1" height="1"/);
  assert.match(withPixel('{{ open_pixel_url }}'), /<img src="\{\{ open_pixel_url \}\}" width="1"/);
  assert.ok(!withPixel('http://t.example.com/p.gif').includes('width="1" height="1"'));
  assert.ok(!withPixel('javascript:alert(1)').includes('width="1" height="1"'));
});

test('plain text version strips formatting and keeps links', () => {
  const doc = createDoc('x', [
    createBlock('heading', { text: 'Hello', level: 1 }),
    createBlock('text', { text: 'Some **bold** and [a link](https://a.com).' }),
    createBlock('button', { text: 'Go', url: 'https://a.com/go' }),
    createBlock('divider'),
  ]);
  const text = renderPlainText(doc);
  assert.equal(text, 'HELLO\n\nSome bold and a link (https://a.com).\n\nGo: https://a.com/go\n\n----------\n');
});

test('checklist flags missing subject/unsubscribe and passes good emails', () => {
  const bad = runChecks(createDoc('x', [createBlock('text')]));
  assert.ok(bad.some((c) => c.level === 'warn' && /subject/i.test(c.message)));
  assert.ok(bad.some((c) => c.level === 'warn' && /unsubscribe/i.test(c.message)));
  const good = runChecks(createDoc('x', [createBlock('text'), createBlock('footer')], { subject: 'Hello there', preheader: 'p' }));
  assert.ok(!good.some((c) => c.level === 'warn'));
  assert.ok(good.some((c) => c.level === 'pass' && /unsubscribe/i.test(c.message)));
});
