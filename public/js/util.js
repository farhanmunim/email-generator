// Small, dependency-free helpers shared by the whole app.

export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

/** Escape text for use in HTML text nodes and quoted attributes. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function clamp(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Returns a normalised #rrggbb colour, or `fallback` when the input is not a hex colour. */
export function safeColor(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return fallback;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return `#${hex.toLowerCase()}`;
}

const LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

/**
 * Validates a link destination. Allows http(s), mailto, tel, anchors, relative
 * values and merge tags such as {{ url }}; blocks javascript:, data: etc.
 * Returns '' when unusable.
 */
export function safeUrl(value) {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned) return '';
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);
  if (scheme && !LINK_SCHEMES.has(scheme[1].toLowerCase())) return '';
  return cleaned.replace(/\s/g, '%20');
}

/** Image sources must be absolute http(s) URLs. Returns '' otherwise. */
export function safeImageUrl(value) {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!/^https?:\/\/[^\s/]+/i.test(cleaned)) return '';
  return cleaned.replace(/\s/g, '%20');
}

export function debounce(fn, wait = 200) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  wrapped.flush = (...args) => {
    clearTimeout(t);
    fn(...args);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

export const slugify = (s) =>
  String(s || 'email').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'email';

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}
