import { describe, it, expect, vi } from 'vitest';
import { voiceFromCache, loadDraft, speakRequest, MAX_CONTACTS } from '../draft.js';
import { paidJobCount, clipKey, introSeconds } from '../lipsync.js';

const draftWith = (over = {}) => ({ ...loadDraft({ getItem: () => null }), voiceCache: {}, ...over });
const make = (url) => vi.fn(async () => ({ url, duration: 2.5 }));

describe('reusing greetings that were already voiced', () => {
  it('makes a greeting once, then reuses it with the same URL', async () => {
    const d = draftWith();
    const m = make('https://cdn.x/a.mp3');
    const first = await voiceFromCache(d, 'Hi Mike!', m);
    const second = await voiceFromCache(d, 'Hi Mike!', m);
    expect(m).toHaveBeenCalledTimes(1);
    expect(first.reused).toBe(false);
    expect(second).toMatchObject({ url: 'https://cdn.x/a.mp3', duration: 2.5, reused: true });
  });
  it('different words, a different voice or another language is a new greeting', async () => {
    const d = draftWith();
    const m = vi.fn().mockResolvedValueOnce({ url: 'https://cdn.x/1.mp3', duration: 1 }).mockResolvedValueOnce({ url: 'https://cdn.x/2.mp3', duration: 1 })
      .mockResolvedValueOnce({ url: 'https://cdn.x/3.mp3', duration: 1 }).mockResolvedValueOnce({ url: 'https://cdn.x/4.mp3', duration: 1 });
    await voiceFromCache(d, 'Hi Mike!', m);
    await voiceFromCache(d, 'Hi Ann!', m);
    d.voice = { ...d.voice, mode: 'stock', stockVoice: 'Deep_Voice_Man' };
    await voiceFromCache(d, 'Hi Mike!', m);
    d.language = 'Spanish';
    await voiceFromCache(d, 'Hi Mike!', m);
    expect(m).toHaveBeenCalledTimes(4);
  });
  it('never reuses a temporary blob link, and a failed make stores nothing', async () => {
    const d = draftWith();
    const key = JSON.stringify(speakRequest(d, 'Hi!')); // the real key, so the blob entry really is the one found
    d.voiceCache = { [key]: { url: 'blob:x', duration: 1 } };
    const bad = vi.fn().mockRejectedValue(new Error('voice service down'));
    await expect(voiceFromCache(d, 'Hi!', bad)).rejects.toThrow('voice service down');
    expect(bad).toHaveBeenCalledTimes(1); // the blob link was not reused
    expect(Object.keys(d.voiceCache)).toEqual([key]); // nothing new stored
  });
  it('keeps the cache bounded', async () => {
    const d = draftWith();
    for (let i = 0; i < 12; i += 1) await voiceFromCache(d, `Hi ${i}!`, make(`https://cdn.x/${i}.mp3`), { max: 5 });
    expect(Object.keys(d.voiceCache)).toHaveLength(5);
  });
  it('holds a whole campaign: the largest campaign voices nothing twice on a retry', async () => {
    const d = draftWith();
    const m = vi.fn(async (line) => ({ url: `https://cdn.x/${encodeURIComponent(line)}.mp3`, duration: 1 }));
    for (let i = 0; i < MAX_CONTACTS; i += 1) await voiceFromCache(d, `Hi ${i}!`, m);
    expect(m).toHaveBeenCalledTimes(MAX_CONTACTS);
    for (let i = 0; i < MAX_CONTACTS; i += 1) await voiceFromCache(d, `Hi ${i}!`, m); // the retry
    expect(m).toHaveBeenCalledTimes(MAX_CONTACTS); // nothing was generated again
  });
  it('survives a reload of the saved draft', () => {
    const saved = { voiceCache: { k: { url: 'https://cdn.x/a.mp3', duration: 1 } } };
    expect(loadDraft({ getItem: () => JSON.stringify(saved) }).voiceCache).toEqual(saved.voiceCache);
    expect(loadDraft({ getItem: () => JSON.stringify({ voiceCache: 5 }) }).voiceCache).toEqual({});
  });
  it('so a retry does not pay for lip-sync again: the same audio URL hits the lip-sync cache', async () => {
    const d = draftWith({ video: { url: 'https://cdn.x/video.mp4', duration: 20 } });
    d.voice = { ...d.voice, lipsync: true };
    // first run: two prospects voiced; Mike's lip-sync finished, Ann's failed
    const mike1 = await voiceFromCache(d, 'Hi Mike!', make('https://cdn.x/mike.mp3'));
    const ann1 = await voiceFromCache(d, 'Hi Ann!', make('https://cdn.x/ann.mp3'));
    const run1 = { m: { url: mike1.url, duration: 2.5, text: 'Hi Mike!', name: 'Mike' }, a: { url: ann1.url, duration: 2.5, text: 'Hi Ann!', name: 'Ann' } };
    const seconds = introSeconds(d, run1);
    const cache = { [clipKey(d.video.url, seconds, mike1.url)]: 'https://cdn.x/mike-clip.mp4' };
    expect(paidJobCount(d, run1, cache)).toBe(1); // only Ann still needs a paid job
    // retry WITH greeting reuse: Mike's audio URL is unchanged, so his clip is still found
    const mike2 = await voiceFromCache(d, 'Hi Mike!', make('https://cdn.x/NEW-mike.mp3'));
    const run2 = { m: { ...run1.m, url: mike2.url }, a: run1.a };
    expect(mike2.url).toBe(mike1.url);
    expect(paidJobCount(d, run2, cache)).toBe(1);
    // without reuse (the old behaviour) a fresh URL would miss the cache and pay for Mike again
    const run2Old = { m: { ...run1.m, url: 'https://cdn.x/NEW-mike.mp3' }, a: run1.a };
    expect(paidJobCount(d, run2Old, cache)).toBe(2);
  });
});
