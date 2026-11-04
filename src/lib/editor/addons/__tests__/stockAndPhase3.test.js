import { describe, it, expect, vi } from 'vitest';
import {
  createStockSearch, normalizePixabayVideo, normalizePexelsVideo, normalizePixabayImage, normalizePexelsPhoto,
  renderStockBrowser, capturePreset, presetToClips, loadPresets, savePresets, fragmentFor,
  getAddon, createAddonClip, buildOverlayElement, renderAddonEditor, VIDEO_TRANSITIONS, STOCK_SOURCES,
} from '../index.js';

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};
const flush = () => new Promise((r) => setTimeout(r, 0));

const pixabayVideoHit = {
  id: 211191, tags: 'light leak, film burn, transition', duration: 10, user: 'cutter', pageURL: 'https://pixabay.com/videos/id-211191/',
  videos: { small: { url: 'https://cdn.pixabay.com/v/small.mp4', thumbnail: 'https://cdn.pixabay.com/v/small.jpg', width: 1280 }, tiny: { url: 'https://cdn.pixabay.com/v/tiny.mp4', width: 640 } },
};
const pexelsVideo = {
  id: 77, url: 'https://www.pexels.com/video/light-leaks-77/', image: 'https://images.pexels.com/v77.jpg', duration: 8, user: { name: 'Ana' },
  video_files: [{ link: 'https://v.pexels.com/sd.mp4', file_type: 'video/mp4', width: 640 }, { link: 'https://v.pexels.com/hd.mp4', file_type: 'video/mp4', width: 1280 }, { link: 'https://v.pexels.com/4k.mp4', file_type: 'video/mp4', width: 3840 }],
};
const pixabayImageHit = { id: 5, tags: 'office, desk', largeImageURL: 'https://pixabay.com/get/large.jpg', webformatURL: 'https://pixabay.com/get/web.jpg', previewURL: 'https://cdn.pixabay.com/p.jpg', user: 'u' };
const pexelsPhoto = { id: 9, alt: 'Team meeting', url: 'https://www.pexels.com/photo/team-9/', photographer: 'Bo', src: { large2x: 'https://images.pexels.com/9-l2.jpg', medium: 'https://images.pexels.com/9-m.jpg', tiny: 'https://images.pexels.com/9-t.jpg' } };

describe('stock media normalizers', () => {
  it('Pixabay video: small for playback, tiny for preview', () => {
    expect(normalizePixabayVideo(pixabayVideoHit)).toMatchObject({
      id: 'pixabay-211191', source: 'pixabay', name: 'light leak, film burn', src: 'https://cdn.pixabay.com/v/small.mp4',
      preview: 'https://cdn.pixabay.com/v/tiny.mp4', thumbnail: 'https://cdn.pixabay.com/v/small.jpg', duration: 10,
    });
  });
  it('Pexels video: ~1280 wide file, name from the page slug', () => {
    expect(normalizePexelsVideo(pexelsVideo)).toMatchObject({ id: 'pexels-77', source: 'pexels', name: 'light leaks', src: 'https://v.pexels.com/hd.mp4', preview: 'https://v.pexels.com/sd.mp4', user: 'Ana' });
  });
  it('images: Pixabay must be copied (no hotlinking), Pexels can be used directly', () => {
    expect(normalizePixabayImage(pixabayImageHit)).toMatchObject({ src: 'https://pixabay.com/get/large.jpg', mustCopy: true });
    const p = normalizePexelsPhoto(pexelsPhoto);
    expect(p).toMatchObject({ src: 'https://images.pexels.com/9-l2.jpg', thumbnail: 'https://images.pexels.com/9-t.jpg', name: 'Team meeting' });
    expect(p.mustCopy).toBeUndefined();
  });
});

describe('createStockSearch', () => {
  const clients = () => ({
    pixabay: { searchImages: vi.fn().mockResolvedValue({ hits: [pixabayImageHit] }), searchVideos: vi.fn().mockResolvedValue({ hits: [pixabayVideoHit] }) },
    pexels: { searchPhotos: vi.fn().mockResolvedValue({ photos: [pexelsPhoto] }), searchVideos: vi.fn().mockResolvedValue({ videos: [pexelsVideo] }) },
  });

  it('routes images/videos to each source and caches for 24h', async () => {
    const c = clients();
    const search = createStockSearch(c, { storage: memStorage() });
    expect((await search('videos', 'pixabay', 'light leak')).items[0].source).toBe('pixabay');
    expect((await search('videos', 'pexels', 'light leak')).items[0].source).toBe('pexels');
    expect((await search('images', 'pixabay', 'office')).items[0].mustCopy).toBe(true);
    expect((await search('images', 'pexels', 'team')).items[0].name).toBe('Team meeting');
    const again = await search('videos', 'pixabay', 'Light Leak');
    expect(again.cached).toBe(true);
    expect(c.pixabay.searchVideos).toHaveBeenCalledTimes(1);
    expect(c.pexels.searchVideos.mock.calls[0][0]).toMatchObject({ query: 'light leak', orientation: 'landscape' });
  });

  it('reports a friendly error when a proxy key is missing', async () => {
    const c = clients();
    c.pexels.searchPhotos.mockRejectedValue(Object.assign(new Error('PEXELS_API_KEY not configured'), { status: 503 }));
    const res = await createStockSearch(c, { storage: memStorage() })('images', 'pexels', 'x');
    expect(res).toMatchObject({ ok: false, error: "Pexels isn't connected on the server yet" });
  });
});

describe('Stock Media panel', () => {
  it('searches both sources for videos and images and adds the pick', async () => {
    const box = document.createElement('div');
    const search = vi.fn(async (kind, source) => ({ ok: true, items: [{ id: `${source}-${kind}`, name: `${source} ${kind}`, src: 'x', thumbnail: 't', duration: 4 }] }));
    const onPick = vi.fn();
    renderStockBrowser(box, { search, onPick });
    await flush();
    expect(search).toHaveBeenCalledWith('videos', 'pixabay', 'business');
    expect(box.querySelector('.addon-source-label').textContent).toContain('Videos from Pixabay');
    box.querySelector('[data-stock-source="pexels"]').click();
    await flush();
    expect(search).toHaveBeenLastCalledWith('videos', 'pexels', 'business');
    box.querySelector('[data-stock-kind="images"]').click();
    await flush();
    expect(search).toHaveBeenLastCalledWith('images', 'pexels', 'business');
    box.querySelector('[data-stock-pick="0"]').click();
    await flush();
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'pexels-images' }), 'images');
    box.querySelector('.stock-query').value = 'sunset';
    box.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    expect(search).toHaveBeenLastCalledWith('images', 'pexels', 'sunset');
  });
});

describe('Overlay Transitions + Video Transitions', () => {
  it('registers upstream Creative entries with defaults', () => {
    expect(getAddon('overlay-transition')).toMatchObject({ label: 'Overlay Transitions', section: 'Creative' });
    expect(getAddon('overlay-transition').defaults()).toMatchObject({ blendMode: 'screen', durationSec: 3 });
    expect(getAddon('overlay-video-transition').defaults().transition).toBe('fade');
    expect(VIDEO_TRANSITIONS.length).toBe(125);
    expect(VIDEO_TRANSITIONS[0]).toEqual(['fade', 'Fade']);
  });

  it('overlay transition renders a full-frame muted video', () => {
    const clip = createAddonClip('overlay-transition', { startSec: 0, timelineSeconds: 60, id: 'ot' });
    clip.addon.src = 'https://cdn.pixabay.com/v/small.mp4';
    const el = buildOverlayElement(clip);
    expect(el.classList.contains('popcorn-json-transition')).toBe(true);
    expect(el.querySelector('video').muted).toBe(true);
    expect(el.style.mixBlendMode).toBe('screen');
    expect(el.style.width).toBe('100%');
  });

  it('video transition renders a canvas and wraps gl-transition GLSL', () => {
    const clip = createAddonClip('overlay-video-transition', { startSec: 0, timelineSeconds: 60, id: 'vt' });
    const el = buildOverlayElement(clip);
    expect(el.querySelector('canvas')).not.toBeNull();
    expect(el.dataset.transition).toBe('fade');
    const frag = fragmentFor({ glsl: 'vec4 transition(vec2 uv){ return mix(getFromColor(uv), getToColor(uv), progress); }' });
    expect(frag).toContain('uniform sampler2D from, to;');
    expect(frag).toContain('gl_FragColor = transition(_uv);');
  });

  it('video picker: sources, categories, pick sets src + duration', async () => {
    const box = document.createElement('div');
    const onChange = vi.fn();
    const searchStock = vi.fn(async (kind, source) => ({ ok: true, items: [{ id: `${source}-1`, source, name: 'leak', src: `https://${source}/a.mp4`, preview: 'p', thumbnail: 't', duration: 12 }] }));
    const d = getAddon('overlay-transition');
    renderAddonEditor(box, { fields: d.fields, options: d.defaults(), onChange, services: { stockSources: STOCK_SOURCES, searchStock } });
    await flush();
    expect(searchStock).toHaveBeenCalledWith('videos', 'pixabay', 'light leak');
    box.querySelector('[data-vp-source="pexels"]').click();
    await flush();
    box.querySelector('[data-vp-tab="glitch"]').click();
    await flush();
    expect(searchStock).toHaveBeenLastCalledWith('videos', 'pexels', 'glitch transition');
    box.querySelector('[data-video-pick="0"]').click();
    expect(onChange.mock.calls.at(-1)[0]).toMatchObject({ src: 'https://pexels/a.mp4', source: 'pexels', durationSec: 8 });
    expect(box.textContent).toContain('Videos from Pexels');
  });

  it('image field searches stock and copies the pick via importStockImage', async () => {
    const box = document.createElement('div');
    const onChange = vi.fn();
    const searchStock = vi.fn(async () => ({ ok: true, items: [{ id: 'pixabay-5', src: 'https://pixabay.com/get/large.jpg', thumbnail: 't', mustCopy: true }] }));
    const importStockImage = vi.fn(async () => 'https://storage.test/copied.jpg');
    const d = getAddon('overlay-image');
    renderAddonEditor(box, { fields: d.fields, options: d.defaults(), onChange, services: { stockSources: STOCK_SOURCES, searchStock, importStockImage } });
    box.querySelector('.addon-img-query').value = 'logo';
    box.querySelector('[data-img-search]').click();
    await flush();
    expect(searchStock).toHaveBeenCalledWith('images', 'pixabay', 'logo');
    box.querySelector('[data-stock-image="0"]').click();
    await flush();
    expect(importStockImage).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)[0].src).toBe('https://storage.test/copied.jpg');
  });
});

describe('Presets (combined)', () => {
  const T = 60;
  const at = (id, type, start, end, addon) => ({ id, type, left: (start / T) * 100, width: ((end - start) / T) * 100, addon });
  it('captures overlays under the playhead and re-inserts them relative to a new start', () => {
    const tracks = [{ name: 'Text', items: [at(1, 'overlay-lower-third', 10, 15, { name: 'Ann' }), at(2, 'overlay-sticker', 11, 14, { src: '/s.png' }), at(3, 'addon-pause', 11, 12, {})] }];
    const preset = capturePreset(tracks, 12, T, 'Intro pack');
    expect(preset.items.map((i) => [i.type, i.offset])).toEqual([['overlay-lower-third', 0], ['overlay-sticker', 1]]);
    const clips = presetToClips(preset, 30, T, 100);
    expect(clips.map((c) => [c.id, c.type, c.start, c.end])).toEqual([[100, 'overlay-lower-third', 30, 35], [101, 'overlay-sticker', 31, 34]]);
    expect(clips[0].addon.name).toBe('Ann');
    expect(capturePreset(tracks, 40, T, 'x')).toBeNull();
  });
  it('persists presets', () => {
    const storage = memStorage();
    savePresets([{ id: 'p1', name: 'A', items: [] }], storage);
    expect(loadPresets(storage)).toEqual([{ id: 'p1', name: 'A', items: [] }]);
  });
});
