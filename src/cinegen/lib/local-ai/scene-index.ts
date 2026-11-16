// [remix] Port I1: semantic scene search. Scene thumbnails (data URLs already stored on SceneInfo) are embedded once with CLIP; a text query is embedded and scenes
// are ranked by cosine similarity (vectors are L2-normalised, so a dot product). Approach and ranking follow FreeCut's scene-browser/utils/semantic-rank.ts and
// analysis/embeddings/clip-worker.ts (MIT); this file is a re-implementation over CineGen's SceneInfo, not a copy. Optional captions (SmolVLM) are stored as scene tags.
import type { SceneInfo } from '../scenes/scenes';
import { searchScenes } from '../scenes/scenes';
import { modelById } from './catalog';
import type { ModelManager } from './manager';
import { abortError, refOf, type LocalAiClient } from './worker-client';
import type { WorkerResponse } from './worker-protocol';
import { thumbSig, type SceneVectorStore } from './scene-vector-store';

export const CLIP_ID = 'clip-vit-b32';
export const CAPTION_ID = 'smolvlm-256m';

export const dot = (a: Float32Array, b: Float32Array): number => { let s = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) s += a[i] * b[i]; return s; };

export interface RankedScene { scene: SceneInfo; score: number }
/** Rank scenes by similarity to `queryVec`; scenes without a vector are skipped. `minScore` drops weak matches (CLIP cosine for a true match is typically 0.2+). */
export function rankByEmbedding(scenes: readonly SceneInfo[], vectors: ReadonlyMap<string, Float32Array>, queryVec: Float32Array, minScore = 0.18): RankedScene[] {
  const out: RankedScene[] = [];
  for (const s of scenes) { const v = vectors.get(s.id); if (v) { const score = dot(v, queryVec); if (score >= minScore) out.push({ scene: s, score }); } }
  return out.sort((a, b) => b.score - a.score || a.scene.startSec - b.scene.startSec);
}

/** "a dog" -> "a photo of a dog" gives CLIP its trained prompt shape. */
export const clipPrompt = (q: string): string => `a photo of ${q.trim()}`;

export class SceneSearchIndex {
  private vecs = new Map<string, Float32Array>();
  private sig = new Map<string, string>();
  constructor(private manager: ModelManager, private client: LocalAiClient, private store: SceneVectorStore | null = null) {}
  get size(): number { return this.vecs.size; }
  ready(): boolean { return this.manager.isInstalled(CLIP_ID); }
  vectors(): ReadonlyMap<string, Float32Array> { return this.vecs; }

  /** Embed thumbnails that are not indexed yet (batches of 8). Returns the number newly embedded. */
  async index(scenes: readonly SceneInfo[], opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void; batch?: number } = {}): Promise<number> {
    this.manager.requireInstalled(CLIP_ID);
    const m = modelById(CLIP_ID)!;
    // [remix] Stage 11: reuse vectors saved by an earlier session when the thumbnail is unchanged
    if (this.store) {
      const fresh = scenes.filter((s) => s.thumb && this.sig.get(s.id) !== s.thumb);
      const saved = await this.store.load(fresh.map((s) => s.id));
      for (const r of saved) { const sc = fresh.find((s) => s.id === r.id); if (sc?.thumb && thumbSig(sc.thumb) === r.sig) { this.vecs.set(r.id, r.vec); this.sig.set(r.id, sc.thumb); } }
    }
    const todo = scenes.filter((s) => s.thumb && this.sig.get(s.id) !== s.thumb);
    const batch = opts.batch ?? 8; let done = 0;
    for (let i = 0; i < todo.length; i += batch) {
      if (opts.signal?.aborted) throw abortError('Indexing cancelled');
      const part = todo.slice(i, i + batch);
      const blobs = await Promise.all(part.map(async (s) => (await fetch(s.thumb!)).blob()));
      const res = await this.client.request<Extract<WorkerResponse, { type: 'vectors' }>>({ type: 'embed-images', model: refOf(m, 'wasm'), blobs }, { signal: opts.signal });
      part.forEach((s, k) => { this.vecs.set(s.id, res.vectors[k]); this.sig.set(s.id, s.thumb!); });
      void this.store?.save(part.map((s, k) => ({ id: s.id, sig: thumbSig(s.thumb!), vec: res.vectors[k] })));
      done += part.length; opts.onProgress?.(done, todo.length);
    }
    return done;
  }

  async embedQuery(query: string, signal?: AbortSignal): Promise<Float32Array> {
    this.manager.requireInstalled(CLIP_ID);
    const res = await this.client.request<Extract<WorkerResponse, { type: 'vectors' }>>({ type: 'embed-text', model: refOf(modelById(CLIP_ID)!, 'wasm'), texts: [clipPrompt(query)] }, { signal });
    return res.vectors[0];
  }

  /** Text query -> scenes ranked by visual similarity. */
  async search(scenes: readonly SceneInfo[], query: string, signal?: AbortSignal): Promise<RankedScene[]> {
    const q = await this.embedQuery(query, signal);
    return rankByEmbedding(scenes, this.vecs, q);
  }
}

/** Merge: semantic matches first (by score), then metadata matches the semantic pass did not include. Pure. */
export function mergeSearch(scenes: readonly SceneInfo[], query: string, semantic: readonly RankedScene[]): SceneInfo[] {
  const seen = new Set(semantic.map((r) => r.scene.id));
  return [...semantic.map((r) => r.scene), ...searchScenes(scenes, query).filter((s) => !seen.has(s.id))];
}

/** Caption one scene thumbnail with the small VLM; returns a short sentence. */
export async function captionScene(manager: ModelManager, client: LocalAiClient, scene: SceneInfo, signal?: AbortSignal): Promise<string> {
  manager.requireInstalled(CAPTION_ID);
  if (!scene.thumb) throw new Error('This scene has no thumbnail to caption.');
  const blob = await (await fetch(scene.thumb)).blob();
  const res = await client.request<Extract<WorkerResponse, { type: 'caption-result' }>>({ type: 'caption', model: refOf(modelById(CAPTION_ID)!, 'wasm'), blob, prompt: 'Describe this image in one short sentence.' }, { signal });
  return res.text;
}
