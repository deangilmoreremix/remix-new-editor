// src/lib/staleVersion.js
//
// After a new version of SmartVid goes live, a tab opened before it still asks for the old code files
// (e.g. assets/pickerModal-<old hash>.js). Those no longer exist, so the import fails and the button the
// person clicked (Video Pages, a studio, …) silently does nothing. This shows one banner instead:
// "SmartVid was updated. Reload to continue." with a Reload button.

const STALE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

/** Pure: is this error (or rejection reason) a missing code file from an older version? */
export function isStaleChunkError(err) {
  const text = typeof err === 'string' ? err : `${err?.message || ''} ${err?.name || ''}`;
  return STALE.test(text);
}

/** Show the reload banner once. Returns the banner element. */
export function showReloadBanner({ doc = globalThis.document, reload = () => globalThis.location.reload() } = {}) {
  if (!doc?.body) return null;
  const existing = doc.querySelector('[data-stale-version]');
  if (existing) return existing;
  const bar = doc.createElement('div');
  bar.dataset.staleVersion = '';
  bar.setAttribute('role', 'alert');
  bar.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100000;display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;background:#0a0a0a;border:1px solid #d9ff00;color:#fff;font:600 14px Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5)';
  const text = doc.createElement('span');
  text.textContent = 'SmartVid was updated. Reload to continue.';
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Reload';
  // App buttons are outline-only (outline-buttons.css): lime border + lime text.
  btn.style.cssText = 'border:1px solid #d9ff00;border-radius:8px;background:transparent;color:#d9ff00;padding:6px 14px;font-weight:700;cursor:pointer';
  btn.addEventListener('click', () => reload());
  bar.append(text, btn);
  doc.body.appendChild(bar);
  return bar;
}

/** Watch for stale-version failures anywhere in the app. Call once at start-up. Returns { stop }. */
export function mountStaleVersionGuard({ win = globalThis.window } = {}) {
  if (!win?.addEventListener) return { stop() {} };
  const onRejection = (e) => { if (isStaleChunkError(e?.reason)) { e.preventDefault?.(); showReloadBanner(); } };
  const onPreload = (e) => { e.preventDefault?.(); showReloadBanner(); };   // Vite's own event for a failed preload
  // Only these two: a failed dynamic import surfaces as a rejection, a failed preload as Vite's event. (A generic
  // `error` listener could show the banner for unrelated errors whose text happens to match.)
  win.addEventListener('unhandledrejection', onRejection);
  win.addEventListener('vite:preloadError', onPreload);
  return {
    stop() {
      win.removeEventListener('unhandledrejection', onRejection);
      win.removeEventListener('vite:preloadError', onPreload);
    },
  };
}
