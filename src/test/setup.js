// Test setup for Vitest
// Mock browser APIs and global objects

/* eslint-disable no-undef, no-redeclare */
// Polyfill minimal browser globals so lib files that touch `window`/`document`
// at module load time don't crash in node env (e.g. analytics.js registers
// a `pageview` listener on import).
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { href: 'http://localhost/' },
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { userAgent: 'node' };
}
if (typeof globalThis.HTMLElement === 'undefined') {
  // Minimal stub so `value instanceof HTMLElement` works in node env.
  globalThis.HTMLElement = class HTMLElement {};
}
if (typeof globalThis.document === 'undefined' || typeof globalThis.document.createElement !== 'function') {
  // Minimal DOM shim that mimics the textContent→innerHTML round-trip used
  // by `escapeHtml` in src/lib/security.js. Real browsers/jsdom handle this
  // automatically; in pure node we need to escape manually.
  const escapeForInnerHTML = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  class FakeElement extends globalThis.HTMLElement {
    constructor(tag) {
      super();
      this.tagName = tag.toUpperCase();
      this._textContent = '';
    }
    get textContent() { return this._textContent; }
    set textContent(v) { this._textContent = String(v); }
    get innerHTML() { return escapeForInnerHTML(this._textContent); }
    set innerHTML(v) { this._textContent = String(v); }
  }
  globalThis.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: (tag) => new FakeElement(tag),
  };
}

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.sessionStorage = sessionStorageMock;

// Stub indexedDB so modules that call it during eval do not crash
if (typeof globalThis.indexedDB === 'undefined') {
  globalThis.indexedDB = {
    open: () => ({
      result: null,
      onerror: null,
      onsuccess: null,
      onupgradeneeded: null,
      setTransaction() {},
    }),
  };
}

// Mock fetch
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};