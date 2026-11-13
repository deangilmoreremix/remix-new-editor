// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';

// The router calls the brand pages with NO arguments; the brand id arrives in the URL query.
const BRANDS = [
  { id: 'b1', brandName: 'Alpha Co', industry: 'x', logoUrl: 'https://x/a.png', toneOfVoice: [], colors: [] },
  { id: 'b2', brandName: 'Beta Co', industry: 'y', logoUrl: 'https://x/b.png', toneOfVoice: [], colors: [] },
];
const seed = (brands = BRANDS) => localStorage.setItem('brand_dna_list', JSON.stringify(brands));
const at = (search) => window.history.replaceState({}, '', `/${search}#/x`);

beforeEach(() => { localStorage.clear(); at(''); });

describe('resolveBrandId', () => {
  it('reads ?brandId=, and ?id= only where id is the brand (Brand DNA)', async () => {
    const { resolveBrandId } = await import('../lib/brandStore.js');
    seed();
    at('?brandId=b2'); expect(resolveBrandId()).toBe('b2');
    at('?id=b2'); expect(resolveBrandId()).not.toBe('b2'); // ?id= is an asset id on the Asset Editor
    at('?id=b2'); expect(resolveBrandId({}, { allowId: true })).toBe('b2');
  });
  it('returns an asked-for id as-is so a bad id still shows "not found"', async () => {
    const { resolveBrandId, getBrand } = await import('../lib/brandStore.js');
    seed(); at('?brandId=nope');
    expect(resolveBrandId()).toBe('nope');
    expect(getBrand('nope')).toBeNull();
  });
  it('falls back to the last-used brand, then the first brand, then null', async () => {
    const { resolveBrandId, rememberBrandId } = await import('../lib/brandStore.js');
    seed();
    expect(resolveBrandId()).toBe('b1');
    rememberBrandId('b2');
    expect(resolveBrandId()).toBe('b2');
    localStorage.setItem('brand_last_used_id', 'deleted-brand');
    expect(resolveBrandId()).toBe('b1');
    localStorage.clear(); seed([]);
    expect(resolveBrandId()).toBeNull();
  });
});

describe('brand pages open the brand from the URL (router passes no args)', () => {
  it.each([
    ['BrandDnaEditor', '../components/BrandDnaEditor.js', '?id=b2'],
    ['CampaignWizard', '../components/CampaignWizard.js', '?brandId=b2'],
    ['AssetCanvasEditor', '../components/AssetCanvasEditor.js', '?brandId=b2'],
  ])('%s', async (name, file, query) => {
    seed(); at(query);
    const mod = await import(file);
    const el = mod[name]();
    expect(el.textContent).not.toContain('Brand not found');
    if (name !== 'AssetCanvasEditor') expect(el.textContent).toContain('Beta Co'); // the Asset Editor doesn't print the brand name
    else expect(el.textContent).toContain('Canvas Controls');
  });

  it('with no id at all it opens the first brand instead of "not found"', async () => {
    seed(); at('');
    const { BrandDnaEditor } = await import('../components/BrandDnaEditor.js');
    const el = BrandDnaEditor();
    expect(el.textContent).not.toContain('Brand not found');
    expect(el.textContent).toContain('Alpha Co');
  });

  it('still says "Brand not found" (with a way back) when there are no brands or the id is bad', async () => {
    const { BrandDnaEditor } = await import('../components/BrandDnaEditor.js');
    seed([]); at('');
    expect(BrandDnaEditor().textContent).toContain('Brand not found');
    seed(); at('?id=nope');
    const el = BrandDnaEditor();
    expect(el.textContent).toContain('Brand not found');
    expect(el.textContent).toContain('Back to Brand Studio');
  });

  it('CampaignPage reads ?campaignId=', async () => {
    localStorage.setItem('brand_campaigns', JSON.stringify([{ id: 'c1', brandId: 'b1', goal: 'Launch it', createdAt: new Date().toISOString() }]));
    seed(); at('?campaignId=c1');
    const { CampaignPage } = await import('../components/CampaignPage.js');
    const el = CampaignPage();
    expect(el.textContent).not.toContain('Campaign not found');
    expect(el.textContent).toContain('Launch it');
  });
});

describe('Photo Studio', () => {
  const src = fs.readFileSync('src/components/PhotoStudioPage.js', 'utf8');
  it('follows the brand dropdown for the logo and the saved brand', () => {
    expect(src).toMatch(/let selectedBrand/);
    expect(src).toMatch(/selectedBrand = b \|\| null/);
    expect(src).toContain('logoUrl: state.logoUrl || null');
    expect(src).not.toMatch(/logoUrl: selectedBrand\?\.logoUrl \|\| null,\s*category/); // the generate call must not use the first brand
  });
  it('Animate is a button that hands the photo to Animate Studio, not a root-relative link', () => {
    expect(src).not.toMatch(/href="\/animate/);
    expect(src).toContain('data-photo-animate');
    expect(src).toContain("sessionStorage.setItem('storyboard_animate_frame'");
    expect(src).toContain("navigate('animate')");
  });
  it('the Animate hand-off key is the one Animate Studio reads', () => {
    expect(fs.readFileSync('src/components/AnimatePage.js', 'utf8')).toContain("sessionStorage.getItem('storyboard_animate_frame')");
  });
  it('mounts and lists every brand in the dropdown', async () => {
    seed(); at('?brandId=b2');
    const { PhotoStudioPage } = await import('../components/PhotoStudioPage.js');
    const el = PhotoStudioPage();
    const sel = [...el.querySelectorAll('select')].find((s) => s.textContent.includes('No brand logo'));
    expect(sel).toBeTruthy();
    expect(sel.value).toBe('b2'); // ?brandId= picks the initial brand
    expect([...sel.options].map((o) => o.textContent.trim())).toEqual(['No brand logo', 'Alpha Co', 'Beta Co']);
  });
});
