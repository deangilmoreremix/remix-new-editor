/**
 * The export runner runs in a sandboxed iframe with an opaque origin, where
 * reading window.localStorage / sessionStorage throws. Some libraries read
 * them for optional settings; give them a harmless in-memory stand-in.
 * Must be imported before anything else in the runner.
 */
function memoryStorage() {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(String(k)); },
    clear: () => m.clear(),
  };
}

for (const name of ['localStorage', 'sessionStorage']) {
  let works = false;
  try { works = !!window[name]; } catch { works = false; }
  if (!works) {
    try {
      Object.defineProperty(window, name, { value: memoryStorage(), configurable: true });
    } catch { /* leave as is */ }
  }
}
