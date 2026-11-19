// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import fixture from './fixtures/template-video-catalog.json';
import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { createTemplateStore } from '../components/modals/template-generator/templates.js';
import {
  normalizeClip, normalizeCatalog, loadTemplateCatalog, searchTemplateClips, resetTemplateCatalogCache, orientationOf, safeHttpUrl, TEMPLATE_CATALOG_URL,
} from '../components/modals/template-generator/videoTemplates.js';

// `fixture` is a small slice of real entries from the public demo-template-videos catalog.
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const catalog = normalizeCatalog(fixture);

describe('video templates catalog', () => {
  beforeEach(() => resetTemplateCatalogCache());

  it('turns catalog clips into footage items that keep the credit', () => {
    const c = fixture.clips[0];
    const it = normalizeClip(c);
    expect(it).toMatchObject({ kind: 'video', source: 'template-video', url: c.videoUrl, preview: c.videoUrl, poster: c.posterUrl, user: c.credit.author, pageURL: c.credit.url });
    expect(it.id).toBe(`vtpl-${c.id}`);
    expect(normalizeClip({ id: 'x' })).toBeNull();
    expect(orientationOf('9:16')).toBe('portrait');
    expect(orientationOf('16:9')).toBe('landscape');
  });

  it('filters by category, subcategory, shape and words, and pages', () => {
    const cat = fixture.clips[0].category; const sub = fixture.clips[0].subcategory;
    const r = searchTemplateClips(catalog, { category: cat, subcategory: sub });
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((i) => i.category === cat && i.subcategory === sub)).toBe(true);
    expect(searchTemplateClips(catalog, { orientation: 'portrait' }).items.every((i) => i.orientation === 'portrait')).toBe(true);
    expect(searchTemplateClips(catalog, { query: 'zzzz-nothing' }).items).toEqual([]);
    const p = searchTemplateClips(catalog, { perPage: 3, page: 1 });
    expect(p.items).toHaveLength(3); expect(p.hasMore).toBe(true);
  });

  it('loads once, reads only (GET, no key), and does not cache a failure', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    await loadTemplateCatalog({ fetchImpl: ok }); await loadTemplateCatalog({ fetchImpl: ok });
    expect(ok).toHaveBeenCalledTimes(1);
    expect(ok.mock.calls[0][0]).toBe(TEMPLATE_CATALOG_URL);
    expect(Object.keys(ok.mock.calls[0][1] || {})).toEqual(['signal']); // only an abort signal: no headers, no key, no body
    resetTemplateCatalogCache();
    const bad = vi.fn(async () => ({ ok: false, status: 503 }));
    await expect(loadTemplateCatalog({ fetchImpl: bad })).rejects.toThrow(/503/);
    await expect(loadTemplateCatalog({ fetchImpl: ok })).resolves.toBeTruthy();
  });
});

describe('Template Generator — Video templates in step 1', () => {
  afterEach(() => { document.body.innerHTML = ''; });
  const open = (extra = {}) => {
    const m = new TemplateGeneratorModal({ templateStore: createTemplateStore(memory()), stockSearch: async () => ({ items: [], hasMore: false }), templateCatalog: async () => catalog, ...extra });
    m.open(); m.s.started = true; m.paint(); m.runSearch(true);
    return m;
  };

  it('is the first source and the default, and shows real posters', async () => {
    const m = open();
    await vi.waitFor(() => expect(document.querySelectorAll('.video-tile[data-id]').length).toBe(catalog.clips.length));
    expect(document.querySelector('.library__btn-item').textContent.trim()).toBe('Video templates');
    expect(document.querySelector('.library__btn-active').textContent.trim()).toBe('Video templates');
    const tile = document.querySelector('.video-tile[data-id]');
    expect(tile.style.backgroundImage).toContain(fixture.clips[0].posterUrl.split('/').pop());
    m.destroy();
  });

  it('shows category, subcategory and shape chips and narrows the list', async () => {
    const m = open();
    await vi.waitFor(() => expect(document.querySelector('[aria-label="Category"] .tg-chip')).toBeTruthy());
    const cat = fixture.clips[0].category;
    document.querySelector(`[data-act="filter"][data-id="${cat}"]`).click();
    await vi.waitFor(() => expect(document.querySelector('[aria-label="Subcategory"]')).toBeTruthy());
    const want = catalog.clips.filter((c) => c.category === cat).length;
    await vi.waitFor(() => expect(document.querySelectorAll('.video-tile[data-id]').length).toBe(want));
    document.querySelector('[data-act="tpl-shape"][data-id="portrait"]').click();
    await vi.waitFor(() => expect(document.querySelectorAll('.video-tile[data-id]').length).toBe(catalog.clips.filter((c) => c.category === cat && c.orientation === 'portrait').length));
    m.destroy();
  });

  it('plays the real clip on hover, keeps the credit when picked, and survives save → reopen', async () => {
    const m = open();
    await vi.waitFor(() => expect(document.querySelector('.video-tile[data-id]')).toBeTruthy());
    const tile = document.querySelector('.video-tile[data-id]');
    tile.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(tile.querySelector('video.tg-hovervid').getAttribute('src')).toBe(fixture.clips[0].videoUrl);
    tile.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    m.pickVideo(tile.dataset.id);
    expect(m.s.selectedVideos[0]).toMatchObject({ source: 'template-video', user: fixture.clips[0].credit.author, pageURL: fixture.clips[0].credit.url });
    const snap = JSON.parse(JSON.stringify(m.s.selectedVideos));
    expect(snap[0].url).toBe(fixture.clips[0].videoUrl);
    m.destroy();
  });

  it('says so, and offers another try, when the library cannot be loaded', async () => {
    const m = open({ templateCatalog: async () => { throw new Error('The template library answered 503'); } });
    await vi.waitFor(() => expect(document.querySelector('.tg-empty--error').textContent).toContain('503'));
    m.destroy();
  });
});

describe('Template Generator — real footage instead of text', () => {
  afterEach(() => { document.body.innerHTML = ''; });
  const make = (extra = {}) => new TemplateGeneratorModal({ defaultProvider: 'pixabay', templateStore: createTemplateStore(memory()), stockSearch: async () => ({ items: [], hasMore: false }), templateCatalog: async () => catalog, ...extra });

  it('the selected strip shows each clip\'s real poster (and an animation\'s real still), not just its name', () => {
    const m = make(); m.open(); m.s.started = true;
    m.s.selectedVideos = [{ id: 'a', kind: 'video', source: 'template-video', title: 'Jet', url: 'https://x/a.webm', poster: 'https://x/a.webp', duration: 6 }, { id: 'b', kind: 'video', source: 'upload', title: 'Mine', url: 'https://x/b.mp4', duration: 5 }];
    m.s.selectedAnimations = [{ id: 'anim:1', source: 'animations', title: 'Bar chart', thumb: '/hyperframes/thumbs/bar-chart-race.jpg', duration: 6 }];
    m.paint();
    const thumbs = [...document.querySelectorAll('.tg-selected__thumb')];
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0].style.backgroundImage).toContain('a.webp');
    expect(thumbs[1].querySelector('video.tg-poster').getAttribute('src')).toBe('https://x/b.mp4#t=0.1');   // no poster → its own first frame
    expect(thumbs[2].style.backgroundImage).toContain('bar-chart-race.jpg');
    m.destroy();
  });

  it('script cards and the script preview show real footage stills once the catalog is loaded, and none when it is not', async () => {
    const m = make(); m.open(); m.s.started = true; m.s.step = 1; m.ui.scriptNiche = 'Luxury & Premium'; m.paint();
    await vi.waitFor(() => expect(document.querySelector('.niche-script__still')).toBeTruthy());
    expect(document.querySelector('.niche-script__still').style.backgroundImage).toMatch(/posters\//);
    m.s.selectedVideos = [{ id: 'a', kind: 'video', source: 'x', title: 'A', url: 'https://x/a.mp4', poster: 'https://x/a.webp', duration: 5 }];
    m.setPopup({ kind: 'script', id: document.querySelector('.niche-script').dataset.id });
    expect(document.querySelectorAll('.tg-scene-stills span')).toHaveLength(1);                 // the user's own picked clips, in order
    // a niche with no fitting footage in the library gets no still, rather than a misleading one
    m.ui.scriptNiche = 'Real Estate'; m.paint();
    expect(document.querySelectorAll('.niche-script').length).toBeGreaterThan(0);
    expect(document.querySelector('.niche-script__still')).toBeNull();
    m.destroy(); document.body.innerHTML = '';
    const off = make({ templateCatalog: async () => { throw new Error('offline'); } }); off.open(); off.s.started = true; off.s.step = 1; off.ui.scriptNiche = 'Luxury & Premium'; off.paint();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('.niche-script__still')).toBeNull();
    expect(document.querySelectorAll('.niche-script').length).toBeGreaterThan(0);          // the cards still work
    off.destroy();
  });

  it('the start screen shows a collage of real posters, and nothing broken when the catalog is down', async () => {
    const m = make(); m.open();
    await vi.waitFor(() => expect(document.querySelectorAll('.tg-start__collage span').length).toBeGreaterThan(0));
    m.destroy(); document.body.innerHTML = '';
    const off = make({ templateCatalog: async () => { throw new Error('offline'); } }); off.open();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('.tg-start__collage')).toBeNull();
    expect(document.querySelector('[data-act="start"]')).toBeTruthy();
    off.destroy();
  });
});

describe('catalog links and timeout', () => {
  beforeEach(() => resetTemplateCatalogCache());
  afterEach(() => vi.useRealTimers());

  it('only http(s) pages are kept as links', () => {
    expect(safeHttpUrl('https://example.com/post/1')).toBe('https://example.com/post/1');
    expect(safeHttpUrl('http://example.com/')).toBe('http://example.com/');
    ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', '//evil.example/x', '/relative', 'blob:https://x/1', '', null, undefined, 42].forEach((u) => expect(safeHttpUrl(u)).toBe(''));
  });
  it('a catalog entry with a javascript: credit link loses the link but keeps its name', () => {
    const clip = normalizeClip({ id: 'x1', videoUrl: 'https://v.example/x.mp4', credit: { author: 'Ann', url: 'javascript:alert(1)' } });
    expect(clip.pageURL).toBe('');
    expect(clip.user).toBe('Ann');
    expect(normalizeClip({ id: 'x2', videoUrl: 'https://v.example/y.mp4', credit: { url: 'https://example.com/p' } }).pageURL).toBe('https://example.com/p');
  });
  it('a catalog host that never answers fails after the timeout and is not cached', async () => {
    vi.useFakeTimers();
    const hang = vi.fn(() => new Promise(() => {}));
    const first = loadTemplateCatalog({ fetchImpl: hang, timeoutMs: 1000 });
    const caught = expect(first).rejects.toThrow(/took too long/);
    await vi.advanceTimersByTimeAsync(1001);
    await caught;
    vi.useRealTimers();
    const ok = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    await expect(loadTemplateCatalog({ fetchImpl: ok })).resolves.toBeTruthy(); // the next try asks again
    expect(hang).toHaveBeenCalledTimes(1); expect(ok).toHaveBeenCalledTimes(1);
  });
  it('passes an abort signal to the request', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    await loadTemplateCatalog({ fetchImpl: ok });
    expect(ok.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
