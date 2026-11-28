import { describe, it, expect } from 'vitest';
import { detectCapabilities, summarizeCapabilities } from '../capabilities.js';

const byId = (items) => Object.fromEntries(items.map((i) => [i.id, i]));

describe('capability detection', () => {
  it('reports everything unavailable for an empty environment, without throwing', () => {
    const r = byId(detectCapabilities({}));
    expect(r.camera.status).toBe('unavailable');
    expect(r.webgpu.status).toBe('unavailable');
    expect(r.memory.status).toBe('unknown');
  });
  it('separates supported from needs-permission', () => {
    const env = {
      isSecureContext: true,
      navigator: { mediaDevices: { getUserMedia() {}, getDisplayMedia() {} }, clipboard: { writeText() {}, write() {} }, share() {}, gpu: {}, serviceWorker: {}, locks: {}, deviceMemory: 8, storage: { getDirectory() {} } },
      MediaRecorder: class {}, VideoEncoder: class {}, VideoDecoder: class {}, ClipboardItem: class {}, PushManager: class {}, Notification: class {}, indexedDB: {}, BroadcastChannel: class {}, Worker: class {}, WebAssembly: {},
    };
    const r = byId(detectCapabilities(env));
    expect(r.camera.status).toBe('permission');
    expect(r.screen.status).toBe('permission');
    expect(r.push.status).toBe('permission');
    for (const id of ['recorder', 'webcodecs', 'webgpu', 'clipboard', 'clipboardRich', 'share', 'indexeddb', 'opfs', 'locks', 'broadcast', 'wasm', 'workers']) expect(r[id].status).toBe('supported');
    expect(r.memory.detail).toContain('8');
  });
  it('explains a page that is not secure', () => {
    const r = byId(detectCapabilities({ isSecureContext: false }));
    expect(r.secure.status).toBe('unavailable');
    expect(r.secure.detail).toMatch(/https/);
  });
  it('summarises by status', () => {
    const s = summarizeCapabilities(detectCapabilities({}));
    expect(s.unavailable).toBeGreaterThan(10);
    expect(s.supported + s.permission + s.unavailable + s.unknown).toBe(detectCapabilities({}).length);
  });
});
