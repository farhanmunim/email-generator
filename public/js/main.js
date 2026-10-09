// App bootstrap: wires store, canvas, panels, dialogs, persistence and export.

import { $, $$, h, initTabs } from './dom.js';
import { icon } from './icons.js';
import { createStore } from './store.js';
import { createDoc, normalizeDoc, BLOCKS } from './blocks.js';
import { TEMPLATES } from './templates.js';
import * as storage from './storage.js';
import { renderEmail, exportEmail, mobileCss } from './render.js';
import { debounce, slugify, formatBytes, uid } from './util.js';
import { toast } from './ui/toast.js';
import { createActions } from './ui/actions.js';
import { createCanvas } from './ui/canvas.js';
import { createSettingsPanel } from './ui/settings.js';
import { createPalette, createImageLibrary } from './ui/library.js';

const app = $('#app');

// ---- initial document ---------------------------------------------------------------
function initialDoc() {
  const id = storage.getCurrentId();
  const saved = id && storage.loadProject(id);
  if (saved) return saved;
  const latest = storage.listProjects()[0];
  const fromList = latest && storage.loadProject(latest.id);
  return fromList || TEMPLATES.find((t) => t.id === 'welcome').build();
}

const store = createStore(initialDoc());
const actions = createActions(store);

// Static icons in the HTML shell
$$('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon, +el.dataset.size || 18); });

// The mobile preview rules also style the editing canvas when "Mobile" is on.
$('#mobile-canvas-css').textContent = mobileCss('[data-device="mobile"] .em-canvas');

// ---- view state ---------------------------------------------------------------------
function setView(view) {
  app.dataset.view = view;
  $$('.mobile-nav button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
}
function setMode(mode) {
  app.dataset.mode = mode;
  $$('[data-mode-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modeBtn === mode)));
  if (mode === 'preview') refreshPreview.flush();
}
function setDevice(device) {
  app.dataset.device = device;
  $$('[data-device-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.deviceBtn === device)));
}
$$('.mobile-nav button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
$$('[data-mode-btn]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.modeBtn)));
$$('[data-device-btn]').forEach((b) => b.addEventListener('click', () => setDevice(b.dataset.deviceBtn)));
setView('canvas');
setMode('edit');
setDevice('desktop');

// ---- panels ---------------------------------------------------------------------------
const leftTabs = initTabs($('#left-tabs'));
const rightTabs = initTabs($('#right-tabs'));

const settings = createSettingsPanel({ store, blockRoot: $('#block-settings'), emailRoot: $('#email-settings'), actions });

function openSettings({ focus = false } = {}) {
  rightTabs.select('block');
  setView('settings');
  if (focus) {
    requestAnimationFrame(() => {
      const first = $('#block-settings input:not([type=radio]):not([type=range]), #block-settings textarea, #block-settings select');
      first?.focus();
    });
  }
}

createPalette({
  root: $('#palette'),
  actions,
  onAdded: () => { if (matchMedia('(max-width: 1023px)').matches) { setView('canvas'); toast('Block added'); } },
});

const library = createImageLibrary({
  store, actions, form: $('#lib-form'), grid: $('#lib-grid'),
  onAdded: () => { if (matchMedia('(max-width: 1023px)').matches) setView('canvas'); },
});

const canvas = createCanvas({
  store,
  root: $('#canvas'),
  actions,
  onOpenSettings: openSettings,
  onEmpty: () => openDialog('templates-dialog'),
});

// ---- preview iframe -------------------------------------------------------------------------
const previewFrame = $('#preview-frame');
const refreshPreview = debounce(() => {
  if (app.dataset.mode !== 'preview') return;
  try {
    previewFrame.srcdoc = renderEmail(store.doc);
  } catch (e) {
    toast('Preview failed to render', { kind: 'error' });
    console.error(e);
  }
}, 150);

// ---- persistence ------------------------------------------------------------------------------
const saveStatus = $('#save-status');
const nameInput = $('#project-name');

const save = debounce(() => {
  const res = storage.saveProject(store.doc);
  storage.setCurrentId(store.doc.id);
  if (res.ok) {
    saveStatus.textContent = 'Saved locally';
    saveStatus.dataset.state = 'saved';
  } else {
    saveStatus.textContent = 'Not saved — storage unavailable';
    saveStatus.dataset.state = 'error';
    if (!save.warned) {
      save.warned = true;
      toast('Browser storage is full or blocked. Export a JSON backup to keep your work.', { kind: 'error', timeout: 6000 });
    }
  }
}, 400);
function markDirty() {
  saveStatus.textContent = 'Saving…';
  saveStatus.dataset.state = 'saving';
  save();
}

nameInput.addEventListener('input', () => {
  const v = nameInput.value.slice(0, 80);
  store.commit((d) => { d.name = v.trim() || 'Untitled email'; }, { key: 'name', source: 'edit' });
});
nameInput.addEventListener('blur', () => { nameInput.value = store.doc.name; });

// ---- store subscription ----------------------------------------------------------------------------
function syncChrome() {
  $('#btn-undo').disabled = !store.canUndo;
  $('#btn-redo').disabled = !store.canRedo;
  if (document.activeElement !== nameInput) nameInput.value = store.doc.name;
}

store.subscribe((e) => {
  if (e.type === 'select') {
    canvas.updateSelection({ scroll: true });
    library.sync();
    library.render();
    if (store.selectedId) rightTabs.select('block');
    else if (!matchMedia('(max-width: 1023px)').matches) rightTabs.select('email');
    settings.renderBlock();
    return;
  }
  // doc | load
  canvas.render();
  library.render();
  refreshPreview();
  if (e.type === 'load' || (e.type === 'doc' && e.source !== 'edit')) settings.render();
  syncChrome();
  markDirty();
});

// ---- toolbar buttons ------------------------------------------------------------------------------------
$('#btn-undo').addEventListener('click', () => store.undo());
$('#btn-redo').addEventListener('click', () => store.redo());

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return; // native undo inside fields
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); store.undo(); }
  else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); store.redo(); }
});

// ---- dialogs ---------------------------------------------------------------------------------------------
function openDialog(id) {
  const d = document.getElementById(id);
  if (!d.open) d.showModal();
  return d;
}
$$('dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  $$('[data-close]', d).forEach((b) => b.addEventListener('click', () => d.close()));
});

function loadDoc(doc, message) {
  storage.saveProject(doc);
  storage.setCurrentId(doc.id);
  store.load(doc);
  if (message) toast(message);
}

// Templates
const tplGrid = $('#templates-grid');
function buildTemplates() {
  tplGrid.replaceChildren(...TEMPLATES.map((t) => {
    const thumb = h('iframe', { class: 'tpl-thumb', title: `${t.name} preview`, tabindex: '-1', sandbox: '', loading: 'lazy', 'aria-hidden': 'true' });
    const doc = t.build();
    thumb.srcdoc = doc.blocks.length ? renderEmail(doc) : '<body style="margin:0;display:grid;place-items:center;height:100vh;font:600 40px sans-serif;color:#9ca3af;background:#fff">Blank</body>';
    return h('li', {},
      h('button', {
        type: 'button', class: 'tpl-card',
        onclick: () => {
          const fresh = t.build();
          $('#templates-dialog').close();
          loadDoc(fresh, `Started “${fresh.name}”`);
          setView('canvas');
        },
      }, h('span', { class: 'tpl-frame' }, thumb), h('strong', {}, t.name), h('small', {}, t.description)));
  }));
}
$('#btn-templates').addEventListener('click', () => { if (!tplGrid.children.length) buildTemplates(); openDialog('templates-dialog'); });

// Projects
const projList = $('#projects-list');
function buildProjects() {
  const items = storage.listProjects();
  projList.replaceChildren();
  if (!items.length) projList.append(h('li', { class: 'lib-empty' }, 'No saved projects yet.'));
  for (const p of items) {
    const current = p.id === store.doc.id;
    projList.append(h('li', { class: 'proj-item' },
      h('div', { class: 'proj-info' },
        h('strong', {}, p.name, current ? h('span', { class: 'badge' }, 'Open') : null),
        h('small', {}, `${p.blockCount} block${p.blockCount === 1 ? '' : 's'} · ${new Date(p.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`)),
      h('div', { class: 'proj-actions' },
        h('button', { type: 'button', class: 'mini', disabled: current, onclick: () => { const d = storage.loadProject(p.id); if (!d) return toast('Could not open that project', { kind: 'error' }); $('#projects-dialog').close(); loadDoc(d, `Opened “${d.name}”`); } }, 'Open'),
        h('button', { type: 'button', class: 'mini', onclick: () => { const d = storage.loadProject(p.id); if (!d) return; d.id = uid(); d.name = `${d.name} (copy)`.slice(0, 80); d.updatedAt = Date.now(); storage.saveProject(d); buildProjects(); toast('Project duplicated'); } }, 'Duplicate'),
        h('button', { type: 'button', class: 'mini danger', onclick: () => {
          if (!confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
          storage.deleteProject(p.id);
          if (current) {
            const next = storage.listProjects()[0];
            const doc = (next && storage.loadProject(next.id)) || createDoc('Untitled email');
            loadDoc(doc);
          }
          buildProjects();
        } }, 'Delete'))));
  }
  $('#projects-warning').hidden = storage.isPersistent();
}
$('#btn-projects').addEventListener('click', () => { buildProjects(); openDialog('projects-dialog'); });
$('#btn-new').addEventListener('click', () => { $('#projects-dialog').close(); loadDoc(createDoc('Untitled email'), 'New blank project'); setView('canvas'); });

// JSON backup
function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#btn-json-export').addEventListener('click', () => {
  try {
    download(`${slugify(store.doc.name)}.json`, JSON.stringify(store.doc, null, 2), 'application/json');
    toast('Project JSON downloaded');
  } catch (e) {
    toast(`Couldn’t export JSON: ${e.message}`, { kind: 'error' });
  }
});
const fileInput = $('#json-file');
$('#btn-json-import').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('File is larger than 5 MB.');
    let data;
    try { data = JSON.parse(await file.text()); } catch { throw new Error('This file is not valid JSON.'); }
    const doc = normalizeDoc(data);
    doc.id = uid(); // never overwrite an existing project
    doc.updatedAt = Date.now();
    $('#projects-dialog').close();
    loadDoc(doc, `Imported “${doc.name}”`);
    setView('canvas');
  } catch (e) {
    toast(`Import failed: ${e.message}`, { kind: 'error', timeout: 5000 });
  }
});

// Export
const exportCode = $('#export-code');
const exportText = $('#export-text');
const exportWarnings = $('#export-warnings');
let lastExport = null;
let exportTab = 'html';
const exportTabs = initTabs($('#export-tabs'), (name) => {
  exportTab = name;
  $('#btn-copy-label').textContent = name === 'html' ? 'Copy HTML' : 'Copy text';
  $('#btn-download-label').textContent = name === 'html' ? 'Download .html' : 'Download .txt';
});

async function copyText(text, okMessage, fallbackEl) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch {
    try {
      fallbackEl.focus();
      fallbackEl.select();
      if (!document.execCommand('copy')) throw new Error('copy rejected');
      toast(okMessage);
    } catch {
      toast('Copy failed — select the text and copy it manually.', { kind: 'error' });
    }
  }
}

$('#btn-export').addEventListener('click', () => {
  const dlg = openDialog('export-dialog');
  exportTabs.select('html');
  exportWarnings.replaceChildren();
  try {
    lastExport = exportEmail(store.doc);
    exportCode.value = lastExport.html;
    exportText.value = lastExport.text;
    $('#export-subject').textContent = store.doc.settings.subject;
    $('#export-size').textContent = formatBytes(lastExport.bytes);
    $('#export-actions').hidden = false;
    for (const c of lastExport.checks) {
      const word = { warn: 'Needs attention: ', info: 'Note: ', pass: 'OK: ' }[c.level];
      exportWarnings.append(h('li', { class: `warn-${c.level}` }, h('span', { class: 'sr-only' }, word), c.message));
    }
  } catch (e) {
    console.error(e);
    lastExport = null;
    exportCode.value = '';
    exportText.value = '';
    $('#export-actions').hidden = true;
    exportWarnings.append(h('li', { class: 'warn-warn' }, `Couldn’t generate the HTML: ${e.message}`));
  }
  setupSendTest();
  dlg.querySelector('h2')?.focus?.();
});
$('#btn-copy').addEventListener('click', () => {
  if (!lastExport) return;
  if (exportTab === 'html') copyText(lastExport.html, 'HTML copied to clipboard', exportCode);
  else copyText(lastExport.text, 'Plain text copied to clipboard', exportText);
});
$('#btn-copy-subject').addEventListener('click', () => {
  const subject = store.doc.settings.subject.trim();
  if (!subject) return toast('No subject set yet — add one in Email settings → Inbox', { kind: 'warn' });
  copyText(subject, 'Subject copied', $('#btn-copy-subject'));
});
$('#btn-download').addEventListener('click', () => {
  if (!lastExport) return;
  try {
    if (exportTab === 'html') download(`${slugify(store.doc.name)}.html`, lastExport.html, 'text/html');
    else download(`${slugify(store.doc.name)}.txt`, lastExport.text, 'text/plain');
    toast('File downloaded');
  } catch (e) {
    toast(`Download failed: ${e.message}`, { kind: 'error' });
  }
});

// Optional "send a test" — only shown when the Pages Function is configured (see README).
const sendForm = $('#send-test');
const sendStatus = $('#send-status');
async function setupSendTest() {
  let enabled = false;
  try {
    const r = await fetch('/api/send-test', { headers: { accept: 'application/json' } });
    enabled = r.ok && (await r.json()).enabled === true;
  } catch { /* offline or no function deployed: feature stays hidden */ }
  sendForm.hidden = !enabled;
  if (enabled) {
    try { $('#send-to').value ||= localStorage.getItem('emailbuilder:v1:testTo') || ''; } catch { /* ignore */ }
  }
}
sendForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const to = $('#send-to').value.trim();
  if (!to || !$('#send-to').checkValidity()) { sendStatus.textContent = 'Enter a valid email address.'; $('#send-to').focus(); return; }
  if (!lastExport) return;
  const btn = $('#btn-send');
  btn.disabled = true;
  sendStatus.textContent = 'Sending…';
  try {
    const r = await fetch('/api/send-test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to, subject: store.doc.settings.subject, html: lastExport.html, text: lastExport.text }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    sendStatus.textContent = `Test sent to ${to}. Check your inbox (and spam folder).`;
    try { localStorage.setItem('emailbuilder:v1:testTo', to); } catch { /* ignore */ }
  } catch (err) {
    sendStatus.textContent = `Couldn’t send: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
});

// ---- go -----------------------------------------------------------------------------------------------------
settings.render();
canvas.render();
library.render();
syncChrome();
storage.saveProject(store.doc);
storage.setCurrentId(store.doc.id);
saveStatus.textContent = storage.isPersistent() ? 'Saved locally' : 'Not saved — storage unavailable';
saveStatus.dataset.state = storage.isPersistent() ? 'saved' : 'error';
rightTabs.select('email');

// Exposed for debugging / automated tests.
window.__builder = { store, actions, BLOCKS };
