// Observable document store with undo/redo and selection state.

const HISTORY_LIMIT = 100;
const COALESCE_MS = 900;

export function createStore(initialDoc) {
  let doc = initialDoc;
  let selectedId = null;
  let past = [];
  let future = [];
  let lastKey = null;
  let lastAt = 0;
  const subs = new Set();
  const emit = (e) => subs.forEach((fn) => fn(e));
  const snapshot = () => JSON.stringify(doc);
  const fixSelection = () => {
    if (selectedId && !doc.blocks.some((b) => b.id === selectedId)) selectedId = null;
  };

  return {
    get doc() { return doc; },
    get selectedId() { return selectedId; },
    get selected() { return doc.blocks.find((b) => b.id === selectedId) || null; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },

    select(id) {
      if (id === selectedId) return;
      selectedId = id;
      emit({ type: 'select' });
    },

    /**
     * Mutate the document in place. `key` coalesces rapid edits of one field
     * into a single undo step. `source: 'edit'` tells the settings panel not to rebuild.
     */
    commit(mutator, { key = null, source = 'structure' } = {}) {
      const now = Date.now();
      const coalesce = key && key === lastKey && now - lastAt < COALESCE_MS;
      if (!coalesce) {
        past.push(snapshot());
        if (past.length > HISTORY_LIMIT) past.shift();
      }
      future = [];
      lastKey = key;
      lastAt = now;
      mutator(doc);
      doc.updatedAt = now;
      const hadSelection = selectedId;
      fixSelection();
      emit({ type: 'doc', source });
      if (hadSelection !== selectedId) emit({ type: 'select' });
    },

    undo() {
      if (!past.length) return false;
      future.push(snapshot());
      doc = JSON.parse(past.pop());
      lastKey = null;
      const prev = selectedId;
      fixSelection();
      emit({ type: 'doc', source: 'history' });
      if (prev !== selectedId) emit({ type: 'select' });
      return true;
    },

    redo() {
      if (!future.length) return false;
      past.push(snapshot());
      doc = JSON.parse(future.pop());
      lastKey = null;
      const prev = selectedId;
      fixSelection();
      emit({ type: 'doc', source: 'history' });
      if (prev !== selectedId) emit({ type: 'select' });
      return true;
    },

    load(newDoc) {
      doc = newDoc;
      selectedId = null;
      past = [];
      future = [];
      lastKey = null;
      emit({ type: 'load' });
    },
  };
}
