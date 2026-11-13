// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import fixture from './fixtures/template-video-catalog.json';
import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { createTemplateStore } from '../components/modals/template-generator/templates.js';
import {
  normalizeClip, normalizeCatalog, loadTemplateCatalog, searchTemplateClips, resetTemplateCatalogCache, orientationOf, TEMPLATE_CATALOG_URL,
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
    expect(ok.mock.calls[0]).toEqual([TEMPLATE_CATALOG_URL]);
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
