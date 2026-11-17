// Host shim (not upstream): replaces the Electron preload in a browser. Upstream's renderer talks to the main process only through
// `window.electron.ipcRenderer` (electron-ipc-decorator proxies → invoke) and `window.api` (events); both are implemented here over
// HTTP + server-sent events against the host server (host/server.ts). Loaded as a classic script before the app bundle.
(() => {
  // The host palette is dark-only: keep upstream's `.dark` class (used by its `dark:` utilities) on <html> whatever the theme setting says.
  const root = document.documentElement;
  const forceDark = () => { if (!root.classList.contains('dark') || root.classList.contains('light')) { root.classList.add('dark'); root.classList.remove('light'); } };
  forceDark();
  new MutationObserver(forceDark).observe(root, { attributes: true, attributeFilter: ['class'] });

  const script = document.currentScript;
  const base = new URL('.', script ? script.src : location.href).href;
  const post = (path, body) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });

  const listeners = new Map(); // channel -> Set<callback>
  const dispatch = (channel, args) => {
    for (const cb of Array.from(listeners.get(channel) ?? [])) {
      try { cb(...args); } catch (error) { console.error(`[web-shim] listener for ${channel} failed`, error); }
    }
  };
  let source;
  const connect = () => {
    source = new EventSource(`${base}ipc/events`, { withCredentials: true });
    source.onmessage = (event) => {
      try { const { channel, args } = JSON.parse(event.data); dispatch(channel, args ?? []); } catch { /* ignore malformed */ }
    };
    source.onerror = () => { /* EventSource reconnects by itself */ };
  };
  connect();

  const on = (channel, callback) => {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel).add(callback);
    return callback;
  };
  const removeListener = (channel, callback) => { listeners.get(channel)?.delete(callback); };

  const invoke = async (channel, ...args) => {
    const response = await post('ipc/invoke', { channel, args });
    if (!response.ok) throw new Error(`IPC ${channel} failed (${response.status})`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || `IPC ${channel} failed`);
    return data.result;
  };
  const send = (channel, ...args) => { void post('ipc/send', { channel, args }); };

  // 'darwin' selects upstream's mac chrome: no minimize/maximize/close buttons (Electron-only). Settings reads the real platform from main.
  const platform = 'darwin';
  // Subscribers of ipcRenderer.on receive (event, ...args) in Electron.
  window.electron = {
    ipcRenderer: {
      invoke,
      send,
      on: (channel, callback) => { const wrapped = (...args) => callback({}, ...args); on(channel, wrapped); return () => removeListener(channel, wrapped); },
      removeListener,
      removeAllListeners: (channel) => listeners.delete(channel),
    },
    process: { platform, versions: {}, env: {} },
  };
  window.api = {
    on,
    removeListener,
    send,
    // Browsers never expose local file paths for dropped files.
    getPathForFile: () => null,
  };
})();
