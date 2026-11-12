// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { STEPS, STEP_LABELS } from '../components/modals/template-generator/rules.js';

const item = (n, kind = 'video', source = 'pexels') => ({
  id: `${source}-${n}`, kind, source, title: `T${n}`, url: `https://x.test/${n}.${kind === 'video' ? 'mp4' : 'jpg'}`,
  preview: `https://x.test/${n}.jpg`, poster: `https://x.test/${n}.jpg`, duration: kind === 'video' ? 6 : 0, user: 'Ann', pageURL: 'https://p.test',
});

describe('TemplateGeneratorModal — the original 4-step wizard (Video, Script, Overlay, Preview)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('has exactly four steps', () => {
    expect(STEP_LABELS).toEqual(['Video', 'Script', 'Overlay', 'Preview']);
    expect(Object.keys(STEPS)).toHaveLength(4);
  });

  it('walks Video → Script → Overlay → Preview → Add to Timeline with Pexels + Pixabay stock', async () => {
    const calls = [];
    const stockSearch = vi.fn(async (q) => {
      calls.push(q);
      return { items: q.source === 'pixabay' ? [item(1, 'video', 'pixabay'), item(2, 'image', 'pixabay')] : [item(3), item(4, 'image')], hasMore: false };
    });
    const onConfirm = vi.fn();
    const m = new TemplateGeneratorModal({ stockSearch, onConfirm });
    m.open();
    m.s.started = true;
    m.paint();
    await m.runSearch(true);
    expect(calls.at(-1).source).toBe('pixabay');
    m.setProvider('pexels');
    await vi.waitFor(() => expect(m.ui.results.length).toBe(2));

    await m.goNext();
    expect(m.s.step).toBe(STEPS.VIDEO);     // blocked: nothing selected yet
    for (const it of m.ui.results) m.pickVideo(it.id);
    expect(m.s.selectedVideos.length).toBe(2);

    await m.goNext(); expect(m.s.step).toBe(STEPS.SCRIPT);
    m.s.script.text = 'Welcome. Book today.';
    await m.goNext(); expect(m.s.step).toBe(STEPS.OVERLAY);
    await m.goNext(); expect(m.s.step).toBe(STEPS.PREVIEW);
    expect(document.querySelector('#tg-next').textContent).toBe('Add to Timeline');

    await m.addToTimeline();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const { composition } = onConfirm.mock.calls[0][0];
    const media = composition.tracks.flatMap((t) => t.clips).filter((c) => c.asset);
    expect(media.map((c) => c.asset.source)).toEqual(['pexels', 'pexels']);
  });
});
