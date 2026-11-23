import { describe, it, expect, vi, beforeEach } from 'vitest';

// A tiny fake Supabase client: records calls, answers from `db`.
const db = vi.hoisted(() => ({ configured: true, userId: 'user_1', favorites: [], popular: [], popularError: null, calls: [] }));

vi.mock('../lib/supabase.js', () => {
  const builder = (table) => {
    const q = {
      select() { return q; },
      order() { return Promise.resolve({ data: db.favorites.map((template_id) => ({ template_id })), error: null }); },
      upsert(rows) { db.calls.push(['upsert', table, rows.map((r) => r.template_id)]); return Promise.resolve({ error: null }); },
      delete() { return { eq: (_c, id) => { db.calls.push(['delete', table, id]); return Promise.resolve({ error: null }); } }; },
    };
    return q;
  };
  return {
    supabase: {
      from: builder,
      rpc: (name, args) => {
        db.calls.push(['rpc', name, args]);
        if (name === 'template_popularity') return Promise.resolve(db.popularError ? { data: null, error: db.popularError } : { data: db.popular, error: null });
        return Promise.resolve({ data: null, error: null });
      },
    },
    primeSupabaseIdentity: async () => {},
    getClerkUserId: () => db.userId,
    isSupabaseConfigured: () => db.configured,
  };
});

import { allTemplates, templates } from '../lib/templates.js';
import { ExplorePage, exploreCategories } from '../components/ExplorePage.js';
import { toggleFavoriteTemplate, getFavoriteTemplateIds, setFavoriteTemplateIds, addRecentTemplate } from '../lib/templateUx.js';
import { syncFavorites, fetchTrendingTemplateIds } from '../lib/templateCloud.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
const ids = (root, sel) => [...root.querySelectorAll(sel)].map((el) => el.dataset.templateId);

beforeEach(() => {
  localStorage.clear();
  Object.assign(db, { configured: true, userId: 'user_1', favorites: [], popular: [], popularError: null, calls: [] });
});

describe('Explore categories', () => {
  it('counts all templates, including the industry ones, and nothing shows 0', () => {
    const cats = exploreCategories();
    expect(cats.reduce((n, c) => n + c.count, 0)).toBe(allTemplates.length);
    expect(cats.filter((c) => c.niche).reduce((n, c) => n + c.count, 0)).toBe(allTemplates.filter((t) => t.niche).length);
    expect(cats.every((c) => c.count > 0)).toBe(true);
  });
  it('shows a row of real templates per category, with its count and a See all link to Templates', () => {
    const page = ExplorePage();
    const cats = exploreCategories();
    const rows = [...page.querySelectorAll('[data-explore-categories] [data-category]')];
    expect(rows.length).toBe(cats.length);
    expect(page.textContent).toContain(`${allTemplates.length} templates in ${cats.length} categories`);
    for (const { label, count } of cats) {
      const row = rows.find((r) => r.dataset.category === label);
      expect(row.querySelector('[data-category-count]').textContent.startsWith(`${count} `), label).toBe(true);
      expect(row.querySelectorAll('[data-template-id]').length, label).toBe(Math.min(4, count));
      expect(row.querySelector('[data-see-all]').textContent).toContain(`See all ${count}`);
    }
  });
  it('puts only templates of that category in its row', () => {
    const page = ExplorePage();
    const byId = new Map(allTemplates.map((t) => [t.id, t]));
    const row = page.querySelector('[data-explore-categories] [data-category="Social Media"]');
    for (const id of ids(row, '[data-template-id]')) expect(byId.get(id).category).toBe('Social Media');
  });
});

describe('Trending templates', () => {
  it('uses the default order until there is usage data', async () => {
    const page = ExplorePage();
    await flush();
    const section = page.querySelector('[data-explore-trending]');
    expect(section.dataset.exploreTrending).toBe('default');
    expect(ids(section, '[data-template-id]')).toEqual(templates.slice(0, 8).map((t) => t.id));
  });
  it('ranks by real usage, tops up with defaults, and says what it is ranked on', async () => {
    const ranked = [allTemplates[40].id, allTemplates[250].id];
    db.popular = ranked.map((template_id, i) => ({ template_id, score: 10 - i }));
    const page = ExplorePage();
    await flush(); await flush();
    const section = page.querySelector('[data-explore-trending]');
    expect(section.dataset.exploreTrending).toBe('live');
    const shown = ids(section, '[data-template-id]');
    expect(shown.slice(0, 2)).toEqual(ranked);
    expect(shown.length).toBe(8);
    expect(new Set(shown).size).toBe(8);
    expect(section.textContent).toContain('last 30 days');
  });
  it('falls back quietly when the ranking function is missing or the backend is off', async () => {
    db.popularError = { message: 'function does not exist' };
    expect(await fetchTrendingTemplateIds(8)).toEqual([]);
    db.configured = false; db.popular = [{ template_id: 'x', score: 3 }];
    expect(await fetchTrendingTemplateIds(8)).toEqual([]);
    db.configured = true; db.popularError = null; db.popular = [{ template_id: 'x', score: 0 }];
    expect(await fetchTrendingTemplateIds(8)).toEqual([]);
  });
});

describe('Favorites on Explore', () => {
  it('shows favorites and recently opened templates, and stars update live', async () => {
    const [a, b, c] = [templates[1].id, templates[2].id, templates[3].id];
    setFavoriteTemplateIds([a]);
    addRecentTemplate(b);
    const page = ExplorePage();
    await flush();
    const favs = page.querySelector('[data-explore-favorites]');
    expect(ids(favs, '[data-template-id]')).toContain(a);
    expect(favs.textContent).toContain('Recently opened');
    // star a trending card: it joins "Your favorites" and every copy of the star turns on
    page.querySelector(`[data-explore-trending] [data-template-id="${c}"]`)?.querySelector('[data-favorite]')?.click();
    await flush();
    expect(getFavoriteTemplateIds()).toContain(c);
    expect(ids(page.querySelector('[data-explore-favorites]'), '[data-template-id]')).toContain(c);
    expect(page.querySelector(`[data-explore-trending] [data-favorite="${c}"]`)?.getAttribute('aria-pressed')).toBe('true');
  });
  it('shows a hint instead of an empty box when there are none', async () => {
    const page = ExplorePage();
    await flush();
    expect(page.querySelector('[data-explore-favorites]').textContent).toContain('No favorites yet');
  });
});

describe('Favorites follow the account', () => {
  it('merges account and browser favorites and pushes browser-only ones up', async () => {
    db.favorites = ['cloud-only', 'both'];
    setFavoriteTemplateIds(['local-only', 'both']);
    const merged = await syncFavorites();
    expect(merged).toEqual(['local-only', 'both', 'cloud-only']);
    expect(getFavoriteTemplateIds()).toEqual(['local-only', 'both', 'cloud-only']);
    expect(db.calls).toContainEqual(['upsert', 'template_favorites', ['local-only']]);
  });
  it('saves a new star and a removed star to the account, and counts the favorite for trending', async () => {
    toggleFavoriteTemplate('tiktok-video');
    await flush(); await flush();
    expect(db.calls).toContainEqual(['upsert', 'template_favorites', ['tiktok-video']]);
    expect(db.calls).toContainEqual(['rpc', 'record_template_event', { p_template_id: 'tiktok-video', p_kind: 'favorite' }]);
    toggleFavoriteTemplate('tiktok-video');
    await flush(); await flush();
    expect(db.calls).toContainEqual(['delete', 'template_favorites', 'tiktok-video']);
  });
  it('records an opened template for the ranking', async () => {
    addRecentTemplate('youtube-thumbnail');
    await flush(); await flush();
    expect(db.calls).toContainEqual(['rpc', 'record_template_event', { p_template_id: 'youtube-thumbnail', p_kind: 'open' }]);
  });
  it('stays browser-only when signed out: no backend calls, favorites still work', async () => {
    db.userId = null;
    toggleFavoriteTemplate('tiktok-video');
    addRecentTemplate('tiktok-video');
    expect(await syncFavorites()).toEqual(['tiktok-video']);
    await flush(); await flush();
    expect(db.calls.filter((c) => c[0] !== 'rpc' || c[1] !== 'template_popularity')).toEqual([]);
  });
});

describe('Templates page category link', () => {
  it('opens on the category chosen on Explore', async () => {
    const category = exploreCategories().find((c) => c.niche).label;
    window.history.replaceState({}, '', `/?category=${encodeURIComponent(category)}#/templates`);
    const { TemplatesPage } = await import('../components/TemplatesPage.js');
    const page = TemplatesPage();
    const active = [...page.querySelectorAll('button[data-filter]')].find((b) => b.className.includes('bg-primary/20'));
    expect(active?.dataset.filter).toBe(category);
    window.history.replaceState({}, '', '/');
  });
});
