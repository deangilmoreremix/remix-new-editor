/**
 * Per-asset local-AI index (CLIP frame embeddings, tags, audio labels),
 * stored in IndexedDB separately from the project save so embeddings never
 * bloat the project document.
 *
 * Record: { assetId, url, frames: [{ t, embedding: Float32Array }], tags: [{label, score}],
 *           objects: [{label, score}], audio: [{start,end,label,score}], updatedAt }
 */
import { get, set, del, createStore } from 'idb-keyval';

let store = null;
const memory = new Map();

function getStore() {
  if (store !== null) return store;
  try {
    store = typeof indexedDB === 'undefined' ? false : createStore('timeline-ml-index-v1', 'assets');
  } catch {
    store = false;
  }
  return store;
}

export async function getIndex(assetId) {
  if (!assetId) return null;
  if (memory.has(assetId)) return memory.get(assetId);
  const s = getStore();
  if (!s) return null;
  try {
    const rec = await get(assetId, s);
    if (rec) memory.set(assetId, rec);
    return rec || null;
  } catch {
    return null;
  }
}

export async function putIndex(assetId, patch) {
  const prev = (await getIndex(assetId)) || { assetId };
  const rec = { ...prev, ...patch, assetId, updatedAt: Date.now() };
  memory.set(assetId, rec);
  const s = getStore();
  if (s) { try { await set(assetId, rec, s); } catch { /* memory copy still works this session */ } }
  return rec;
}

export async function deleteIndex(assetId) {
  memory.delete(assetId);
  const s = getStore();
  if (s) { try { await del(assetId, s); } catch { /* ignore */ } }
}

export function dot(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) s += a[i] * b[i];
  return s;
}

/**
 * Rank indexed assets against a (normalized) query embedding.
 * @returns {{ assetId, t, score }[]} best frame per asset, highest score first
 */
export function rankFrames(records, query, { limit = 20, minScore = 0.18 } = {}) {
  const hits = [];
  for (const rec of records) {
    let best = null;
    for (const f of rec?.frames || []) {
      const score = dot(f.embedding, query);
      if (!best || score > best.score) best = { assetId: rec.assetId, t: f.t, score };
    }
    if (best && best.score >= minScore) hits.push(best);
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Zero-shot tags: softmax over cosine similarities scaled by CLIP's logit scale (100). */
export function zeroShotTags(imageEmbedding, labelEmbeddings, labels, { top = 5, minProb = 0.08 } = {}) {
  const logits = labelEmbeddings.map((e) => 100 * dot(imageEmbedding, e));
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return labels
    .map((label, i) => ({ label, score: exps[i] / sum }))
    .sort((a, b) => b.score - a.score)
    .filter((t, i) => i < top && t.score >= minProb);
}
