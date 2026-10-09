// Left panel: block palette and the image library.

import { h, $ } from '../dom.js';
import { BLOCKS, BLOCK_TYPES } from '../blocks.js';
import { icon } from '../icons.js';
import { uid, safeImageUrl } from '../util.js';
import { createImagePreview } from './imagePreview.js';
import { MIME_NEW, MIME_IMAGE } from './canvas.js';
import { toast } from './toast.js';

export function createPalette({ root, actions, onAdded }) {
  root.replaceChildren(...BLOCK_TYPES.map((type) =>
    h('li', {},
      h('button', {
        type: 'button', class: 'palette-item', draggable: 'true', 'data-type': type, title: BLOCKS[type].hint,
        onclick: () => { actions.add(type); onAdded?.(type); },
        ondragstart: (e) => {
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData(MIME_NEW, type);
          e.dataTransfer.setData('text/plain', type);
        },
      },
      h('span', { class: 'pi-icon', html: icon(type, 20) }),
      h('span', { class: 'pi-label' }, BLOCKS[type].label)))));
}

export function createImageLibrary({ store, actions, form, grid, onAdded }) {
  const urlInput = $('#lib-url', form);
  const altInput = $('#lib-alt', form);
  const previewHost = $('#lib-preview', form);
  const preview = createImagePreview();
  previewHost.append(preview.el);
  form.addEventListener('submit', (e) => e.preventDefault());
  const addBtn = $('#lib-add', form);
  const saveBtn = $('#lib-save', form);
  const useBtn = $('#lib-use', form);
  const hint = $('#lib-hint', form);

  function validUrl() {
    const url = safeImageUrl(urlInput.value);
    if (!url) {
      hint.textContent = urlInput.value.trim()
        ? 'Enter a full URL starting with https:// (or http://).'
        : 'Enter an image URL first.';
      hint.hidden = false;
      urlInput.setAttribute('aria-invalid', 'true');
      urlInput.focus();
      return '';
    }
    hint.hidden = true;
    urlInput.removeAttribute('aria-invalid');
    return url;
  }

  let t;
  urlInput.addEventListener('input', () => {
    clearTimeout(t);
    hint.hidden = true;
    urlInput.removeAttribute('aria-invalid');
    t = setTimeout(() => preview.check(urlInput.value), 350);
  });
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); }
  });

  addBtn.addEventListener('click', () => {
    const src = validUrl();
    if (!src) return;
    actions.add('image', { src, alt: altInput.value.trim() });
    onAdded?.();
    if (preview.state === 'error') toast('Added — but the image could not be loaded. Check the URL.', { kind: 'warn' });
  });
  useBtn.addEventListener('click', () => {
    const src = validUrl();
    const sel = store.selected;
    if (!src || !sel || sel.type !== 'image') return;
    const alt = altInput.value.trim();
    store.commit((d) => {
      const b = d.blocks.find((x) => x.id === sel.id);
      b.src = src;
      if (alt) b.alt = alt;
    });
    toast('Image updated');
  });
  saveBtn.addEventListener('click', () => {
    const src = validUrl();
    if (!src) return;
    if (store.doc.images.some((i) => i.url === src)) { toast('That image is already in the library'); return; }
    store.commit((d) => { d.images.unshift({ id: uid(), url: src, alt: altInput.value.trim() }); });
    toast('Saved to library');
  });

  function sync() {
    const sel = store.selected;
    useBtn.disabled = !(sel && sel.type === 'image');
  }

  function render() {
    sync();
    const images = store.doc.images;
    grid.replaceChildren();
    if (!images.length) {
      grid.append(h('li', { class: 'lib-empty' }, 'Your saved images appear here. They are stored in this project only.'));
      return;
    }
    for (const img of images) {
      const thumb = h('img', { src: img.url, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', draggable: 'false' });
      thumb.addEventListener('error', () => {
        thumb.replaceWith(h('span', { class: 'thumb-fail' }, 'Unavailable'));
      });
      const label = img.alt || img.url.replace(/^https?:\/\//, '');
      grid.append(h('li', {
        class: 'lib-item', draggable: 'true',
        ondragstart: (e) => {
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData(MIME_IMAGE, img.url);
          e.dataTransfer.setData('text/plain', img.alt || '');
        },
      },
      h('div', { class: 'lib-thumb' }, thumb),
      h('p', { class: 'lib-name', title: img.url }, label),
      h('div', { class: 'lib-actions' },
        h('button', { type: 'button', class: 'mini', onclick: () => { actions.add('image', { src: img.url, alt: img.alt }); onAdded?.(); }, 'aria-label': `Add ${label} to email` }, 'Add'),
        h('button', {
          type: 'button', class: 'mini', disabled: !(store.selected && store.selected.type === 'image'), 'aria-label': `Use ${label} in selected image block`,
          onclick: () => {
            const sel = store.selected;
            if (!sel || sel.type !== 'image') return;
            store.commit((d) => { const b = d.blocks.find((x) => x.id === sel.id); b.src = img.url; if (img.alt && !b.alt) b.alt = img.alt; });
            toast('Image updated');
          },
        }, 'Use'),
        h('button', {
          type: 'button', class: 'mini danger', 'aria-label': `Remove ${label} from library`,
          onclick: () => store.commit((d) => { d.images = d.images.filter((i) => i.id !== img.id); }),
        }, 'Remove'))));
    }
  }

  return { render, sync };
}
