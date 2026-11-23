// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

vi.mock('../../../lib/router.js', () => ({ navigate: vi.fn() }));
vi.mock('../../../lib/supabase.js', () => ({ supabase: null, isSupabaseConfigured: () => false }));

import { navigate } from '../../../lib/router.js';
import { consumeStudioPrefill } from '../../../lib/studioPrefill.js';
import { openBrandKitModal } from '../BrandKitModal.js';
import { kitInputFromDiscovery, discoverBrand } from '../../../lib/brandKit.js';

const DISCOVERY = {
  ok: true, url: 'https://bluebird-bakery.com/', title: 'Bluebird Bakery | Austin', description: 'Family bakery.',
  logo: 'https://bluebird-bakery.com/logo.png', brandColors: { primary: '#1f4e8c', accent: '#f2a900' },
  assets: [
    { kind: 'product', url: 'https://bluebird-bakery.com/a.jpg', source: 'jsonld' },
    { kind: 'product', url: 'https://bluebird-bakery.com/b.jpg', source: 'img' },
    { kind: 'photo', url: 'javascript:alert(1)', source: 'img' },
  ],
};
const PROFILE = { fonts: ['Playfair Display'], toneOfVoice: ['friendly'], offerings: ['Sourdough loaf'], testimonials: [], images: [], pages: [{ url: 'https://bluebird-bakery.com/menu', kind: 'products' }], inferred: ['toneOfVoice'] };

const q = (id) => document.querySelector(`[data-testid="${id}"]`);
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async () => { for (let i = 0; i < 6; i++) await tick(); };
let close;

function mockFetch() {
  vi.stubGlobal('fetch', vi.fn(async (url) => ({
    ok: true, status: 200,
    json: async () => (String(url).includes('brand-kit') ? { ok: true, profile: PROFILE } : DISCOVERY),
  })));
}
async function findBrand() {
  const input = document.querySelector('input[aria-label="Business website"]');
  input.value = 'bluebird-bakery.com';
  input.dispatchEvent(new Event('input'));
  document.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
}

beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; vi.clearAllMocks(); mockFetch(); });
afterEach(() => { close?.(); vi.unstubAllGlobals(); });

describe('Brand Kit modal', () => {
  it('opens empty and closes with Escape, the backdrop and the close button', () => {
    close = openBrandKitModal();
    expect(q('brand-kit-modal')).not.toBeNull();
    expect(q('brand-kit-found')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(q('brand-kit-modal')).toBeNull();
    close = openBrandKitModal();
    q('brand-kit-modal').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(q('brand-kit-modal')).toBeNull();
    close = openBrandKitModal();
    document.querySelector('[aria-label="Close"]').click();
    expect(q('brand-kit-modal')).toBeNull();
  });

  it('opens only one at a time', () => {
    close = openBrandKitModal();
    openBrandKitModal();
    expect(document.querySelectorAll('[data-testid="brand-kit-modal"]')).toHaveLength(1);
  });

  it('does not look anything up until asked, then shows what was found (and ignores unsafe image urls)', async () => {
    close = openBrandKitModal({ url: 'bluebird-bakery.com' });
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    await findBrand();
    expect(fetch).toHaveBeenCalledWith('/api/demo/discover', expect.objectContaining({ method: 'POST' }));
    const found = q('brand-kit-found');
    expect(found.textContent).toContain('Bluebird Bakery');
    expect(found.querySelectorAll('button[aria-pressed]')).toHaveLength(2);
  });

  it('lets you drop an image, scan more pages, save, and open a studio with the brief', async () => {
    close = openBrandKitModal();
    await findBrand();
    q('brand-kit-found').querySelector('button[aria-pressed="true"]').click();
    expect(q('brand-kit-found').querySelectorAll('button[aria-pressed="false"]')).toHaveLength(1);

    q('brand-kit-scan').click();
    await flush();
    expect(q('brand-kit-profile').textContent).toContain('Playfair Display');
    expect(q('brand-kit-profile').textContent).toContain('inferred');
    expect(document.body.textContent).toContain('Read 1 page');

    q('brand-kit-save').click();
    expect(q('brand-kit-save').textContent).toBe('✓ Saved');
    expect(document.body.textContent).not.toContain('Brand Studio');
    expect(localStorage.getItem('brand_dna_list')).toBeNull(); // Brand Studio's list is not touched
    const list = JSON.parse(localStorage.getItem('sv_brand_kits'));
    expect(list).toHaveLength(1);
    expect(list[0].productImages).toEqual(['https://bluebird-bakery.com/b.jpg']); // the dropped image is not kept
    expect(list[0].fonts).toEqual(['Playfair Display']);

    const target = document.querySelector('select[aria-label="Make with"]');
    target.value = 'storyboard';
    target.dispatchEvent(new Event('change'));
    q('brand-kit-make').click();
    expect(navigate).toHaveBeenCalledWith('storyboard');
    expect(consumeStudioPrefill('storyboard').prompt).toContain('Bluebird Bakery');
    expect(q('brand-kit-modal')).toBeNull();
    expect(JSON.parse(localStorage.getItem('sv_brand_kits'))).toHaveLength(1);
  });

  it('shows a readable error and no kit when the lookup fails', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    close = openBrandKitModal();
    await findBrand();
    expect(document.querySelector('[role="alert"]').textContent).toContain('Too many lookups');
    expect(q('brand-kit-found')).toBeNull();
  });
});

describe('discovery mapping', () => {
  it('maps the free discovery response and rejects other shapes', async () => {
    const input = kitInputFromDiscovery(DISCOVERY);
    expect(input.assets.map((a) => a.category)).toEqual(['product', 'product']);
    expect(kitInputFromDiscovery({ ok: false })).toBeNull();
    await expect(discoverBrand('')).rejects.toThrow('Enter a business website');
    await expect(discoverBrand('x.com', async () => ({ ok: true, status: 200, json: async () => ({ ok: true, assets: [] }) }))).rejects.toThrow('Nothing was found');
  });
});

describe('the personalization modal is untouched', () => {
  it('does not mention the Brand Kit anywhere in the personalization feature', () => {
    const modal = 'src/features/personalization/shared/personalization/PersonalizationModal.tsx';
    expect(fs.readFileSync(modal, 'utf8')).not.toMatch(/brandKit|BrandKit/);
    expect(fs.existsSync('src/features/personalization/shared/personalization/BrandKitPanel.tsx')).toBe(false);
  });
});

describe('Find My Brand page', () => {
  it('opens the Brand Kit modal, on arrival and from its button, not the personalization modal', async () => {
    const { FindMyBrandPage } = await import('../../FindMyBrandPage.js');
    const page = FindMyBrandPage();
    document.body.appendChild(page);
    for (let i = 0; i < 20 && !q('brand-kit-modal'); i++) await new Promise((r) => setTimeout(r, 10));
    expect(q('brand-kit-modal')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(q('brand-kit-modal')).toBeNull();
    q('free-discovery-open')?.click?.() ?? page.querySelector('button').click();
    for (let i = 0; i < 20 && !q('brand-kit-modal'); i++) await new Promise((r) => setTimeout(r, 10));
    expect(q('brand-kit-modal')).not.toBeNull();
    expect(fs.readFileSync('src/components/FindMyBrandPage.js', 'utf8')).not.toContain('features/personalization');
  });
});
