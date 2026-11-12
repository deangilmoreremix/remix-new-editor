// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { STEPS, STEP_LABELS } from '../components/modals/template-generator/rules.js';
import { createTemplateStore } from '../components/modals/template-generator/templates.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

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

  it('is called Template Generator, never Video Automation Creator', () => {
    const m = new TemplateGeneratorModal({ stockSearch: async () => ({ items: [], hasMore: false }), templateStore: createTemplateStore(memory()) });
    m.open();
    expect(document.body.textContent).toContain('Template Generator');
    expect(document.body.textContent).not.toMatch(/Video Automation Creator/);
  });

  it('saves a template, lists it under My templates, and reuses it with its footage and script', async () => {
    const templateStore = createTemplateStore(memory());
    const stockSearch = async () => ({ items: [item(1, 'video', 'pexels'), item(2, 'video', 'pexels')], hasMore: false });
    const m = new TemplateGeneratorModal({ stockSearch, templateStore, onConfirm: vi.fn() });
    m.open();
    m.s.started = true; m.paint();
    await m.runSearch(true);
    for (const it of m.ui.results) m.pickVideo(it.id);
    m.s.script.text = 'Welcome. Book today.';
    m.s.selectedTransition = { type: 'fade', duration: 1 };
    m.s.step = STEPS.PREVIEW; m.paint();
    expect(document.querySelector('#tg-save')).toBeTruthy();

    m.openSave();
    expect(document.querySelector('#tg-tpl-name')).toBeTruthy();
    m.ui.tplName = 'Weekend promo';
    await m.saveTemplate(false);
    const saved = templateStore.list();
    expect(saved.length).toBe(1);
    expect(saved[0]).toMatchObject({ name: 'Weekend promo', clipCount: 2, scriptId: null });
    expect(saved[0].transition.type).toBe('fade');

    // a brand-new modal: the template is in the library and reopens fully populated
    const m2 = new TemplateGeneratorModal({ stockSearch, templateStore });
    m2.open();
    m2.ui.view = 'library'; m2.paint();
    expect(document.body.textContent).toContain('Weekend promo');
    m2.useTemplate(saved[0].id);
    expect(m2.s.selectedVideos.length).toBe(2);
    expect(m2.s.script.text).toBe('Welcome. Book today.');
    expect(m2.s.selectedTransition.type).toBe('fade');
    expect(m2.s.step).toBe(STEPS.VIDEO);

    // saving again offers "update" and keeps one record; adding to the timeline counts a use
    m2.s.step = STEPS.PREVIEW; m2.paint();
    m2.openSave();
    expect(m2.ui.tplMode).toBe('update');
    await m2.saveTemplate(false);
    expect(templateStore.list().length).toBe(1);
    await m2.addToTimeline();
    expect(templateStore.get(saved[0].id).uses).toBe(1);
  });

  it('syncs on open: templates from another device show up in My templates, with a status badge', async () => {
    let status = 'local'; let fn = null; let pulled = false;
    const templateStore = {
      ...createTemplateStore(memory()),
      status: () => status,
      lastError: () => null,
      subscribe: (cb) => { fn = cb; return () => { fn = null; }; },
      sync: async () => { status = 'syncing'; fn?.(status, {}); pulled = true; status = 'synced'; fn?.(status, { changed: true }); },
    };
    const m = new TemplateGeneratorModal({ stockSearch: async () => ({ items: [], hasMore: false }), templateStore });
    m.open();
    expect(pulled).toBe(true);
    m.ui.view = 'library'; m.paint();
    expect(document.querySelector('.tg-sync').textContent).toMatch(/Synced across your devices/);
    // another device's template arrives while the library is open
    templateStore.save({ name: 'From my phone', clips: [], clipCount: 0, duration: 0 });
    fn('synced', { changed: true });
    expect(document.querySelector('#tg-lib-grid').textContent).toContain('From my phone');
    m.close();
    await vi.waitFor(() => expect(fn).toBeNull());   // unsubscribed once the close animation finishes
  });
});
