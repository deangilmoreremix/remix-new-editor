// Host shim (not upstream): a minimal `electron` replacement so upstream's main-process code can run in plain Node
// behind an HTTP/SSE bridge. Only what upstream's main process touches is implemented; everything else is a no-op.
import { EventEmitter } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const dataDir = path.resolve(process.env.VIDBEE_DATA_DIR || path.join(os.homedir(), '.vidbee-web'));
const downloadsDir = path.resolve(process.env.VIDBEE_DOWNLOAD_DIR || path.join(dataDir, 'downloads'));
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(downloadsDir, { recursive: true });

/** Broadcast hub: main-process `webContents.send(channel, ...args)` → every connected browser (SSE). */
export const hub = (globalThis.__vidbeeHub ||= { listeners: new Set(), emit(channel, args) { for (const l of this.listeners) l(channel, args); } });

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
export const __invoke = async (channel, args, sender) => {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler registered for '${channel}'`);
  return fn({ sender, senderFrame: null }, ...args);
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

export const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }), showSaveDialog: async () => ({ canceled: true }), showMessageBox: async () => ({ response: 0 }), showErrorBox() {} };
export const shell = { openPath: async () => '', openExternal: async () => {}, showItemInFolder() {}, trashItem: async () => {} };
export const clipboard = noop('clipboard');
export const nativeImage = noop('nativeImage');
export const Menu = noop('Menu');
export const Tray = noop('Tray');
export const Notification = class { static isSupported() { return false; } show() {} on() {} };
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
