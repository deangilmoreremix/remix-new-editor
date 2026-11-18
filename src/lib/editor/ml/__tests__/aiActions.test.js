import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../localAI.js', () => ({
  detectSilences: vi.fn(),
  assignSpeakers: (caps, turns) => caps.map((c) => ({ ...c, speaker: turns.length ? 1 : undefined })),
  diarize: vi.fn(async () => [{ speaker: 0, start: 0, end: 5 }]),
  translateCaptions: vi.fn(async (caps, tgt) => [{ text: 'hola', startMs: 0, endMs: 900, lang: tgt }]),
}));

import * as actions from '../aiActions.js';
import * as ai from '../localAI.js';

/** Minimal editor over seconds-based clips (start/dur), mirroring the page contract. */
function makeEditor(tracks) {
  const all = () => tracks.flatMap((t) => t.items);
  return {
    tracks,
    timelineSeconds: () => 60,
    playheadSec: () => 0,
    clipStart: (c) => c.s,
    clipDuration: (c) => c.d,
    setClipTimes: (c, s, e) => { c.s = s; c.d = e - s; },
    allClips: all,
    getClip: (id) => all().find((c) => c.id === id) || null,
    trackOf: (clip) => tracks.find((t) => t.items.some((c) => c.id === clip.id)) || null,
    addToTrack: (t, c) => { t.items.push(c); return c; },
    removeClip: (id) => tracks.forEach((t) => { const i = t.items.findIndex((c) => c.id === id); if (i >= 0) t.items.splice(i, 1); }),
    mediaSrc: (c) => c.src,
    setMediaSrc: (c, u) => { c.src = u; },
    snapshot: vi.fn(),
    commit: vi.fn(),
    refresh: vi.fn(),
    toast: vi.fn(),
    storeBlob: vi.fn(async () => 'https://cdn.example.com/file'),
    growTimeline: vi.fn(),
    insertClip: vi.fn((c) => c),
    ensureTrack: vi.fn(),
  };
}

describe('keptRanges', () => {
  it('keeps speech with a little air and drops silences', () => {
    const keep = actions.keptRanges([{ start: 2, end: 4 }, { start: 7, end: 10 }], 10, { pad: 0.1 });
    expect(keep.map((k) => [k.start, Number(k.end.toFixed(2))])).toEqual([[0, 2.1], [3.9, 7.1]]);
  });
});

describe('removeSilences (ripple)', () => {
  beforeEach(() => vi.clearAllMocks());
  it('splits the clip into kept pieces and pulls later clips left', async () => {
    const clip = { id: 'a', type: 'audio', src: 'https://x/a.mp3', s: 0, d: 10, trimIn: 0, name: 'VO' };
    const later = { id: 'b', type: 'video', src: 'https://x/b.mp4', s: 10, d: 5 };
    const editor = makeEditor([{ id: 't', items: [clip, later] }]);
    ai.detectSilences.mockResolvedValue([{ start: 3, end: 6 }]);
    const r = await actions.removeSilences(editor, clip, {});
    expect(r.pieces).toBe(2);
    expect(r.removedSec).toBeCloseTo(3 - 0.24, 5);
    const pieces = editor.tracks[0].items.filter((c) => c.id.startsWith('a-k'));
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toMatchObject({ s: 0, trimIn: 0 });
    expect(pieces[1].trimIn).toBeCloseTo(5.88, 5);
    expect(pieces[1].s).toBeCloseTo(3.12, 5);
    expect(later.s).toBeCloseTo(10 - r.removedSec, 5);
    expect(editor.snapshot).toHaveBeenCalled();
  });
  it('does nothing when there is no long silence', async () => {
    const clip = { id: 'a', type: 'audio', src: 'https://x/a.mp3', s: 0, d: 10 };
    const editor = makeEditor([{ id: 't', items: [clip] }]);
    ai.detectSilences.mockResolvedValue([]);
    expect(await actions.removeSilences(editor, clip, {})).toEqual({ removedSec: 0, pieces: 1 });
    expect(editor.tracks[0].items).toEqual([clip]);
  });
});

describe('captions actions', () => {
  it('translate adds a lined-up copy on the same track', async () => {
    const caps = { id: 'c', type: 'captions', s: 2, d: 5, captions: [{ text: 'hello', startMs: 0, endMs: 900 }] };
    const editor = makeEditor([{ id: 'text', items: [caps] }]);
    const copy = await actions.translateCaptionsClip(editor, caps, 'es');
    expect(copy).toMatchObject({ type: 'captions', lang: 'es', s: 2, d: 5, translatedFrom: 'c' });
    expect(editor.tracks[0].items).toContain(copy);
  });
  it('speaker labels need a source clip', async () => {
    const caps = { id: 'c', type: 'captions', s: 0, d: 5, captions: [{ text: 'hi', startMs: 0, endMs: 500 }] };
    const editor = makeEditor([{ id: 'text', items: [caps] }]);
    await expect(actions.labelSpeakers(editor, caps)).rejects.toThrow(/Transcribe/);
    const src = { id: 'v', type: 'video', src: 'https://x/v.mp4', s: 0, d: 5 };
    editor.tracks.push({ id: 'video', items: [src] });
    caps.sourceClipId = 'v';
    const speakers = await actions.labelSpeakers(editor, caps);
    expect(speakers).toEqual([{ id: 1, name: 'Speaker 1' }]);
    expect(caps.captions[0].speaker).toBe(1);
  });
});

describe('replaceMedia / restoreMedia', () => {
  it('keeps the first original across repeated edits and restores it', async () => {
    const clip = { id: 'i', type: 'image', src: 'https://x/orig.png', s: 0, d: 3 };
    const editor = makeEditor([{ id: 't', items: [clip] }]);
    await actions.replaceMedia(editor, clip, new Blob(['a']), { op: 'upscale-2x', ext: 'png' });
    await actions.replaceMedia(editor, clip, new Blob(['b']), { op: 'depth-blur', ext: 'png' });
    expect(clip.localAI).toMatchObject({ op: 'depth-blur', originalSrc: 'https://x/orig.png' });
    expect(actions.restoreMedia(editor, clip)).toBe(true);
    expect(clip.src).toBe('https://x/orig.png');
    expect(clip.localAI).toBeUndefined();
  });
});
