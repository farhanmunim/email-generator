// The editing canvas: renders blocks as real email markup, handles selection,
// keyboard navigation and drag & drop (reorder + drops from palette/library).

import { esc } from '../util.js';
import { BLOCKS } from '../blocks.js';
import { renderBlock } from '../render.js';
import { icon } from '../icons.js';

const MIME_MOVE = 'application/x-eb-move';
const MIME_NEW = 'application/x-eb-new';
const MIME_IMAGE = 'application/x-eb-image';

export { MIME_NEW, MIME_IMAGE };

export function createCanvas({ store, root, actions, onOpenSettings, onEmpty }) {
  let dropTarget = null; // { el, where }

  function toolbar(id, i, n) {
    const btn = (action, label, ic, extra = '') =>
      `<button type="button" class="tb-btn ${extra}" data-action="${action}" aria-label="${label}" title="${label}"${(action === 'up' && i === 0) || (action === 'down' && i === n - 1) ? ' disabled' : ''}>${icon(ic, 16)}</button>`;
    return `<div class="cb-toolbar" role="toolbar" aria-label="Block actions">
<span class="tb-btn cb-handle" draggable="true" title="Drag to reorder" aria-hidden="true">${icon('grip', 16)}</span>
${btn('up', 'Move up', 'up')}${btn('down', 'Move down', 'down')}${btn('settings', 'Edit settings', 'sliders', 'only-narrow')}${btn('duplicate', 'Duplicate', 'copy')}${btn('delete', 'Delete', 'trash', 'danger')}
</div>`;
  }

  function render() {
    const doc = store.doc;
    const active = document.activeElement;
    let focusSpec = null;
    if (root.contains(active)) {
      const blockEl = active.closest('.cb');
      if (blockEl) focusSpec = { id: blockEl.dataset.id, action: active.dataset?.action || null };
    }

    const s = doc.settings;
    const frame = root.querySelector('.canvas-page') || null;
    const n = doc.blocks.length;
    const rows = doc.blocks.map((b, i) => {
      const sel = b.id === store.selectedId;
      const tabbable = sel || (!store.selectedId && i === 0);
      return `<div class="cb${sel ? ' is-selected' : ''}" data-id="${esc(b.id)}" role="group" aria-roledescription="email block" aria-label="${esc(BLOCKS[b.type].label)}, block ${i + 1} of ${n}"${sel ? ' aria-current="true"' : ''} tabindex="${tabbable ? 0 : -1}">
${toolbar(b.id, i, n)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
${renderBlock(b, doc, { canvas: true })}
</table>
</div>`;
    }).join('');

    const empty = n ? '' : `<div class="canvas-empty" data-empty>
<p><strong>Your email is empty</strong></p>
<p>Click a block on the left, or drag one here.</p>
<button type="button" class="btn" data-action="templates">Start from a template</button>
</div>`;

    root.style.setProperty('--em-page-bg', s.bg);
    root.style.setProperty('--em-content-bg', s.contentBg);
    root.style.setProperty('--em-width', `${s.width}px`);
    root.style.setProperty('--em-outer', `${s.outerPadding}px`);
    root.innerHTML = `<div class="canvas-page"><div class="canvas-content em-canvas" aria-label="Email content">${rows}${empty}</div></div>`;
    void frame;

    if (focusSpec) {
      const target = root.querySelector(`.cb[data-id="${CSS.escape(focusSpec.id)}"]`);
      const btn = focusSpec.action && target?.querySelector(`[data-action="${focusSpec.action}"]:not([disabled])`);
      (btn || target)?.focus({ preventScroll: true });
    }
  }

  function updateSelection({ scroll = false } = {}) {
    const blocks = [...root.querySelectorAll('.cb')];
    blocks.forEach((el, i) => {
      const sel = el.dataset.id === store.selectedId;
      el.classList.toggle('is-selected', sel);
      if (sel) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
      el.tabIndex = sel || (!store.selectedId && i === 0) ? 0 : -1;
      if (sel && scroll) el.scrollIntoView({ block: 'nearest' });
    });
  }

  const blockEl = (id) => root.querySelector(`.cb[data-id="${CSS.escape(id)}"]`);

  // ---- selection + toolbar clicks ------------------------------------------------
  root.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) e.preventDefault(); // never navigate away from the editor
    const actionEl = e.target.closest('[data-action]');
    const el = e.target.closest('.cb');
    if (actionEl && actionEl.dataset.action === 'templates') return onEmpty?.();
    if (!el) {
      if (e.target.closest('.canvas-page') || e.target === root) store.select(null);
      return;
    }
    const id = el.dataset.id;
    if (actionEl && el.contains(actionEl) && actionEl.closest('.cb-toolbar')) {
      switch (actionEl.dataset.action) {
        case 'up': actions.moveBy(id, -1); break;
        case 'down': actions.moveBy(id, 1); break;
        case 'duplicate': actions.duplicate(id); break;
        case 'delete': actions.remove(id); break;
        case 'settings': store.select(id); onOpenSettings?.(); break;
        default: break;
      }
      return;
    }
    store.select(id);
  });

  root.addEventListener('dblclick', (e) => {
    if (e.target.closest('.cb') && !e.target.closest('.cb-toolbar')) onOpenSettings?.({ focus: true });
  });

  // ---- keyboard ------------------------------------------------------------------
  root.addEventListener('keydown', (e) => {
    const el = e.target.closest('.cb');
    if (!el || e.target !== el) return;
    const id = el.dataset.id;
    const blocks = store.doc.blocks;
    const i = actions.indexOf(id);
    const key = e.key;
    const mod = e.ctrlKey || e.metaKey;
    const focusAt = (j) => {
      const b = blocks[j];
      if (!b) return;
      store.select(b.id);
      blockEl(b.id)?.focus();
    };
    if ((key === 'ArrowUp' || key === 'ArrowDown') && e.altKey) {
      e.preventDefault();
      actions.moveBy(id, key === 'ArrowUp' ? -1 : 1);
    } else if (key === 'ArrowUp') { e.preventDefault(); focusAt(Math.max(0, i - 1)); }
    else if (key === 'ArrowDown') { e.preventDefault(); focusAt(Math.min(blocks.length - 1, i + 1)); }
    else if (key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (key === 'End') { e.preventDefault(); focusAt(blocks.length - 1); }
    else if (key === 'Delete' || key === 'Backspace') { e.preventDefault(); actions.remove(id); }
    else if (mod && key.toLowerCase() === 'd') { e.preventDefault(); actions.duplicate(id); }
    else if (key === 'Enter' || key === ' ') { e.preventDefault(); store.select(id); onOpenSettings?.({ focus: true }); }
    else if (key === 'Escape') { store.select(null); }
  });

  // ---- broken images ---------------------------------------------------------------
  root.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.closest('.cb')) return;
    const msg = document.createElement('div');
    msg.className = 'em-img-fail';
    msg.setAttribute('role', 'img');
    msg.setAttribute('aria-label', 'Image could not be loaded');
    msg.textContent = 'Image couldn’t be loaded — check the URL';
    img.replaceWith(msg);
  }, true);

  // ---- drag & drop -----------------------------------------------------------------
  root.addEventListener('dragstart', (e) => {
    const handle = e.target.closest?.('.cb-handle');
    if (!handle) { e.preventDefault(); return; }
    const el = handle.closest('.cb');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(MIME_MOVE, el.dataset.id);
    e.dataTransfer.setData('text/plain', el.dataset.id);
    e.dataTransfer.setDragImage(el, 16, 16);
    el.classList.add('is-dragging');
  });
  root.addEventListener('dragend', () => {
    root.querySelectorAll('.is-dragging').forEach((el) => el.classList.remove('is-dragging'));
    clearDrop();
  });

  function clearDrop() {
    if (dropTarget) dropTarget.el.classList.remove('drop-before', 'drop-after');
    dropTarget = null;
    root.classList.remove('is-drop-empty');
  }

  const ours = (dt) => [MIME_MOVE, MIME_NEW, MIME_IMAGE].some((t) => dt.types.includes(t));

  function locate(e) {
    const blocks = [...root.querySelectorAll('.cb')];
    if (!blocks.length) return null;
    const hit = e.target.closest?.('.cb');
    let el = hit;
    if (!el) {
      // pointer is in the page margin: pick the nearest block vertically
      el = blocks.reduce((best, cur) => {
        const r = cur.getBoundingClientRect();
        const d = Math.abs(e.clientY - (r.top + r.height / 2));
        return !best || d < best.d ? { el: cur, d } : best;
      }, null).el;
    }
    const r = el.getBoundingClientRect();
    return { el, where: e.clientY < r.top + r.height / 2 ? 'before' : 'after' };
  }

  root.addEventListener('dragover', (e) => {
    if (!ours(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(MIME_MOVE) ? 'move' : 'copy';
    const t = locate(e);
    if (!t) { root.classList.add('is-drop-empty'); return; }
    if (dropTarget && (dropTarget.el !== t.el || dropTarget.where !== t.where)) clearDrop();
    dropTarget = t;
    t.el.classList.toggle('drop-before', t.where === 'before');
    t.el.classList.toggle('drop-after', t.where === 'after');
  });
  root.addEventListener('dragleave', (e) => {
    if (!root.contains(e.relatedTarget)) clearDrop();
  });
  root.addEventListener('drop', (e) => {
    if (!ours(e.dataTransfer)) return;
    e.preventDefault();
    const t = dropTarget || locate(e);
    clearDrop();
    const blocks = store.doc.blocks;
    let index = blocks.length;
    if (t) {
      const i = actions.indexOf(t.el.dataset.id);
      index = t.where === 'before' ? i : i + 1;
    }
    const dt = e.dataTransfer;
    if (dt.types.includes(MIME_MOVE)) {
      const id = dt.getData(MIME_MOVE);
      const from = actions.indexOf(id);
      if (from < 0) return;
      actions.move(id, from < index ? index - 1 : index);
    } else if (dt.types.includes(MIME_NEW)) {
      const type = dt.getData(MIME_NEW);
      if (BLOCKS[type]) actions.add(type, {}, index);
    } else if (dt.types.includes(MIME_IMAGE)) {
      const src = dt.getData(MIME_IMAGE);
      actions.add('image', { src, alt: dt.getData('text/plain') || '' }, index);
    }
  });

  return { render, updateSelection };
}
