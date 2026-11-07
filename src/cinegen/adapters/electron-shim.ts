// [remix] Web implementation of CineGen's `window.electronAPI` (it ships as an Electron app; this editor is web only).
// Namespaces CineGen calls are listed explicitly:
//  - nativeVideo / app / sync-progress / stream listeners: not needed in a browser -> inert.
//  - Providers we do not use (higgsfield, topview, artlist, runpod pod, CLI LLMs): reject with a clear message
//    (the UI shows it); generation runs on MuAPI / OpenAI / Hugging Face via the other adapters instead.
//  - Real web implementations are registered with `registerElectronApi()` as each feature is ported.
type AnyFn = (...args: unknown[]) => unknown;
const WEB_UNAVAILABLE = 'This provider is not available in the web editor.';
const impl: Record<string, Record<string, AnyFn>> = {};

export function registerElectronApi(ns: string, methods: Record<string, AnyFn>) {
  impl[ns] = { ...(impl[ns] || {}), ...methods };
}

const INERT_NS = new Set(['nativeVideo', 'app', 'sync', 'localModel', 'transcription', 'acoustic', 'shell']);
const UNAVAILABLE_NS = new Set(['higgsfield', 'topview', 'artlist', 'pod', 'vision']);

function method(ns: string, name: string): AnyFn {
  const real = impl[ns]?.[name];
  if (real) return real;
  if (name.startsWith('on')) return () => () => undefined; // event subscription -> unsubscribe noop
  if (ns === 'nativeVideo') return async () => (name === 'isAvailable' ? false : undefined);
  if (UNAVAILABLE_NS.has(ns)) {
    if (name === 'accountStatus' || name === 'modelCatalog') return async () => ({ connected: false, models: [] });
    return async () => { throw new Error(WEB_UNAVAILABLE); };
  }
  if (INERT_NS.has(ns)) return async () => undefined;
  return async () => { throw new Error(`${ns}.${name} is not available in the web editor yet.`); };
}

function namespace(ns: string) {
  return new Proxy({}, {
    get: (_t, name: string | symbol) => (typeof name === 'string' && name !== 'then' ? method(ns, name) : undefined),
  });
}

export function installElectronShim() {
  const w = window as unknown as { electronAPI?: unknown };
  if (w.electronAPI) return;
  w.electronAPI = new Proxy({}, {
    get: (_t, ns: string | symbol) => {
      if (ns === 'mcpBridge') return undefined; // desktop MCP host: CineGen's web build does not define it either
      if (ns === 'platform') return 'web'; // string, not a namespace (CineGen reads it as an attribute)
      return typeof ns === 'string' && ns !== 'then' ? namespace(ns) : undefined;
    },
  });
}
