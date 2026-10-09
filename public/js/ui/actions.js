// Block-level editing actions shared by the canvas, palette, library and panels.

import { createBlock, BLOCKS, normalizeBlock } from '../blocks.js';
import { uid } from '../util.js';
import { toast } from './toast.js';

export function createActions(store) {
  const indexOf = (id) => store.doc.blocks.findIndex((b) => b.id === id);

  function add(type, overrides = {}, index) {
    const block = createBlock(type, overrides);
    const at = Number.isInteger(index)
      ? Math.max(0, Math.min(index, store.doc.blocks.length))
      : (store.selectedId ? indexOf(store.selectedId) + 1 : store.doc.blocks.length);
    store.commit((d) => { d.blocks.splice(at, 0, block); });
    store.select(block.id);
    return block;
  }

  function move(id, toIndex) {
    const from = indexOf(id);
    if (from < 0) return;
    const to = Math.max(0, Math.min(toIndex, store.doc.blocks.length - 1));
    if (from === to) return;
    store.commit((d) => {
      const [b] = d.blocks.splice(from, 1);
      d.blocks.splice(to, 0, b);
    });
  }

  function moveBy(id, delta) {
    const from = indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= store.doc.blocks.length) return false;
    move(id, to);
    toast(`${BLOCKS[store.doc.blocks[to].type].label} moved to position ${to + 1}`, { timeout: 1500 });
    return true;
  }

  function duplicate(id) {
    const i = indexOf(id);
    if (i < 0) return;
    const copy = normalizeBlock({ ...store.doc.blocks[i], id: uid() });
    store.commit((d) => { d.blocks.splice(i + 1, 0, copy); });
    store.select(copy.id);
  }

  function remove(id) {
    const i = indexOf(id);
    if (i < 0) return;
    const type = store.doc.blocks[i].type;
    store.commit((d) => { d.blocks.splice(i, 1); });
    const next = store.doc.blocks[Math.min(i, store.doc.blocks.length - 1)];
    store.select(next ? next.id : null);
    toast(`${BLOCKS[type].label} deleted — press Ctrl/Cmd+Z to undo`, { timeout: 2500 });
  }

  return { add, move, moveBy, duplicate, remove, indexOf };
}
