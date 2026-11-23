// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

vi.mock('../engines.js', async (orig) => ({
  ...(await orig()),
  detectCapabilities: async () => ({ webgpu: false, wasm: true }),
  transcribeMedia: vi.fn(async () => ({ captions: ['Welcome', ' to', ' HarborDental.', ' Book', ' today'].map((text, i) => ({ text, startMs: i * 400, endMs: i * 400 + 400, timestampMs: i * 400 + 200, confidence: null })) })),
}));
vi.mock('../burn.js', () => ({ burnCaptions: vi.fn(async () => ({ url: 'blob:out/1', ext: 'mp4', blob: { size: 4321 } })) }));

import { CaptionStudioModal } from '../modal.js';
import { transcribeMedia } from '../engines.js';
import * as history from '../history.js';
import { clearJobs, saveJob, listJobs } from '../history.js';
import { announceVideo, clearSessionVideos, loadVideos, studioCounts, filterVideos, addVideo, subscribeNewVideos, captureFrame, clearFrames, toVideoCard, studioLabel, VIDEO_CREATED_EVENT } from '../videos.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
const q = (s) => document.querySelector(s);
const click = (s) => { const el = q(s); if (!el) throw new Error(`missing ${s}`); el.click(); };
const V = (n, extra = {}) => ({ id: String(n), url: `https://cdn.test/${n}.mp4`, title: `Video ${n}`, studio: 'video', createdAt: new Date(2026, 0, n).toISOString(), ...extra });
const open = (opts = {}) => { const m = new CaptionStudioModal(opts); m.open(); return m; };

beforeAll(() => {
  vi.stubGlobal('indexedDB', undefined);
  let n = 0; URL.createObjectURL = vi.fn(() => `blob:t/${n += 1}`); URL.revokeObjectURL = vi.fn();
  HTMLMediaElement.prototype.play = vi.fn(async () => {}); HTMLMediaElement.prototype.pause = vi.fn(); HTMLMediaElement.prototype.load = vi.fn();
});
afterEach(async () => { document.body.innerHTML = ''; clearSessionVideos(); clearFrames(); await clearJobs(); vi.clearAllMocks(); });

describe('Caption Studio — your videos (core helpers)', () => {
  it('lists the host videos newest first without duplicates, the opening clip first', async () => {
    const list = await loadVideos({ load: async () => [V(1), V(3), V(2), V(2), { id: 'x' }], current: { url: 'https://cdn.test/mine.mp4', title: 'Mine' } });
    expect(list.map((v) => v.url)).toEqual(['https://cdn.test/mine.mp4', 'https://cdn.test/3.mp4', 'https://cdn.test/2.mp4', 'https://cdn.test/1.mp4']);
    expect(await loadVideos({ load: async () => { throw new Error('offline'); } })).toEqual([]);
    expect(await loadVideos({})).toEqual([]);
  });
  it('knows about videos made in this tab', async () => {
    const seen = []; window.addEventListener(VIDEO_CREATED_EVENT, (e) => seen.push(e.detail.card.url));
    announceVideo({ url: 'blob:x/1', title: 'Timeline export', studio: 'cinegen' }); announceVideo({ url: 'blob:x/1' });
    expect(seen).toHaveLength(2);
    const list = await loadVideos({ load: async () => [V(1)] });
    expect(list.filter((v) => v.url === 'blob:x/1')).toHaveLength(1);
    expect(list.find((v) => v.url === 'blob:x/1').label).toBe('Timeline');
    expect(announceVideo({})).toBeNull();
  });
  it('counts, filters, adds and subscribes (host watcher too)', () => {
    const v = [toVideoCard(V(1, { studio: 'avatar', title: 'A dentist' })), toVideoCard(V(2, { studio: 'avatar' })), toVideoCard(V(3, { studio: 'lipsync', title: 'Roofing' }))];
    expect(studioCounts(v)).toEqual([['all', 'All videos', 3], ['avatar', 'Avatar', 2], ['lipsync', 'Lip sync', 1]]);
    expect(filterVideos(v, { studio: 'avatar' })).toHaveLength(2);
    expect(filterVideos(v, { query: 'roof' })).toHaveLength(1);
    const c = toVideoCard(V(4)); expect(addVideo(v, c)[0]).toBe(c); expect(addVideo(v, v[0])).toBe(v);
    expect(studioLabel('weird-new')).toBe('Weird New');
    const got = []; let hostCb; const stopHost = vi.fn();
    const stop = subscribeNewVideos((card) => got.push(card.url), { watch: (cb) => { hostCb = cb; return stopHost; } });
    hostCb(V(9)); announceVideo({ url: 'blob:y/1' });
    expect(got).toEqual(['https://cdn.test/9.mp4', 'blob:y/1']);
    stop(); expect(stopHost).toHaveBeenCalled();
  });
  it('gives up with null when a video cannot be read, and draws a data URL when it can', async () => {
    expect(await captureFrame('')).toBeNull();
    const bad = { createElement: () => { const v = { removeAttribute() {}, load() {}, set src(_) { setTimeout(() => v.onerror?.(), 0); } }; return v; } };
    expect(await captureFrame('https://cdn.test/a.mp4', { doc: bad })).toBeNull();
    clearFrames();
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,FRAME' };
    const good = { createElement: (t) => t === 'canvas' ? canvas : (() => { const v = { videoWidth: 960, videoHeight: 540, duration: 4, removeAttribute() {}, load() {}, set src(_) { setTimeout(() => { v.onloadedmetadata?.(); setTimeout(() => v.onseeked?.(), 0); }, 0); } }; return v; })() };
    expect(await captureFrame('https://cdn.test/b.mp4', { doc: good })).toBe('data:image/jpeg;base64,FRAME');
    expect(canvas.width).toBe(480);
  });
});

describe('Caption Studio — your videos and history in the window', () => {
  it('lists the videos made in the app, picks the newest and loads it, no upload', async () => {
    const m = open({ videoLibrary: async () => [V(1), V(3, { studio: 'avatar' }), V(2)] });
    await flush(); await flush();
    expect(document.querySelectorAll('[data-testid="csm-vcard"]')).toHaveLength(3);
    expect(m.srcUrl).toBe('https://cdn.test/3.mp4');
    expect(q('.csm-vcard.on').textContent).toContain('Video 3');
    expect(q('[data-act="lib-studio"][data-v="avatar"]').textContent).toContain('1');
    click('[data-act="pick-video"][data-id="1"]');
    expect(m.srcUrl).toBe('https://cdn.test/1.mp4');
    m.close();
  });
  it('keeps the clip the studio passed, picked and first; searches; adds a video made while open', async () => {
    let hostCb; const stop = vi.fn();
    const m = open({ videoUrl: 'https://cdn.test/mine.mp4', videoLibrary: async () => [V(1, { title: 'Dentist ad' })], watchVideos: (cb) => { hostCb = cb; return stop; } });
    await flush(); await flush();
    expect(m.srcUrl).toBe('https://cdn.test/mine.mp4');
    expect(document.querySelectorAll('[data-testid="csm-vcard"]')).toHaveLength(2);
    hostCb(V(5, { title: 'Roofing promo' }));
    expect(document.querySelectorAll('[data-testid="csm-vcard"]')).toHaveLength(3);
    const s = q('[data-lib-q]'); s.value = 'dentist'; s.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelectorAll('[data-testid="csm-vcard"]')).toHaveLength(1);
    m.close(); expect(stop).toHaveBeenCalled();
  });
  it('with no videos yet it opens on the upload form', async () => {
    const m = open({});
    await flush(); await flush();
    expect(m.source).toBe('upload'); expect(q('[data-drop]')).toBeTruthy();
    click('[data-act="src"][data-s="library"]'); expect(q('[data-testid="csm-vempty"]').textContent).toContain('No videos made yet');
    m.close();
  });
  it('captions the picked video, saves the job to History and lists it with its details', async () => {
    const m = open({ videoLibrary: async () => [V(1)] });
    await flush(); await flush();
    await m.generate(); await flush(); await flush();
    expect(transcribeMedia.mock.calls[0][0]).toBe('https://cdn.test/1.mp4');
    expect(m.captions.length).toBe(5);
    const jobs = await listJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ title: 'Video 1', sourceUrl: 'https://cdn.test/1.mp4' });
    click('[data-act="tab"][data-tab="history"]');
    await flush(); await flush();
    const job = q('[data-testid="csm-job"]');
    for (const label of ['Duration', 'Language', 'Caption style', 'Processing time', 'File size', 'Created']) expect(job.textContent).toContain(label);
    m.close();
  });
  it('opens a job again and deletes it; a rendered video is announced and saved', async () => {
    await saveJob({ id: 'j1', title: 'old.mp4', durationSec: 5, language: 'en', lookName: 'Hormozi', createdAt: 1, captions: [{ text: 'Hi', startMs: 0, endMs: 300, timestampMs: 150, confidence: null }, { text: ' there', startMs: 300, endMs: 600, timestampMs: 450, confidence: null }], style: {}, sourceUrl: 'https://cdn.test/old.mp4' });
    const m = open({});
    await flush(); await flush();
    click('[data-act="tab"][data-tab="history"]'); await flush(); await flush();
    click('[data-act="job-open"][data-id="j1"]'); await flush(); await flush();
    expect(m.tab).toBe('edit'); expect(m.captions).toHaveLength(2); expect(m.srcUrl).toBe('https://cdn.test/old.mp4');
    const seen = []; window.addEventListener(VIDEO_CREATED_EVENT, (e) => seen.push(e.detail.card.title));
    await m.renderVideo(); await flush(); await flush();
    expect(seen[0]).toContain('(captioned)');
    expect((await listJobs())[0].fileSize).toBe(4321);
    click('[data-act="tab"][data-tab="history"]'); await flush();
    click('[data-act="job-del"]'); await flush(); await flush();
    expect(q('[data-testid="csm-history-empty"]')).toBeTruthy();
    m.close();
  });
  it('shows each look on a real picture (the video\'s frame, else the host\'s sample image), never a placeholder', async () => {
    const m = open({ videoLibrary: async () => [V(1)], sampleImage: '/library-previews/sample-in.jpg' });
    await flush(); await flush();
    click('[data-act="tab"][data-tab="style"]');
    expect(q('.csm-pic').getAttribute('style')).toContain('/library-previews/sample-in.jpg');
    m.frame = 'data:image/jpeg;base64,REAL'; m.refresh();
    expect(q('.csm-pic').getAttribute('style')).toContain('data:image/jpeg;base64,REAL');
    expect(q('.csm-pic span').textContent).toBe('Make it pop');
    const none = new CaptionStudioModal({}); none.frame = ''; expect(none.lookPic({ fontFamily: 'Inter', color: '#fff' })).toBe('');
    m.close();
  });
});

describe('review fixes: history jobs', () => {
  const caps = [{ text: 'Hi', startMs: 0, endMs: 300, timestampMs: 150, confidence: null }, { text: ' there', startMs: 300, endMs: 600, timestampMs: 450, confidence: null }];
  it('a job with no kept video does not stay attached to the video picked before', async () => {
    await saveJob({ id: 'j9', title: 'gone.mp4', durationSec: 2, language: 'en', lookName: 'Hormozi', createdAt: 1, captions: caps, style: {} });
    const m = open({ videoLibrary: async () => [V(1)] });
    await flush(); await flush();
    expect(m.srcUrl).toBe('https://cdn.test/1.mp4');
    await m.openJob('j9'); await flush();
    expect(m.srcUrl).toBe(''); expect(m.selectedUrl).toBe(''); expect(m.result).toBeNull();
    expect(m.captions).toHaveLength(2); expect(m.jobId).toBe('j9');
    m.close();
  });
  it('reopening a job restores the language code, not the display label, and the History shows the label', async () => {
    await saveJob({ id: 'j8', title: 'a.mp4', durationSec: 2, language: 'auto', languageLabel: 'auto · en', lookName: 'Hormozi', createdAt: 1, captions: caps, style: {}, sourceUrl: 'https://cdn.test/a.mp4' });
    await saveJob({ id: 'j7', title: 'old.mp4', durationSec: 2, language: 'auto · en', lookName: 'Hormozi', createdAt: 2, captions: caps, style: {}, sourceUrl: 'https://cdn.test/o.mp4' });   // saved before the fix
    const m = open({});
    await flush(); await flush();
    document.querySelector('[data-act="tab"][data-tab="history"]').click(); await flush(); await flush();
    expect(document.querySelector('[data-testid="csm-jobs"]').textContent).toContain('auto · en');
    await m.openJob('j8'); expect(m.language).toBe('auto');
    await m.openJob('j7'); expect(m.language).toBe('auto');
    m.close();
  });
  it('edits to the words or the look reach the history job without rendering', async () => {
    const m = open({ videoLibrary: async () => [V(1)] });
    await flush(); await flush();
    await m.generate(); await flush(); await flush();
    const id = (await listJobs())[0].id;
    m.captions = m.captions.map((c, i) => (i === 0 ? { ...c, text: 'Edited' } : c)); m.style = { ...m.style, color: '#ff0000' };
    m.queueSave();
    await new Promise((r) => setTimeout(r, 700)); await flush(); await flush();
    const job = (await listJobs()).find((j) => j.id === id);
    expect(job.captions[0].text).toBe('Edited'); expect(job.style.color).toBe('#ff0000');
    expect(job.createdAt).toBeLessThanOrEqual(Date.now());
    m.close();
  });
  it('saving edits does not re-render the window or loop, and unchanged captions are not rewritten', async () => {
    const spy = vi.spyOn(history, 'updateJob');
    const m = open({ videoLibrary: async () => [V(1)] });
    await flush(); await flush();
    await m.generate(); await flush(); await flush();
    document.querySelector('[data-act="tab"][data-tab="history"]').click();
    spy.mockClear();
    const refresh = vi.spyOn(m, 'refresh');
    await new Promise((r) => setTimeout(r, 1800));                     // several autosave periods on the History tab
    expect(spy).not.toHaveBeenCalled();                                // nothing changed: nothing written
    refresh.mockClear();
    m.captions = m.captions.map((c, i) => (i === 0 ? { ...c, text: 'Changed' } : c)); m.queueSave();
    await new Promise((r) => setTimeout(r, 1800));
    expect(spy).toHaveBeenCalledTimes(1);                              // written once, then quiet
    expect(refresh).not.toHaveBeenCalled();                            // and the write did not re-render
    m.close();
  });
  it('a failed frame capture is not remembered, so the next try can succeed', async () => {
    clearFrames();
    const bad = { createElement: () => { const v = { removeAttribute() {}, load() {}, set src(_) { setTimeout(() => v.onerror?.(), 0); } }; return v; } };
    expect(await captureFrame('https://cdn.test/retry.mp4', { doc: bad })).toBeNull();
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,OK' };
    const good = { createElement: (t) => t === 'canvas' ? canvas : (() => { const v = { videoWidth: 640, videoHeight: 360, duration: 4, removeAttribute() {}, load() {}, set src(_) { setTimeout(() => { v.onloadedmetadata?.(); setTimeout(() => v.onseeked?.(), 0); }, 0); } }; return v; })() };
    expect(await captureFrame('https://cdn.test/retry.mp4', { doc: good })).toBe('data:image/jpeg;base64,OK');
  });
});
