// Test setup for Vitest
// Mock browser APIs and global objects

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