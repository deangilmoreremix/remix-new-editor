// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { STEPS, createWizardState } from '../components/modals/template-generator/rules.js';
import { createTemplateStore, snapshotTemplate, restoreTemplate } from '../components/modals/template-generator/templates.js';
import { removeClipBackground, canCutOut } from '../components/modals/template-generator/cutout.js';
import { makeBg0Engine, toSupportedBlob } from '../components/modals/template-generator/bg0Engine.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const vid = (n, extra = {}) => ({ id: `v${n}`, kind: 'video', source: 'template-video', title: `Clip ${n}`, url: `https://x.test/${n}.webm`, preview: `https://x.test/${n}.webm`, poster: `https://x.test/${n}.jpg`, duration: 15, ...extra });

describe('cut-out service', () => {
  it('photos can always be cut out; video needs WebCodecs', () => {
    expect(canCutOut({ kind: 'image' }, {})).toBe(true);
    expect(canCutOut({ kind: 'video' }, {})).toBe(false);
    expect(canCutOut({ kind: 'video' }, { VideoEncoder: function VideoEncoder() {} })).toBe(true);
  });

  it('cuts out only the part the template uses (8 s of a 15 s clip), stores the result, and returns its link', async () => {
    const lib = { removeVideoBackground: vi.fn(async () => new Blob(['w'], { type: 'video/webm' })), removeImageBackground: vi.fn() };
    const upload = vi.fn(async (f) => ({ url: `https://cdn.test/${f.name}` }));
    const out = await removeClipBackground(vid(1), { deps: { lib, upload, bg0: null } });
    expect(lib.removeVideoBackground).toHaveBeenCalledWith('https://x.test/1.webm', expect.objectContaining({ fromSec: 0, toSec: 8, maskEvery: 2, maxSize: 1280 }));
    expect(out).toEqual({ url: 'https://cdn.test/Clip_1-no-background.webm', durable: true, engine: 'modnet' });
    const img = { id: 'i', kind: 'image', title: 'Me', url: 'https://x.test/me.jpg' };
    lib.removeImageBackground.mockResolvedValue(new Blob(['p'], { type: 'image/png' }));
    expect((await removeClipBackground(img, { deps: { lib, upload, bg0: null, opaqueShare: async () => null } })).url).toMatch(/Me-no-background\.png$/);
  });

  it('refuses a cut-out that kept almost nothing (the model found no person), leaving the clip as it is', async () => {
    const lib = { removeVideoBackground: async () => new Blob(['w'], { type: 'video/webm' }) };
    const upload = vi.fn();
    await expect(removeClipBackground(vid(1), { deps: { lib, upload, bg0: null, opaqueShare: async () => 0.02 } })).rejects.toThrow(/Almost nothing was kept/);
    expect(upload).not.toHaveBeenCalled();
    await expect(removeClipBackground(vid(1), { deps: { lib, upload: async () => ({ url: 'https://cdn.test/x.webm' }), bg0: null, opaqueShare: async () => 0.4 } })).resolves.toMatchObject({ durable: true });
    await expect(removeClipBackground(vid(1), { deps: { lib, upload: async () => ({ url: 'https://cdn.test/x.webm' }), bg0: null, opaqueShare: async () => null } })).resolves.toBeTruthy();   // not measurable → trust it
  });

  it('falls back to a session-only link when the upload fails, and explains a blocked host', async () => {
    const ok = { removeVideoBackground: async () => new Blob(['w'], { type: 'video/webm' }) };
    const out = await removeClipBackground(vid(1), { deps: { lib: ok, upload: async () => { throw new Error('x'); }, localUrl: () => 'blob:local', bg0: null, opaqueShare: async () => null } });
    expect(out).toMatchObject({ url: 'blob:local', durable: false });
    const blocked = { removeVideoBackground: async () => { throw new TypeError('Failed to fetch'); } };
    await expect(removeClipBackground(vid(1), { deps: { lib: blocked, bg0: null } })).rejects.toThrow(/host does not let the browser read/);
    const cancelled = { removeVideoBackground: async () => { throw Object.assign(new Error('Cancelled'), { name: 'AbortError' }); } };
    await expect(removeClipBackground(vid(1), { deps: { lib: cancelled, bg0: null } })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('BG0 engine (the better model) with MODNet as the fallback', () => {
  const upload = async (f) => ({ url: `https://cdn.test/${f.name}` });
  const png = () => new Blob(['p'], { type: 'image/png' });
  const photo = { id: 'i', kind: 'image', title: 'Me', url: 'https://x.test/me.jpg' };
  const fetched = () => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['j'], { type: 'image/jpeg' }) })));
  afterEach(() => vi.unstubAllGlobals());

  it('a photo goes through BG0 and the older model is not touched', async () => {
    fetched();
    const bg0 = { removeImage: vi.fn(async () => png()), maskFn: vi.fn(), prepare: vi.fn() };
    const lib = { removeImageBackground: vi.fn(), removeVideoBackground: vi.fn() };
    const out = await removeClipBackground(photo, { deps: { lib, bg0, upload, opaqueShare: async () => 0.5 } });
    expect(bg0.removeImage).toHaveBeenCalledTimes(1); expect(lib.removeImageBackground).not.toHaveBeenCalled();
    expect(out).toMatchObject({ engine: 'bg0', durable: true });
  });

  it('a video uses BG0 on sampled frames (masks within a time budget) through the video pipeline', async () => {
    const bg0 = { removeImage: vi.fn(), maskFn: vi.fn(), prepare: vi.fn() };
    const lib = { removeVideoBackground: vi.fn(async () => new Blob(['w'], { type: 'video/webm' })), removeImageBackground: vi.fn() };
    const out = await removeClipBackground(vid(1), { deps: { lib, bg0, upload, opaqueShare: async () => 0.4 } });
    expect(lib.removeVideoBackground).toHaveBeenCalledTimes(1);
    expect(lib.removeVideoBackground.mock.calls[0][1]).toMatchObject({ toSec: 8, maxSize: 720, maskFn: bg0.maskFn, prepare: bg0.prepare, maskBudgetSec: 90 });
    expect(out.engine).toBe('bg0');
  });

  it('if BG0 cannot run (model fails to load) the older model takes over; an unreadable host or a cancel is not hidden', async () => {
    fetched();
    const lib = { removeImageBackground: vi.fn(async () => png()), removeVideoBackground: vi.fn() };
    const broken = { removeImage: vi.fn(async () => { throw Object.assign(new Error('model failed to load'), { code: 'model-load-failed' }); }), maskFn: vi.fn(), prepare: vi.fn() };
    const out = await removeClipBackground(photo, { deps: { lib, bg0: broken, upload, opaqueShare: async () => 0.5 } });
    expect(lib.removeImageBackground).toHaveBeenCalledTimes(1); expect(out.engine).toBe('modnet');
    const blocked = { removeImage: async () => { throw new TypeError('Failed to fetch'); }, maskFn: vi.fn(), prepare: vi.fn() };
    await expect(removeClipBackground(photo, { deps: { lib, bg0: blocked, upload } })).rejects.toThrow(/host does not let the browser read/);
    const cancelled = { removeImage: async () => { throw Object.assign(new Error('Cancelled'), { code: 'cancelled' }); }, maskFn: vi.fn(), prepare: vi.fn() };
    await expect(removeClipBackground(photo, { deps: { lib, bg0: cancelled, upload } })).rejects.toMatchObject({ name: 'AbortError' });
    expect(lib.removeImageBackground).toHaveBeenCalledTimes(1);                  // not called again after the cancel
  });

  it('the engine wrapper passes quality "fast", maps progress stages, and keeps supported image types as they are', async () => {
    const seen = [];
    const m = { removeAssetBackground: vi.fn(async (b, o) => { o.onProgress({ stage: 'downloading', progress: 0.5 }); o.onProgress({ stage: 'processing', progress: 0.9 }); return { blob: png() }; }), prefetchBackgroundRemovalModel: vi.fn(async () => {}) };
    const e = makeBg0Engine(m);
    await e.removeImage(new Blob(['x'], { type: 'image/webp' }), { onProgress: (p) => seen.push(p) });
    expect(m.removeAssetBackground.mock.calls[0][1].quality).toBe('fast');
    expect(seen).toEqual([{ stage: 'download', progress: 0.5 }, { stage: 'process', progress: 0.9 }]);
    await e.prepare(); expect(m.prefetchBackgroundRemovalModel).toHaveBeenCalled();
    const same = new Blob(['x'], { type: 'image/png' });
    expect(await toSupportedBlob(same)).toBe(same);
  });
});

describe('Preview step — cut out a clip', () => {
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });
  const open = (extra = {}) => {
    vi.stubGlobal('VideoEncoder', function VideoEncoder() {});
    const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', templateCatalog: async () => { throw new Error('offline'); }, stockSearch: async () => ({ items: [], hasMore: false }), templateStore: createTemplateStore(memory()), ...extra });
    m.open(); const s = createWizardState(); s.selectedVideos = [vid(1), vid(2)]; s.script.text = 'One.\nTwo.'; Object.assign(m.s, s); m.s.started = true; m.s.step = STEPS.PREVIEW; m.paint();
    return m;
  };

  it('swaps in the cut-out, offers the original back, and restores it', async () => {
    const bgRemover = vi.fn(async () => ({ url: 'https://cdn.test/cut.webm', durable: true }));
    const m = open({ bgRemover });
    const btn = document.querySelector('[data-act="bg-remove"][data-id="v1"]');
    expect(btn.disabled).toBe(false);
    btn.click();
    await vi.waitFor(() => expect(m.s.selectedVideos[0].url).toBe('https://cdn.test/cut.webm'));
    expect(m.s.selectedVideos[0].bgRemoval.originalUrl).toBe('https://x.test/1.webm');
    expect(document.querySelector('[data-act="bg-restore"][data-id="v1"]')).toBeTruthy();
    expect(m.s.selectedVideos[1].url).toBe('https://x.test/2.webm');               // the other clip is untouched
    document.querySelector('[data-act="bg-restore"][data-id="v1"]').click();
    expect(m.s.selectedVideos[0].url).toBe('https://x.test/1.webm'); expect(m.s.selectedVideos[0].bgRemoval).toBeUndefined();
    m.destroy();
  });

  it('shows progress, can be cancelled without changing the clip, and shows failures', async () => {
    let resolveAbort;
    const bgRemover = vi.fn((it, { signal, onProgress }) => new Promise((_, reject) => { onProgress({ stage: 'process', progress: 0.4, etaSec: 20 }); signal.addEventListener('abort', () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' }))); resolveAbort = true; }));
    const m = open({ bgRemover });
    document.querySelector('[data-act="bg-remove"][data-id="v1"]').click();
    await vi.waitFor(() => expect(document.querySelector('.tg-bgprogress').textContent).toContain('40%'));
    expect(document.querySelector('[data-act="bg-remove"][data-id="v2"]').disabled).toBe(true);   // one at a time
    document.querySelector('[data-act="bg-cancel"]').click();
    await vi.waitFor(() => expect(m.ui.bg.busy).toBe(false));
    expect(m.s.selectedVideos[0].url).toBe('https://x.test/1.webm');
    m.bgRemover = async () => { throw new Error('This clip\'s host does not let the browser read the file.'); };
    document.querySelector('[data-act="bg-remove"][data-id="v1"]').click();
    await vi.waitFor(() => expect(document.querySelector('#tg-bgstatus .tg-status--error').textContent).toContain('host does not let'));
    m.destroy();
  });

  it('is unavailable without WebCodecs, and a saved template keeps the cut-out and its original', async () => {
    const m = open({ bgRemover: async () => ({ url: 'https://cdn.test/cut.webm', durable: true }) });
    document.querySelector('[data-act="bg-remove"][data-id="v1"]').click();
    await vi.waitFor(() => expect(m.s.selectedVideos[0].bgRemoval).toBeTruthy());
    const rec = JSON.parse(JSON.stringify(snapshotTemplate(m.s, { name: 'T' })));
    expect(rec.clips[0]).toMatchObject({ url: 'https://cdn.test/cut.webm', bgRemoval: { originalUrl: 'https://x.test/1.webm' } });
    m.destroy();
    vi.unstubAllGlobals(); document.body.innerHTML = '';
    const m2 = new TemplateGeneratorModal({ defaultProvider: 'pixabay', templateCatalog: async () => { throw new Error('offline'); }, stockSearch: async () => ({ items: [], hasMore: false }), templateStore: createTemplateStore(memory()) });
    m2.open(); const s = createWizardState(); s.selectedVideos = [vid(1)]; Object.assign(m2.s, s); m2.s.started = true; m2.s.step = STEPS.PREVIEW; m2.paint();
    expect(document.querySelector('[data-act="bg-remove"]').disabled).toBe(true);
    m2.destroy();
  });
});
