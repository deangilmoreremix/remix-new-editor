import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import * as router from '../lib/router.js';

let RenderPage;
let consoleErrorSpy;

function makeLocalStorage(store) {
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

beforeAll(async () => {
  const mod = await import('../components/RenderPage.js');
  RenderPage = mod.RenderPage;
}, 30000);

describe('RenderPage bug fixes', () => {
  let originalLocalStorage;
  let store;

  beforeEach(() => {
    originalLocalStorage = global.localStorage;
    store = {};
    global.localStorage = makeLocalStorage(store);
    if (!globalThis.crypto) globalThis.crypto = {};
    if (!globalThis.crypto.randomUUID) {
      globalThis.crypto.randomUUID = () => 'id-' + Math.random().toString(36).slice(2);
    }
    vi.spyOn(router, 'navigate').mockImplementation(() => {});
    if (!global.URL.createObjectURL) global.URL.createObjectURL = () => 'blob:x';
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
    vi.restoreAllMocks();
  });

  it('init does not throw on malformed localStorage', () => {
    store['render:templates'] = JSON.stringify([null, { id: 't1' }]);
    store['render:drafts'] = JSON.stringify([{ id: 'd1' }, null]);
    store['render:queue'] = JSON.stringify([null, { id: 'q1', action: 'Export Video' }]);
    expect(() => RenderPage()).not.toThrow();
  });

  it('Saved panel toggle handles malformed data', () => {
    store['render:templates'] = JSON.stringify([null]);
    store['render:drafts'] = JSON.stringify([null]);
    const el = RenderPage();
    const toggle = el.querySelector('#savedToggleBtn');
    expect(() => toggle.click()).not.toThrow();
  });

  it('B1: AI handlers run without "spinner is not defined"', async () => {
    const orig = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        search: '?videoUrl=https://example.com/v.mp4',
        href: 'http://localhost/?videoUrl=https://example.com/v.mp4',
        origin: 'http://localhost',
        hostname: 'localhost',
        pathname: '/',
        protocol: 'http:',
      },
    });
    const el = RenderPage();
    const tile = [...el.querySelectorAll('button')].find(b => b.textContent.includes('Add Subtitles'));
    expect(tile).toBeTruthy();
    tile.click();
    await new Promise((r) => setTimeout(r, 50));
    const spinnerErr = consoleErrorSpy.mock.calls.some(
      ([msg]) => typeof msg === 'string' && /spinner is not defined/.test(msg)
    );
    expect(spinnerErr).toBe(false);
    if (orig) Object.defineProperty(window, 'location', orig);
  }, 15000);

  it('B3: hero Save Draft button saves a draft', () => {
    const el = RenderPage();
    const btn = el.querySelector('#saveDraftBtn');
    expect(btn).toBeTruthy();
    btn.click();
    const drafts = JSON.parse(store['render:drafts'] || '[]');
    expect(Array.isArray(drafts)).toBe(true);
    expect(drafts.length).toBeGreaterThan(0);
  });

  it('B3: hero Start Render button triggers the Export Video action', () => {
    const el = RenderPage();
    const startBtn = el.querySelector('#startRenderBtn');
    expect(startBtn).toBeTruthy();
    startBtn.click();
    const exportBtn = [...el.querySelectorAll('#actionButtonsRow button')].find(
      (b) => b.textContent.trim() === 'Export Video'
    );
    expect(exportBtn && exportBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('B4: queued render shows a readable label', () => {
    const el = RenderPage();
    const queueBtn = [...el.querySelectorAll('#actionButtonsRow button')].find(
      (b) => b.textContent.trim() === 'Queue Render'
    );
    expect(queueBtn).toBeTruthy();
    queueBtn.click();
    const queue = JSON.parse(store['render:queue'] || '[]');
    expect(queue.length).toBeGreaterThan(0);
    expect(queue[queue.length - 1].label).toBeTruthy();
  });
});
