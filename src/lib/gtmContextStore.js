/**
 * GTM Context Store - persist the structured GTM selections (role, industry,
 * methodology, tonality, focus, model, cinematic options) so a studio can
 * restore them after the GTMPromptModal closes.
 *
 * Each studio calls saveGtmContext(studioId, context) when the user applies a
 * generated prompt. The context is JSON-encoded into localStorage under
 * `gtm:context:{studioId}` with a timestamp. Studios call getGtmContext() to
 * read the last selection back. getLastGtmContext() scans every persisted
 * context and returns the most recent one across all studios.
 */

const KEY_PREFIX = 'gtm:context:';

const isBrowser = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeParse = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* ignore */
  }
  return null;
};

/**
 * Persist a GTM context for a given studio.
 * @param {string} studioId  Stable studio identifier (e.g. 'video-studio').
 * @param {object} context   { role, industry, methodology, tonality,
 *                              focus, model, cinematicOptions }
 * @returns {object|null}    The stored context (with timestamp), or null on failure.
 */
export function saveGtmContext(studioId, context) {
  if (!isBrowser() || !studioId) return null;
  const payload = {
    ...(context && typeof context === 'object' ? context : {}),
    timestamp: Date.now()
  };
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${studioId}`, JSON.stringify(payload));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Read the persisted GTM context for a studio.
 * @param {string} studioId
 * @returns {object|null}
 */
export function getGtmContext(studioId) {
  if (!isBrowser() || !studioId) return null;
  try {
    return safeParse(window.localStorage.getItem(`${KEY_PREFIX}${studioId}`));
  } catch {
    return null;
  }
}

/**
 * Return the most recent GTM context across every studio that has saved one.
 * @returns {object|null}
 */
export function getLastGtmContext() {
  if (!isBrowser()) return null;
  let latest = null;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      const ctx = safeParse(window.localStorage.getItem(key));
      if (!ctx) continue;
      if (!latest || (ctx.timestamp || 0) > (latest.timestamp || 0)) {
        latest = ctx;
      }
    }
  } catch {
    return latest;
  }
  return latest;
}

/**
 * Drop a single studio's saved context. Useful for "reset" affordances.
 * @param {string} studioId
 */
export function clearGtmContext(studioId) {
  if (!isBrowser() || !studioId) return;
  try {
    window.localStorage.removeItem(`${KEY_PREFIX}${studioId}`);
  } catch {
    /* ignore */
  }
}

export default {
  saveGtmContext,
  getGtmContext,
  getLastGtmContext,
  clearGtmContext
};
