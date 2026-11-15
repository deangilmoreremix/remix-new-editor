// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { STEPS, createWizardState } from '../components/modals/template-generator/rules.js';
import { createTemplateStore } from '../components/modals/template-generator/templates.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const vid = (n) => ({ id: `v${n}`, kind: 'video', source: 'template-video', title: `Clip ${n}`, url: `https://x.test/${n}.webm`, poster: `https://x.test/${n}.jpg`, duration: 6 });

describe('Preview step — Export video', () => {
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });
  const open = ({ encoder = true, script = 'Come in today.\nBook your table.', ...extra } = {}) => {
    if (encoder) vi.stubGlobal('VideoEncoder', function VideoEncoder() {});
    const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', templateCatalog: async () => { throw new Error('offline'); }, stockSearch: async () => ({ items: [], hasMore: false }), templateStore: createTemplateStore(memory()), ...extra });
    m.open(); const s = createWizardState(); s.selectedVideos = [vid(1), vid(2)]; s.script.text = script; s.elements.title = 'Summer Sale'; Object.assign(m.s, s); m.s.started = true; m.s.step = STEPS.PREVIEW; m.paint();
    return m;
  };

  it('has no Export button when the host cannot render (e.g. the classic editor)', () => {
    const m = open();
    expect(document.querySelector('#tg-export')).toBeNull();
    m.destroy();
  });

  it('renders the template on its own: the host gets the full composition (footage + styled text), progress shows, and the result is reported', async () => {
    let seen;
    const exportVideo = vi.fn(async ({ composition, onProgress }) => { seen = composition; onProgress(0.5); await Promise.resolve(); onProgress(1); return { filename: 'cinegen-export.mp4', fileSize: 3 * 1048576 }; });
    const m = open({ exportVideo });
    const btn = document.querySelector('#tg-export'); expect(btn.disabled).toBe(false);
    btn.click();
    await vi.waitFor(() => expect(document.querySelector('#tg-exportstatus .tg-status').textContent).toContain('Exported cinegen-export.mp4 (3.0 MB)'));
    expect(exportVideo).toHaveBeenCalledTimes(1);
    expect(seen.tracks.some((t) => t.clips.some((c) => c.asset?.url === 'https://x.test/1.webm'))).toBe(true);
    const title = seen.tracks.flatMap((t) => t.clips).find((c) => c.text === 'Summer Sale');
    expect(title._overlayConfig.textStyle.fontFamily).toBe('Anton');
    expect(m.ui.exp.busy).toBe(false);
    m.destroy();
  });

  it('shows progress while rendering and blocks a second export', async () => {
    let finish;
    const exportVideo = vi.fn(({ onProgress }) => new Promise((res) => { onProgress(0.4); finish = () => res({ filename: 'a.mp4', fileSize: 0 }); }));
    const m = open({ exportVideo });
    document.querySelector('#tg-export').click();
    await vi.waitFor(() => expect(document.querySelector('#tg-exportstatus .tg-bgprogress').textContent).toContain('40%'));
    expect(document.querySelector('#tg-export').disabled).toBe(true);
    finish();
    await vi.waitFor(() => expect(m.ui.exp.busy).toBe(false));
    m.destroy();
  });

  it('does not export a script that still says [Your business], and explains why', async () => {
    const exportVideo = vi.fn();
    const m = open({ exportVideo, script: '[Your business] comes alive.\nBook now.' });
    document.querySelector('#tg-export').click();
    await vi.waitFor(() => expect(document.querySelector('#tg-exportstatus .tg-status--error').textContent).toContain('[Your business]'));
    expect(exportVideo).not.toHaveBeenCalled();
    m.destroy();
  });

  it('shows the host\'s failure, and is disabled in a browser that cannot encode video', async () => {
    const m = open({ exportVideo: async () => { throw new Error('Render failed: out of memory'); } });
    document.querySelector('#tg-export').click();
    await vi.waitFor(() => expect(document.querySelector('#tg-exportstatus .tg-status--error').textContent).toContain('out of memory'));
    m.destroy(); document.body.innerHTML = ''; vi.unstubAllGlobals();
    const m2 = open({ encoder: false, exportVideo: vi.fn() });
    expect(document.querySelector('#tg-export').disabled).toBe(true);
    m2.destroy();
  });
});
