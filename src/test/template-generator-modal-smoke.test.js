// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { STEPS } from '../components/modals/template-generator/rules.js';

const item = (n, kind = 'video', source = 'pexels') => ({
  id: `${source}-${n}`, kind, source, title: `T${n}`, url: `https://x.test/${n}.${kind === 'video' ? 'mp4' : 'jpg'}`,
  preview: `https://x.test/${n}.jpg`, poster: `https://x.test/${n}.jpg`, duration: kind === 'video' ? 6 : 0, user: 'Ann', pageURL: 'https://p.test',
});

describe('TemplateGeneratorModal (wired to the ported wizard + Pexels/Pixabay)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('walks Niche → … → Add to Timeline with stock results from both providers', async () => {
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
    expect(document.querySelector('#tg-next')).toBeTruthy();

    m.pickNiche(m.niches[0]);
    await m.goNext();                       // → Script
    expect(m.s.step).toBe(STEPS.SCRIPT);
    m.s.script.text = 'Welcome. Book today.';
    m.s.step = STEPS.VIDEO;                 // jump to Media
    await m.runSearch(true);
    expect(calls.at(-1).source).toBe('pixabay');
    m.setProvider('pexels');
    await vi.waitFor(() => expect(calls.some((c) => c.source === 'pexels')).toBe(true));
    await vi.waitFor(() => expect(m.ui.results.length).toBe(2));

    for (const it of m.ui.results) m.pickVideo(it.id);
    expect(m.s.selectedVideos.length).toBe(2);

    await m.addToTimeline();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const { composition } = onConfirm.mock.calls[0][0];
    const media = composition.tracks.flatMap((t) => t.clips).filter((c) => c.asset);
    expect(media.map((c) => c.asset.source)).toEqual(['pexels', 'pexels']);
  });
});
