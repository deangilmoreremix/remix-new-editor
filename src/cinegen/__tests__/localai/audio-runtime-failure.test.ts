// [remix] Fix Q: a failed WebGPU model start used to surface as the bare number the runtime threw ("9949912") and the in-page WASM retry fails the same way.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
beforeEach(() => { vi.resetModules(); vi.stubGlobal('sessionStorage', store()); vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => ({ requestDevice: async () => ({ destroy: () => undefined }) }) } }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('describeLoadFailure', () => {
  it('turns a bare runtime code into a readable message and keeps real Errors', async () => {
    const { describeLoadFailure } = await import('../../lib/local-ai/audio-runtime');
    const gpu = describeLoadFailure(9949912, 'webgpu');
    expect(gpu.message).toMatch(/WebGPU runtime could not start/);
    expect(gpu.message).toMatch(/9949912/);
    expect(gpu.message).toMatch(/Reload the page/);
    expect(describeLoadFailure(7, 'wasm').message).toMatch(/WASM runtime could not start/);
    const real = new Error('Could not locate file');
    expect(describeLoadFailure(real, 'webgpu')).toBe(real);
  });
});

describe('WebGPU failure memory', () => {
  it('reports WebGPU while nothing failed, and not after a failed start in this tab', async () => {
    const a = await import('../../lib/local-ai/audio-runtime');
    expect((await a.detectCapability()).webgpu).toBe(true);
    a.markWebgpuFailed();
    vi.resetModules(); // a page reload: the module is fresh, sessionStorage survives
    const b = await import('../../lib/local-ai/audio-runtime');
    expect((await b.detectCapability()).webgpu).toBe(false);
  });
});

describe('WebGPU capability probe', () => {
  it('needs a device, not only an adapter', async () => {
    vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => ({ requestDevice: async () => { throw new Error('device lost'); } }) } });
    const a = await import('../../lib/local-ai/audio-runtime');
    expect((await a.detectCapability()).webgpu).toBe(false);
  });
  it('reports no WebGPU without an adapter', async () => {
    vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => null } });
    const a = await import('../../lib/local-ai/audio-runtime');
    expect((await a.detectCapability()).webgpu).toBe(false);
  });
});
