// Schema-driven form controls for the settings panel.

import { h } from '../dom.js';
import { clamp, safeColor, debounce } from '../util.js';
import { createImagePreview } from './imagePreview.js';

let counter = 0;
const nextId = () => `f${++counter}`;

function textControl(field, value, set, id) {
  const common = {
    id, value: value ?? '', placeholder: field.placeholder, maxlength: field.maxLength || 2000,
    autocomplete: 'off', oninput: (e) => set(e.target.value),
  };
  if (field.type === 'textarea') {
    const ta = h('textarea', { ...common, value: null, rows: field.rows || 4 });
    ta.value = value ?? '';
    return ta;
  }
  return h('input', { ...common, type: field.type === 'url' ? 'url' : 'text', spellcheck: field.type === 'url' ? 'false' : null });
}

function numberControl(field, value, set, id) {
  const { min, max, step = 1, unit } = field;
  const num = h('input', { type: 'number', min, max, step, value, class: 'num', 'aria-label': `${field.label}${unit ? ` (${unit})` : ''}` });
  const commit = () => {
    if (num.value === '') return;
    const v = clamp(num.value, min, max, min);
    set(v);
    if (range) range.value = v;
  };
  num.addEventListener('input', commit);
  num.addEventListener('blur', () => { if (num.value === '' || +num.value !== clamp(num.value, min, max, min)) { num.value = clamp(num.value, min, max, value); commit(); } });
  let range = null;
  if (field.type === 'range') {
    range = h('input', { type: 'range', id, min, max, step, value });
    range.addEventListener('input', () => { num.value = range.value; set(+range.value); });
  } else {
    num.id = id;
  }
  return h('div', { class: 'range-row' }, range, num, unit ? h('span', { class: 'unit', 'aria-hidden': 'true' }, unit) : null);
}

function colorControl(field, value, set, id, ctx) {
  const fallback = (field.inherit && ctx.doc.settings[field.inherit]) || '#ffffff';
  let current = value || '';
  const swatch = h('input', { type: 'color', id, value: current || fallback, 'aria-label': `${field.label} colour picker` });
  const hex = h('input', {
    type: 'text', class: 'hex', value: current, maxlength: 7, spellcheck: 'false', autocomplete: 'off',
    placeholder: field.allowNone ? field.noneLabel || 'None' : '#000000', 'aria-label': `${field.label} hex value`,
  });
  const apply = (v) => {
    current = v;
    hex.value = v;
    if (v) swatch.value = v;
    else swatch.value = fallback;
    clear?.toggleAttribute('hidden', !v);
    hex.removeAttribute('aria-invalid');
    set(v);
  };
  swatch.addEventListener('input', () => apply(swatch.value));
  hex.addEventListener('change', () => {
    let v = hex.value.trim();
    if (v && !v.startsWith('#')) v = `#${v}`;
    if (!v && field.allowNone) return apply('');
    const c = safeColor(v);
    if (c) apply(c);
    else { hex.setAttribute('aria-invalid', 'true'); hex.value = current; setTimeout(() => hex.removeAttribute('aria-invalid'), 1200); }
  });
  const clear = field.allowNone
    ? h('button', { type: 'button', class: 'mini', onclick: () => apply(''), 'aria-label': `Clear ${field.label}`, hidden: !current }, field.noneLabel === 'Default' ? 'Reset' : 'Clear')
    : null;
  return h('div', { class: 'color-row' }, swatch, hex, clear);
}

function segmentedControl(field, value, set, id) {
  const name = `${id}-seg`;
  return h('div', { class: 'seg', role: 'radiogroup', 'aria-labelledby': `${id}-label` },
    field.options.map((o) => h('label', {},
      h('input', { type: 'radio', name, value: o.value, checked: String(o.value) === String(value), onchange: () => set(o.value) }),
      h('span', {}, o.label))));
}

function selectControl(field, value, set, id) {
  const sel = h('select', { id, onchange: (e) => set(field.numeric ? Number(e.target.value) : e.target.value) },
    field.options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label)));
  return sel;
}

function imageControl(field, value, set, id, ctx) {
  const input = h('input', { type: 'url', id, value: value ?? '', placeholder: 'https://example.com/photo.jpg', autocomplete: 'off', spellcheck: 'false', maxlength: 2000 });
  const preview = createImagePreview({ empty: 'No image yet — paste a URL above.' });
  const check = debounce((v) => preview.check(v), 350);
  input.addEventListener('input', () => { set(input.value); check(input.value); });
  preview.check(value);
  const library = ctx.doc.images || [];
  let picker = null;
  if (library.length) {
    picker = h('select', {
      'aria-label': 'Choose from image library',
      onchange: (e) => {
        if (!e.target.value) return;
        input.value = e.target.value;
        set(input.value);
        preview.check(input.value);
        e.target.value = '';
      },
    }, h('option', { value: '' }, 'Choose from library…'),
    library.map((img, i) => h('option', { value: img.url }, img.alt || `Image ${i + 1}`)));
  }
  return h('div', { class: 'image-field' }, input, preview.el, picker);
}

function checkboxControl(field, value, set, id) {
  return h('label', { class: 'switch', for: id },
    h('input', { type: 'checkbox', id, role: 'switch', checked: !!value, onchange: (e) => set(e.target.checked) }),
    h('span', { class: 'track', 'aria-hidden': 'true' }),
    h('span', {}, field.label));
}

/**
 * Builds the form for a list of field groups.
 * `values` is the live object being edited; `onChange(key, value)` persists it.
 */
export function buildForm(groups, values, { onChange, doc }) {
  const root = document.createDocumentFragment();
  const conditional = [];

  for (const group of groups) {
    const grid = h('div', { class: 'fields' });
    for (const field of group.fields) {
      const id = nextId();
      const set = (v) => {
        values[field.key] = v; // keep local view current for showIf
        onChange(field.key, v);
        refresh();
      };
      let control;
      switch (field.type) {
        case 'text': case 'url': case 'textarea': control = textControl(field, values[field.key], set, id); break;
        case 'number': case 'range': control = numberControl(field, values[field.key], set, id); break;
        case 'color': control = colorControl(field, values[field.key], set, id, { doc }); break;
        case 'segmented': control = segmentedControl(field, values[field.key], set, id); break;
        case 'select': control = selectControl(field, values[field.key], set, id); break;
        case 'checkbox': control = checkboxControl(field, values[field.key], set, id); break;
        case 'image': control = imageControl(field, values[field.key], set, id, { doc }); break;
        default: control = null;
      }
      if (!control) continue;
      const inlineLabel = field.type === 'checkbox';
      const wrap = h('div', { class: `field${field.half ? ' half' : ''}${inlineLabel ? ' field-inline' : ''}` },
        inlineLabel ? null : h('label', { id: `${id}-label`, for: field.type === 'segmented' ? null : id }, field.label),
        control,
        field.help ? h('p', { class: 'help' }, field.help) : null);
      if (field.showIf) conditional.push({ wrap, field });
      grid.append(wrap);
    }
    root.append(h('section', { class: 'group' }, h('h3', {}, group.title), grid));
  }

  function refresh() {
    for (const { wrap, field } of conditional) wrap.hidden = !field.showIf(values);
  }
  refresh();
  return root;
}
