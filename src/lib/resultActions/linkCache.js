/**
 * Remembers which results already have a link, so a second "Get link" click (or a reload) reuses the first copy
 * instead of uploading again. Per browser; capped, oldest entries dropped first. Never throws (private mode, quota).
 */
const KEY = 'resultbar.links.v1';
const MAX = 200;

export function createLinkCache(storage = (() => { try { return globalThis.localStorage; } catch { return null; } })()) {
  const read = () => { try { return JSON.parse(storage?.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  const write = (all) => {
    try {
      const keys = Object.keys(all);
      if (keys.length > MAX) keys.sort((a, b) => (all[a].at || 0) - (all[b].at || 0)).slice(0, keys.length - MAX).forEach((k) => { delete all[k]; });
      storage?.setItem(KEY, JSON.stringify(all));
    } catch { /* the cache is a convenience only */ }
  };
  return {
    get(key) { return read()[key] || null; },
    set(key, value) { const all = read(); all[key] = { ...(all[key] || {}), ...value, at: Date.now() }; write(all); },
    delete(key) { const all = read(); delete all[key]; write(all); },
  };
}
