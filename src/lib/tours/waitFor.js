// src/lib/tours/waitFor.js
// Studios render their DOM in pieces (and some after a network call), and the router has no "page ready" signal.
// These helpers wait for a target to exist and be visible, so a tour can start on a page that is still filling in.

// On screen = it has a box and is not visibility:hidden. (Not `.hidden`: Tailwind's `hidden md:flex` is visible on desktop.)
export const isVisible = (el) => {
  if (!el || el.isConnected === false) return false;
  if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false;
  try { if (globalThis.getComputedStyle?.(el)?.visibility === 'hidden') return false; } catch { /* ignore */ }
  return true;
};

/** First visible element for a selector, a list of fallback selectors, or a function. Never throws. */
export function resolveTarget(target, root = document) {
  try {
    if (!target) return null;
    if (typeof target === 'function') { const el = target(root); return isVisible(el) ? el : null; }
    const list = Array.isArray(target) ? target : [target];
    for (const sel of list) {
      const all = root.querySelectorAll(sel);
      for (const el of all) if (isVisible(el)) return el;
    }
  } catch { /* a bad selector must not break the tour */ }
  return null;
}

/**
 * waitForTarget(target, { timeout, root, signal }) -> Promise<Element|null>
 * Resolves as soon as the target is visible, or null after `timeout` ms (or when `signal` aborts).
 */
export function waitForTarget(target, { timeout = 6000, root = document, signal = null } = {}) {
  return new Promise((resolve) => {
    const found = resolveTarget(target, root);
    if (found || timeout <= 0) { resolve(found); return; }
    let done = false;
    const finish = (el) => { if (done) return; done = true; mo.disconnect(); clearTimeout(timer); clearInterval(poll); signal?.removeEventListener?.('abort', onAbort); resolve(el); };
    const check = () => { const el = resolveTarget(target, root); if (el) finish(el); };
    const onAbort = () => finish(null);
    const mo = new MutationObserver(check);
    mo.observe(root.body || root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    const poll = setInterval(check, 250); // layout changes (images, fonts) do not always mutate the DOM
    const timer = setTimeout(() => finish(null), timeout);
    signal?.addEventListener?.('abort', onAbort);
  });
}

// Inside the viewport, not transparent: a sheet parked below the screen edge (translateY(100%)) is not "open".
const onScreen = (el) => {
  if (!isVisible(el)) return false;
  try {
    const r = el.getBoundingClientRect();
    const w = globalThis.innerWidth || 0;
    const h = globalThis.innerHeight || 0;
    if (r.width <= 0 || r.height <= 0 || r.bottom <= 0 || r.right <= 0 || (h && r.top >= h) || (w && r.left >= w)) return false;
    if (Number(globalThis.getComputedStyle(el).opacity) === 0) return false;
  } catch { /* if it cannot be measured, treat it as open */ }
  return true;
};

/** True when something modal is ON SCREEN (API-key popup, Settings, a welcome overlay): a tour should wait for it. */
export function blockingOverlayOpen(root = document) {
  const sel = '[data-onboarding],[data-outreach-welcome],[role="dialog"][aria-modal="true"],div.fixed.inset-0[class*="z-[100]"],.driver-popover';
  return [...root.querySelectorAll(sel)].some((el) => onScreen(el));
}
