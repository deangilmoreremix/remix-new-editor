// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateSlug, slugify, canonicalUrl, claimBusinessSlug, setVideoSlug, setVideoPrivacy, publishVideo, RESERVED_SLUGS,
} from '../publishClient.js';
import { mountWatchPage } from '../../../../pages/WatchPage.jsx';
import { renderSharePanel } from '../sharePanel.js';

describe('slug helpers', () => {
  it('validates like the database', () => {
    expect(validateSlug('spring-promo')).toBeNull();
    expect(validateSlug('ab')).toBeTruthy();
    expect(validateSlug('Has-Caps')).toBeTruthy();
    expect(validateSlug('-lead')).toBeTruthy();
    expect(validateSlug('trail-')).toBeTruthy();
    expect(validateSlug('dou--ble')).toBeTruthy();
    expect(validateSlug('under_score')).toBeTruthy();
    expect(validateSlug('x'.repeat(49))).toBeTruthy();
    for (const r of RESERVED_SLUGS.filter((x) => x.length >= 3)) expect(validateSlug(r)).toBeTruthy();
  });
  it('slugifies titles', () => {
    expect(slugify('My Spring Promo!')).toBe('my-spring-promo');
    expect(slugify('Café Déjà-vu')).toBe('cafe-deja-vu');
    expect(slugify('★★★', 'video')).toBe('video');
    expect(slugify('admin')).toBe('video');
    expect(slugify('a'.repeat(100)).length).toBeLessThanOrEqual(48);
  });
  it('builds the canonical url', () => {
    expect(canonicalUrl({ id: 'abcdefgh12', business: 'acme', slug: 'promo' }, 'https://x.io')).toBe('https://x.io/v/acme/promo');
    expect(canonicalUrl({ id: 'abcdefgh12' }, 'https://x.io')).toBe('https://x.io/watch/abcdefgh12');
  });
});

describe('owner slug calls', () => {
  it('maps database errors to friendly messages', async () => {
    const c = { rpc: vi.fn(async () => ({ data: null, error: { message: 'slug_taken' } })) };
    await expect(setVideoSlug(c, 'abcdefgh12', 'x-y')).rejects.toThrow(/already taken/);
    const c2 = { rpc: vi.fn(async () => ({ data: null, error: { message: 'business_required' } })) };
    await expect(setVideoSlug(c2, 'abcdefgh12', 'x-y')).rejects.toThrow(/business name/);
    const c3 = { rpc: vi.fn(async () => ({ data: 'acme', error: null })) };
    expect(await claimBusinessSlug(c3, 'acme', 'Acme')).toBe('acme');
    expect(c3.rpc).toHaveBeenCalledWith('claim_business_slug', { p_slug: 'acme', p_display: 'Acme' });
  });
  it('publishes with the source project id and validates privacy', async () => {
    const upsert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: 'abcdefgh12' }, error: null }) }) }));
    await publishVideo({ from: () => ({ upsert }) }, { id: 'abcdefgh12', project: { title: 'T' }, projectId: 'p-1' });
    expect(upsert.mock.calls[0][0]).toMatchObject({ project_id: 'p-1' });
    await expect(setVideoPrivacy({}, 'abcdefgh12', 'secret')).rejects.toThrow(/Unknown privacy/);
  });
});

describe('watch page for readable links', () => {
  beforeEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });
  const proj = { title: 'Demo', timelineSeconds: 5, tracks: [{ id: 'v', type: 'video', items: [{ left: 0, width: 100, id: 'vid', type: 'video', src: 'https://cdn/x.mp4' }] }] };
  const engine = () => ({ create: () => ({ play() {}, pause() {}, seekToFrame() {}, destroy() {} }) });

  it('follows a rename redirect and shows the canonical address', async () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const fetchVideo = vi.fn()
      .mockResolvedValueOnce({ redirect: { id: 'abcdefgh12', business: 'acme', slug: 'new-name' } })
      .mockResolvedValueOnce({ id: 'abcdefgh12', title: 'Demo', project: proj, business: 'acme', slug: 'new-name', privacy: 'public' });
    const analytics = { track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() };
    await mountWatchPage(box, { business: 'acme', slug: 'old-name' }, { fetchVideo, createEngine: engine().create, analytics });
    expect(fetchVideo).toHaveBeenNthCalledWith(1, { business: 'acme', slug: 'old-name' });
    expect(fetchVideo).toHaveBeenNthCalledWith(2, { business: 'acme', slug: 'new-name' });
    expect(box.querySelector('h1').textContent).toBe('Demo');
    expect(location.pathname).toBe('/v/acme/new-name');
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('marks unlisted videos noindex and shows not-found for missing ones', async () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    await mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'D', project: proj, privacy: 'unlisted' }), createEngine: engine().create, analytics: { track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() } });
    expect(document.querySelector('meta[name="robots"]').content).toContain('noindex');

    const box2 = document.createElement('div');
    document.body.appendChild(box2);
    expect(await mountWatchPage(box2, { business: 'acme', slug: 'gone' }, { fetchVideo: async () => null })).toBeNull();
    expect(box2.textContent).toContain('not found');
  });
});

describe('share panel link editor', () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  it('validates locally, saves via the owner callback and shows the canonical link', async () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const saveLink = vi.fn(async ({ business, slug }) => ({ id: 'abcdefgh12', title: 'T', published: true, business: business || 'acme', slug, privacy: 'public', view_count: 0 }));
    renderSharePanel(box, {
      defaultTitle: 'T',
      getInfo: async () => ({ id: 'abcdefgh12', title: 'T', published: true, view_count: 0, business: null, slug: null, privacy: 'public' }),
      publish: async () => ({}), setPublished: async () => {}, copy: async () => {},
      saveLink, setPrivacy: vi.fn(async () => {}), listRevisions: async () => [{ revision: 2, title: 'T', created_at: '2026-01-01T00:00:00Z' }],
    });
    await tick(); await tick();
    box.querySelector('[data-share-slug]').value = 'x';
    box.querySelector('[data-share-savelink]').click();
    await tick();
    expect(saveLink).not.toHaveBeenCalled();
    expect(box.querySelector('[data-share-linkmsg]').textContent).toMatch(/3-48/);

    box.querySelector('[data-share-slug]').value = 'spring-promo';
    box.querySelector('[data-share-savelink]').click();
    await tick();
    expect(box.querySelector('[data-share-linkmsg]').textContent).toMatch(/business name/);

    box.querySelector('[data-share-business]').value = 'acme';
    box.querySelector('[data-share-slug]').value = 'spring-promo';
    box.querySelector('[data-share-savelink]').click();
    await tick(); await tick();
    expect(saveLink).toHaveBeenCalledWith({ business: 'acme', slug: 'spring-promo' });
    expect(box.querySelector('[data-share-link]').value).toMatch(/\/v\/acme\/spring-promo$/);
  });
});
