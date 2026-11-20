// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { brandFromDiscovery, prefillBrandFromWebsite, stageBrandPrefill, runStagedBrandPrefill } from '../brandPrefill.js';

const ok = (body, status = 200) => vi.fn(async () => ({ ok: status < 300, status, json: async () => body }));
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const data = {
  ok: true, title: '  Acme   Inc  ', description: 'We make rockets', logo: 'https://acme.com/logo.png',
  brandColors: { primary: '#E63946', accent: '#1d3557', palette: ['#e63946', '#2a9d8f', 'not-a-color', '#f4a261', '#264653'] },
  assets: [{ previewUrl: 'https://acme.com/a.jpg' }, { sourceUrl: 'https://acme.com/b.jpg' }, { previewUrl: 'javascript:alert(1)' }, {}],
};

describe('brandFromDiscovery', () => {
  it('maps the free discovery answer to a brand record, keeping only safe values', () => {
    const b = brandFromDiscovery(data, 'https://acme.com');
    expect(b).toMatchObject({ url: 'https://acme.com', brandName: 'Acme Inc', valueProposition: 'We make rockets', logoUrl: 'https://acme.com/logo.png', source: 'onboarding' });
    expect(b.primaryColors).toEqual(['#e63946', '#1d3557', '#2a9d8f']);
    expect(b.secondaryColors).toEqual(['#f4a261', '#264653']);
    expect(b.siteImages).toEqual(['https://acme.com/a.jpg', 'https://acme.com/b.jpg']);
    expect(b.id).toBeTruthy();
  });
  it('falls back to the host name, and rejects an unusable answer', () => {
    expect(brandFromDiscovery({ ok: true }, 'https://www.acme.com').brandName).toBe('acme.com');
    expect(brandFromDiscovery({ ok: false }, 'https://acme.com')).toBeNull();
    expect(brandFromDiscovery(null, 'https://acme.com')).toBeNull();
  });
});

describe('prefillBrandFromWebsite', () => {
  it('posts the website to the free discover endpoint and saves the brand', async () => {
    const f = ok(data); const save = vi.fn((b) => b);
    const r = await prefillBrandFromWebsite('www.acme.com', { fetchImpl: f, brands: () => [], save });
    expect(f).toHaveBeenCalledWith('/api/demo/discover', expect.objectContaining({ method: 'POST', body: JSON.stringify({ websiteUrl: 'https://acme.com' }) }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(r.brandName).toBe('Acme Inc');
  });
  it('does nothing without a usable website or when a brand already exists, and never calls the server then', async () => {
    const f = ok(data); const save = vi.fn();
    expect(await prefillBrandFromWebsite('', { fetchImpl: f, brands: () => [], save })).toBeNull();
    expect(await prefillBrandFromWebsite('not a site', { fetchImpl: f, brands: () => [], save })).toBeNull();
    expect(await prefillBrandFromWebsite('acme.com', { fetchImpl: f, brands: () => [{ id: 'x' }], save })).toBeNull();
    expect(f).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
  it('swallows 429/503, network errors and a brand created while waiting', async () => {
    const save = vi.fn();
    expect(await prefillBrandFromWebsite('acme.com', { fetchImpl: ok({}, 429), brands: () => [], save })).toBeNull();
    expect(await prefillBrandFromWebsite('acme.com', { fetchImpl: ok({}, 503), brands: () => [], save })).toBeNull();
    expect(await prefillBrandFromWebsite('acme.com', { fetchImpl: async () => { throw new Error('offline'); }, brands: () => [], save })).toBeNull();
    let n = 0;
    expect(await prefillBrandFromWebsite('acme.com', { fetchImpl: ok(data), brands: () => (n++ ? [{ id: 'new' }] : []), save })).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});

describe('staged hand-off', () => {
  it('runs once after the reload, and ignores old or missing notes', async () => {
    const st = mem(); const save = vi.fn((b) => b);
    expect(stageBrandPrefill('nope', st)).toBe(false);
    expect(stageBrandPrefill('acme.com', st)).toBe(true);
    expect((await runStagedBrandPrefill({ fetchImpl: ok(data), brands: () => [], save }, st)).brandName).toBe('Acme Inc');
    expect(await runStagedBrandPrefill({ fetchImpl: ok(data), brands: () => [], save }, st)).toBeNull(); // consumed
    st.setItem('smartvideo-brand-prefill', JSON.stringify({ website: 'acme.com', at: Date.now() - 2 * 3600_000 }));
    expect(await runStagedBrandPrefill({ fetchImpl: ok(data), brands: () => [], save }, st)).toBeNull();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
