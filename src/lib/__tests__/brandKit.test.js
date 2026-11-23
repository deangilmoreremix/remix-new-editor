import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../router.js', () => ({ navigate: vi.fn() }));
vi.mock('../supabase.js', () => ({ supabase: null, isSupabaseConfigured: () => false }));

import { navigate } from '../router.js';
import { buildBrandKit, saveBrandKit, buildBrandAdPlan, makeBrandAd, buildBrandBrief, makeBrandProject, mergeBrandProfile, enrichBrandKit, scanAndSaveBrandKit } from '../brandKit.js';
import { listBrandKits } from '../brandKitStore.js';
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

  it('ignores a one-word description fragment', () => {
    expect(buildBrandKit({ research: { ...research, description: 'We' }, client: { businessName: 'Acme' } }).valueProposition).toBe('');
    expect(buildBrandKit({ research: { ...research, description: 'Fast, friendly plumbers serving all of Austin.' }, client }).valueProposition).toBe('Fast, friendly plumbers serving all of Austin.');
  });

  it('keeps Brand Kits separate from Brand Studio: saving never touches its brands', () => {
    localStorage.setItem('brand_dna_list', JSON.stringify([{ id: 'mine', brandName: 'Existing brand' }]));
    saveBrandKit(buildBrandKit({ research, client, assets }));
    expect(JSON.parse(localStorage.getItem('brand_dna_list'))).toEqual([{ id: 'mine', brandName: 'Existing brand' }]);
    expect(JSON.parse(localStorage.getItem('sv_brand_kits'))).toHaveLength(1);
  });

  it('throws instead of pretending to save when the browser will not store the kit', () => {
    const kit = buildBrandKit({ research, client, assets });
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(() => saveBrandKit(kit)).toThrow("Couldn't save");
    spy.mockRestore();
    expect(saveBrandKit(kit).id).toBeTruthy(); // and works again once storage does
  });

  it('returns null with nothing usable', () => {
    expect(buildBrandKit({})).toBeNull();
  });

  it('saves once per website and updates it on re-run', () => {
    const first = saveBrandKit(buildBrandKit({ research, client, assets }));
    const again = saveBrandKit(buildBrandKit({ research, client: { ...client, offer: 'Free quote' }, assets: [] }));
    expect(listBrandKits()).toHaveLength(1);
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

const profile = {
  fonts: ['Poppins', 'Lora'], toneOfVoice: ['friendly', 'professional'], brandPersonality: ['warm and approachable'],
  offerings: ['Drain cleaning', 'Water heater repair'], testimonials: ['They fixed our leak the same day and the crew was spotless.'],
  aboutText: 'Family owned since 2004.', images: ['https://acme-plumbing.com/team.jpg', 'javascript:alert(1)'],
  pages: [{ url: 'https://acme-plumbing.com/about', kind: 'about', title: 'About' }], inferred: ['toneOfVoice'],
};

describe('deep scan', () => {
  it('merges a profile without wiping existing data and drops unsafe image urls', () => {
    const base = saveBrandKit(buildBrandKit({ research, client, assets }));
    const merged = mergeBrandProfile(base, profile);
    expect(merged.fonts).toEqual(['Poppins', 'Lora']);
    expect(merged.toneOfVoice).toEqual(['friendly', 'professional']);
    expect(merged.siteImages).toContain('https://acme-plumbing.com/team.jpg');
    expect(merged.siteImages.some((u) => u.startsWith('javascript:'))).toBe(false);
    expect(merged.productImages).toEqual(base.productImages);
    const empty = mergeBrandProfile(merged, { fonts: [], toneOfVoice: [], offerings: [], testimonials: [], images: [] });
    expect(empty.fonts).toEqual(['Poppins', 'Lora']);
    expect(empty.offerings).toEqual(['Drain cleaning', 'Water heater repair']);
  });

  it('calls /api/brand-kit and reports server errors', async () => {
    const base = saveBrandKit(buildBrandKit({ research, client, assets }));
    const ok = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, profile }) });
    const out = await enrichBrandKit(base, ok);
    expect(ok).toHaveBeenCalledWith('/api/brand-kit', expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: 'https://www.acme-plumbing.com/' }) }));
    expect(out.fonts).toEqual(['Poppins', 'Lora']);
    const bad = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false, error: 'Could not read that website' }) });
    await expect(enrichBrandKit(base, bad)).rejects.toThrow('Could not read that website');
    await expect(enrichBrandKit({}, ok)).rejects.toThrow('no website');
  });

  it('scanAndSave persists the richer record on the same brand', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, profile }) });
    const saved = await scanAndSaveBrandKit(buildBrandKit({ research, client, assets }), f);
    expect(listBrandKits()).toHaveLength(1);
    expect(listBrandKits()[0].id).toBe(saved.id);
    expect(listBrandKits()[0].fonts).toEqual(['Poppins', 'Lora']);
  });
});

describe('studio briefs', () => {
  const brand = () => mergeBrandProfile(saveBrandKit(buildBrandKit({ research, client, assets })), profile);

  it('uses the scanned tone, fonts and offers in the ad brief', () => {
    const p = buildBrandBrief(brand(), 'video', { duration: 15 });
    expect(p.prompt).toContain('Drain cleaning');
    expect(p.prompt).toContain('friendly, professional');
    expect(p.prompt).toContain('Poppins');
  });
  it('writes a different brief for each studio', () => {
    const b = brand();
    const cinema = buildBrandBrief(b, 'cinema');
    const board = buildBrandBrief(b, 'storyboard', { duration: 30 });
    const agent = buildBrandBrief(b, 'video-agent');
    expect(cinema.prompt).toMatch(/^A cinematic hero shot for Acme Plumbing/);
    expect(board.prompt).toContain('5 scenes');
    expect(board.prompt).toContain('same day');
    expect(agent.prompt).toContain('Use exactly these brand colors: #112233');
    expect(agent.prompt).toContain('Use Poppins and Lora for text');
    expect(new Set([cinema.prompt, board.prompt, agent.prompt]).size).toBe(3);
    expect(buildBrandBrief(null, 'cinema')).toBeNull();
  });
  it('opens each studio: Cinema via prefill_prompt, others via the staged prefill', () => {
    const b = brand();
    makeBrandProject(b, 'cinema');
    expect(navigate).toHaveBeenLastCalledWith('cinema');
    expect(localStorage.getItem('prefill_prompt')).toContain('cinematic hero shot');
    for (const [target, route] of [['storyboard', 'storyboard'], ['video-agent', 'video-agent'], ['video', 'video']]) {
      makeBrandProject(b, target, { aspectRatio: '16:9' });
      expect(navigate).toHaveBeenLastCalledWith(route);
      const staged = consumeStudioPrefill(route);
      expect(staged.prompt).toContain('Acme Plumbing');
      expect(staged.params.aspectRatio).toBe('16:9');
    }
    expect(makeBrandProject(b, 'nope')).toBeNull();
  });
});
