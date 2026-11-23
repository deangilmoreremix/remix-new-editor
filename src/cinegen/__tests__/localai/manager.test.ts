// [remix] Port I1: model manager, queue, consent, licence gate, quota, capability, progress, cancel, delete, cache - all with a mocked loader (no network, no ONNX).
import { describe, it, expect, vi } from 'vitest';
import { MODEL_CATALOG, isDownloadable, modelById } from '../../lib/local-ai/catalog';
import { ConsentRequiredError, ConsentStore, type KeyValueStore } from '../../lib/local-ai/consent';
import { ModelManager, type ModelLoader } from '../../lib/local-ai/manager';
import { ModelCache, memoryBlobStore, repoOfUrl } from '../../lib/local-ai/model-cache';
import { checkQuota, describeCapabilities, fmtBytes, pickBackend, type EnvProbe } from '../../lib/local-ai/capabilities';

const kv = (): KeyValueStore => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }; };
const probe = (o: Partial<EnvProbe> = {}): EnvProbe => ({ hasWebGpu: false, hasWasm: true, hasSimd: true, crossOriginIsolated: false, hasSharedArrayBuffer: false, hasIndexedDb: true, hasOpfs: true, hardwareConcurrency: 4, storage: { quota: 50e9, usage: 1e9 }, ...o });

function setup(loader?: Partial<ModelLoader>, env: Partial<EnvProbe> = {}) {
  const cache = new ModelCache(memoryBlobStore());
  const consent = new ConsentStore(kv());
  const calls: string[] = [];
  const l: ModelLoader = {
    prepare: loader?.prepare ?? (async (m, _b, h) => { calls.push(m.id); const url = `https://huggingface.co/${m.repo}/resolve/main/onnx/model.onnx`; h.onProgress(50, 100); await cache.put(url, new Response(new Uint8Array(1000))); h.onProgress(100, 100); }),
  };
  const manager = new ModelManager({ cache, consent, loader: l, capabilities: async () => describeCapabilities(probe(env)) });
  return { cache, consent, manager, calls };
}

describe('catalogue licence gate', () => {
  it('only verified models are downloadable; restricted / unverified are disabled with a reason', () => {
    for (const m of MODEL_CATALOG) {
      if (m.licence.status === 'restricted' || m.licence.status === 'unverified') { expect(isDownloadable(m), m.id).toBe(false); expect(m.enabled, m.id).toBe(false); expect(m.disabledReason, m.id).toBeTruthy(); }
      else expect(isDownloadable(m), m.id).toBe(true);
      expect(m.licence.url).toMatch(/^https:\/\//); expect(m.sourceUrl).toMatch(/^https:\/\/huggingface\.co\//); expect(m.licence.how.length).toBeGreaterThan(20);
    }
    expect(modelById('lfm2.5-vl-450m')!.licence.status).toBe('restricted');
  });
});

describe('ModelManager', () => {
  it('refuses to download without consent, and does not call the loader', async () => {
    const { manager, calls } = setup();
    await expect(manager.download('whisper-tiny-en')).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(calls).toEqual([]); expect(manager.state('whisper-tiny-en')!.status).toBe('not-installed');
  });
  it('refuses restricted / unknown models even with consent', async () => {
    const { manager, calls } = setup();
    await expect(manager.download('lfm2.5-vl-450m', { acceptedLicence: true })).rejects.toThrow(/LFM Open License|10M/);
    await expect(manager.download('nope', { acceptedLicence: true })).rejects.toThrow(/Unknown/);
    expect(calls).toEqual([]); expect(manager.state('lfm2.5-vl-450m')!.status).toBe('unavailable');
  });
  it('downloads after explicit acceptance: progress, marker, installed size, consent recorded, survives refresh', async () => {
    const { manager, consent, cache } = setup();
    const seen: number[] = []; manager.subscribe(() => seen.push(manager.state('whisper-tiny-en')!.progress));
    await manager.download('whisper-tiny-en', { acceptedLicence: true });
    const s = manager.state('whisper-tiny-en')!;
    expect(s.status).toBe('installed'); expect(s.installedBytes).toBe(1000); expect(s.backend).toBe('wasm');
    expect(seen.some((p) => p > 0 && p < 1)).toBe(true); expect(seen[seen.length - 1]).toBe(1); expect(consent.has(modelById('whisper-tiny-en')!)).toBe(true);
    const m2 = new ModelManager({ cache, consent, loader: { prepare: vi.fn() }, capabilities: async () => describeCapabilities(probe()) });
    await m2.refresh(); expect(m2.isInstalled('whisper-tiny-en')).toBe(true);
    expect(() => m2.requireInstalled('whisper-base')).toThrow(ConsentRequiredError);
  });
  it('uses stored consent for a later download but a changed licence re-asks', async () => {
    const { manager, consent } = setup();
    consent.grant(modelById('clip-vit-b32')!);
    await manager.download('clip-vit-b32');
    expect(manager.isInstalled('clip-vit-b32')).toBe(true);
    const altered = { ...modelById('clip-vit-b32')!, licence: { ...modelById('clip-vit-b32')!.licence, name: 'Other' } };
    expect(consent.has(altered)).toBe(false);
  });
  it('cancel aborts the loader, removes partial files and leaves the model not-installed', async () => {
    let started!: () => void; const gate = new Promise<void>((r) => { started = r; });
    const { manager, cache } = setup({
      prepare: async (m, _b, h) => { await cache.put(`https://huggingface.co/${m.repo}/resolve/main/a.onnx`, new Response(new Uint8Array(10))); started(); await new Promise((_, rej) => h.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' })))); },
    });
    const p = manager.download('whisper-tiny', { acceptedLicence: true });
    await gate; expect(manager.state('whisper-tiny')!.status).toBe('downloading');
    manager.cancel('whisper-tiny');
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(manager.state('whisper-tiny')!.status).toBe('not-installed');
    expect(await cache.usageByRepo()).toEqual({}); expect(await cache.store.getMarker('whisper-tiny')).toBeUndefined();
  });
  it('queues downloads one at a time and a queued download can be cancelled', async () => {
    const order: string[] = []; let release!: () => void; const hold = new Promise<void>((r) => { release = r; });
    const { manager } = setup({ prepare: async (m) => { order.push(`start:${m.id}`); if (m.id === 'whisper-tiny') await hold; order.push(`end:${m.id}`); } });
    const a = manager.download('whisper-tiny', { acceptedLicence: true });
    const b = manager.download('clip-vit-b32', { acceptedLicence: true });
    const c = manager.download('smolvlm-256m', { acceptedLicence: true });
    await new Promise((r) => setTimeout(r, 10));
    expect(manager.state('clip-vit-b32')!.status).toBe('queued'); expect(order).toEqual(['start:whisper-tiny']);
    manager.cancel('smolvlm-256m'); release();
    await a; await b; await expect(c).rejects.toMatchObject({ name: 'AbortError' });
    expect(order).toEqual(['start:whisper-tiny', 'end:whisper-tiny', 'start:clip-vit-b32', 'end:clip-vit-b32']);
    expect(manager.state('smolvlm-256m')!.status).toBe('not-installed');
  });
  it('a loader failure is reported as an error state and partial files are removed; retry works', async () => {
    let fail = true;
    const { manager, cache } = setup({ prepare: async (m) => { await cache.put(`https://huggingface.co/${m.repo}/resolve/main/a.onnx`, new Response(new Uint8Array(5))); if (fail) throw new Error('network down'); } });
    await expect(manager.download('whisper-base', { acceptedLicence: true })).rejects.toThrow('network down');
    expect(manager.state('whisper-base')).toMatchObject({ status: 'error', error: 'network down' });
    expect(await cache.usageByRepo()).toEqual({});
    fail = false; await manager.download('whisper-base', { acceptedLicence: true }); expect(manager.isInstalled('whisper-base')).toBe(true);
  });
  it('blocks the download when the storage quota is too small, and when no backend exists', async () => {
    const small = setup(undefined, { storage: { quota: 100e6, usage: 90e6 } });
    await expect(small.manager.download('clip-vit-b32', { acceptedLicence: true })).rejects.toThrow(/Not enough browser storage/);
    expect(small.calls).toEqual([]);
    const none = setup(undefined, { hasWasm: false });
    await expect(none.manager.download('whisper-tiny', { acceptedLicence: true })).rejects.toThrow(/cannot run local AI/);
  });
  it('delete removes files, marker and consent; the next download needs consent again', async () => {
    const { manager, cache, consent } = setup();
    await manager.download('whisper-tiny-en', { acceptedLicence: true });
    expect(Object.keys(await cache.usageByRepo())).toEqual(['onnx-community/whisper-tiny.en_timestamped']);
    await manager.remove('whisper-tiny-en');
    expect(await cache.usageByRepo()).toEqual({}); expect(manager.state('whisper-tiny-en')!.status).toBe('not-installed');
    expect(consent.has(modelById('whisper-tiny-en')!)).toBe(false);
    await expect(manager.download('whisper-tiny-en')).rejects.toBeInstanceOf(ConsentRequiredError);
  });
});

describe('ModelCache (transformers.js customCache contract)', () => {
  it('match/put/delete round-trip with content-type, per-repo usage and repo deletion', async () => {
    const c = new ModelCache(memoryBlobStore());
    const u1 = 'https://huggingface.co/a/b/resolve/main/x.json'; const u2 = 'https://huggingface.co/a/b/resolve/main/onnx/y.onnx'; const u3 = 'https://huggingface.co/c/d/resolve/main/z.bin';
    expect(await c.match(u1)).toBeUndefined();
    await c.put(u1, new Response('{"k":1}', { headers: { 'content-type': 'application/json' } }));
    await c.put(u2, new Response(new Uint8Array(100))); await c.put(u3, new Response(new Uint8Array(7)));
    const hit = await c.match(u1); expect(hit!.headers.get('content-type')).toContain('json'); expect(await hit!.json()).toEqual({ k: 1 });
    expect(await c.usageByRepo()).toMatchObject({ 'a/b': { files: 2 }, 'c/d': { bytes: 7, files: 1 } });
    expect(await c.deleteRepo('a/b')).toBe(2); expect(await c.match(u2)).toBeUndefined(); expect(await c.match(u3)).toBeDefined();
    expect(repoOfUrl('https://example.com/x.wasm')).toBe('_other');
  });
});

describe('capabilities', () => {
  it('reports backends, threads need cross-origin isolation, and explains degradations', () => {
    const base = describeCapabilities(probe());
    expect(base.backends).toEqual(['wasm']); expect(base.wasmThreads).toBe(false);
    expect(base.notes.join(' ')).toMatch(/No WebGPU/); expect(base.notes.join(' ')).toMatch(/COOP \+ COEP/);
    const iso = describeCapabilities(probe({ hasWebGpu: true, crossOriginIsolated: true, hasSharedArrayBuffer: true }));
    expect(iso.wasmThreads).toBe(true); expect(iso.backends).toEqual(['webgpu', 'wasm']); expect(pickBackend(iso)).toBe('webgpu'); expect(pickBackend(iso, 'wasm')).toBe('wasm');
    expect(describeCapabilities(probe({ hasSimd: false })).notes.join(' ')).toMatch(/SIMD/);
    expect(pickBackend({ backends: [] })).toBeNull();
  });
  it('quota check needs 10% headroom; unknown quota is allowed', () => {
    expect(checkQuota(100, { quota: 1000, usage: 800 }).ok).toBe(true);
    expect(checkQuota(100, { quota: 1000, usage: 895 }).ok).toBe(false);
    expect(checkQuota(1e9, undefined).ok).toBe(true);
    expect(fmtBytes(154 * 1024 * 1024)).toBe('154 MB'); expect(fmtBytes(2.5 * 1024 ** 3)).toBe('2.5 GB');
  });
});
