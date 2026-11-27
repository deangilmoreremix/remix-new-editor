/**
 * Optional Cloudflare Turnstile widget for the public lead forms. Everything here is a no-op unless
 * VITE_TURNSTILE_SITE_KEY is set (the server only checks the token when TURNSTILE_SECRET_KEY is set).
 */
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** The site key from the build environment, or '' (widget off). */
export function turnstileSiteKey(env = (typeof import.meta !== 'undefined' && import.meta.env) || {}) {
  const key = String(env.VITE_TURNSTILE_SITE_KEY || '').trim();
  return /^[A-Za-z0-9_-]{8,128}$/.test(key) ? key : '';
}

let scriptPromise = null;
/** Load Cloudflare's script once; resolves to window.turnstile or null when it cannot load. */
export function loadTurnstile(doc = globalThis.document, win = globalThis.window) {
  if (win?.turnstile) return Promise.resolve(win.turnstile);
  if (!doc) return Promise.resolve(null);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const s = doc.createElement('script');
      s.src = SCRIPT_SRC; s.async = true; s.defer = true;
      s.onload = () => resolve(win?.turnstile || null);
      s.onerror = () => { scriptPromise = null; resolve(null); };
      doc.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Render the widget into `container`. Returns { token(), reset() }; token() is '' until the viewer passes the check.
 * If the script cannot load (blocked, offline) `ready` stays false and token() is '' (the server decides what to do).
 */
export function mountTurnstile(container, siteKey, { load = loadTurnstile } = {}) {
  const state = { id: null, value: '', ready: false, api: null };
  load().then((api) => {
    if (!api || !container.isConnected) return;
    state.api = api;
    state.id = api.render(container, {
      sitekey: siteKey,
      callback: (t) => { state.value = String(t || ''); },
      'expired-callback': () => { state.value = ''; },
      'error-callback': () => { state.value = ''; },
    });
    state.ready = true;
  }).catch(() => { /* the widget is optional */ });
  return {
    token: () => state.value,
    isReady: () => state.ready,
    reset: () => { state.value = ''; try { if (state.id != null) state.api?.reset(state.id); } catch { /* ignore */ } },
  };
}
