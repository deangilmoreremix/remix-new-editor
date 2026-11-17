// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureFrame, clearFrames, toVideoCard, announceVideo, clearSessionVideos, loadVideos, studioCounts, filterVideos, addVideo, subscribeNewVideos, studioLabel, VIDEO_CREATED_EVENT } from '../components/modals/ai-captions/library.js';

const H = (n, extra = {}) => ({ id: String(n), url: `https://cdn.test/${n}.mp4`, prompt: `Prompt ${n}`, studio: 'video', type: 'video', timestamp: new Date(2026, 0, n).toISOString(), ...extra });

describe('AI Captions — your videos', () => {
  beforeEach(() => clearSessionVideos());

  it('lists only videos, newest first, without duplicates', async () => {
    const load = async () => [H(1), H(3), H(2), H(2), { ...H(9), type: 'image' }, { ...H(8), type: 'audio' }, { id: 'x', type: 'video' }];
    const list = await loadVideos({ load });
    expect(list.map((v) => v.url)).toEqual(['https://cdn.test/3.mp4', 'https://cdn.test/2.mp4', 'https://cdn.test/1.mp4']);
  });

  it('puts the clip the studio passed first, even when it is not in the history, and never twice', async () => {
    const load = async () => [H(1), H(2)];
    const a = await loadVideos({ load, current: { url: 'https://cdn.test/new.mp4', title: 'Fresh' } });
    expect(a[0]).toMatchObject({ url: 'https://cdn.test/new.mp4', title: 'Fresh' });
    expect(a).toHaveLength(3);
    const b = await loadVideos({ load, current: { url: 'https://cdn.test/1.mp4' } });
    expect(b[0].url).toBe('https://cdn.test/1.mp4');
    expect(b.filter((v) => v.url === 'https://cdn.test/1.mp4')).toHaveLength(1);
  });

  it('survives a history that cannot be read', async () => {
    expect(await loadVideos({ load: async () => { throw new Error('offline'); } })).toEqual([]);
  });

  it('includes videos announced in this tab (a Template Generator export, a captioned render)', async () => {
    const seen = [];
    window.addEventListener(VIDEO_CREATED_EVENT, (e) => seen.push(e.detail.card.url));
    announceVideo({ url: 'blob:test/1', title: 'Template Generator video', studio: 'template-generator' });
    announceVideo({ url: 'blob:test/1' });                       // same video again: still one card
    expect(seen).toEqual(['blob:test/1', 'blob:test/1']);
    const list = await loadVideos({ load: async () => [H(1)] });
    expect(list.filter((v) => v.url === 'blob:test/1')).toHaveLength(1);
    expect(list.find((v) => v.url === 'blob:test/1').label).toBe('Template Generator');
    expect(announceVideo({})).toBeNull();
  });

  it('counts studios, filters by studio and search, and adds new cards on top', () => {
    const v = [toVideoCard(H(1, { studio: 'avatar', prompt: 'A dentist' })), toVideoCard(H(2, { studio: 'avatar' })), toVideoCard(H(3, { studio: 'lipsync', prompt: 'Roofing tips' }))];
    expect(studioCounts(v)).toEqual([['all', 'All videos', 3], ['avatar', 'Avatar', 2], ['lipsync', 'Lip sync', 1]]);
    expect(filterVideos(v, { studio: 'avatar' })).toHaveLength(2);
    expect(filterVideos(v, { query: 'roof' })).toHaveLength(1);
    expect(filterVideos(v, { query: 'DENTIST', studio: 'avatar' })).toHaveLength(1);
    const card = toVideoCard(H(4));
    expect(addVideo(v, card)[0]).toBe(card);
    expect(addVideo(v, v[0])).toBe(v);
    expect(studioLabel('some-new-studio')).toBe('Some New Studio');
  });

  it('hears about a video a studio just saved (generation:saved) and stops when told to', () => {
    const got = [];
    const stop = subscribeNewVideos((c) => got.push(c));
    const fire = (entry, studio) => window.dispatchEvent(new CustomEvent('generation:saved', { detail: { entry, studio } }));
    fire(H(5), 'cinema');
    fire({ ...H(6), type: 'image' }, 'image');                    // not a video
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ url: 'https://cdn.test/5.mp4', label: 'Cinema' });
    stop();
    fire(H(7), 'cinema');
    expect(got).toHaveLength(1);
  });
});

describe('AI Captions — a real frame of the picked video', () => {
  it('gives up with null (so the bundled photo shows) when the video cannot be read', async () => {
    clearFrames();
    expect(await captureFrame('')).toBeNull();
    const doc = { createElement: () => { const v = { removeAttribute() {}, load() {}, set src(_) { setTimeout(() => v.onerror?.(), 0); } }; return v; } };
    expect(await captureFrame('https://cdn.test/a.mp4', { doc })).toBeNull();
  });

  it('draws the frame to a data URL when the browser can read it', async () => {
    clearFrames();
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,FRAME' };
    const doc = { createElement: (t) => {
      if (t === 'canvas') return canvas;
      const v = { videoWidth: 960, videoHeight: 540, duration: 4, removeAttribute() {}, load() {}, set src(_) { setTimeout(() => { v.onloadedmetadata?.(); setTimeout(() => v.onseeked?.(), 0); }, 0); } };
      return v;
    } };
    expect(await captureFrame('https://cdn.test/b.mp4', { doc })).toBe('data:image/jpeg;base64,FRAME');
    expect(canvas.width).toBe(480);                                  // scaled down
  });
});
