// src/lib/outreach/focusTrap.js
//
// Keeps keyboard focus inside a dialog while it is open (requirements 12 and 51): Tab and Shift+Tab cycle through the
// dialog's own controls, focus starts inside it, and when it closes focus goes back to what opened it.

const FOCUSABLE = 'a[href], button, input, select, textarea, video[controls], [tabindex]:not([tabindex="-1"])';

/** The controls inside `root` that can take focus right now, in tab order. */
export function focusables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((n) => !n.disabled && !n.hidden && n.getAttribute('tabindex') !== '-1' && n.type !== 'hidden' && !n.closest('[hidden]') && !n.closest('[inert]') && isRendered(n, root));
}

/** False for a control that is not drawn (display: none on it or a parent inside the dialog, or visibility: hidden): it cannot take focus. */
function isRendered(n, root) {
  const view = n.ownerDocument?.defaultView;
  if (!view?.getComputedStyle) return true;
  for (let e = n; e && e !== root.parentElement; e = e.parentElement) if (view.getComputedStyle(e).display === 'none') return false;
  return view.getComputedStyle(n).visibility !== 'hidden';
}

/**
 * @param {HTMLElement} root  the dialog
 * @param {{ initial?: HTMLElement|null, doc?: Document }} [opts]  initial: what to focus first (default: the first control)
 * @returns {() => void} release: stops trapping and returns focus to what had it before
 */
export function trapFocus(root, { initial = null, doc = root.ownerDocument || document } = {}) {
  const opener = doc.activeElement;
  const onKey = (e) => {
    if (e.key !== 'Tab' || e.defaultPrevented) return;
    const list = focusables(root);
    if (!list.length) { e.preventDefault(); root.focus?.(); return; }
    const first = list[0]; const last = list[list.length - 1];
    const active = doc.activeElement;
    if (!root.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
  doc.addEventListener('keydown', onKey, true);
  if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
  const start = initial && root.contains(initial) ? initial : focusables(root)[0] || root;
  start.focus?.();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    doc.removeEventListener('keydown', onKey, true);
    if (opener && opener !== doc.body && doc.contains(opener) && typeof opener.focus === 'function') opener.focus();
  };
}
