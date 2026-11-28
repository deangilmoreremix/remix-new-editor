import { describe, it, expect } from 'vitest';
import { speechModels, chosenModel, chooseModel, modelStates, clearSpeechModel, DEFAULT_MODEL, MODEL_KEY, CACHE_NAME } from '../modelManager.js';

const BASE = 'onnx-community/whisper-base_timestamped';
const TINY = 'onnx-community/whisper-tiny_timestamped';
const memory = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), has: (k) => m.has(k) }; };
const fakeCaches = (urls) => {
  const store = new Set(urls);
  const cache = { keys: async () => [...store].map((url) => ({ url })), delete: async (r) => store.delete(r.url) };
  return { open: async (name) => { if (name !== CACHE_NAME) throw new Error(`wrong cache ${name}`); return cache; }, store };
};

describe('speech model manager', () => {
  it('lists the models the shared caption code offers', () => {
    expect(speechModels().map((m) => m.id)).toEqual(expect.arrayContaining([BASE, TINY]));
    speechModels().forEach((m) => expect(m.label).toMatch(/MB/));
  });
  it('remembers the chosen model, ignoring unknown ones', () => {
    const s = memory();
    expect(chosenModel(s)).toBe(DEFAULT_MODEL);
    expect(chooseModel(TINY, s)).toBe(true);
    expect(chosenModel(s)).toBe(TINY);
    expect(chooseModel('someone/else', s)).toBe(false);
    s.setItem(MODEL_KEY, 'junk');
    expect(chosenModel(s)).toBe(DEFAULT_MODEL);
    const blocked = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(chosenModel(blocked)).toBe(DEFAULT_MODEL);
    expect(chooseModel(TINY, blocked)).toBe(false);
  });
  it('shows what is on the device for each model', async () => {
    const caches = fakeCaches([`https://huggingface.co/${BASE}/resolve/main/a.onnx`, `https://huggingface.co/${BASE}/resolve/main/b.json`, 'https://huggingface.co/other/model/x']);
    const s = memory({ [`remix-whisper-consent:${BASE}`]: '1' });
    const states = await modelStates({ cacheStorage: caches, storage: s });
    const base = states.find((m) => m.id === BASE);
    expect(base).toMatchObject({ agreed: true, files: 2, chosen: true });
    expect(states.find((m) => m.id === TINY)).toMatchObject({ agreed: false, files: 0, chosen: false });
  });
  it('works without any cache support', async () => {
    const states = await modelStates({ cacheStorage: undefined, storage: memory() });
    expect(states.every((m) => m.files === 0)).toBe(true);
  });
  it('clears one model only: its files and its agreement', async () => {
    const caches = fakeCaches([`https://hf.co/${BASE}/resolve/a`, `https://hf.co/${BASE}/resolve/b`, `https://hf.co/${TINY}/resolve/a`]);
    const s = memory({ [`remix-whisper-consent:${BASE}`]: '1', [`remix-whisper-consent:${TINY}`]: '1' });
    expect(await clearSpeechModel(BASE, { cacheStorage: caches, storage: s })).toEqual({ removed: 2 });
    expect([...caches.store]).toEqual([`https://hf.co/${TINY}/resolve/a`]);
    expect(s.has(`remix-whisper-consent:${BASE}`)).toBe(false);
    expect(s.has(`remix-whisper-consent:${TINY}`)).toBe(true);
  });
  it('refuses a name that is not one of the models (so nothing else can be deleted)', async () => {
    const caches = fakeCaches(['https://hf.co/anything/x']);
    await expect(clearSpeechModel('anything', { cacheStorage: caches, storage: memory() })).rejects.toThrow(/not one of/);
    expect(caches.store.size).toBe(1);
  });
});
