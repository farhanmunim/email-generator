// Email HTML generation. Pure string functions (no DOM) so the same output is
// used for the editing canvas, the live preview and the exported file.
//
// Email-client notes:
//  * layout uses nested role="presentation" tables, inline CSS and bgcolor attrs
//  * a conditional "ghost" table fixes the content width in Outlook (Word engine)
//  * buttons use the padding + mso-padding-alt technique (no images/VML needed)
//  * the only <style> block holds resets and one mobile @media query

import { esc, clamp, safeColor, safeUrl, safeImageUrl, tagUrl, safePixelUrl, hasMergeTag } from './util.js';
import { BLOCKS, fontStack } from './blocks.js';

export const MOBILE_BREAKPOINT = 620;

/** [selector, declarations]; used for the exported @media block AND the editor's mobile canvas. */
export const MOBILE_RULES = [
  ['.em-outer', 'padding-left:0!important;padding-right:0!important'],
  ['.em-pl', 'padding-left:16px!important'],
  ['.em-pr', 'padding-right:16px!important'],
  ['.em-h', 'font-size:26px!important;line-height:32px!important'],
  ['.em-col', 'display:block!important;width:100%!important;max-width:100%!important'],
  ['.em-col-l', 'padding:0 0 24px 0!important'],
  ['.em-col-r', 'padding:0!important'],
  ['.em-col-img', 'width:100%!important;max-width:none!important'],
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
export function formatInline(raw, linkColor, mapUrl = (u) => u) {
  let out = '';
  let last = 0;
  const re = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let m;
  while ((m = re.exec(raw))) {
    out += emphasis(raw.slice(last, m.index));
    const url = mapUrl(safeUrl(m[2]));
    out += url
      ? `<a href="${esc(url)}" target="_blank" style="color:${linkColor};text-decoration:underline;">${emphasis(m[1])}</a>`
      : emphasis(m[0]);
    last = re.lastIndex;
  }
  return out + emphasis(raw.slice(last));
}

/** Sanitised link destination, with UTM parameters when enabled. */
const linkOf = (doc) => (u) => tagUrl(safeUrl(u), doc.settings);

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
      const body = p ? formatInline(p, s.linkColor, linkOf(doc)).replace(/\n/g, '<br>') : placeholder('Empty text');
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
    const link = linkOf(doc)(b.link);
    const html = link
      ? `<a href="${esc(link)}" target="_blank" style="text-decoration:none;">${img}</a>`
      : img;
    return cell(b, html, b.align, 'font-size:0;line-height:0;');
  },

  button(b, doc, canvas) {
    const label = (b.text || '').trim();
    if (!label && !canvas) return '';
    const s = doc.settings;
    const url = linkOf(doc)(b.url) || '#';
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

  columns(b, doc, canvas) {
    const s = doc.settings;
    const gap = num(b.gap, 0, 48, 24);
    const pl = num(b.paddingLeft, 0, 120, 0);
    const pr = num(b.paddingRight, 0, 120, 0);
    const colW = Math.max(60, Math.floor((s.width - pl - pr - gap) / 2));
    const align = b.align === 'center' ? 'center' : 'left';
    const link = linkOf(doc);
    const titleSize = num(b.titleSize, 10, 48, 18);
    const textSize = num(b.textSize, 10, 36, 15);
    const radius = num(b.radius, 0, 32, 0);
    const margin = align === 'center' ? '0 auto' : '0';
    let any = false;
    const col = (n, cls, pad) => {
      const img = safeImageUrl(b[`c${n}Image`]);
      const title = (b[`c${n}Title`] || '').trim();
      const text = (b[`c${n}Text`] || '').trim();
      const label = (b[`c${n}Label`] || '').trim();
      const url = link(b[`c${n}Url`]);
      const parts = [];
      if (img) {
        const tag = `<img class="em-col-img" src="${esc(img)}" alt="${esc(b[`c${n}Alt`])}" width="${colW}" style="display:block;width:100%;max-width:${colW}px;height:auto;border:0;margin:${margin};${radius ? `border-radius:${radius}px;` : ''}">`;
        parts.push(`<div style="font-size:0;line-height:0;padding:0 0 14px 0;">${url ? `<a href="${esc(url)}" target="_blank" style="text-decoration:none;">${tag}</a>` : tag}</div>`);
      }
      const font = `font-family:${fontStack('inherit', s.fontFamily)};text-align:${align};`;
      if (title) parts.push(`<h3 style="margin:0 0 8px 0;padding:0;${font}font-size:${titleSize}px;line-height:${Math.round(titleSize * 1.3)}px;mso-line-height-rule:exactly;font-weight:700;color:${s.headingColor};">${esc(title)}</h3>`);
      if (text) parts.push(`<p style="margin:0;padding:0;${font}font-size:${textSize}px;line-height:${Math.round(textSize * 1.55)}px;mso-line-height-rule:exactly;color:${s.textColor};">${esc(text).replace(/\r?\n/g, '<br>')}</p>`);
      if (label && url) parts.push(`<p style="margin:12px 0 0 0;padding:0;${font}font-size:${textSize}px;line-height:${Math.round(textSize * 1.4)}px;"><a href="${esc(url)}" target="_blank" style="color:${s.linkColor};font-weight:700;text-decoration:underline;">${esc(label)}</a></p>`);
      if (parts.length) any = true;
      else if (canvas) parts.push(placeholder(`Empty column ${n}`));
      return `<td class="em-col ${cls}" width="50%" valign="top" style="width:50%;padding:${pad};vertical-align:top;">\n${parts.join('\n')}\n</td>`;
    };
    const half = Math.floor(gap / 2);
    const left = col(1, 'em-col-l', `0 ${half}px 0 0`);
    const right = col(2, 'em-col-r', `0 0 0 ${gap - half}px`);
    if (!any && !canvas) return '';
    return cell(b, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">\n<tr>\n${left}\n${right}\n</tr>\n</table>`, 'left');
  },

  quote(b, doc, canvas) {
    const quote = (b.quote || '').trim();
    if (!quote && !canvas) return '';
    const s = doc.settings;
    const size = num(b.fontSize, 10, 60, 20);
    const accent = safeColor(b.accent, s.linkColor);
    const color = safeColor(b.color) || s.headingColor;
    const centered = b.variant === 'centered';
    const align = centered ? 'center' : 'left';
    const font = `font-family:${fontStack(b.fontFamily, s.fontFamily)};text-align:${align};`;
    const author = (b.author || '').trim();
    const role = (b.role || '').trim();
    const who = [author && `<strong style="color:${color};">${esc(author)}</strong>`, role && esc(role)].filter(Boolean).join(' · ');
    const inner = `<p style="margin:0;padding:0;${font}font-size:${size}px;line-height:${Math.round(size * 1.5)}px;mso-line-height-rule:exactly;font-style:italic;color:${color};">${quote ? esc(quote).replace(/\r?\n/g, '<br>') : placeholder('Empty quote')}</p>${who ? `\n<p style="margin:12px 0 0 0;padding:0;${font}font-size:14px;line-height:20px;color:${s.textColor};">${who}</p>` : ''}`;
    const body = centered
      ? inner
      : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">\n<tr>\n<td style="border-left:4px solid ${accent};padding:2px 0 2px 20px;">\n${inner}\n</td>\n</tr>\n</table>`;
    return cell(b, body, align);
  },

  social(b, doc, canvas) {
    const s = doc.settings;
    const link = linkOf(doc);
    const nets = [['website', 'Website'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['x', 'X'], ['linkedin', 'LinkedIn'], ['youtube', 'YouTube'], ['tiktok', 'TikTok']];
    const color = safeColor(b.color) || s.linkColor;
    const links = nets
      .map(([k, label]) => ({ url: link(b[k]), label }))
      .filter((n) => n.url)
      .map((n) => `<a href="${esc(n.url)}" target="_blank" style="color:${color};text-decoration:underline;">${n.label}</a>`);
    if (!links.length) return canvas ? cell(b, placeholder('Add your profile links'), b.align) : '';
    const size = num(b.fontSize, 8, 40, 13);
    const sep = b.separator && b.separator.trim() ? `&nbsp;&nbsp;${esc(b.separator.trim())}&nbsp;&nbsp;` : '&nbsp;&nbsp;&nbsp;';
    return cell(b, `<p style="margin:0;padding:0;font-family:${fontStack('inherit', s.fontFamily)};font-size:${size}px;line-height:${Math.round(size * 1.6)}px;mso-line-height-rule:exactly;font-weight:${b.bold ? 700 : 400};text-align:${b.align};">${links.join(sep)}</p>`, b.align);
  },

  footer(b, doc, canvas) {
    const s = doc.settings;
    const link = linkOf(doc);
    const size = num(b.fontSize, 8, 30, 12);
    const color = safeColor(b.color, '#9ca3af');
    const style = `margin:0 0 6px 0;padding:0;font-family:${fontStack('inherit', s.fontFamily)};font-size:${size}px;line-height:${Math.round(size * 1.5)}px;mso-line-height-rule:exactly;color:${color};text-align:${b.align};`;
    const a = (url, label) => `<a href="${esc(url)}" target="_blank" style="color:${color};text-decoration:underline;">${esc(label)}</a>`;
    const lines = [];
    const company = (b.company || '').trim();
    const address = (b.address || '').trim();
    if (company || address) lines.push([company && `<strong>${esc(company)}</strong>`, address && esc(address).replace(/\r?\n/g, '<br>')].filter(Boolean).join('<br>'));
    if ((b.note || '').trim()) lines.push(esc(b.note.trim()));
    const links = [];
    const unsub = link(b.unsubscribeUrl);
    const view = link(b.browserUrl);
    if (unsub && (b.unsubscribeLabel || '').trim()) links.push(a(unsub, b.unsubscribeLabel.trim()));
    if (view && (b.browserLabel || '').trim()) links.push(a(view, b.browserLabel.trim()));
    if (links.length) lines.push(links.join('&nbsp;&nbsp;·&nbsp;&nbsp;'));
    if (!lines.length) return canvas ? cell(b, placeholder('Empty footer'), b.align) : '';
    return cell(b, lines.map((l) => `<p style="${style}">${l}</p>`).join('\n'), b.align);
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

function pixelHtml(s) {
  const url = safePixelUrl(s.trackingPixel);
  return url ? `<img src="${esc(url)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;opacity:0;">\n` : '';
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
${pixelHtml(s)}</div>
</body>
</html>
`;
}

const label = (b, i) => `${BLOCKS[b.type].label} block ${i + 1}`;

/** Every raw link destination in the document (for checks and counts). */
function allLinks(doc) {
  const urls = [];
  for (const b of doc.blocks) {
    if (b.type === 'button') urls.push(b.url);
    else if (b.type === 'image') urls.push(b.link);
    else if (b.type === 'columns') urls.push(b.c1Url, b.c2Url);
    else if (b.type === 'footer') urls.push(b.unsubscribeUrl, b.browserUrl);
    else if (b.type === 'social') urls.push(b.website, b.facebook, b.instagram, b.x, b.linkedin, b.youtube, b.tiktok);
    else if (b.type === 'text') for (const m of (b.text || '').matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) urls.push(m[1]);
  }
  return urls.map((u) => safeUrl(u)).filter(Boolean);
}

const UNSUB = /unsub|opt-?out|\{\{[^}]*unsub|\*\|unsub/i;

/**
 * Pre-send checklist. Each item: { level: 'pass'|'info'|'warn', message, blockId? }.
 * Ordered with problems first.
 */
export function runChecks(doc, html = '') {
  const items = [];
  const add = (level, message, blockId) => items.push({ level, message, ...(blockId && { blockId }) });
  const s = doc.settings;

  if (!doc.blocks.length) add('warn', 'The email is empty — add some blocks first.');

  const subject = (s.subject || '').trim();
  if (!subject) add('warn', 'No subject line set (Email tab → Inbox). Add one so it can be checked and copied.');
  else if (subject.length > 60) add('info', `Subject is ${subject.length} characters — many inboxes cut it off after about 60.`);
  else add('pass', `Subject line set (${subject.length} characters).`);

  if (!(s.preheader || '').trim()) add('info', 'No preview text — inboxes will show the first words of the email instead.');
  else add('pass', 'Preview text set.');

  let imagesOk = true;
  let imageCount = 0;
  doc.blocks.forEach((b, i) => {
    const name = label(b, i);
    if (b.type === 'image') {
      if (!safeImageUrl(b.src)) {
        imagesOk = false;
        add('warn', `${name} has no valid image URL and was left out.`, b.id);
        return;
      }
      imageCount += 1;
      if (!b.alt.trim()) { imagesOk = false; add('info', `${name} has no alt text (shown when images are blocked).`, b.id); }
      if (/^http:\/\//i.test(b.src)) { imagesOk = false; add('warn', `${name} uses http:// — many email clients block insecure images. Use https://.`, b.id); }
      if (b.link && !safeUrl(b.link)) add('warn', `${name} has an unsupported link and it was removed.`, b.id);
    } else if (b.type === 'columns') {
      for (const n of [1, 2]) {
        if (b[`c${n}Image`]) {
          imageCount += 1;
          if (!(b[`c${n}Alt`] || '').trim()) { imagesOk = false; add('info', `${name}, column ${n}: image has no alt text.`, b.id); }
        }
        if ((b[`c${n}Label`] || '').trim() && !safeUrl(b[`c${n}Url`])) add('warn', `${name}, column ${n}: link “${b[`c${n}Label`].trim()}” has no valid URL, so it was left out.`, b.id);
      }
    } else if (b.type === 'button') {
      if (!b.text.trim()) add('warn', `${name} has no label and was left out.`, b.id);
      else if (!safeUrl(b.url)) add('warn', `${name} (“${b.text.trim()}”) has no valid link — it points to “#”.`, b.id);
    } else if ((b.type === 'heading' || b.type === 'text' || b.type === 'quote') && !(b.text || b.quote || '').trim()) {
      add('info', `${name} is empty and was left out.`, b.id);
    }
  });
  if (imageCount && imagesOk) add('pass', 'All images have https URLs and alt text.');

  const links = allLinks(doc);
  if (!UNSUB.test(links.join(' '))) add('warn', 'No unsubscribe link found. Marketing email needs one (CAN-SPAM, GDPR) — add a Footer block.');
  else add('pass', 'Unsubscribe link present.');
  const footer = doc.blocks.find((b) => b.type === 'footer');
  if (footer && hasMergeTag(footer.unsubscribeUrl)) add('info', 'The unsubscribe link is a merge tag — make sure your email platform fills it in.');
  if (footer && !(footer.address || '').trim()) add('info', 'The footer has no postal address (required in many countries for marketing email).', footer.id);

  const textChars = doc.blocks.reduce((n, b) => n + (b.type === 'text' || b.type === 'heading' ? (b.text || '').length : b.type === 'columns' ? (b.c1Text || '').length + (b.c2Text || '').length : 0), 0);
  if (imageCount && textChars < 80) add('info', 'The email is mostly images. Add some text so it still reads with images blocked.');

  if (s.utmEnabled) add('info', `UTM parameters will be added to ${links.filter((u) => /^https?:\/\//i.test(u) && !hasMergeTag(u) && !/unsubscribe|opt-?out|preferences/i.test(u)).length} link(s).`);
  if ((s.trackingPixel || '').trim()) {
    if (safePixelUrl(s.trackingPixel)) add('pass', 'Open-tracking pixel included.');
    else add('warn', 'The tracking pixel URL must start with https:// (or be a merge tag) — it was left out.');
  }

  if (html) {
    const bytes = new TextEncoder().encode(html).length;
    if (bytes > 102 * 1024) add('warn', `The HTML is ${Math.round(bytes / 1024)} KB — Gmail clips messages larger than 102 KB.`);
    else add('pass', `HTML size is ${(bytes / 1024).toFixed(1)} KB (Gmail clips above 102 KB).`);
  }
  const rank = { warn: 0, info: 1, pass: 2 };
  return items.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** Things that need attention (everything except passes). */
export const analyze = (doc, html = '') => runChecks(doc, html).filter((i) => i.level !== 'pass');

const stripInline = (text, mapUrl) =>
  text
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, l, u) => { const url = mapUrl(safeUrl(u)); return url ? `${l} (${url})` : l; })
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1');

/** Plain-text alternative (multipart/alternative text part). */
export function renderPlainText(doc) {
  const link = linkOf(doc);
  const out = [];
  for (const b of doc.blocks) {
    switch (b.type) {
      case 'heading': if (b.text.trim()) out.push(b.level === 1 ? b.text.trim().toUpperCase() : b.text.trim()); break;
      case 'text': if (b.text.trim()) out.push(stripInline(b.text.trim().replace(/\r\n?/g, '\n'), link)); break;
      case 'quote': if (b.quote.trim()) out.push(`${b.quote.trim()}${b.author ? `\n— ${b.author.trim()}${b.role ? `, ${b.role.trim()}` : ''}` : ''}`); break;
      case 'image': {
        const url = link(b.link);
        if (safeImageUrl(b.src) && (b.alt.trim() || url)) out.push([b.alt.trim() && `[${b.alt.trim()}]`, url].filter(Boolean).join(' '));
        break;
      }
      case 'button': if (b.text.trim()) out.push(`${b.text.trim()}: ${link(b.url) || ''}`.trim()); break;
      case 'columns':
        for (const n of [1, 2]) {
          const parts = [b[`c${n}Title`], b[`c${n}Text`]].map((t) => (t || '').trim()).filter(Boolean);
          const url = link(b[`c${n}Url`]);
          if ((b[`c${n}Label`] || '').trim() && url) parts.push(`${b[`c${n}Label`].trim()}: ${url}`);
          if (parts.length) out.push(parts.join('\n'));
        }
        break;
      case 'social': {
        const nets = [['website', 'Website'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['x', 'X'], ['linkedin', 'LinkedIn'], ['youtube', 'YouTube'], ['tiktok', 'TikTok']];
        const lines = nets.filter(([k]) => link(b[k])).map(([k, l]) => `${l}: ${link(b[k])}`);
        if (lines.length) out.push(lines.join('\n'));
        break;
      }
      case 'divider': out.push('----------'); break;
      case 'footer': {
        const lines = [b.company, b.address, b.note].map((t) => (t || '').trim()).filter(Boolean);
        if (link(b.unsubscribeUrl) && (b.unsubscribeLabel || '').trim()) lines.push(`${b.unsubscribeLabel.trim()}: ${link(b.unsubscribeUrl)}`);
        if (link(b.browserUrl) && (b.browserLabel || '').trim()) lines.push(`${b.browserLabel.trim()}: ${link(b.browserUrl)}`);
        if (lines.length) out.push(`--\n${lines.join('\n')}`);
        break;
      }
      default: break;
    }
  }
  return `${out.join('\n\n')}\n`;
}

export function exportEmail(doc) {
  const html = renderEmail(doc);
  const checks = runChecks(doc, html);
  return {
    html,
    text: renderPlainText(doc),
    checks,
    warnings: checks.filter((i) => i.level !== 'pass'),
    bytes: new TextEncoder().encode(html).length,
  };
}
