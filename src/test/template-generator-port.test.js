import { describe, it, expect } from 'vitest';
import {
  STEPS, MAX_VIDEOS, createWizardState, guardStep, nextStepIndex, nextDisabled, nextLabel, toggleVideo,
  toBuilderState, scriptLines, MESSAGES,
} from '../components/modals/template-generator/rules.js';
import {
  pexelsPlayFile, pixabayPlayFile, normalizePexelsVideo, normalizePixabayVideo, normalizePixabayImage,
  createStockClient, kindFromUrlOrType, remoteItem,
} from '../components/modals/template-generator/stock.js';
import { buildCompositionFromState } from '../lib/editor/templateCompositionBuilder.js';

const vid = (n, extra = {}) => ({ id: `v${n}`, kind: 'video', title: `V${n}`, url: `https://x/${n}.mp4`, duration: 6, source: 'pexels', user: 'Ann', pageURL: 'https://p/1', ...extra });

describe('wizard rules (ported from the original ModalContent)', () => {
  it('limits to 5 videos', () => {
    const s = createWizardState();
    for (let i = 0; i < MAX_VIDEOS; i += 1) expect(toggleVideo(s, vid(i)).ok).toBe(true);
    const r = toggleVideo(s, vid(9));
    expect(r.ok).toBe(false);
    expect(r.message).toBe(MESSAGES.maxVideos);
    expect(toggleVideo(s, vid(0)).selected).toBe(false);
  });
  it('guards steps like the original', () => {
    const s = createWizardState();
    expect(guardStep(s, STEPS.SCRIPT)).toBe(MESSAGES.needVideo);
    toggleVideo(s, vid(1));
    expect(guardStep(s, STEPS.SCRIPT)).toBeNull();
    expect(guardStep(s, STEPS.OVERLAY)).toBe(MESSAGES.needTwoVideos);
    toggleVideo(s, vid(2));
    expect(guardStep(s, STEPS.OVERLAY)).toBe(MESSAGES.needScript);
    s.script.text = 'Hello there.';
    expect(guardStep(s, STEPS.OVERLAY)).toBeNull();
    expect(guardStep(s, STEPS.PREVIEW)).toBeNull();
  });
  it('skips Overlay with one video, disables Next until ready', () => {
    const s = createWizardState();
    expect(nextDisabled(s, STEPS.VIDEO)).toBe(true);
    toggleVideo(s, vid(1));
    expect(nextDisabled(s, STEPS.VIDEO)).toBe(false);
    expect(nextDisabled(s, STEPS.SCRIPT)).toBe(true);
    s.selectedScript = { id: 'a' };
    expect(nextDisabled(s, STEPS.SCRIPT)).toBe(false);
    expect(nextStepIndex(s, STEPS.SCRIPT)).toBe(STEPS.PREVIEW);
    toggleVideo(s, vid(2));
    expect(nextStepIndex(s, STEPS.SCRIPT)).toBe(STEPS.OVERLAY);
    expect(nextLabel(STEPS.PREVIEW)).toBe('Add to Timeline');
    expect(nextDisabled(s, STEPS.PREVIEW, true)).toBe(true);
  });
  it('splits a script into per-scene lines', () => {
    expect(scriptLines('One. Two. Three. Four.', 2)).toEqual(['One. Two.', 'Three. Four.']);
    expect(scriptLines('', 3)).toEqual([]);
  });
});

describe('wizard state → composition', () => {
  const build = () => {
    const s = createWizardState();
    toggleVideo(s, vid(1)); toggleVideo(s, vid(2, { kind: 'image', duration: 0 }));
    s.script.text = 'First line. Second line.';
    s.selectedTransition = { type: 'fade', duration: 1 };
    s.elements.title = 'Big Sale';
    return buildCompositionFromState(toBuilderState(s));
  };
  it('puts both clips on the media track with the transition between them', () => {
    const c = build();
    const media = c.tracks.find((t) => t.clips.some((x) => x.type === 'video'));
    expect(media.clips.map((x) => x.type)).toEqual(['video', 'image']);
    expect(c.transitions.length).toBe(1);
    expect(c.transitions[0].type).toBe('fade');
  });
  it('adds captions and a title as text clips', () => {
    const c = build();
    const texts = c.tracks.flatMap((t) => t.clips).filter((x) => x.type === 'text' || x.type === 'caption');
    expect(texts.map((x) => x.text)).toEqual(expect.arrayContaining(['First line.', 'Second line.', 'Big Sale']));
  });
  it('keeps the photographer credit on the clip asset', () => {
    const c = build();
    const first = c.tracks.flatMap((t) => t.clips).find((x) => x.type === 'video');
    expect(first.asset.credit).toEqual({ user: 'Ann', pageURL: 'https://p/1' });
  });
});

describe('stock providers (original file choice)', () => {
  it('Pexels: largest file under 1920px, SD preview', () => {
    const v = { id: 1, duration: 9, image: 'p.jpg', url: 'u', user: { name: 'Bo' }, video_files: [
      { link: 'a', width: 3840, quality: 'uhd' }, { link: 'b', width: 1920, quality: 'hd' }, { link: 'c', width: 1280, quality: 'hd' }, { link: 'd', width: 640, quality: 'sd' }] };
    expect(pexelsPlayFile(v.video_files).link).toBe('c');
    const n = normalizePexelsVideo(v);
    expect(n).toMatchObject({ id: 'pexels-1', kind: 'video', url: 'c', preview: 'd', user: 'Bo' });
  });
  it('Pixabay: skips videos over 60s, picks largest under 1920', () => {
    expect(normalizePixabayVideo({ id: 1, duration: 61, videos: { large: { url: 'l', width: 1920 } } })).toBeNull();
    const h = { id: 2, duration: 10, tags: 'sea, waves', user: 'Cy', videos: { large: { url: 'l', width: 1920 }, medium: { url: 'm', width: 1280 }, tiny: { url: 't', width: 640 } } };
    expect(pixabayPlayFile(h.videos).url).toBe('m');
    expect(normalizePixabayVideo(h)).toMatchObject({ title: 'Sea', url: 'm', preview: 't' });
  });
  it('Pixabay images must be copied', () => {
    expect(normalizePixabayImage({ id: 3, largeImageURL: 'L', tags: 'x' }).mustCopy).toBe(true);
  });
  it('searches the right client calls and paginates at 15', async () => {
    const calls = [];
    const mk = (name, key) => async (a) => { calls.push([name, a]); return { [key]: Array.from({ length: 15 }, (_, i) => ({ id: i, src: { large: 'u' }, photographer: 'P' })) }; };
    const stock = createStockClient({
      pexels: { searchPhotos: mk('searchPhotos', 'photos'), getCuratedPhotos: mk('curated', 'photos') },
      pixabay: { getCuratedPixabayImages: mk('pixCurated', 'hits') },
    });
    const a = await stock({ source: 'pexels', filter: 'photos', query: 'sea' });
    expect(calls[0][0]).toBe('searchPhotos');
    expect(a.hasMore).toBe(true);
    await stock({ source: 'pexels', filter: 'photos', query: '' });
    expect(calls[1][0]).toBe('curated');
    await stock({ source: 'pixabay', filter: 'vectors', query: '' });
    expect(calls[2][1].image_type).toBe('vector');
  });
  it('"All" merges videos and photos, interleaved', async () => {
    const mk = (key, n) => async () => ({ [key]: Array.from({ length: n }, (_, i) => ({ id: i, src: { large2x: 'u' }, photographer: 'P', video_files: [{ link: 'v' + i, width: 1280, quality: 'hd' }], user: { name: 'U' } })) });
    const stock = createStockClient({ pexels: { getPopularVideos: mk('videos', 15), getCuratedPhotos: mk('photos', 15) } });
    const r = await stock({ source: 'pexels', filter: 'all' });
    expect(r.items.length).toBe(30);
    expect(r.items.slice(0, 4).map((x) => x.kind)).toEqual(['video', 'image', 'video', 'image']);
    expect(r.hasMore).toBe(true);
  });
  it('"All" still shows one kind when the other fails', async () => {
    const stock = createStockClient({ pexels: {
      getPopularVideos: async () => { throw new Error('boom'); },
      getCuratedPhotos: async () => ({ photos: [{ id: 1, src: { large2x: 'u' } }] }),
    } });
    const r = await stock({ source: 'pexels', filter: 'all' });
    expect(r.items.length).toBe(1);
    expect(r.error).toBeUndefined();
  });
  it('turns a 503 into a key hint', async () => {
    const stock = createStockClient({ pexels: { getPopularVideos: async () => { const e = new Error('x'); e.status = 503; throw e; } } });
    const r = await stock({ source: 'pexels', filter: 'videos' });
    expect(r.error).toMatch(/Settings → API keys/);
  });
});

describe('upload + remote', () => {
  it('detects kinds', () => {
    expect(kindFromUrlOrType('a.MP4')).toBe('video');
    expect(kindFromUrlOrType('a.png?x=1')).toBe('image');
    expect(kindFromUrlOrType('a.txt')).toBeNull();
  });
  it('validates remote links', async () => {
    expect((await remoteItem('nope')).error).toBeTruthy();
    expect((await remoteItem('https://x.com/a.txt')).error).toBeTruthy();
    const r = await remoteItem('https://x.com/a.mp4', async () => ({ duration: 12 }));
    expect(r.item).toMatchObject({ kind: 'video', duration: 12 });
  });
});

describe('animations → composition overlays', () => {
  it('become overlay clips on an Animations track, timed against the footage', () => {
    const s = createWizardState();
    toggleVideo(s, vid(1)); toggleVideo(s, vid(2));            // 6 s + 6 s of footage = 12 s
    s.script.text = 'Hello.';
    s.selectedAnimations = [
      { id: 'a1', source: 'animations', title: 'Lower third', duration: 4, placeAt: 'spread' },
      { id: 'a2', source: 'animations', title: 'Bar chart', duration: 4, placeAt: 'spread' },
      { id: 'a3', source: 'endscreens', title: 'End screen', duration: 5, placeAt: 'end' },
    ];
    const c = buildCompositionFromState(toBuilderState(s, { a1: { overlay: { type: 'hyperframes', blockId: 'x' } } }));
    const track = c.tracks.find((t) => t.name === 'Animations');
    expect(track.clips.map((x) => [x.name, x.startTime, x.duration])).toEqual([['Lower third', 0, 4], ['Bar chart', 6, 4], ['End screen', 7, 5]]);
    expect(track.clips[0]._overlayConfig.animation.overlay.blockId).toBe('x');          // resolved payload travels with the clip
    expect(track.clips[1]._overlayConfig.animation.ref).toEqual({ id: 'a2', source: 'animations' }); // otherwise just the reference
  });
});
