import { h } from '../dom.js';

let host;

/** Shows a short status message; the host is an aria-live region so it is announced too. */
export function toast(message, { kind = 'info', timeout = 3200 } = {}) {
  host ||= document.getElementById('toasts');
  if (!host) return;
  const el = h('div', { class: `toast toast-${kind}` }, message);
  host.append(el);
  try {
    // Popover puts toasts in the top layer so they stay visible above open dialogs.
    if (host.matches(':popover-open')) host.hidePopover();
    host.showPopover();
  } catch { /* popover unsupported: fixed positioning still works */ }
  while (host.children.length > 3) host.firstElementChild.remove();
  setTimeout(() => {
    el.remove();
    try { if (!host.children.length && host.matches(':popover-open')) host.hidePopover(); } catch { /* ignore */ }
  }, timeout);
}
