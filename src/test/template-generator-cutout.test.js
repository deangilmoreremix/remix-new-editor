// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { STEPS, createWizardState } from '../components/modals/template-generator/rules.js';
import { createTemplateStore, snapshotTemplate, restoreTemplate } from '../components/modals/template-generator/templates.js';
import { removeClipBackground, canCutOut } from '../components/modals/template-generator/cutout.js';

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
    const out = await removeClipBackground(vid(1), { deps: { lib, upload } });
    expect(lib.removeVideoBackground).toHaveBeenCalledWith('https://x.test/1.webm', expect.objectContaining({ fromSec: 0, toSec: 8, maskEvery: 2, maxSize: 1280 }));
    expect(out).toEqual({ url: 'https://cdn.test/Clip_1-no-background.webm', durable: true });
    const img = { id: 'i', kind: 'image', title: 'Me', url: 'https://x.test/me.jpg' };
    lib.removeImageBackground.mockResolvedValue(new Blob(['p'], { type: 'image/png' }));
    expect((await removeClipBackground(img, { deps: { lib, upload } })).url).toMatch(/Me-no-background\.png$/);
  });

  it('refuses a cut-out that kept almost nothing (the model found no person), leaving the clip as it is', async () => {
    const lib = { removeVideoBackground: async () => new Blob(['w'], { type: 'video/webm' }) };
    const upload = vi.fn();
    await expect(removeClipBackground(vid(1), { deps: { lib, upload, opaqueShare: async () => 0.02 } })).rejects.toThrow(/Almost nothing was kept/);
    expect(upload).not.toHaveBeenCalled();
    await expect(removeClipBackground(vid(1), { deps: { lib, upload: async () => ({ url: 'https://cdn.test/x.webm' }), opaqueShare: async () => 0.4 } })).resolves.toMatchObject({ durable: true });
    await expect(removeClipBackground(vid(1), { deps: { lib, upload: async () => ({ url: 'https://cdn.test/x.webm' }), opaqueShare: async () => null } })).resolves.toBeTruthy();   // not measurable → trust it
  });

  it('falls back to a session-only link when the upload fails, and explains a blocked host', async () => {
    const ok = { removeVideoBackground: async () => new Blob(['w'], { type: 'video/webm' }) };
    const out = await removeClipBackground(vid(1), { deps: { lib: ok, upload: async () => { throw new Error('x'); }, localUrl: () => 'blob:local' } });
    expect(out).toEqual({ url: 'blob:local', durable: false });
    const blocked = { removeVideoBackground: async () => { throw new TypeError('Failed to fetch'); } };
    await expect(removeClipBackground(vid(1), { deps: { lib: blocked } })).rejects.toThrow(/host does not let the browser read/);
    const cancelled = { removeVideoBackground: async () => { throw Object.assign(new Error('Cancelled'), { name: 'AbortError' }); } };
    await expect(removeClipBackground(vid(1), { deps: { lib: cancelled } })).rejects.toMatchObject({ name: 'AbortError' });
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
