// [remix] Fix L: robustness of semantic scene ranking (prompt ensemble, neutral-baseline subtraction, caption bonus) with SYNTHETIC vectors. The real-CLIP numbers are in docs/stage-11/FIX_L_REPORT.md.
import { describe, it, expect } from 'vitest';
import { ConsentStore } from '../../lib/local-ai/consent';
import { ModelManager } from '../../lib/local-ai/manager';
import { ModelCache, memoryBlobStore } from '../../lib/local-ai/model-cache';
import { describeCapabilities } from '../../lib/local-ai/capabilities';
import { LocalAiClient, type WorkerLike } from '../../lib/local-ai/worker-client';
import { SceneSearchIndex, rankByEmbedding, meanUnit, clipPrompt, clipPrompts, queryWords, captionBonus, CLIP_TEMPLATES, NEUTRAL_PROMPTS, BASELINE_REF, BASELINE_WEIGHT, MIN_SCORE_CALIBRATED } from '../../lib/local-ai/scene-index';
import type { WorkerRequest, WorkerResponse } from '../../lib/local-ai/worker-protocol';
import type { SceneInfo } from '../../lib/scenes/scenes';

const scene = (i: number, extra: Partial<SceneInfo> = {}): SceneInfo => ({ id: `a:${i}`, assetId: 'a', index: i, name: `clip - scene ${i + 1}`, startSec: i * 2, endSec: i * 2 + 2, tags: [], thumb: `data:image/jpeg;base64,${i}`, ...extra });
const f = (...v: number[]) => new Float32Array(v);
const Q = f(1, 0, 0); const B = f(0, 1, 0);
// "true": cos(q)=0.26, cos(base)=0.20.  "decoy" (e.g. a beach photo with a "New York City" book): cos(q)=0.27 but cos(base)=0.40 because it matches every caption.
const TRUE = f(0.26, 0.2, 0.94); const DECOY = f(0.27, 0.4, 0.88);

describe('prompt ensemble helpers', () => {
  it('keeps "a photo of X" first and builds one prompt per template', () => {
    const ps = clipPrompts(' a tiger ');
    expect(ps[0]).toBe(clipPrompt('a tiger'));
    expect(ps).toHaveLength(CLIP_TEMPLATES.length);
    expect(ps).toContain('a video frame of a tiger');
    expect(ps).toContain('a tiger');
    expect(new Set(ps).size).toBe(ps.length);
  });
  it('meanUnit averages and re-normalises', () => {
    const m = meanUnit([f(1, 0), f(0, 1)]);
    expect(m[0]).toBeCloseTo(Math.SQRT1_2); expect(m[1]).toBeCloseTo(Math.SQRT1_2);
    expect(Math.hypot(...m)).toBeCloseTo(1);
    expect(Array.from(meanUnit([f(3, 4)]))).toEqual([expect.closeTo(0.6), expect.closeTo(0.8)]);
    expect(meanUnit([])).toHaveLength(0);
  });
});

describe('rankByEmbedding with a neutral baseline', () => {
  const scenes = [scene(0), scene(1)];
  const vecs = new Map([['a:0', DECOY], ['a:1', TRUE]]);
  it('without a baseline the generic-matching decoy wins (the original defect)', () => {
    expect(rankByEmbedding(scenes, vecs, Q).map((r) => r.scene.id)).toEqual(['a:0', 'a:1']);
  });
  it('subtracting the baseline ranks the true scene first and drops the decoy below the floor', () => {
    const r = rankByEmbedding(scenes, vecs, Q, undefined, { baseline: B });
    expect(r.map((x) => x.scene.id)).toEqual(['a:1']);
    expect(r[0].score).toBeCloseTo(0.26 - BASELINE_WEIGHT * (0.2 - BASELINE_REF), 5);
    const all = rankByEmbedding(scenes, vecs, Q, 0, { baseline: B });
    expect(all.map((x) => x.scene.id)).toEqual(['a:1', 'a:0']);
    expect(all[1].score).toBeCloseTo(0.27 - BASELINE_WEIGHT * (0.4 - BASELINE_REF), 5);
    expect(all[1].score).toBeLessThan(MIN_SCORE_CALIBRATED);
  });
  it('an explicit minScore still wins, scenes without vectors are skipped and ties keep timeline order', () => {
    const tie = new Map([['a:1', TRUE], ['a:2', TRUE]]);
    expect(rankByEmbedding([scene(2), scene(1), scene(0)], tie, Q, 0).map((r) => r.scene.id)).toEqual(['a:1', 'a:2']);
    expect(rankByEmbedding(scenes, vecs, Q, 0.99)).toEqual([]);
  });
});

describe('caption / tag lexical bonus', () => {
  it('extracts content words only', () => {
    expect(queryWords('A photo of the city street with buildings')).toEqual(['city', 'street', 'buildings']);
    expect(queryWords('a')).toEqual([]);
  });
  it('is 0 without a caption or tags, scales per word and is capped', () => {
    expect(captionBonus({ tags: [] }, 'city street')).toBe(0);
    expect(captionBonus({ tags: [], caption: 'A busy city street at dusk' }, 'city')).toBeCloseTo(0.02);
    expect(captionBonus({ tags: [], caption: 'A busy city street at dusk' }, 'a city street')).toBeCloseTo(0.04);
    expect(captionBonus({ tags: ['city'], caption: 'city street with buildings' }, 'city street buildings')).toBeCloseTo(0.04);
    expect(captionBonus({ tags: [], caption: 'a tiger in the grass' }, 'city')).toBe(0);
  });
  it('matches whole words (and simple plurals), not substrings', () => {
    expect(captionBonus({ tags: [], caption: 'a cityscape' }, 'city')).toBe(0);
    expect(captionBonus({ tags: [], caption: 'two buildings' }, 'building')).toBeCloseTo(0.02);
  });
  it('breaks a near-tie in favour of the scene whose caption names the query subject', () => {
    const a = scene(0), b = scene(1, { caption: 'a city street with tall buildings' });
    const v = new Map([['a:0', f(0.27, 0.2, 0.94)], ['a:1', f(0.26, 0.2, 0.94)]]);
    expect(rankByEmbedding([a, b], v, Q, 0).map((r) => r.scene.id)).toEqual(['a:0', 'a:1']);
    expect(rankByEmbedding([a, b], v, Q, 0, { query: 'a city street with buildings' }).map((r) => r.scene.id)).toEqual(['a:1', 'a:0']);
  });
});

class FakeWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null; onerror: WorkerLike['onerror'] = null; seen: WorkerRequest[] = [];
  postMessage(m: unknown) {
    const r = m as WorkerRequest; this.seen.push(r);
    queueMicrotask(() => {
      let res: WorkerResponse | null = null;
      if (r.type === 'embed-images') res = { type: 'vectors', id: r.id, dim: 3, vectors: r.blobs.map((b) => (String((b as unknown as { u: string }).u).endsWith('0') ? DECOY : TRUE)) };
      if (r.type === 'embed-text') res = { type: 'vectors', id: r.id, dim: 3, vectors: r.texts.map((t) => (NEUTRAL_PROMPTS.includes(t) ? B : Q)) };
      if (res) this.onmessage?.({ data: res } as MessageEvent<WorkerResponse>);
    });
  }
  terminate() { /* nothing */ }
}
const kv = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

describe('SceneSearchIndex.search', () => {
  it('sends the ensemble + neutral prompts once, then only the ensemble, and ranks with the baseline', async () => {
    const manager = new ModelManager({ cache: new ModelCache(memoryBlobStore()), consent: new ConsentStore(kv()), loader: { prepare: async () => undefined }, capabilities: async () => describeCapabilities({ hasWebGpu: false, hasWasm: true, hasSimd: true, crossOriginIsolated: false, hasSharedArrayBuffer: false, hasIndexedDb: true, hasOpfs: true, hardwareConcurrency: 2 }) });
    await manager.download('clip-vit-b32', { acceptedLicence: true });
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (u: string) => ({ blob: async () => ({ u }) })) as unknown as typeof fetch;
    try {
      const w = new FakeWorker(); const idx = new SceneSearchIndex(manager, new LocalAiClient(() => w));
      const scenes = [scene(0), scene(1)];
      await idx.index(scenes);
      const first = await idx.search(scenes, 'a city street');
      expect(first.map((h) => h.scene.id)).toEqual(['a:1']);
      const second = await idx.search(scenes, 'a beach');
      expect(second.map((h) => h.scene.id)).toEqual(['a:1']);
      const texts = w.seen.filter((x) => x.type === 'embed-text').map((x) => (x as { texts: string[] }).texts);
      expect(texts).toHaveLength(2);
      expect(texts[0]).toHaveLength(CLIP_TEMPLATES.length + NEUTRAL_PROMPTS.length);
      expect(texts[1]).toHaveLength(CLIP_TEMPLATES.length);
      expect(texts[0][0]).toBe('a photo of a city street');
      const qv = await idx.embedQuery('a city street');
      expect(Math.hypot(...qv)).toBeCloseTo(1);
    } finally { globalThis.fetch = realFetch; }
  });
});
