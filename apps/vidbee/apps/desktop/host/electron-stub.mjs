// Host shim (not upstream): a minimal `electron` replacement so upstream's main-process code can run in plain Node
// behind an HTTP/SSE bridge. Only what upstream's main process touches is implemented; everything else is a no-op.
import { EventEmitter } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

const dataDir = path.resolve(process.env.VIDBEE_DATA_DIR || path.join(os.homedir(), '.vidbee-web'));
const downloadsDir = path.resolve(process.env.VIDBEE_DOWNLOAD_DIR || path.join(dataDir, 'downloads'));
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(downloadsDir, { recursive: true });

/** Broadcast hub: main-process `webContents.send(channel, ...args)` → every connected browser (SSE). */
export const hub = (globalThis.__vidbeeHub ||= {
  listeners: new Set(),
  pending: new Map(),
  emit(channel, args) { for (const l of this.listeners) l(channel, args); },
  /** Ask the connected browser to do something only a browser can (pick a file, confirm, …) and wait for its answer. */
  request(kind, payload, fallback, timeoutMs = 10 * 60 * 1000) {
    if (this.listeners.size === 0) return Promise.resolve(fallback);
    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { this.pending.delete(id); resolve(fallback); }, timeoutMs);
      this.pending.set(id, (result) => { clearTimeout(timer); this.pending.delete(id); resolve(result); });
      this.emit('host:request', [{ id, kind, payload }]);
    });
  },
  respond(id, result) { this.pending.get(id)?.(result); },
});

/** Generic permissive stub: any property is a callable no-op that returns another stub. */
const noop = (name = 'stub') => new Proxy(function () {}, {
  get: (_t, prop) => (prop === 'then' ? undefined : prop === Symbol.toPrimitive ? () => name : noop(`${name}.${String(prop)}`)),
  apply: () => undefined,
  construct: () => noop(`new ${name}`),
});

const handlers = new Map();
export const ipcMain = Object.assign(new EventEmitter(), {
  handle: (channel, fn) => handlers.set(channel, fn),
  handleOnce: (channel, fn) => handlers.set(channel, fn),
  removeHandler: (channel) => handlers.delete(channel),
});
const invokeStore = new AsyncLocalStorage();
/** Files the main process "saved" during one IPC call; they are handed to the browser as downloads when the call finishes. */
export const exportsDir = path.join(dataDir, 'exports');
export const __invoke = async (channel, args, sender) => {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler registered for '${channel}'`);
  const store = { exports: [] };
  try {
    return await invokeStore.run(store, () => fn({ sender, senderFrame: null }, ...args));
  } finally {
    for (const file of store.exports) {
      try {
        if (fs.existsSync(file.path) && fs.statSync(file.path).isFile()) hub.emit('host:download', [{ url: `exports/${file.id}/${encodeURIComponent(path.basename(file.path))}` }]);
      } catch { /* ignore */ }
    }
  }
};
export const __handlers = handlers;

const tolerant = (target) => new Proxy(target, { get: (t, p) => (p in t ? t[p] : typeof p === 'symbol' || p === 'then' ? undefined : () => undefined) });
const windowContents = tolerant({
  id: 1,
  send: (channel, ...args) => hub.emit(channel, args),
  isDestroyed: () => false,
  setWindowOpenHandler: () => {},
  on: () => {},
  once: () => {},
  getURL: () => '',
  session: noop('session'),
  isCrashed: () => false,
  isLoading: () => false,
  isLoadingMainFrame: () => false,
  isWaitingForResponse: () => false,
});
const makeWindow = () => {
  const win = Object.assign(new EventEmitter(), {
    getNormalBounds: () => ({ x: 0, y: 0, width: 1280, height: 800 }),
    id: 1,
    webContents: windowContents,
    isDestroyed: () => false,
    isMinimized: () => false,
    isMaximized: () => false,
    isFullScreen: () => false,
    isVisible: () => true,
    isFocused: () => true,
    show() {}, hide() {}, focus() {}, close() {}, minimize() {}, maximize() {}, unmaximize() {}, restore() {}, setTitle() {}, setProgressBar() {},
    loadURL: async () => {}, loadFile: async () => {},
    getBounds: () => ({ x: 0, y: 0, width: 1280, height: 800 }),
  });
  return tolerant(win);
};
const windows = [makeWindow()];
export class BrowserWindow extends EventEmitter {
  constructor() { super(); return makeWindow(); }
  static getAllWindows() { return windows; }
  static getFocusedWindow() { return windows[0]; }
  static fromWebContents() { return windows[0]; }
  static fromId() { return windows[0]; }
}

export const app = Object.assign(new EventEmitter(), {
  isPackaged: false,
  getPath: (name) => (name === 'downloads' ? downloadsDir : name === 'temp' ? os.tmpdir() : name === 'home' ? os.homedir() : path.join(dataDir, name === 'userData' ? '' : name)),
  setPath() {},
  getAppPath: () => process.cwd(),
  getName: () => 'VidBee',
  getVersion: () => process.env.VIDBEE_APP_VERSION || '0.0.0',
  getLocale: () => 'en-US',
  getSystemLocale: () => 'en-US',
  getPreferredSystemLanguages: () => ['en-US'],
  whenReady: () => Promise.resolve(),
  isReady: () => true,
  requestSingleInstanceLock: () => true,
  quit() {}, exit() {}, relaunch() {}, focus() {},
  setAppUserModelId() {}, setName() {}, setAboutPanelOptions() {}, setBadgeCount() {},
  commandLine: { appendSwitch() {}, hasSwitch: () => false },
  dock: noop('dock'),
  getGPUInfo: async () => ({}),
  getLoginItemSettings: () => ({ openAtLogin: false }),
  setLoginItemSettings() {},
  setAsDefaultProtocolClient: () => true,
});

export const Menu = noop('Menu');
export const Tray = noop('Tray');
// ── Browser-backed replacements for Electron's native UI (the browser does the picking; the server owns the files) ──
const splitArgs = (a, b) => (b !== undefined || (a && (a.webContents || a.id !== undefined)) ? [a, b ?? {}] : [null, a ?? {}]);
export const dialog = {
  async showOpenDialog(a, b) {
    const [, options] = splitArgs(a, b);
    const result = await hub.request('open', { properties: options.properties ?? [], filters: options.filters ?? [], title: options.title ?? '' }, { canceled: true, filePaths: [] });
    return { canceled: Boolean(result?.canceled), filePaths: result?.filePaths ?? [] };
  },
  async showSaveDialog(a, b) {
    const [, options] = splitArgs(a, b);
    const store = invokeStore.getStore();
    const id = crypto.randomUUID();
    const dir = path.join(exportsDir, id);
    fs.mkdirSync(dir, { recursive: true });
    const name = path.basename(options.defaultPath || 'download');
    const filePath = path.join(dir, name);
    store?.exports.push({ id, path: filePath });
    return { canceled: false, filePath };
  },
  async showMessageBox(a, b) {
    const [, options] = splitArgs(a, b);
    const result = await hub.request('message', { message: options.message ?? '', detail: options.detail ?? '', buttons: options.buttons ?? ['OK'], type: options.type ?? 'info', defaultId: options.defaultId ?? 0 }, { response: options.defaultId ?? 0 });
    return { response: result?.response ?? 0, checkboxChecked: false };
  },
  showErrorBox(title, content) { hub.emit('host:notify', [{ title, body: content }]); },
};
const inFolders = (p) => {
  const roots = [process.env.VIDBEE_DOWNLOAD_DIR, dataDir, downloadsDir].filter(Boolean);
  try { const real = fs.realpathSync(p); return roots.some((r) => { try { const rr = fs.realpathSync(r); return real === rr || real.startsWith(rr + path.sep); } catch { return false; } }); } catch { return false; }
};
export const shell = {
  async openPath(p) { if (p && fs.existsSync(p) && inFolders(p)) hub.emit('host:open', [{ url: `media?path=${encodeURIComponent(p)}` }]); return ''; },
  async openExternal(url) { hub.emit('host:open', [{ href: String(url) }]); },
  showItemInFolder(p) { if (p && fs.existsSync(p) && inFolders(p)) hub.emit('host:open', [{ url: `media?path=${encodeURIComponent(p)}` }]); },
  trashItem: async (p) => { try { if (inFolders(p)) fs.rmSync(p, { force: true, recursive: true }); } catch { /* ignore */ } },
};
const makeImage = (buffer) => ({
  isEmpty: () => !buffer || buffer.length === 0,
  toPNG: () => buffer, toJPEG: () => buffer, toDataURL: () => `data:image/png;base64,${Buffer.from(buffer ?? []).toString('base64')}`,
  getSize: () => ({ width: 0, height: 0 }), resize: () => makeImage(buffer), crop: () => makeImage(buffer), getBitmap: () => buffer, getNativeHandle: () => buffer,
});
export const nativeImage = {
  createEmpty: () => makeImage(Buffer.alloc(0)),
  createFromBuffer: (buffer) => makeImage(Buffer.from(buffer ?? [])),
  createFromPath: (p) => { try { return makeImage(fs.readFileSync(p)); } catch { return makeImage(Buffer.alloc(0)); } },
  createFromBitmap: (buffer) => makeImage(Buffer.from(buffer ?? [])),
  createFromDataURL: (url) => makeImage(Buffer.from(String(url).split(',')[1] ?? '', 'base64')),
};
export const clipboard = {
  writeText: (text) => hub.emit('host:clipboard', [{ text: String(text ?? '') }]),
  writeImage: (image) => { const png = image?.toPNG?.(); if (png?.length) hub.emit('host:clipboard', [{ image: Buffer.from(png).toString('base64') }]); },
  write: (data) => { if (data?.text) hub.emit('host:clipboard', [{ text: data.text }]); if (data?.image?.toPNG) clipboard.writeImage(data.image); },
  writeBuffer() {}, readText: () => '', readImage: () => makeImage(Buffer.alloc(0)), availableFormats: () => [], clear() {},
};
export const Notification = class {
  constructor(options = {}) { this.options = options; }
  static isSupported() { return true; }
  show() { hub.emit('host:notify', [{ title: this.options.title ?? '', body: this.options.body ?? '' }]); }
  on() { return this; } once() { return this; } close() {}
};
export const safeStorage = { isEncryptionAvailable: () => false, encryptString: (s) => Buffer.from(s), decryptString: (b) => b.toString() };
// Upstream registers `vidbee://` (file protocol: thumbnail cache etc.) and `agent-artifact://` (protocol.handle). Keep the handlers so the host
// server can serve them over HTTP (/protocol/<scheme>/…); the web shim rewrites those URLs in the page.
export const __protocolHandlers = new Map();
export const protocol = {
  registerSchemesAsPrivileged() {},
  handle: (scheme, fn) => { __protocolHandlers.set(scheme, { kind: 'handle', fn }); },
  unhandle: (scheme) => { __protocolHandlers.delete(scheme); },
  registerFileProtocol: (scheme, fn) => { __protocolHandlers.set(scheme, { kind: 'file', fn }); return true; },
  registerStreamProtocol() {},
  isProtocolHandled: (scheme) => __protocolHandlers.has(scheme),
};
export const session = noop('session');
export const net = noop('net');
export const nativeTheme = Object.assign(new EventEmitter(), { shouldUseDarkColors: true, themeSource: 'system' });
export const powerSaveBlocker = { start: () => 0, stop() {}, isStarted: () => false };
export const ShareMenu = class { popup() {} };
export const screen = noop('screen');
export const crashReporter = noop('crashReporter');
export const powerMonitor = Object.assign(new EventEmitter(), { getSystemIdleTime: () => 0 });
export const webContents = { getAllWebContents: () => [], fromId: () => undefined };
export const globalShortcut = noop('globalShortcut');
export const autoUpdater = noop('autoUpdater');
export const contextBridge = noop('contextBridge');
export const ipcRenderer = { invoke: async () => ({}), on() {}, once() {}, send() {}, sendSync: () => ({}), removeListener() {}, removeAllListeners() {} };
export const webUtils = noop('webUtils');

export default { app, BrowserWindow, ipcMain, dialog, shell, clipboard, nativeImage, Menu, Tray, Notification, safeStorage, protocol, session, net, nativeTheme, powerSaveBlocker, ShareMenu, screen, globalShortcut, autoUpdater };
