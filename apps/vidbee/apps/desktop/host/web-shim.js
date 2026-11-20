// Host shim (not upstream): replaces the Electron preload in a browser. Upstream's renderer talks to the main process only through
// `window.electron.ipcRenderer` (electron-ipc-decorator proxies → invoke) and `window.api` (events); both are implemented here over
// HTTP + server-sent events against the host server (host/server.ts). Loaded as a classic script before the app bundle.
(() => {
  // Host theme: upstream's own light / dark / system setting (next-themes, `.dark` class) drives the palette. The embedding page can pass
  // ?theme=light|dark|system for a visit and later postMessage({ type: 'vidbee-theme', theme }) (same origin only). Default: dark.
  const hostTheme = (t) => {
    try {
      localStorage.setItem('theme', t);
      window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: t, storageArea: localStorage }));
    } catch { /* storage unavailable: upstream's setting still works */ }
    // upstream re-applies its persisted `theme` setting (app-layout.tsx), so persist it there too (one shared library → one shared setting)
    queueMicrotask(() => post('ipc/invoke', { channel: 'settings.set', args: ['theme', t] }).catch(() => {}));
  };
  const valid = (t) => t === 'light' || t === 'dark' || t === 'system';
  const wanted = new URLSearchParams(location.search).get('theme');
  if (valid(wanted)) hostTheme(wanted);
  else {
    // first visit in this browser: default to dark, unless the shared library already has an explicit light/dark choice saved
    let first = false; try { first = !localStorage.getItem('theme'); } catch { /* ignore */ }
    if (first) {
      queueMicrotask(() => post('ipc/invoke', { channel: 'settings.get', args: ['theme'] }).then((r) => r.json())
        .then((j) => { if (!j || (j.result !== 'light' && j.result !== 'dark')) hostTheme('dark'); else { try { localStorage.setItem('theme', j.result); } catch { /* ignore */ } } })
        .catch(() => hostTheme('dark')));
    }
  }
  window.addEventListener('message', (e) => { if (e.origin === location.origin && e.data && e.data.type === 'vidbee-theme' && valid(e.data.theme)) hostTheme(e.data.theme); });
  // end host theme

  const script = document.currentScript;
  const base = new URL('.', script ? script.src : location.href).href;
  // binary-replacer-start
  // JSON cannot carry binary: send ArrayBuffers and typed arrays as base64 (host/ipc-binary.mjs turns them back into bytes).
  const toBase64 = (bytes) => { let text = ''; for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(text); };
  const binaryReplacer = (_key, value) => value instanceof ArrayBuffer ? { __vidbeeBinary: toBase64(new Uint8Array(value)) }
    : ArrayBuffer.isView(value) ? { __vidbeeBinary: toBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) } : value;
  // binary-replacer-end
  // Identifies this tab so the host sends its file pickers and confirmations to it alone.
  const clientId = (crypto.randomUUID && crypto.randomUUID()) || `c${Date.now()}${Math.random().toString(36).slice(2)}`;
  const post = (path, body) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vidbee-client': clientId }, body: JSON.stringify(body, binaryReplacer), credentials: 'same-origin' });


  // ── What Electron did natively, done by the browser (server side: host/electron-stub.mjs, host/server.ts) ──
  const uploadsByToken = new Map(); // upload://… token → File
  const uploadedPath = new Map();   // token → server path (upload once)
  let uploadSeq = 0;
  const registerUpload = (file) => { const token = `upload://${++uploadSeq}/${encodeURIComponent(file.name)}`; uploadsByToken.set(token, file); return token; };
  const uploadFile = async (file) => {
    const response = await fetch(`${base}upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file, credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Upload failed (${response.status})`);
    return (await response.json()).path;
  };
  // Dropped files reach upstream's code as upload:// tokens (window.api.getPathForFile); they're uploaded when an IPC call carries them.
  const resolveUploads = async (value) => {
    if (typeof value === 'string' && value.startsWith('upload://')) {
      const file = uploadsByToken.get(value);
      if (!file) return value;
      if (!uploadedPath.has(value)) uploadedPath.set(value, uploadFile(file));
      return uploadedPath.get(value);
    }
    if (Array.isArray(value)) return Promise.all(value.map(resolveUploads));
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      const out = {};
      for (const [key, inner] of Object.entries(value)) out[key] = await resolveUploads(inner);
      return out;
    }
    return value;
  };

  const overlay = (build) => new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font:14px Inter,system-ui,sans-serif';
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;color:#111;border-radius:14px;padding:20px;min-width:320px;max-width:560px;max-height:80vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.35)';
    wrap.append(card); document.body.append(wrap);
    const close = (result) => { wrap.remove(); resolve(result); };
    build(card, close);
  });
  const button = (label, onClick, primary) => {
    const b = document.createElement('button'); b.textContent = label; b.onclick = onClick;
    b.style.cssText = `padding:8px 14px;border-radius:10px;border:1px solid #d4d4d8;cursor:pointer;font:inherit;${primary ? 'background:#111;color:#fff;border-color:#111' : 'background:#fff;color:#111'}`;
    return b;
  };
  const heading = (card, text) => { const h = document.createElement('div'); h.textContent = text; h.style.cssText = 'font-weight:600;margin-bottom:12px;word-break:break-word'; card.append(h); };
  const row = (...kids) => { const r = document.createElement('div'); r.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap'; r.append(...kids); return r; };

  const pickServerFolder = (title) => overlay((card, close) => {
    heading(card, title || 'Choose a folder on the server');
    const where = document.createElement('div'); where.style.cssText = 'font-size:12px;color:#52525b;margin-bottom:8px;word-break:break-all';
    const list = document.createElement('div'); list.style.cssText = 'border:1px solid #e4e4e7;border-radius:10px;max-height:300px;overflow:auto';
    let current = '';
    const load = async (dir) => {
      const r = await fetch(`${base}host/list?path=${encodeURIComponent(dir)}`, { credentials: 'same-origin' });
      if (!r.ok) return;
      const data = await r.json(); current = data.path; where.textContent = current; list.replaceChildren();
      const add = (label, target) => { const item = document.createElement('div'); item.textContent = label; item.style.cssText = 'padding:8px 12px;cursor:pointer;border-bottom:1px solid #f4f4f5'; item.onclick = () => load(target); list.append(item); };
      if (data.parent) add('⬑  ..', data.parent);
      for (const name of data.directories) add(`📁  ${name}`, `${current.replace(/\/$/, '')}/${name}`);
    };
    card.append(where, list, row(button('Cancel', () => close({ canceled: true, filePaths: [] })), button('Select this folder', () => close({ canceled: false, filePaths: [current] }), true)));
    load('');
  });

  const pickFiles = (payload) => overlay((card, close) => {
    const multi = (payload.properties || []).includes('multiSelections');
    const extensions = (payload.filters || []).flatMap((f) => f.extensions || []).filter((e) => e && e !== '*');
    heading(card, payload.title || (multi ? 'Choose files' : 'Choose a file'));
    const input = document.createElement('input'); input.type = 'file'; input.multiple = multi;
    if (extensions.length) input.accept = extensions.map((e) => `.${e}`).join(',');
    const status = document.createElement('div'); status.style.cssText = 'font-size:12px;color:#52525b;margin-top:8px';
    input.onchange = async () => {
      if (!input.files.length) return;
      status.textContent = 'Uploading…';
      try { close({ canceled: false, filePaths: await Promise.all([...input.files].map(uploadFile)) }); } catch (error) { status.textContent = String(error.message || error); }
    };
    card.append(input, status, row(button('Cancel', () => close({ canceled: true, filePaths: [] }))));
  });

  const messageBox = (payload) => overlay((card, close) => {
    heading(card, payload.message || '');
    if (payload.detail) { const d = document.createElement('div'); d.textContent = payload.detail; d.style.cssText = 'font-size:13px;color:#52525b;white-space:pre-wrap'; card.append(d); }
    card.append(row(...(payload.buttons || ['OK']).map((label, index) => button(label, () => close({ response: index }), index === (payload.defaultId || 0)))));
  });

  const answer = (id, result) => post('ipc/response', { id, result });
  const hostEvent = async (channel, args) => {
    const data = (args && args[0]) || {};
    if (channel === 'host:request') {
      const { id, kind, payload } = data;
      try {
        if (kind === 'open') answer(id, (payload.properties || []).includes('openDirectory') ? await pickServerFolder(payload.title) : await pickFiles(payload));
        else if (kind === 'message') answer(id, await messageBox(payload));
        else answer(id, null);
      } catch { answer(id, null); }
    } else if (channel === 'host:download') {
      const a = document.createElement('a'); a.href = `${base}${data.url}`; a.download = ''; document.body.append(a); a.click(); a.remove();
    } else if (channel === 'host:open') {
      window.open(data.href || `${base}${data.url}`, '_blank', 'noopener');
    } else if (channel === 'host:clipboard') {
      try {
        if (data.text !== undefined) await navigator.clipboard.writeText(data.text);
        else if (data.image) { const bytes = Uint8Array.from(atob(data.image), (c) => c.charCodeAt(0)); await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]); }
      } catch (error) { console.warn('[web-shim] clipboard write was blocked by the browser', error); }
    } else if (channel === 'host:notify') {
      try {
        if (Notification.permission === 'default') await Notification.requestPermission();
        if (Notification.permission === 'granted') new Notification(data.title || 'VidBee', { body: data.body || '' });
      } catch { /* notifications unavailable */ }
    }
  };

  const listeners = new Map(); // channel -> Set<callback>
  const dispatch = (channel, args) => {
    for (const cb of Array.from(listeners.get(channel) ?? [])) {
      try { cb(...args); } catch (error) { console.error(`[web-shim] listener for ${channel} failed`, error); }
    }
  };
  let source;
  const connect = () => {
    source = new EventSource(`${base}ipc/events?client=${clientId}`, { withCredentials: true });
    source.onmessage = (event) => {
      try { const { channel, args } = JSON.parse(event.data); if (channel.startsWith('host:')) void hostEvent(channel, args); else dispatch(channel, args ?? []); } catch { /* ignore malformed */ }
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
    const response = await post('ipc/invoke', { channel, args: await resolveUploads(args) });
    if (!response.ok) throw new Error(`IPC ${channel} failed (${response.status})`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || `IPC ${channel} failed`);
    return data.result;
  };
  const send = (channel, ...args) => { void resolveUploads(args).then((resolved) => post('ipc/send', { channel, args: resolved })); };

  // 'darwin' selects upstream's mac chrome: no minimize/maximize/close buttons (Electron-only). Settings reads the real platform from main.
  // Upstream loads thumbnails / chat artifacts through custom protocols (vidbee://, agent-artifact://). Browsers can't, so rewrite those URLs to
  // the host server's /protocol/<scheme>/… route (which calls the very handlers upstream registered).
  const customUrl = /^(vidbee|agent-artifact):\/\/(.*)$/i;
  const rewrite = (value) => {
    if (typeof value !== 'string') return value;
    const match = customUrl.exec(value);
    return match ? `${base}protocol/${match[1].toLowerCase()}/${match[2]}` : value;
  };
  for (const [proto, props] of [[HTMLImageElement.prototype, ['src']], [HTMLMediaElement.prototype, ['src']], [HTMLSourceElement.prototype, ['src']], [HTMLVideoElement.prototype, ['poster']]]) {
    for (const prop of props) {
      const desc = Object.getOwnPropertyDescriptor(proto, prop);
      if (desc && desc.set) Object.defineProperty(proto, prop, { ...desc, set(value) { desc.set.call(this, rewrite(value)); } });
    }
  }
  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    return nativeSetAttribute.call(this, name, /^(src|poster)$/i.test(name) ? rewrite(value) : value);
  };

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
    // Browsers never expose local file paths: dropped files become upload:// tokens that are uploaded when an IPC call uses them.
    getPathForFile: (file) => (file ? registerUpload(file) : null),
  };
})();
