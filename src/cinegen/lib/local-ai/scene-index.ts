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

/** [remix] Fix L: CLIP prompt ensemble. Averaging several phrasings of one query smooths out single-template quirks (measured: a lone "a photo of X" let a beach photo containing a
 * "New York City" book outrank the real city shot; the ensemble widened the margin). The first template stays "a photo of X" (see `clipPrompt`). */
export const CLIP_TEMPLATES: readonly string[] = ['a photo of {}', 'a video frame of {}', '{}', 'a still from a video showing {}'];
/** Generic prompts whose mean embedding measures how strongly a frame "matches any caption" (text-heavy / busy frames score high for every query). */
export const NEUTRAL_PROMPTS: readonly string[] = ['a photo', 'a photo of something', 'an image', 'a video frame', 'a picture'];
/** Weight of the neutral-baseline subtraction and the baseline level added back so scores stay on the familiar ~0.2-0.3 cosine scale (the panel shows score x 100 as "match %"). */
export const BASELINE_WEIGHT = 0.75;
export const BASELINE_REF = 0.2;
/** Minimum score: 0.18 for raw cosine (no baseline); 0.22 once the baseline is subtracted (measured: absent-subject queries top out at ~0.225, real matches start at ~0.234). */
export const MIN_SCORE_RAW = 0.18;
export const MIN_SCORE_CALIBRATED = 0.22;
/** Optional lexical signal: each query word found in a scene caption/tag adds this much (capped), so a SmolVLM caption can break near-ties. */
export const CAPTION_WORD_BONUS = 0.02;
export const CAPTION_BONUS_MAX = 0.04;

const STOP = new Set(['a', 'an', 'the', 'of', 'with', 'in', 'on', 'at', 'and', 'or', 'to', 'is', 'are', 'photo', 'photos', 'video', 'image', 'picture', 'frame', 'showing', 'shot', 'scene']);
/** Content words of a query (lower-case, stop words and 1-2 letter tokens dropped). Pure. */
export function queryWords(query: string): string[] { return query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)); }
/** Lexical bonus from the scene's caption and tags. 0 when there is neither. Pure. */
export function captionBonus(scene: Pick<SceneInfo, 'caption' | 'tags'>, query: string): number {
  const hay = ` ${[scene.caption ?? '', ...scene.tags].join(' ').toLowerCase().split(/[^a-z0-9]+/).join(' ')} `;
  if (hay.trim() === '') return 0;
  const hits = queryWords(query).filter((w) => hay.includes(` ${w} `) || hay.includes(` ${w}s `)).length;
  return Math.min(CAPTION_BONUS_MAX, hits * CAPTION_WORD_BONUS);
}

/** Mean of several embeddings, re-normalised to unit length (CLIP text embeddings are unit vectors; their mean is not). Returns the first vector's copy when only one is given. */
export function meanUnit(vs: readonly Float32Array[]): Float32Array {
  const n = vs[0]?.length ?? 0; const out = new Float32Array(n);
  for (const v of vs) for (let i = 0; i < n; i++) out[i] += v[i];
  let norm = 0; for (let i = 0; i < n; i++) norm += out[i] * out[i];
  norm = Math.sqrt(norm) || 1; for (let i = 0; i < n; i++) out[i] /= norm;
  return out;
}

export interface RankOptions {
  /** Unit "generic caption" embedding (mean of NEUTRAL_PROMPTS). When given, each scene's score is `cos(scene, query) - BASELINE_WEIGHT * (cos(scene, baseline) - BASELINE_REF)`. */
  baseline?: Float32Array;
  /** The query text; enables the caption/tag lexical bonus. */
  query?: string;
}
/** Rank scenes by similarity to `queryVec`; scenes without a vector are skipped. `minScore` drops weak matches (default 0.18 raw / 0.22 with a baseline). */
export function rankByEmbedding(scenes: readonly SceneInfo[], vectors: ReadonlyMap<string, Float32Array>, queryVec: Float32Array, minScore?: number, opts: RankOptions = {}): RankedScene[] {
  const floor = minScore ?? (opts.baseline ? MIN_SCORE_CALIBRATED : MIN_SCORE_RAW);
  const out: RankedScene[] = [];
  for (const s of scenes) {
    const v = vectors.get(s.id); if (!v) continue;
    let score = dot(v, queryVec);
    if (opts.baseline) score -= BASELINE_WEIGHT * (dot(v, opts.baseline) - BASELINE_REF);
    if (opts.query) score += captionBonus(s, opts.query);
    if (score >= floor) out.push({ scene: s, score });
  }
  return out.sort((a, b) => b.score - a.score || a.scene.startSec - b.scene.startSec);
}

/** "a dog" -> "a photo of a dog" gives CLIP its trained prompt shape. */
export const clipPrompt = (q: string): string => `a photo of ${q.trim()}`;
/** All ensemble phrasings of a query. */
export const clipPrompts = (q: string): string[] => CLIP_TEMPLATES.map((t) => t.replace('{}', q.trim()));

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

  private baseline: Float32Array | null = null;
  /** Embed a query and (once per index) the neutral baseline in a single worker round trip. Falls back to a plain query vector when the worker returns fewer vectors than prompts. */
  private async embedPrompts(query: string, signal?: AbortSignal): Promise<{ q: Float32Array; baseline: Float32Array | null }> {
    this.manager.requireInstalled(CLIP_ID);
    const prompts = clipPrompts(query); const withBase = !this.baseline;
    const texts = withBase ? [...prompts, ...NEUTRAL_PROMPTS] : prompts;
    const res = await this.client.request<Extract<WorkerResponse, { type: 'vectors' }>>({ type: 'embed-text', model: refOf(modelById(CLIP_ID)!, 'wasm'), texts }, { signal });
    if (withBase && res.vectors.length === texts.length) this.baseline = meanUnit(res.vectors.slice(prompts.length));
    return { q: meanUnit(res.vectors.slice(0, prompts.length)), baseline: this.baseline };
  }
  /** Ensemble query embedding (mean of the CLIP_TEMPLATES phrasings, unit length). */
  async embedQuery(query: string, signal?: AbortSignal): Promise<Float32Array> { return (await this.embedPrompts(query, signal)).q; }

  /** Text query -> scenes ranked by visual similarity (prompt ensemble, neutral-baseline subtraction, caption/tag bonus). */
  async search(scenes: readonly SceneInfo[], query: string, signal?: AbortSignal): Promise<RankedScene[]> {
    const { q, baseline } = await this.embedPrompts(query, signal);
    return rankByEmbedding(scenes, this.vecs, q, undefined, { baseline: baseline ?? undefined, query });
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
