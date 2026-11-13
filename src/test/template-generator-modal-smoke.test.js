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
    const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', stockSearch, onConfirm });
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
    const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', stockSearch: async () => ({ items: [], hasMore: false }), templateStore: createTemplateStore(memory()) });
    m.open();
    expect(document.body.textContent).toContain('Template Generator');
    expect(document.body.textContent).not.toMatch(/Video Automation Creator/);
  });

  it('saves a template, lists it under My templates, and reuses it with its footage and script', async () => {
    const templateStore = createTemplateStore(memory());
    const stockSearch = async () => ({ items: [item(1, 'video', 'pexels'), item(2, 'video', 'pexels')], hasMore: false });
    const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', stockSearch, templateStore, onConfirm: vi.fn() });
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
    const m2 = new TemplateGeneratorModal({ defaultProvider: 'pixabay', stockSearch, templateStore });
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
    const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', stockSearch: async () => ({ items: [], hasMore: false }), templateStore });
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
      const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', stockSearch, templateStore: createTemplateStore(memory()), projectMedia, extraSources: [src.animations, src.endscreens], onConfirm, ...extra });
      m.open(); m.s.started = true; m.paint();
      return { m, src, onConfirm };
    };

    it('lists every source in the rail, in groups', () => {
      const { m } = open();
      const labels = [...document.querySelectorAll('.library__btn-item')].map((b) => b.textContent.trim());
      expect(labels).toEqual(['Video templates', 'Pixabay', 'Pexels', 'My media', 'Upload', 'Remote URL', 'AI Generate', 'Animations', 'End screens & forms']);
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

      const classic = new TemplateGeneratorModal({ defaultProvider: 'pixabay', templateStore, stockSearch: async () => ({ items: [], hasMore: false }) });  // no extra sources
      classic.open(); classic.useTemplate(rec.id);
      expect(classic.s.selectedAnimations).toEqual([]);
      expect(classic.ui.toast).toMatch(/1 animation.*Timeline Studio editor/);
      classic.destroy();
    });
  });

  describe('real previews (no mock images or videos)', () => {
    const openWith = (items, extra = {}) => {
      const stockSearch = async () => ({ items, hasMore: false });
      const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', stockSearch, templateStore: createTemplateStore(memory()), ...extra });
      m.open(); m.s.started = true; m.paint();
      return m;
    };
    const over = (el, type = 'mouseover', related = null) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, relatedTarget: related }));

    it('stock videos play their real preview clip on hover and stop when the pointer leaves', async () => {
      const v = { ...item(1, 'video', 'pexels'), preview: 'https://videos.pexels.test/sd.mp4', poster: 'https://images.pexels.test/poster.jpg' };
      const m = openWith([v]);
      await m.runSearch(true);
      const tile = document.querySelector('.video-tile[data-id]');
      expect(tile.style.backgroundImage).toContain('images.pexels.test/poster.jpg');   // the provider's own poster
      expect(tile.querySelector('video')).toBeNull();
      over(tile);
      const vid = tile.querySelector('video.tg-hovervid');
      expect(vid.getAttribute('src')).toBe('https://videos.pexels.test/sd.mp4');
      expect(vid.muted).toBe(true); expect(vid.loop).toBe(true);
      over(tile, 'mouseout', document.body);
      expect(tile.querySelector('video')).toBeNull();
      m.destroy();
    });

    it('a video with no poster shows its own first frame; a photo shows itself (never a video URL as an image)', async () => {
      const m = openWith([], { projectMedia: [
        { id: 'v', type: 'video', name: 'Take 1', url: 'https://x.test/take1.mp4', duration: 5 },
        { id: 'i', type: 'image', name: 'Logo', url: 'https://x.test/logo.png' },
      ] });
      m.setProvider('library');
      const [vt, it2] = [...document.querySelectorAll('.video-tile[data-id]')];
      expect(vt.querySelector('video.tg-poster').getAttribute('src')).toBe('https://x.test/take1.mp4#t=0.1');
      expect(vt.style.backgroundImage).not.toContain('take1.mp4');   // never url(take1.mp4)
      expect(it2.style.backgroundImage).toContain('logo.png');
      expect(it2.querySelector('video')).toBeNull();
      m.destroy();
    });

    it('animation tiles show the library\'s real still, and fall back to the glyph if it cannot load', async () => {
      const card = { id: 'anim:1', kind: 'animation', source: 'animations', title: 'Bar Chart Race', badge: 'ANIMATION', category: 'Data & charts', duration: 12, glyph: '▤', poster: '/hyperframes/thumbs/bar-chart-race.jpg' };
      const animations = { id: 'animations', label: 'Animations', filters: [['all', 'All']], search: async () => ({ items: [card], hasMore: false }), resolve: async () => ({}) };
      const m = openWith([], { extraSources: [animations] });
      m.setProvider('animations'); await vi.waitFor(() => expect(document.querySelector('.tg-anim')).toBeTruthy());
      const img = document.querySelector('.tg-anim img.tg-thumb');
      expect(img.getAttribute('src')).toBe('/hyperframes/thumbs/bar-chart-race.jpg');
      expect(document.querySelector('.tg-anim .tg-anim__glyph')).toBeTruthy();   // underneath, as the fallback
      img.dispatchEvent(new Event('error'));                                      // the file is missing → the image goes away
      expect(document.querySelector('.tg-anim img.tg-thumb')).toBeNull();
      expect(document.querySelector('.tg-anim .tg-anim__glyph')).toBeTruthy();
      m.destroy();
    });

    it('an animation tile runs the library\'s live preview after a short hover and tears it down on leave', async () => {
      let mounted = 0; let destroyed = 0;
      const card = { id: 'anim:1', kind: 'animation', source: 'animations', title: 'Camcorder HUD', badge: 'ANIMATION', category: 'Backgrounds & effects', duration: 4, poster: '/hyperframes/thumbs/camcorder-hud.jpg' };
      const animations = { id: 'animations', label: 'Animations', filters: [['all', 'All']], search: async () => ({ items: [card], hasMore: false }), resolve: async () => ({}),
        mountPreview: (host, it) => { mounted += 1; host.dataset.live = it.id; return () => { destroyed += 1; }; } };
      const m = openWith([], { extraSources: [animations] });
      m.setProvider('animations'); await vi.waitFor(() => expect(document.querySelector('.tg-anim')).toBeTruthy());
      const tile = document.querySelector('.tg-anim');
      over(tile);
      expect(mounted).toBe(0);                                                    // not on a fly-by
      await vi.waitFor(() => expect(mounted).toBe(1));
      expect(tile.querySelector('.tg-anim__live').dataset.live).toBe('anim:1');
      over(tile, 'mouseout', document.body);
      expect(destroyed).toBe(1); expect(tile.querySelector('.tg-anim__live')).toBeNull();
      over(tile); over(tile, 'mouseout', document.body);                          // a quick fly-by never mounts anything
      await new Promise((r) => setTimeout(r, 450));
      expect(mounted).toBe(1);
      m.destroy();
    });
  });

  describe('written niche scripts, your details, and scene-aware AI', () => {
    const open = () => {
      const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', stockSearch: async () => ({ items: [], hasMore: false }), templateStore: createTemplateStore(memory()) });
      m.open(); m.s.started = true; m.s.step = STEPS.SCRIPT; m.paint();
      return m;
    };
    const type = (selector, value) => { const el = document.querySelector(selector); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
    const ta = () => document.querySelector('#tg-script-text');
    const cta = () => document.querySelector('#tg-script-cta');

    it('picking a template puts its written script (one line per scene) and call to action in the editor', () => {
      const m = open();
      m.pickScript('midnight_table_film');
      const lines = ta().value.split('\n');
      expect(lines).toHaveLength(5);                                   // the template has 5 scenes
      expect(lines[0]).toMatch(/comes alive/);
      expect(ta().value).toContain('[Your business]');                 // nothing typed yet: a visible reminder
      expect(cta().value).toContain('[Your business]');
      expect(document.querySelector('#tg-placeholders').hidden).toBe(false);
      m.destroy();
    });

    it('typing your details fills the script in place, without losing focus-friendly state', () => {
      const m = open();
      m.pickScript('midnight_table_film');
      type('[data-bind="s.details.business_name"]', 'Luna Bistro');
      type('[data-bind="s.details.city"]', 'Austin');
      expect(ta().value).toContain('Luna Bistro');
      expect(ta().value).toContain('Austin');
      expect(ta().value).not.toContain('[Your');
      expect(cta().value).toBe('Reserve your table tonight at Luna Bistro.');
      expect(document.querySelector('#tg-placeholders').hidden).toBe(true);
      expect(m.s.script.text).toBe(ta().value);                        // state and screen agree
      m.destroy();
    });

    it('never overwrites what the user wrote; a button brings the written script back', () => {
      const m = open();
      m.pickScript('midnight_table_film');
      type('#tg-script-text', 'My own words. Edited by hand.');
      type('[data-bind="s.details.business_name"]', 'Luna Bistro');
      expect(ta().value).toBe('My own words. Edited by hand.');      // untouched by the details
      m.paint();
      const btn = document.querySelector('[data-act="use-template-script"]');
      expect(btn.textContent).toContain('Midnight Table Film');
      btn.click();
      expect(m.s.script.text.split('\n')).toHaveLength(5);
      expect(m.s.script.text).toContain('Luna Bistro');
      expect(document.querySelector('[data-act="use-template-script"]')).toBeNull();   // already in use
      m.destroy();
    });

    it('a template pick does not replace text the user already typed', () => {
      const m = open();
      m.s.script.text = 'Something I wrote first.'; m.paint();
      m.pickScript('midnight_table_film');
      expect(m.s.script.text).toBe('Something I wrote first.');
      expect(document.querySelector('[data-act="use-template-script"]')).toBeTruthy();
      m.destroy();
    });

    it('the script preview shows each scene with its written line', () => {
      const m = open();
      m.s.details.business_name = 'Luna Bistro';
      m.setPopup({ kind: 'script', id: 'midnight_table_film' });
      const items = [...document.querySelectorAll('.tg-scenes--script li')];
      expect(items).toHaveLength(5);
      expect(items[0].querySelector('b').textContent).toBe('opening atmosphere');
      expect(items[0].querySelector('span').textContent).toMatch(/Luna Bistro/);
      expect(document.querySelector('.tg-popup').textContent).toMatch(/Call to action/);
      m.destroy();
    });

    it('captions follow the script: each of 5 clips gets its own scene\'s line; fewer clips share the lines evenly', async () => {
      const { toBuilderState } = await import('../components/modals/template-generator/rules.js');
      const m = open();
      m.pickScript('midnight_table_film');
      const lines = m.s.script.text.split('\n');
      for (let i = 1; i <= 5; i += 1) m.s.selectedVideos.push(item(i));
      const five = toBuilderState(m.s).overlays.filter((o) => o.kind === 'caption').map((o) => o.text);
      expect(five).toEqual(lines);                                      // clip n ↔ scene n
      m.s.selectedVideos.splice(3);                                     // keep 3 clips
      const three = toBuilderState(m.s).overlays.filter((o) => o.kind === 'caption').map((o) => o.text);
      expect(three).toEqual([`${lines[0]} ${lines[1]}`, `${lines[2]} ${lines[3]}`, lines[4]]);
      m.destroy();
    });

    it('"Write with AI" asks for one line per scene, with your details, on the customer\'s own key', async () => {
      const sent = [];
      vi.stubGlobal('fetch', vi.fn(async (url, opts) => { sent.push({ url, body: JSON.parse(opts.body) }); return { ok: true, json: async () => ({ ok: true, text: '1. Hook line.\n2. Dish line.\n3. Detail line.\n4. Texture line.\n5. Closing line.' }) }; }));
      const m = open();
      m.pickScript('signature_plate_showcase');
      type('[data-bind="s.details.business_name"]', 'Luna Bistro');
      type('[data-bind="s.details.about"]', 'wood-fired pizza, cosy patio');
      await m.runScriptAction('generate');
      const { url, body } = sent[0];
      expect(url).toBe('/api/timeline-script');
      expect(body.scenes).toEqual(['opening tease', 'plate reveal', 'detail shots', 'texture showcase', 'final presentation']);
      expect(body.business).toMatchObject({ business_name: 'Luna Bistro', about: 'wood-fired pizza, cosy patio' });
      expect(body.duration).toBe(30);
      expect(body.templateContext).toMatchObject({ name: 'Signature Plate Showcase' });
      expect(m.s.script.text.split('\n')).toEqual(['Hook line.', 'Dish line.', 'Detail line.', 'Texture line.', 'Closing line.']);   // numbering stripped
      expect(m.s.autoText).toBe('');                                   // AI text now belongs to the user: details won't overwrite it
      vi.unstubAllGlobals(); m.destroy();
    });

    it('with no template, the AI writes one line per picked clip', async () => {
      const sent = [];
      vi.stubGlobal('fetch', vi.fn(async (url, opts) => { sent.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ ok: true, text: 'A\nB\nC' }) }; }));
      const m = open();
      m.s.selectedVideos.push(item(1), item(2), item(3));
      await m.runScriptAction('generate');
      expect(sent[0].scenes).toHaveLength(3);
      expect(m.s.script.text).toBe('A\nB\nC');
      vi.unstubAllGlobals(); m.destroy();
    });

    it('does not feed the [Your …] reminders to the AI as a call to action, and shows a missing-key message', async () => {
      let body;
      vi.stubGlobal('fetch', vi.fn(async (url, opts) => { body = JSON.parse(opts.body); return { ok: false, status: 401, json: async () => ({ ok: false, error: 'This uses your own OpenAI key. Add it in SmartVid → Settings → API keys (OpenAI API Key).' }) }; }));
      const m = open();
      m.pickScript('midnight_table_film');                               // the CTA is "[Your business]"-style until details are typed
      await m.runScriptAction('generate');
      expect(body.cta).toBe('');
      expect(document.querySelector('.tg-status--error').textContent).toMatch(/your own OpenAI key/);
      vi.unstubAllGlobals(); m.destroy();
    });

    it('your details are saved with a template and come back when it is reused', async () => {
      const store = createTemplateStore(memory());
      const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', stockSearch: async () => ({ items: [], hasMore: false }), templateStore: store });
      m.open(); m.s.started = true; m.s.step = STEPS.SCRIPT; m.paint();
      m.pickScript('midnight_table_film');
      type('[data-bind="s.details.business_name"]', 'Luna Bistro');
      m.s.selectedVideos.push(item(1)); m.s.step = STEPS.PREVIEW; m.paint();
      m.openSave(); m.ui.tplName = 'Luna promo';
      await m.saveTemplate(false);
      const rec = store.list()[0];
      expect(rec.details.business_name).toBe('Luna Bistro');
      expect(rec.script.text).toContain('Luna Bistro');
      const m2 = new TemplateGeneratorModal({ defaultProvider: 'pixabay', stockSearch: async () => ({ items: [], hasMore: false }), templateStore: store });
      m2.open(); m2.useTemplate(rec.id);
      expect(m2.s.details.business_name).toBe('Luna Bistro');
      m.destroy(); m2.destroy();
    });
  });
});
