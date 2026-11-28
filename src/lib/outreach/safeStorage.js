// src/lib/outreach/safeStorage.js
//
// Reading `localStorage` can itself throw (a SecurityError when the site's storage is blocked). A default parameter such as
// `storage = globalThis.localStorage` runs before a function's own try/catch, so it cannot be guarded there: use this instead.

/** The browser's localStorage, or null when it cannot be reached. */
export function browserStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
