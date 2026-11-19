// src/lib/tours/waitFor.js
// Studios render their DOM in pieces (and some after a network call), and the router has no "page ready" signal.
// These helpers wait for a target to exist and be visible, so a tour can start on a page that is still filling in.

export const isVisible = (el) => !!el && el.isConnected !== false && (typeof el.getClientRects !== 'function' || el.getClientRects().length > 0) && !el.closest?.('[hidden],.hidden');

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

/** True when something modal is on screen (API-key popup, Settings, a welcome overlay), so a tour should wait. */
export function blockingOverlayOpen(root = document) {
  return !!root.querySelector('[data-onboarding],[data-outreach-welcome],[role="dialog"][aria-modal="true"],div.fixed.inset-0[class*="z-[100]"],.driver-popover');
}
