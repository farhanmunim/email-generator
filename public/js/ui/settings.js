// Right-hand settings panel: block settings + email-wide settings.

import { h } from '../dom.js';
import { BLOCKS, SETTINGS_GROUPS } from '../blocks.js';
import { icon } from '../icons.js';
import { buildForm } from './fields.js';

export function createSettingsPanel({ store, blockRoot, emailRoot, actions }) {
  function renderBlock() {
    const block = store.selected;
    blockRoot.replaceChildren();
    if (!block) {
      blockRoot.append(h('div', { class: 'empty-note' },
        h('p', {}, 'Nothing selected'),
        h('p', { class: 'help' }, 'Select a block on the canvas to edit its content and style. Or change the whole email from the “Email” tab.')));
      return;
    }
    const def = BLOCKS[block.type];
    const head = h('div', { class: 'panel-head' },
      h('div', { class: 'panel-title' }, h('span', { html: icon(block.type) }), h('h2', { id: 'block-settings-title' }, `${def.label} settings`)),
      h('div', { class: 'panel-actions' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Duplicate block', title: 'Duplicate', html: icon('copy'), onclick: () => actions.duplicate(block.id) }),
        h('button', { type: 'button', class: 'icon-btn danger', 'aria-label': 'Delete block', title: 'Delete', html: icon('trash'), onclick: () => actions.remove(block.id) })));
    const form = buildForm(def.groups, block, {
      doc: store.doc,
      onChange: (key, value) => {
        const id = block.id;
        store.commit((d) => {
          const b = d.blocks.find((x) => x.id === id);
          if (b) b[key] = value;
        }, { key: `${id}:${key}`, source: 'edit' });
      },
    });
    blockRoot.append(head, form);
  }

  function renderEmail() {
    emailRoot.replaceChildren();
    const settings = { ...store.doc.settings };
    const form = buildForm(SETTINGS_GROUPS, settings, {
      doc: store.doc,
      onChange: (key, value) => {
        store.commit((d) => { d.settings[key] = value; }, { key: `settings:${key}`, source: 'edit' });
      },
    });
    emailRoot.append(
      h('div', { class: 'panel-head' }, h('div', { class: 'panel-title' }, h('span', { html: icon('sliders') }), h('h2', {}, 'Email settings'))),
      form);
  }

  function render() {
    renderBlock();
    renderEmail();
  }

  return { render, renderBlock, renderEmail };
}
