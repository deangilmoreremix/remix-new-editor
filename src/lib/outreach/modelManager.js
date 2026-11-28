// src/lib/outreach/modelManager.js
//
// The speech models Video Outreach can download (requirements 13 and 49): which one to use, what is on this device, and a
// way to remove it again. Models are the Whisper files Transformers.js keeps in the browser's Cache API ("transformers-cache");
// agreeing to a download is remembered per model by the shared caption code. Nothing here downloads anything.
import { browserStorage } from './safeStorage.js';
import { WHISPER_MODELS } from '../captionStudio/transcribeClient.js';

export const CACHE_NAME = 'transformers-cache';
export const MODEL_KEY = 'outreach-whisper-model';
export const DEFAULT_MODEL = 'onnx-community/whisper-base_timestamped';
const consentKey = (id) => `remix-whisper-consent:${id}`;
const part = (id) => `/${id}/`;

export const speechModels = () => WHISPER_MODELS.map(([id, label]) => ({ id, label }));
export const isKnownModel = (id) => WHISPER_MODELS.some(([k]) => k === id);

// What was picked in this page, used even when the browser would not keep it for next time.
let sessionChoice = null;

/** The model to use: the pick made in this page, else the one kept in this browser, else the default. */
export function chosenModel(storage = browserStorage()) {
  if (isKnownModel(sessionChoice)) return sessionChoice;
  try { const v = storage?.getItem(MODEL_KEY); return isKnownModel(v) ? v : DEFAULT_MODEL; } catch { return DEFAULT_MODEL; }
}
/** @returns {boolean} true when the pick was also kept for next time; false when it only applies to this page (or the model is unknown, and nothing changes) */
export function chooseModel(id, storage = browserStorage()) {
  if (!isKnownModel(id)) return false;
  sessionChoice = id;
  if (!storage) return false;
  try { storage.setItem(MODEL_KEY, id); return true; } catch { return false; }
}
/** For tests: forget the pick made in this page. */
export const forgetSessionChoice = () => { sessionChoice = null; };

/**
 * What is on this device for each model: whether the user agreed to download it, and how many of its files are stored.
 * @returns {Promise<{ id:string, label:string, agreed:boolean, files:number, chosen:boolean }[]>}
 */
export async function modelStates({ cacheStorage = globalThis.caches, storage = browserStorage() } = {}) {
  let urls = [];
  try { if (cacheStorage) urls = (await (await cacheStorage.open(CACHE_NAME)).keys()).map((r) => String(r.url || r)); } catch { urls = []; }
  const chosen = chosenModel(storage);
  return speechModels().map((m) => {
    let agreed = false;
    try { agreed = storage?.getItem(consentKey(m.id)) === '1'; } catch { /* unreadable: treated as not agreed */ }
    return { ...m, agreed, files: urls.filter((u) => u.includes(part(m.id))).length, chosen: m.id === chosen };
  });
}

/**
 * Remove a model: its stored files, and the remembered agreement (so you are asked again before it downloads again).
 * @returns {Promise<{ removed:number }>}
 */
export async function clearSpeechModel(id, { cacheStorage = globalThis.caches, storage = browserStorage() } = {}) {
  if (!isKnownModel(id)) throw new Error('That is not one of the speech models.');
  let removed = 0;
  if (cacheStorage) {
    const cache = await cacheStorage.open(CACHE_NAME);
    const mine = (await cache.keys()).filter((r) => String(r.url || r).includes(part(id)));
    await Promise.all(mine.map((r) => cache.delete(r)));
    removed = mine.length;
  }
  try { storage?.removeItem(consentKey(id)); } catch { /* ignore */ }
  return { removed };
}
