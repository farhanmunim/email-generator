// Image URL preview with loading / error states. Used by the library and the
// image block settings.

import { h } from '../dom.js';
import { safeImageUrl } from '../util.js';

export function createImagePreview({ empty = 'Paste an image URL to preview it.' } = {}) {
  const frame = h('div', { class: 'img-preview', 'aria-hidden': 'true' });
  const status = h('p', { class: 'img-status', role: 'status' }, empty);
  const el = h('div', { class: 'img-preview-wrap' }, frame, status);
  let token = 0;
  let timer;
  let state = 'empty';

  const set = (s, text, node) => {
    state = s;
    el.dataset.state = s;
    status.textContent = text;
    frame.replaceChildren(...(node ? [node] : []));
  };

  function check(url) {
    const mine = ++token;
    clearTimeout(timer);
    const raw = (url || '').trim();
    if (!raw) return set('empty', empty);
    const safe = safeImageUrl(raw);
    if (!safe) return set('error', 'Enter a full web address starting with http:// or https://');
    const img = new Image();
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    set('loading', 'Loading…', img);
    timer = setTimeout(() => {
      if (mine === token && state === 'loading') {
        set('error', 'This image is taking too long to load. Check the URL.');
      }
    }, 15000);
    img.onload = () => {
      if (mine !== token) return;
      clearTimeout(timer);
      el.dataset.state = 'ok';
      state = 'ok';
      status.textContent = `Image loaded (${img.naturalWidth} × ${img.naturalHeight})`;
    };
    img.onerror = () => {
      if (mine !== token) return;
      clearTimeout(timer);
      set('error', 'Couldn’t load this image. Check the URL, or that the file is publicly accessible.');
    };
    img.src = safe;
  }

  return { el, check, get state() { return state; } };
}
