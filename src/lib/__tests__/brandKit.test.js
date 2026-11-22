import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../router.js', () => ({ navigate: vi.fn() }));
vi.mock('../supabase.js', () => ({ supabase: null, isSupabaseConfigured: () => false }));

import { navigate } from '../router.js';
import { buildBrandKit, saveBrandKit, buildBrandAdPlan, makeBrandAd } from '../brandKit.js';
import { listBrands } from '../brandStore.js';
import { consumeStudioPrefill } from '../studioPrefill.js';

const research = {
  canonicalUrl: 'https://www.acme-plumbing.com/', title: 'Acme Plumbing | Home', description: 'Fast, friendly plumbers.',
  logoUrl: 'https://acme-plumbing.com/logo.png', socialLinks: { instagram: 'https://instagram.com/acme' },
  brandColors: { primary: '#112233', accent: '#FF8800', palette: ['#112233', '#abcdef', 'nope'] },
};
const client = { businessName: 'Acme Plumbing', industry: 'Plumbing', offer: '$50 off first visit', callToAction: 'Book today', location: 'Austin', phone: '555' };
const assets = [
  { id: 'a', previewUrl: 'https://acme-plumbing.com/van.jpg', category: 'product', selected: true, recommended: true, rejected: false, qualityScore: 5 },
  { id: 'b', previewUrl: 'https://acme-plumbing.com/junk.jpg', category: 'irrelevant', selected: true, rejected: false },
  { id: 'c', previewUrl: 'https://acme-plumbing.com/old.jpg', category: 'product', selected: false, rejected: true },
  { id: 'd', previewUrl: 'data:image/png;base64,xx', category: 'product', selected: true, rejected: false },
];

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

describe('brand kit', () => {
  it('builds a DNA-compatible kit from only what was found', () => {
    const kit = buildBrandKit({ research, client, assets });
    expect(kit.brandName).toBe('Acme Plumbing');
    expect(kit.primaryColors).toEqual(['#112233', '#ff8800']);
    expect(kit.secondaryColors).toEqual(['#abcdef']);
    expect(kit.logoUrl).toBe('https://acme-plumbing.com/logo.png');
    expect(kit.productImages).toEqual(['https://acme-plumbing.com/van.jpg']); // no rejected, irrelevant or data: urls
    expect(kit.socials).toEqual({ instagram: 'https://instagram.com/acme' });
    expect(kit.tagline).toBe('');
  });

  it('returns null with nothing usable', () => {
    expect(buildBrandKit({})).toBeNull();
  });

  it('saves once per website and updates it on re-run', () => {
    const first = saveBrandKit(buildBrandKit({ research, client, assets }));
    const again = saveBrandKit(buildBrandKit({ research, client: { ...client, offer: 'Free quote' }, assets: [] }));
    expect(listBrands()).toHaveLength(1);
    expect(again.id).toBe(first.id);
    expect(again.offer).toBe('Free quote');
    expect(again.productImages).toEqual(['https://acme-plumbing.com/van.jpg']); // empty re-run does not wipe images
  });

  it('writes an ad plan from the kit', () => {
    const plan = buildBrandAdPlan(buildBrandKit({ research, client, assets }), { duration: 30, aspectRatio: '16:9' });
    expect(plan.prompt).toContain('30-second widescreen');
    expect(plan.prompt).toContain('Acme Plumbing');
    expect(plan.prompt).toContain('$50 off first visit');
    expect(plan.prompt).toContain('#112233');
    expect(plan.prompt).toContain('"Book today"');
    expect(plan.referenceImageUrl).toBe('https://acme-plumbing.com/van.jpg');
    expect(buildBrandAdPlan(null)).toBeNull();
  });

  it('opens Video Studio with the brief staged', () => {
    makeBrandAd(saveBrandKit(buildBrandKit({ research, client, assets })), { aspectRatio: '9:16' });
    expect(navigate).toHaveBeenCalledWith('video');
    const staged = consumeStudioPrefill('video');
    expect(staged.prompt).toContain('Acme Plumbing');
    expect(staged.params.referenceImageUrl).toBe('https://acme-plumbing.com/van.jpg');
    expect(staged.params.aspectRatio).toBe('9:16');
    expect(staged.autoGenerate).toBe(false);
  });
});
