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

  describe('media sources: Pexels, Pixabay, My media, animations, motion graphics, end screens', () => {
    const anim = (n, extra = {}) => ({ id: `anim:${n}`, kind: 'animation', source: 'animations', title: `Anim ${n}`, badge: 'ANIMATION', category: 'Lower thirds', duration: 5, glyph: '▭', ...extra });
    const sources = () => {
      const calls = []; let destroyed = 0;
      const animations = {
        id: 'animations', label: 'Animations', blurb: 'Animated titles.', filters: [['all', 'All'], ['Lower thirds', 'Lower thirds']],
        search: async (q) => { calls.push(['animations', q]); const all = [anim(1), anim(2), anim(3, { category: 'Data & charts' })]; return { items: all.filter((i) => (q.filter === 'all' || i.category === q.filter) && (!q.query || i.title.toLowerCase().includes(q.query.toLowerCase()))), hasMore: false }; },
        resolve: async (ref) => ({ overlay: { type: 'hyperframes', blockId: ref.id.replace('anim:', ''), name: ref.title } }),
        mountPreview: (host, it) => { host.dataset.mounted = it.id; return () => { destroyed += 1; }; },
      };
      const endscreens = {
        id: 'endscreens', label: 'End screens & forms', blurb: 'End screens.', filters: [['all', 'All']],
        search: async () => ({ items: [{ id: 'tpl:end-1', kind: 'animation', source: 'endscreens', title: 'Subscribe', badge: 'END SCREEN', category: 'endScreens', duration: 6, placeAt: 'end' }], hasMore: false }),
        resolve: async (ref) => ({ templateId: ref.id.replace('tpl:', '') }),
      };
      return { animations, endscreens, calls, destroyed: () => destroyed };
    };
    const open = (extra = {}) => {
      const src = sources();
      const stockSearch = async (q) => ({ items: [item(q.source === 'pixabay' ? 1 : 3, 'video', q.source)], hasMore: false });
      const projectMedia = [{ id: 'p1', type: 'video', name: 'Intro take', url: 'https://x.test/intro.mp4', duration: 7, thumbnail: 'https://x.test/intro.jpg' }, { id: 'p2', type: 'image', name: 'Logo', url: 'https://x.test/logo.png' }];
      const onConfirm = vi.fn();
      const m = new TemplateGeneratorModal({ stockSearch, templateStore: createTemplateStore(memory()), projectMedia, extraSources: [src.animations, src.endscreens], onConfirm, ...extra });
      m.open(); m.s.started = true; m.paint();
      return { m, src, onConfirm };
    };

    it('lists every source in the rail, in groups', () => {
      const { m } = open();
      const labels = [...document.querySelectorAll('.library__btn-item')].map((b) => b.textContent.trim());
      expect(labels).toEqual(['Pixabay', 'Pexels', 'My media', 'Upload', 'Remote URL', 'AI Generate', 'Animations', 'End screens & forms']);
      expect(document.querySelector('.tg-rail-label').textContent).toBe('Motion & templates');
      m.destroy();
    });

    it('Pexels and Pixabay each return videos and photos (the All / Videos / Photos views)', async () => {
      const seen = []; const { m } = open({ stockSearch: async (q) => { seen.push([q.source, q.filter]); return { items: [], hasMore: false }; } });
      await m.runSearch(true);                       // Pixabay, default "All"
      m.setProvider('pexels'); await vi.waitFor(() => expect(seen.some(([s]) => s === 'pexels')).toBe(true));
      m.ui.filter = 'photos'; await m.runSearch(true); m.ui.filter = 'videos'; await m.runSearch(true);
      expect(seen).toEqual(expect.arrayContaining([['pixabay', 'all'], ['pexels', 'all'], ['pexels', 'photos'], ['pexels', 'videos']]));
      const chips = (id) => { m.setProvider(id); return [...document.querySelectorAll('.tg-chips .tg-chip')].map((c) => c.textContent); };
      expect(chips('pixabay')).toEqual(expect.arrayContaining(['All', 'Videos', 'Photos', 'Illustrations', 'Vectors']));
      expect(chips('pexels')).toEqual(expect.arrayContaining(['All', 'Videos', 'Photos', 'Collections']));
      m.destroy();
    });

    it('My media shows the project clips and images, filterable and searchable, and picks them as clips', () => {
      const { m } = open();
      m.setProvider('library');
      expect(m.libraryItems().map((i) => i.title)).toEqual(['Intro take', 'Logo']);
      m.ui.filter = 'photos'; expect(m.libraryItems().map((i) => i.title)).toEqual(['Logo']);
      m.ui.filter = 'all'; m.ui.query = 'intro'; expect(m.libraryItems().map((i) => i.title)).toEqual(['Intro take']);
      m.paintList();
      m.pickVideo('library-p1'); expect(m.s.selectedVideos.map((v) => v.source)).toEqual(['library']);
      m.destroy();
    });

    it('animations are overlays: own limit, own tray, no clip slots, searchable by category and text', async () => {
      const { m, src } = open();
      m.setProvider('animations');
      await vi.waitFor(() => expect(m.ui.results.length).toBe(3));
      expect(document.querySelectorAll('.tg-anim').length).toBe(3);
      m.pickVideo('anim:1'); m.pickVideo('anim:2');
      expect(m.s.selectedAnimations.map((a) => a.id)).toEqual(['anim:1', 'anim:2']);
      expect(m.s.selectedVideos.length).toBe(0);
      expect(document.querySelector('.tg-selected--anim').textContent).toContain('Anim 1');
      expect(document.querySelector('#tg-count').textContent).toBe('2/6');   // on an animation source the counter shows the animation limit
      m.ui.filter = 'Data & charts'; await m.runSearch(true);
      expect(m.ui.results.map((r) => r.id)).toEqual(['anim:3']);
      expect(src.calls.at(-1)[1]).toMatchObject({ filter: 'Data & charts', page: 1 });
      m.ui.filter = 'all'; m.ui.query = 'anim 2'; await m.runSearch(true);
      expect(m.ui.results.map((r) => r.id)).toEqual(['anim:2']);
      m.removeAnimation('anim:1'); expect(m.s.selectedAnimations.length).toBe(1);
      for (let i = 10; i < 20; i += 1) m.itemsById.set(`anim:${i}`, anim(i));
      for (let i = 10; i < 20; i += 1) m.pickVideo(`anim:${i}`);
      expect(m.s.selectedAnimations.length).toBe(6);   // MAX_ANIMATIONS
      m.destroy();
    });

    it('previews an animation live in the popup and cleans the preview up', async () => {
      const { m, src } = open();
      m.setProvider('animations'); await vi.waitFor(() => expect(m.ui.results.length).toBe(3));
      m.setPopup({ kind: 'animation', id: 'anim:1' });
      expect(document.querySelector('#tg-live').dataset.mounted).toBe('anim:1');
      m.setPopup(null);
      expect(src.destroyed()).toBe(1);
      m.destroy();
    });

    it('adds picked clips AND animations / end screens to the timeline composition', async () => {
      const { m, onConfirm } = open();
      m.setProvider('pexels'); await vi.waitFor(() => expect(m.ui.results.length).toBe(1));
      m.pickVideo(m.ui.results[0].id);
      m.setProvider('library'); m.pickVideo('library-p1');
      m.setProvider('animations'); await vi.waitFor(() => expect(m.ui.results.length).toBe(3)); m.pickVideo('anim:1');
      m.setProvider('endscreens'); await vi.waitFor(() => expect(m.ui.results.length).toBe(1)); m.pickVideo('tpl:end-1');
      m.s.script.text = 'Welcome. Book today.';
      await m.addToTimeline();
      const { composition } = onConfirm.mock.calls[0][0];
      const media = composition.tracks.flatMap((t) => t.clips).filter((c) => c.asset);
      expect(media.map((c) => c.asset.source)).toEqual(['pexels', 'library']);
      const motion = composition.tracks.find((t) => t.name === 'Animations').clips;
      expect(motion.map((c) => [c.name, c._overlayConfig.animation])).toEqual([
        ['Anim 1', { overlay: { type: 'hyperframes', blockId: '1', name: 'Anim 1' } }],
        ['Subscribe', { templateId: 'end-1' }],
      ]);
      expect(motion[1].startTime).toBeGreaterThan(motion[0].startTime);   // the end screen sits at the end
    });

    it('a saved template remembers its animations; an editor without that library sets them aside', async () => {
      const templateStore = createTemplateStore(memory());
      const { m } = open({ templateStore });
      m.setProvider('animations'); await vi.waitFor(() => expect(m.ui.results.length).toBe(3)); m.pickVideo('anim:2');
      m.setProvider('library'); m.pickVideo('library-p1');
      m.s.script.text = 'Hello.'; m.s.step = STEPS.PREVIEW; m.paint(); m.openSave(); m.ui.tplName = 'With motion';
      await m.saveTemplate(false);
      const rec = templateStore.list()[0];
      expect(rec.animations.map((a) => a.id)).toEqual(['anim:2']);
      m.destroy();

      const classic = new TemplateGeneratorModal({ templateStore, stockSearch: async () => ({ items: [], hasMore: false }) });  // no extra sources
      classic.open(); classic.useTemplate(rec.id);
      expect(classic.s.selectedAnimations).toEqual([]);
      expect(classic.ui.toast).toMatch(/1 animation.*Timeline Studio editor/);
      classic.destroy();
    });
  });
});
