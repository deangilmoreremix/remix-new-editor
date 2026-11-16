// [remix] Port I1: transcription orchestration, worker client and semantic scene search with MOCKED workers/pipelines (the real ones are exercised in docs/stage-11/smoke).
import type { SceneVectorStore, StoredVector } from '../../lib/local-ai/scene-vector-store';
import { describe, it, expect, vi } from 'vitest';
import { ConsentStore } from '../../lib/local-ai/consent';
import { ConsentRequiredError } from '../../lib/local-ai/consent';
import { ModelManager } from '../../lib/local-ai/manager';
import { ModelCache, memoryBlobStore } from '../../lib/local-ai/model-cache';
import { describeCapabilities } from '../../lib/local-ai/capabilities';
import { LocalAiClient, type WorkerLike } from '../../lib/local-ai/worker-client';
import { transcribeLocal, pickInstalledAsr } from '../../lib/local-ai/transcribe';
import { SceneSearchIndex, captionScene, mergeSearch, rankByEmbedding, dot, clipPrompt } from '../../lib/local-ai/scene-index';
import { SAMPLE_RATE } from '../../lib/local-ai/whisper-words';
import type { WorkerRequest, WorkerResponse } from '../../lib/local-ai/worker-protocol';
import type { SceneInfo } from '../../lib/scenes/scenes';

const kv = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

class FakeWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null; onerror: WorkerLike['onerror'] = null; terminated = false; seen: WorkerRequest[] = [];
  constructor(private handler: (r: WorkerRequest, reply: (m: WorkerResponse) => void) => void) {}
  postMessage(m: unknown) { const r = m as WorkerRequest; this.seen.push(r); queueMicrotask(() => { if (!this.terminated) this.handler(r, (x) => this.onmessage?.({ data: x } as MessageEvent<WorkerResponse>)); }); }
  terminate() { this.terminated = true; }
}

async function installed(ids: string[], backend: 'wasm' | 'webgpu' = 'wasm') {
  const cache = new ModelCache(memoryBlobStore()); const consent = new ConsentStore(kv());
  const manager = new ModelManager({ cache, consent, loader: { prepare: async () => undefined }, capabilities: async () => describeCapabilities({ hasWebGpu: backend === 'webgpu', hasWasm: true, hasSimd: true, crossOriginIsolated: false, hasSharedArrayBuffer: false, hasIndexedDb: true, hasOpfs: true, hardwareConcurrency: 2 }) });
  for (const id of ids) await manager.download(id, { acceptedLicence: true });
  return manager;
}

describe('transcribeLocal', () => {
  it('refuses when no model is installed (no implicit download) and for an English-only model with another language', async () => {
    const m = await installed([]);
    const client = new LocalAiClient(() => { throw new Error('worker must not start'); });
    await expect(transcribeLocal('x', m, client, { decode: async () => new Float32Array(10) })).rejects.toBeInstanceOf(ConsentRequiredError);
    const en = await installed(['whisper-tiny-en']);
    await expect(transcribeLocal('x', en, client, { modelId: 'whisper-tiny-en', language: 'fr', decode: async () => new Float32Array(10) })).rejects.toThrow(/English only/);
  });

  it('chunks long audio into overlapping spans, offsets word times, de-duplicates the overlap and reports progress', async () => {
    const m = await installed(['whisper-base']);
    const worker = new FakeWorker((r, reply) => {
      if (r.type !== 'asr') return;
      const len = r.audio.length / SAMPLE_RATE;
      // every span "hears" one word at its start and the boundary word that is also heard by the neighbouring span
      const chunks = len > 100 ? [{ text: ' start', timestamp: [0.5, 0.9] as [number, number] }, { text: ' boundary', timestamp: [118.4, 118.9] as [number, number] }] : [{ text: ' boundary', timestamp: [0.5, 1.0] as [number, number] }, { text: ' tail', timestamp: [3, 3.5] as [number, number] }];
      reply({ type: 'asr-result', id: r.id, text: '', chunks, backend: 'wasm' });
    });
    const client = new LocalAiClient(() => worker);
    const progress: number[] = [];
    const res = await transcribeLocal('clip.mp4', m, client, { language: 'en', decode: async () => new Float32Array(SAMPLE_RATE * 125), onProgress: (p) => progress.push(p.progress) });
    expect(worker.seen.filter((x) => x.type === 'asr')).toHaveLength(2);
    expect(res.words.map((w) => w.text.trim())).toEqual(['start', 'boundary', 'tail']);
    expect(res.words[1].start).toBeCloseTo(118.4); expect(res.words[2].start).toBeCloseTo(118 + 3);
    expect(res.captions[0].text).toBe('start'); expect(res.captions[1].text).toBe(' boundary');
    expect(worker.seen.filter((x) => x.type === 'asr').every((x) => (x as { multilingual: boolean }).multilingual === true)).toBe(true);
    expect(res.language).toBe('en'); expect(res.modelId).toBe('whisper-base'); expect(res.durationSec).toBeCloseTo(125);
    expect(progress[progress.length - 1]).toBe(1); expect(progress.some((p) => p > 0 && p < 1)).toBe(true);
    expect(res.segments.length).toBeGreaterThan(0);
  });

  it('cancel mid-inference terminates the worker and rejects with AbortError', async () => {
    const m = await installed(['whisper-tiny']);
    const worker = new FakeWorker(() => undefined); // never answers
    const client = new LocalAiClient(() => worker);
    const ac = new AbortController();
    const p = transcribeLocal('c', m, client, { decode: async () => new Float32Array(SAMPLE_RATE * 3), signal: ac.signal });
    await new Promise((r) => setTimeout(r, 5)); ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' }); expect(worker.terminated).toBe(true);
    const pre = new AbortController(); pre.abort();
    await expect(transcribeLocal('c', m, client, { decode: async () => new Float32Array(100), signal: pre.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reports a worker error and empty audio', async () => {
    const m = await installed(['whisper-tiny']);
    const client = new LocalAiClient(() => new FakeWorker((r, reply) => reply({ type: 'error', id: r.id, message: 'boom' })));
    await expect(transcribeLocal('c', m, client, { decode: async () => new Float32Array(SAMPLE_RATE) })).rejects.toThrow('boom');
    await expect(transcribeLocal('c', m, client, { decode: async () => new Float32Array(0) })).rejects.toThrow(/no audio/);
  });

  it('picks the best installed model for the request', async () => {
    const m = await installed(['whisper-tiny-en', 'whisper-tiny']);
    expect(pickInstalledAsr(m, 'de')?.id).toBe('whisper-tiny');
    expect(pickInstalledAsr(m, 'en', false)?.id).toBe('whisper-tiny');
    expect(pickInstalledAsr(await installed([]))).toBeNull();
  });
});

describe('LocalAiClient', () => {
  it('forwards progress and rejects pending requests when the worker errors', async () => {
    const w = new FakeWorker((r, reply) => { reply({ type: 'progress', id: r.id, loaded: 5, total: 10 }); reply({ type: 'prepared', id: r.id, backend: 'wasm' }); });
    const c = new LocalAiClient(() => w); const seen: number[][] = [];
    await c.request({ type: 'prepare', model: { id: 'x', kind: 'asr', repo: 'r', backend: 'wasm' } }, { onProgress: (l, t) => seen.push([l, t]) });
    expect(seen).toEqual([[5, 10]]);
    const w2 = new FakeWorker(() => undefined); const c2 = new LocalAiClient(() => w2);
    const p = c2.request({ type: 'prepare', model: { id: 'x', kind: 'asr', repo: 'r', backend: 'wasm' } });
    w2.onerror?.({ message: 'crash' } as ErrorEvent);
    await expect(p).rejects.toThrow('crash'); expect(w2.terminated).toBe(true);
  });
});

const scene = (i: number, thumb = `data:image/jpeg;base64,${i}`): SceneInfo => ({ id: `a:${i}`, assetId: 'a', index: i, name: `clip - scene ${i + 1}`, startSec: i * 2, endSec: i * 2 + 2, tags: [], thumb });
const unit = (...v: number[]) => { const n = Math.hypot(...v); return new Float32Array(v.map((x) => x / n)); };

describe('semantic scene search', () => {
  it('ranks by cosine similarity, drops weak matches and merges with metadata matches', () => {
    const scenes = [scene(0), scene(1), scene(2)];
    scenes[2].tags = ['beach'];
    const vecs = new Map([['a:0', unit(1, 0)], ['a:1', unit(0.9, 0.3)], ['a:2', unit(0, 1)]]);
    const ranked = rankByEmbedding(scenes, vecs, unit(1, 0));
    expect(ranked.map((r) => r.scene.id)).toEqual(['a:0', 'a:1']);
    expect(dot(unit(1, 0), unit(1, 0))).toBeCloseTo(1);
    expect(mergeSearch(scenes, 'beach', ranked).map((s) => s.id)).toEqual(['a:0', 'a:1', 'a:2']);
    expect(clipPrompt(' a dog ')).toBe('a photo of a dog');
  });

  it('indexes thumbnails in batches, skips already indexed ones, and searches with the text embedding', async () => {
    const m = await installed(['clip-vit-b32']);
    vi.stubGlobal('fetch', vi.fn(async (u: string) => ({ blob: async () => ({ u }) })));
    const worker = new FakeWorker((r, reply) => {
      if (r.type === 'embed-images') reply({ type: 'vectors', id: r.id, dim: 2, vectors: r.blobs.map((b) => (String((b as unknown as { u: string }).u).endsWith('1') ? unit(0, 1) : unit(1, 0))) });
      if (r.type === 'embed-text') reply({ type: 'vectors', id: r.id, dim: 2, vectors: [unit(0, 1)] });
    });
    const idx = new SceneSearchIndex(m, new LocalAiClient(() => worker));
    const scenes = [scene(0), scene(1), scene(2)];
    expect(await idx.index(scenes, { batch: 2 })).toBe(3);
    expect(worker.seen.filter((x) => x.type === 'embed-images')).toHaveLength(2);
    expect(await idx.index(scenes)).toBe(0);
    const hits = await idx.search(scenes, 'a person');
    expect(hits.map((h) => h.scene.id)).toEqual(['a:1']);
    expect((worker.seen.find((x) => x.type === 'embed-text') as { texts: string[] }).texts).toEqual(['a photo of a person']);
    vi.unstubAllGlobals();
  });

  it('saves scene vectors and reuses them in a new session, but re-embeds a scene whose thumbnail changed', async () => {
    const m = await installed(['clip-vit-b32']);
    vi.stubGlobal('fetch', vi.fn(async (u: string) => ({ blob: async () => ({ u }) })));
    const mem = new Map<string, StoredVector>();
    const store: SceneVectorStore = { load: async (ids) => ids.flatMap((i) => (mem.has(i) ? [mem.get(i)!] : [])), save: async (rows) => { rows.forEach((r) => mem.set(r.id, r)); } };
    const mk = () => new FakeWorker((r, reply) => { if (r.type === 'embed-images') reply({ type: 'vectors', id: r.id, dim: 2, vectors: r.blobs.map(() => unit(1, 0)) }); });
    const w1 = mk();
    expect(await new SceneSearchIndex(m, new LocalAiClient(() => w1), store).index([scene(0), scene(1)])).toBe(2);
    expect(mem.size).toBe(2);
    const w2 = mk();
    const second = new SceneSearchIndex(m, new LocalAiClient(() => w2), store);
    expect(await second.index([scene(0), scene(1)])).toBe(0);
    expect(second.size).toBe(2);
    expect(w2.seen.filter((x) => x.type === 'embed-images')).toHaveLength(0);
    const w3 = mk();
    expect(await new SceneSearchIndex(m, new LocalAiClient(() => w3), store).index([scene(0), scene(1, 'data:image/jpeg;base64,changed')])).toBe(1);
    vi.unstubAllGlobals();
  });

  it('requires the model to be installed (consent flow) for search and captions; captions come from the VLM', async () => {
    const none = await installed([]);
    const client = new LocalAiClient(() => { throw new Error('no worker'); });
    await expect(new SceneSearchIndex(none, client).index([scene(0)])).rejects.toBeInstanceOf(ConsentRequiredError);
    await expect(captionScene(none, client, scene(0))).rejects.toBeInstanceOf(ConsentRequiredError);
    const m = await installed(['smolvlm-256m']);
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Uint8Array(1) })));
    const w = new FakeWorker((r, reply) => { if (r.type === 'caption') reply({ type: 'caption-result', id: r.id, text: 'A dog on a beach.' }); });
    expect(await captionScene(m, new LocalAiClient(() => w), scene(0))).toBe('A dog on a beach.');
    vi.unstubAllGlobals();
  });
});
