// Email HTML generation. Pure string functions (no DOM) so the same output is
// used for the editing canvas, the live preview and the exported file.
//
// Email-client notes:
//  * layout uses nested role="presentation" tables, inline CSS and bgcolor attrs
//  * a conditional "ghost" table fixes the content width in Outlook (Word engine)
//  * buttons use the padding + mso-padding-alt technique (no images/VML needed)
//  * the only <style> block holds resets and one mobile @media query

import { esc, clamp, safeColor, safeUrl, safeImageUrl } from './util.js';
import { BLOCKS, fontStack } from './blocks.js';

export const MOBILE_BREAKPOINT = 620;

/** [selector, declarations]; used for the exported @media block AND the editor's mobile canvas. */
export const MOBILE_RULES = [
  ['.em-outer', 'padding-left:0!important;padding-right:0!important'],
  ['.em-pl', 'padding-left:16px!important'],
  ['.em-pr', 'padding-right:16px!important'],
  ['.em-h', 'font-size:26px!important;line-height:32px!important'],
];

const num = (v, min, max, fb) => Math.round(clamp(v, min, max, fb));

function placeholder(text) {
  return `<span style="color:#9ca3af;font-style:italic;">${esc(text)}</span>`;
}

function emphasis(raw) {
  return esc(raw)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<em>$1</em>');
}

/** Tiny inline formatter: **bold**, __italic__, [label](url). Everything is escaped first. */
export function formatInline(raw, linkColor) {
  let out = '';
  let last = 0;
  const re = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let m;
  while ((m = re.exec(raw))) {
    out += emphasis(raw.slice(last, m.index));
    const url = safeUrl(m[2]);
    out += url
      ? `<a href="${esc(url)}" target="_blank" style="color:${linkColor};text-decoration:underline;">${emphasis(m[1])}</a>`
      : emphasis(m[0]);
    last = re.lastIndex;
  }
  return out + emphasis(raw.slice(last));
}

/** Wraps block content in a <tr><td> carrying padding + background. */
function cell(b, inner, align = 'left', extraStyle = '') {
  const pt = num(b.paddingTop, 0, 120, 0);
  const pb = num(b.paddingBottom, 0, 120, 0);
  const pl = num(b.paddingLeft, 0, 120, 0);
  const pr = num(b.paddingRight, 0, 120, 0);
  const cls = [pl > 16 && 'em-pl', pr > 16 && 'em-pr'].filter(Boolean).join(' ');
  const bg = safeColor(b.bg);
  return `<tr>
<td${cls ? ` class="${cls}"` : ''} align="${align}"${bg ? ` bgcolor="${bg}"` : ''} style="padding:${pt}px ${pr}px ${pb}px ${pl}px;${bg ? `background-color:${bg};` : ''}text-align:${align};${extraStyle}">
${inner}
</td>
</tr>`;
}

const RENDERERS = {
  heading(b, doc, canvas) {
    const raw = (b.text || '').trim();
    if (!raw && !canvas) return '';
    const s = doc.settings;
    const size = num(b.fontSize, 8, 120, 32);
    const color = safeColor(b.color) || s.headingColor;
    const tag = `h${num(b.level, 1, 3, 1)}`;
    const style = [
      'margin:0', 'padding:0',
      `font-family:${fontStack(b.fontFamily, s.fontFamily)}`,
      `font-size:${size}px`,
      `line-height:${Math.round(size * clamp(b.lineHeight, 1, 2.5, 1.25))}px`,
      'mso-line-height-rule:exactly',
      `font-weight:${b.bold ? 700 : 400}`,
      `color:${color}`,
      `text-align:${b.align}`,
    ].join(';');
    const html = raw ? esc(raw).replace(/\r?\n/g, '<br>') : placeholder('Empty heading');
    return cell(b, `<${tag}${size > 28 ? ' class="em-h"' : ''} style="${style};">${html}</${tag}>`, b.align);
  },

  text(b, doc, canvas) {
    const raw = (b.text || '').replace(/\r\n?/g, '\n').trim();
    if (!raw && !canvas) return '';
    const s = doc.settings;
    const size = num(b.fontSize, 8, 60, 16);
    const lh = Math.round(size * clamp(b.lineHeight, 1, 2.5, 1.6));
    const color = safeColor(b.color) || s.textColor;
    const gap = Math.round(size * 0.9);
    const base = `margin:0 0 ${gap}px 0;padding:0;font-family:${fontStack(b.fontFamily, s.fontFamily)};font-size:${size}px;line-height:${lh}px;mso-line-height-rule:exactly;color:${color};text-align:${b.align}`;
    const paras = raw ? raw.split(/\n{2,}/) : [''];
    const html = paras.map((p, i) => {
      const style = i === paras.length - 1 ? `${base};margin:0` : base;
      const body = p ? formatInline(p, s.linkColor).replace(/\n/g, '<br>') : placeholder('Empty text');
      return `<p style="${style};">${body}</p>`;
    }).join('\n');
    return cell(b, html, b.align);
  },

  image(b, doc, canvas) {
    const src = safeImageUrl(b.src);
    if (!src) {
      if (!canvas) return '';
      return cell(b, '<div class="em-img-empty">Add an image URL in the settings panel</div>', 'center');
    }
    const pl = num(b.paddingLeft, 0, 120, 0);
    const pr = num(b.paddingRight, 0, 120, 0);
    const inner = Math.max(40, doc.settings.width - pl - pr);
    const px = Math.max(24, Math.round((inner * clamp(b.width, 10, 100, 100)) / 100));
    const margin = b.align === 'center' ? '0 auto' : b.align === 'right' ? '0 0 0 auto' : '0';
    const radius = num(b.radius, 0, 48, 0);
    const img = `<img src="${esc(src)}" alt="${esc(b.alt)}" width="${px}" style="display:block;width:100%;max-width:${px}px;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;margin:${margin};${radius ? `border-radius:${radius}px;` : ''}">`;
    const link = safeUrl(b.link);
    const html = link
      ? `<a href="${esc(link)}" target="_blank" style="text-decoration:none;">${img}</a>`
      : img;
    return cell(b, html, b.align, 'font-size:0;line-height:0;');
  },

  button(b, doc, canvas) {
    const label = (b.text || '').trim();
    if (!label && !canvas) return '';
    const s = doc.settings;
    const url = safeUrl(b.url) || '#';
    const fill = safeColor(b.fill);
    const textColor = safeColor(b.textColor, '#ffffff');
    const border = safeColor(b.borderColor);
    const bw = border ? num(b.borderWidth, 0, 6, 0) : 0;
    const radius = num(b.radius, 0, 40, 0);
    const size = num(b.fontSize, 8, 40, 16);
    const padY = num(b.padY, 0, 60, 14);
    const padX = num(b.padX, 0, 120, 28);
    const full = !!b.fullWidth;
    const align = full ? 'center' : b.align;
    const tdStyle = [
      fill && `background-color:${fill}`,
      radius && `border-radius:${radius}px`,
      bw && `border:${bw}px solid ${border}`,
    ].filter(Boolean).join(';');
    const aStyle = [
      `display:${full ? 'block' : 'inline-block'}`,
      `padding:${padY}px ${padX}px`,
      'mso-padding-alt:0',
      `font-family:${fontStack(b.fontFamily, s.fontFamily)}`,
      `font-size:${size}px`,
      `line-height:${Math.round(size * 1.2)}px`,
      `font-weight:${b.bold ? 700 : 400}`,
      `color:${textColor}`,
      'text-decoration:none',
      radius && `border-radius:${radius}px`,
      'text-align:center',
    ].filter(Boolean).join(';');
    const text = label ? esc(label) : placeholder('Button');
    const inner = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${full ? ' width="100%" style="width:100%;"' : ` align="${align}"`}>
<tr>
<td align="center"${fill ? ` bgcolor="${fill}"` : ''} style="${tdStyle}">
<a href="${esc(url)}" target="_blank" style="${aStyle};"><!--[if mso]><i style="letter-spacing:${padX}px;mso-font-width:-100%;mso-text-raise:${padY * 2}pt" hidden>&nbsp;</i><![endif]--><span style="mso-text-raise:${padY}pt;">${text}</span><!--[if mso]><i style="letter-spacing:${padX}px;mso-font-width:-100%" hidden>&nbsp;</i><![endif]--></a>
</td>
</tr>
</table>`;
    return cell(b, inner, align);
  },

  divider(b) {
    const w = num(b.width, 10, 100, 100);
    const t = num(b.thickness, 1, 12, 1);
    const color = safeColor(b.color, '#e5e7eb');
    const style = ['solid', 'dashed', 'dotted'].includes(b.lineStyle) ? b.lineStyle : 'solid';
    const align = w < 100 ? b.align : 'center';
    const inner = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${w}%" align="${align}" style="width:${w}%;">
<tr>
<td height="${t}" style="height:${t}px;font-size:1px;line-height:1px;border-top:${t}px ${style} ${color};">&nbsp;</td>
</tr>
</table>`;
    return cell(b, inner, align, 'font-size:0;line-height:0;');
  },

  spacer(b) {
    const h = num(b.height, 1, 400, 32);
    const bg = safeColor(b.bg);
    return `<tr>
<td height="${h}"${bg ? ` bgcolor="${bg}"` : ''} style="height:${h}px;line-height:${h}px;font-size:1px;padding:0;${bg ? `background-color:${bg};` : ''}">&nbsp;</td>
</tr>`;
  },
};

/** Renders one block as a `<tr>` (empty string if it has nothing to show in an email). */
export function renderBlock(block, doc, { canvas = false } = {}) {
  const fn = RENDERERS[block.type];
  return fn ? fn(block, doc, canvas) : '';
}

export function mobileCss(scope = '') {
  return MOBILE_RULES.map(([sel, decl]) => `${scope ? `${scope} ` : ''}${sel}{${decl}}`).join('\n');
}

function preheaderHtml(text) {
  const t = (text || '').trim();
  if (!t) return '';
  const pad = '&#847;&zwnj;&nbsp;'.repeat(40);
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(t)}${pad}</div>\n`;
}

/** Full, self-contained email document. */
export function renderEmail(doc) {
  const s = doc.settings;
  const width = num(s.width, 320, 720, 600);
  const rows = doc.blocks.map((b) => renderBlock(b, doc)).filter(Boolean).join('\n');
  const body = rows || `<tr><td style="padding:32px;font-family:${fontStack(s.fontFamily)};font-size:16px;color:${s.textColor};text-align:center;">&nbsp;</td></tr>`;
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(doc.name)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>td,th,div,p,a,h1,h2,h3{font-family:Arial,sans-serif;}</style>
<![endif]-->
<style>
html,body{margin:0!important;padding:0!important;width:100%!important;}
*{-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
table{border-collapse:collapse;border-spacing:0;}
img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;}
u+#body a{color:inherit;text-decoration:none;}
@media only screen and (max-width:${MOBILE_BREAKPOINT}px){
${mobileCss()}
}
</style>
</head>
<body id="body" style="margin:0;padding:0;word-spacing:normal;background-color:${s.bg};">
${preheaderHtml(s.preheader)}<div role="article" aria-roledescription="email" aria-label="${esc(doc.name)}" lang="en" style="background-color:${s.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${s.bg}" style="width:100%;background-color:${s.bg};">
<tr>
<td align="center" class="em-outer" style="padding:${num(s.outerPadding, 0, 80, 24)}px 12px;">
<!--[if mso]><table role="presentation" align="center" width="${width}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="em-container" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${s.contentBg}" style="width:100%;max-width:${width}px;background-color:${s.contentBg};">
${body}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td>
</tr>
</table>
</div>
</body>
</html>
`;
}

const label = (b, i) => `${BLOCKS[b.type].label} block ${i + 1}`;

/** Lists things that will behave unexpectedly in the exported email. */
export function analyze(doc, html = '') {
  const warnings = [];
  if (!doc.blocks.length) warnings.push({ level: 'warn', message: 'The email is empty — add some blocks first.' });
  doc.blocks.forEach((b, i) => {
    const name = label(b, i);
    if (b.type === 'image') {
      if (!safeImageUrl(b.src)) {
        warnings.push({ level: 'warn', blockId: b.id, message: `${name} has no valid image URL and was left out.` });
      } else {
        if (!b.alt.trim()) warnings.push({ level: 'info', blockId: b.id, message: `${name} has no alt text (shown when images are blocked).` });
        if (/^http:\/\//i.test(b.src)) warnings.push({ level: 'warn', blockId: b.id, message: `${name} uses http:// — many email clients block insecure images. Use https://.` });
        if (b.link && !safeUrl(b.link)) warnings.push({ level: 'warn', blockId: b.id, message: `${name} has an unsupported link and it was removed.` });
      }
    } else if (b.type === 'button') {
      if (!b.text.trim()) warnings.push({ level: 'warn', blockId: b.id, message: `${name} has no label and was left out.` });
      else if (!safeUrl(b.url)) warnings.push({ level: 'warn', blockId: b.id, message: `${name} (“${b.text.trim()}”) has no valid link — it points to “#”.` });
    } else if ((b.type === 'heading' || b.type === 'text') && !b.text.trim()) {
      warnings.push({ level: 'info', blockId: b.id, message: `${name} is empty and was left out.` });
    }
  });
  if (html && new TextEncoder().encode(html).length > 102 * 1024) {
    warnings.push({ level: 'warn', message: 'The HTML is larger than 102 KB — Gmail clips messages beyond that size.' });
  }
  return warnings;
}

export function exportEmail(doc) {
  const html = renderEmail(doc);
  return { html, warnings: analyze(doc, html), bytes: new TextEncoder().encode(html).length };
}
