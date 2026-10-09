// Block definitions, the document model and its normaliser.
// Everything the editor knows about a block type lives here: defaults + the
// field schema that drives the settings panel and validates imported JSON.

import { uid, clamp, safeColor, safeUrl, safeImageUrl } from './util.js';

export const FONTS = {
  arial: ['Arial / Helvetica', 'Arial, Helvetica, sans-serif'],
  system: ['System UI', "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"],
  georgia: ['Georgia (serif)', 'Georgia, Times New Roman, serif'],
  times: ['Times New Roman', 'Times New Roman, Times, serif'],
  verdana: ['Verdana', 'Verdana, Geneva, sans-serif'],
  trebuchet: ['Trebuchet MS', 'Trebuchet MS, Helvetica, sans-serif'],
  tahoma: ['Tahoma', 'Tahoma, Geneva, sans-serif'],
  courier: ['Courier New (mono)', 'Courier New, Courier, monospace'],
};
export const fontOptions = Object.entries(FONTS).map(([value, [label]]) => ({ value, label }));
const fontOptionsInherit = [{ value: 'inherit', label: 'Email default' }, ...fontOptions];

/** Resolve a font key to a CSS stack, falling back to the document font. */
export function fontStack(key, docFontKey = 'arial') {
  return (FONTS[key] || FONTS[docFontKey] || FONTS.arial)[1];
}

const ALIGN = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const padding = (t, b, l, r) => ({ paddingTop: t, paddingBottom: b, paddingLeft: l, paddingRight: r });

const spacingGroup = {
  title: 'Spacing & background',
  fields: [
    { key: 'paddingTop', label: 'Top', type: 'number', min: 0, max: 120, unit: 'px', half: true },
    { key: 'paddingBottom', label: 'Bottom', type: 'number', min: 0, max: 120, unit: 'px', half: true },
    { key: 'paddingLeft', label: 'Left', type: 'number', min: 0, max: 120, unit: 'px', half: true },
    { key: 'paddingRight', label: 'Right', type: 'number', min: 0, max: 120, unit: 'px', half: true },
    { key: 'bg', label: 'Section background', type: 'color', allowNone: true, noneLabel: 'None' },
  ],
};

const typography = (sizeMin, sizeMax) => [
  { key: 'fontFamily', label: 'Font', type: 'select', options: fontOptionsInherit },
  { key: 'fontSize', label: 'Size', type: 'range', min: sizeMin, max: sizeMax, unit: 'px' },
  { key: 'lineHeight', label: 'Line height', type: 'range', min: 1, max: 2.2, step: 0.05 },
  { key: 'align', label: 'Alignment', type: 'segmented', options: ALIGN },
];

export const BLOCKS = {
  heading: {
    label: 'Heading',
    hint: 'Title or section header',
    defaults: () => ({
      text: 'Your headline here', level: 1, fontSize: 32, lineHeight: 1.25, bold: true,
      color: '', fontFamily: 'inherit', align: 'left', bg: '', ...padding(24, 8, 32, 32),
    }),
    groups: [
      {
        title: 'Content',
        fields: [
          { key: 'text', label: 'Text', type: 'textarea', rows: 2, maxLength: 500 },
          { key: 'level', label: 'Semantic level', type: 'select', numeric: true,
            options: [{ value: 1, label: 'Heading 1' }, { value: 2, label: 'Heading 2' }, { value: 3, label: 'Heading 3' }] },
        ],
      },
      {
        title: 'Style',
        fields: [
          ...typography(14, 72),
          { key: 'bold', label: 'Bold', type: 'checkbox' },
          { key: 'color', label: 'Text colour', type: 'color', allowNone: true, noneLabel: 'Default', inherit: 'headingColor' },
        ],
      },
      spacingGroup,
    ],
  },
  text: {
    label: 'Text',
    hint: 'Paragraphs with links',
    defaults: () => ({
      text: 'Write your message here. Use a blank line to start a new paragraph.\n\nYou can add **bold**, __italic__ and [links](https://example.com).',
      fontSize: 16, lineHeight: 1.6, color: '', fontFamily: 'inherit', align: 'left', bg: '', ...padding(8, 8, 32, 32),
    }),
    groups: [
      {
        title: 'Content',
        fields: [
          { key: 'text', label: 'Text', type: 'textarea', rows: 7, maxLength: 10000,
            help: 'Blank line = new paragraph. **bold**, __italic__, [label](https://link).' },
        ],
      },
      {
        title: 'Style',
        fields: [
          ...typography(10, 40),
          { key: 'color', label: 'Text colour', type: 'color', allowNone: true, noneLabel: 'Default', inherit: 'textColor' },
        ],
      },
      spacingGroup,
    ],
  },
  image: {
    label: 'Image',
    hint: 'Photo or graphic from a URL',
    defaults: () => ({
      src: '', alt: '', width: 100, align: 'center', link: '', radius: 0, bg: '', ...padding(0, 0, 0, 0),
    }),
    groups: [
      {
        title: 'Image',
        fields: [
          { key: 'src', label: 'Image URL', type: 'image' },
          { key: 'alt', label: 'Alt text', type: 'text', maxLength: 300, help: 'Describe the image for people who cannot see it.' },
          { key: 'link', label: 'Link (optional)', type: 'url', placeholder: 'https://…', maxLength: 2000 },
        ],
      },
      {
        title: 'Layout',
        fields: [
          { key: 'width', label: 'Width', type: 'range', min: 10, max: 100, unit: '%' },
          { key: 'align', label: 'Alignment', type: 'segmented', options: ALIGN },
          { key: 'radius', label: 'Corner radius', type: 'range', min: 0, max: 48, unit: 'px' },
        ],
      },
      spacingGroup,
    ],
  },
  button: {
    label: 'Button',
    hint: 'Call-to-action link',
    defaults: () => ({
      text: 'Get started', url: '', fill: '#2563eb', textColor: '#ffffff', borderColor: '', borderWidth: 0,
      radius: 6, fontSize: 16, bold: true, fontFamily: 'inherit', padY: 14, padX: 28, align: 'center',
      fullWidth: false, bg: '', ...padding(16, 16, 32, 32),
    }),
    groups: [
      {
        title: 'Content',
        fields: [
          { key: 'text', label: 'Label', type: 'text', maxLength: 120 },
          { key: 'url', label: 'Link', type: 'url', placeholder: 'https://…', maxLength: 2000 },
        ],
      },
      {
        title: 'Button style',
        fields: [
          { key: 'fill', label: 'Fill colour', type: 'color', allowNone: true, noneLabel: 'Transparent' },
          { key: 'textColor', label: 'Text colour', type: 'color' },
          { key: 'borderColor', label: 'Border colour', type: 'color', allowNone: true, noneLabel: 'None' },
          { key: 'borderWidth', label: 'Border width', type: 'range', min: 0, max: 6, unit: 'px' },
          { key: 'radius', label: 'Corner radius', type: 'range', min: 0, max: 40, unit: 'px' },
          { key: 'fontFamily', label: 'Font', type: 'select', options: fontOptionsInherit },
          { key: 'fontSize', label: 'Text size', type: 'range', min: 12, max: 28, unit: 'px' },
          { key: 'bold', label: 'Bold', type: 'checkbox' },
          { key: 'padY', label: 'Vertical padding', type: 'range', min: 6, max: 40, unit: 'px' },
          { key: 'padX', label: 'Horizontal padding', type: 'range', min: 8, max: 80, unit: 'px' },
          { key: 'fullWidth', label: 'Full width', type: 'checkbox' },
          { key: 'align', label: 'Alignment', type: 'segmented', options: ALIGN, showIf: (p) => !p.fullWidth },
        ],
      },
      spacingGroup,
    ],
  },
  divider: {
    label: 'Divider',
    hint: 'Horizontal line',
    defaults: () => ({
      color: '#e5e7eb', thickness: 1, lineStyle: 'solid', width: 100, align: 'center', bg: '', ...padding(16, 16, 32, 32),
    }),
    groups: [
      {
        title: 'Style',
        fields: [
          { key: 'color', label: 'Colour', type: 'color' },
          { key: 'thickness', label: 'Thickness', type: 'range', min: 1, max: 12, unit: 'px' },
          { key: 'lineStyle', label: 'Line style', type: 'select',
            options: [{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' }] },
          { key: 'width', label: 'Width', type: 'range', min: 10, max: 100, unit: '%' },
          { key: 'align', label: 'Alignment', type: 'segmented', options: ALIGN, showIf: (p) => p.width < 100 },
        ],
      },
      spacingGroup,
    ],
  },
  spacer: {
    label: 'Spacer',
    hint: 'Empty vertical space',
    defaults: () => ({ height: 32, bg: '' }),
    groups: [
      {
        title: 'Size',
        fields: [
          { key: 'height', label: 'Height', type: 'range', min: 4, max: 200, unit: 'px' },
          { key: 'bg', label: 'Background', type: 'color', allowNone: true, noneLabel: 'None' },
        ],
      },
    ],
  },
};

export const BLOCK_TYPES = Object.keys(BLOCKS);

export const SETTINGS_DEFAULTS = {
  width: 600, outerPadding: 24, bg: '#f3f4f6', contentBg: '#ffffff', textColor: '#374151',
  headingColor: '#111827', linkColor: '#2563eb', fontFamily: 'arial', preheader: '',
};

export const SETTINGS_GROUPS = [
  {
    title: 'Layout',
    fields: [
      { key: 'width', label: 'Content width', type: 'range', min: 320, max: 720, step: 10, unit: 'px' },
      { key: 'outerPadding', label: 'Page padding (top/bottom)', type: 'range', min: 0, max: 80, unit: 'px' },
    ],
  },
  {
    title: 'Colours',
    fields: [
      { key: 'bg', label: 'Page background', type: 'color' },
      { key: 'contentBg', label: 'Email background', type: 'color' },
      { key: 'textColor', label: 'Body text', type: 'color' },
      { key: 'headingColor', label: 'Headings', type: 'color' },
      { key: 'linkColor', label: 'Links', type: 'color' },
    ],
  },
  {
    title: 'Typography',
    fields: [{ key: 'fontFamily', label: 'Default font', type: 'select', options: fontOptions }],
  },
  {
    title: 'Inbox',
    fields: [
      { key: 'preheader', label: 'Preview text', type: 'text', maxLength: 200,
        help: 'The snippet shown next to the subject line in most inboxes.' },
    ],
  },
];

const flatten = (groups) => groups.flatMap((g) => g.fields);

function coerce(field, value, fallback) {
  switch (field.type) {
    case 'number':
    case 'range':
      return clamp(value, field.min, field.max, fallback);
    case 'color':
      if (value === '' && field.allowNone) return '';
      return safeColor(value, fallback);
    case 'checkbox':
      return typeof value === 'boolean' ? value : fallback;
    case 'select':
    case 'segmented': {
      const match = field.options.find((o) => String(o.value) === String(value));
      return match ? match.value : fallback;
    }
    case 'image':
      return safeImageUrl(value) ? String(value).trim().slice(0, 2000) : '';
    case 'url':
      return typeof value === 'string' ? safeUrl(value).slice(0, field.maxLength || 2000) : '';
    default:
      return typeof value === 'string' ? value.slice(0, field.maxLength || 2000) : fallback;
  }
}

export function createBlock(type, overrides = {}) {
  const def = BLOCKS[type];
  if (!def) throw new Error(`Unknown block type: ${type}`);
  return normalizeBlock({ id: uid(), type, ...def.defaults(), ...overrides });
}

export function normalizeBlock(raw) {
  const def = raw && BLOCKS[raw.type];
  if (!def) return null;
  const defaults = def.defaults();
  const block = { id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : uid(), type: raw.type };
  for (const field of flatten(def.groups)) {
    block[field.key] = coerce(field, raw[field.key], defaults[field.key]);
  }
  return block;
}

export function normalizeSettings(raw = {}) {
  const out = {};
  for (const field of flatten(SETTINGS_GROUPS)) {
    out[field.key] = coerce(field, raw[field.key], SETTINGS_DEFAULTS[field.key]);
  }
  return out;
}

export function createDoc(name = 'Untitled email', blocks = [], settings = {}) {
  return {
    version: 1,
    id: uid(),
    name,
    updatedAt: Date.now(),
    settings: normalizeSettings(settings),
    blocks,
    images: [],
  };
}

/** Validates and sanitises untrusted project data (storage or JSON import). */
export function normalizeDoc(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.blocks)) {
    throw new Error('This file is not a valid email project.');
  }
  const seen = new Set();
  const blocks = [];
  for (const b of raw.blocks.slice(0, 200)) {
    const nb = normalizeBlock(b);
    if (!nb) continue;
    while (seen.has(nb.id)) nb.id = uid();
    seen.add(nb.id);
    blocks.push(nb);
  }
  const images = [];
  for (const img of Array.isArray(raw.images) ? raw.images.slice(0, 100) : []) {
    const url = safeImageUrl(img && img.url);
    if (url) images.push({ id: typeof img.id === 'string' ? img.id.slice(0, 40) : uid(), url, alt: String(img.alt || '').slice(0, 300) });
  }
  return {
    version: 1,
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : uid(),
    name: (typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Untitled email').slice(0, 80),
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
    settings: normalizeSettings(raw.settings || {}),
    blocks,
    images,
  };
}
