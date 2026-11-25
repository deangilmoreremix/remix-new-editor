import { describe, it, expect, vi } from 'vitest';
import { keepAwake } from '../wakeLock.js';
import { mediaPermissions, permissionMessage, promptHint, watchMediaPermissions } from '../permissions.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

function fakeDoc(state = 'visible') {
  const listeners = {};
  return {
    visibilityState: state,
    addEventListener: (t, f) => { listeners[t] = f; },
    removeEventListener: (t) => { delete listeners[t]; },
    fire(t) { listeners[t]?.(); },
    listeners,
  };
}

describe('keepAwake', () => {
  it('takes a screen lock and releases it', async () => {
    const sentinel = { released: false, release: vi.fn(async () => { sentinel.released = true; }) };
    const nav = { wakeLock: { request: vi.fn(async () => sentinel) } };
    const doc = fakeDoc();
    const release = keepAwake({ nav, doc });
    await flush();
    expect(nav.wakeLock.request).toHaveBeenCalledWith('screen');
    release();
    expect(sentinel.release).toHaveBeenCalled();
    expect(doc.listeners.visibilitychange).toBeUndefined();
    release(); // twice is fine
  });

  it('takes the lock again when the tab comes back', async () => {
    const make = () => ({ released: false, release: vi.fn(async () => {}) });
    const first = make();
    const nav = { wakeLock: { request: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(make()) } };
    const doc = fakeDoc();
    const release = keepAwake({ nav, doc });
    await flush();
    first.released = true; // the browser dropped it when the tab was hidden
    doc.fire('visibilitychange');
    await flush();
    expect(nav.wakeLock.request).toHaveBeenCalledTimes(2);
    release();
  });

  it('does nothing without the API, or when the request fails', async () => {
    expect(keepAwake({ nav: {}, doc: fakeDoc() })).toBeTypeOf('function');
    const release = keepAwake({ nav: { wakeLock: { request: async () => { throw new Error('battery saver'); } } }, doc: fakeDoc() });
    await flush();
    release();
  });

  it('releases a lock that arrives after release() was called', async () => {
    let resolve;
    const sentinel = { release: vi.fn(async () => {}) };
    const nav = { wakeLock: { request: () => new Promise((r) => { resolve = r; }) } };
    const release = keepAwake({ nav, doc: fakeDoc() });
    release();
    resolve(sentinel);
    await flush();
    expect(sentinel.release).toHaveBeenCalled();
  });
});

describe('permissions', () => {
  const nav = (states) => ({ permissions: { query: async ({ name }) => { if (!(name in states)) throw new TypeError('unsupported'); return { state: states[name], addEventListener: vi.fn(), removeEventListener: vi.fn() }; } } });

  it('reads camera and microphone, unknown when unsupported', async () => {
    expect(await mediaPermissions(nav({ camera: 'denied', microphone: 'granted' }))).toEqual({ camera: 'denied', microphone: 'granted' });
    expect(await mediaPermissions(nav({}))).toEqual({ camera: 'unknown', microphone: 'unknown' });
    expect(await mediaPermissions(undefined)).toEqual({ camera: 'unknown', microphone: 'unknown' });
  });

  it('explains a blocked camera or microphone', () => {
    expect(permissionMessage({ need: ['camera', 'microphone'], perms: { camera: 'denied', microphone: 'denied' }, host: 'smartvid.app' }))
      .toMatch(/^Camera and Microphone are blocked for smartvid\.app\. Click the camera or lock icon/);
    expect(permissionMessage({ need: ['camera'], perms: { camera: 'denied', microphone: 'denied' }, host: 'smartvid.app' })).toMatch(/^Camera is blocked/);
  });

  it('explains missing or busy devices', () => {
    expect(permissionMessage({ need: ['camera'], err: { name: 'NotFoundError' } })).toMatch(/No camera was found/);
    expect(permissionMessage({ need: ['microphone'], err: { name: 'NotFoundError' } })).toMatch(/No microphone was found/);
    expect(permissionMessage({ err: { name: 'NotReadableError' } })).toMatch(/another app/);
    expect(permissionMessage({ err: { name: 'NotAllowedError' } })).toMatch(/Access was not allowed/);
    expect(permissionMessage({ err: { name: 'AbortError' } })).toBe('');
  });

  it('hints before the browser prompt', () => {
    expect(promptHint({ camera: 'prompt' })).toMatch(/Choose Allow/);
    expect(promptHint({ camera: 'granted', microphone: 'granted' })).toBe('');
  });

  it('watches for changes and stops watching', async () => {
    const status = { state: 'denied', addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const stop = await watchMediaPermissions(() => {}, { permissions: { query: async () => status } });
    expect(status.addEventListener).toHaveBeenCalledTimes(2);
    stop();
    expect(status.removeEventListener).toHaveBeenCalledTimes(2);
  });
});
