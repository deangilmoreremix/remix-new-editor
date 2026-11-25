// src/lib/recorder/wakeLock.js
//
// Keep the screen awake while recording or reading the teleprompter (Screen Wake Lock API), so a long
// take doesn't dim or lock the screen. The browser drops the lock when the tab is hidden, so it is
// taken again when the tab comes back. Browsers without the API: a no-op.

/**
 * @returns {() => void} release
 */
export function keepAwake({ nav = globalThis.navigator, doc = globalThis.document } = {}) {
  if (!nav?.wakeLock?.request) return () => {};
  let sentinel = null;
  let released = false;
  const take = async () => {
    if (released || (doc && doc.visibilityState !== 'visible')) return;
    try {
      sentinel = await nav.wakeLock.request('screen');
      if (released) { sentinel.release?.().catch?.(() => {}); sentinel = null; }
    } catch { sentinel = null; /* e.g. battery saver: carry on without it */ }
  };
  const onVisible = () => { if (!sentinel || sentinel.released) take(); };
  doc?.addEventListener?.('visibilitychange', onVisible);
  take();
  return () => {
    if (released) return;
    released = true;
    doc?.removeEventListener?.('visibilitychange', onVisible);
    try { sentinel?.release?.()?.catch?.(() => {}); } catch { /* already gone */ }
    sentinel = null;
  };
}
