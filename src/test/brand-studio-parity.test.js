// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';

const muapiMock = vi.hoisted(() => ({
  text: vi.fn(),
  image: vi.fn(async () => 'https://img/new.png'),
  imageEdit: vi.fn(async () => 'https://img/edit.png'),
  imageEdit2: vi.fn(async () => 'https://img/photo.png'),
  uploadBrandAsset: vi.fn(async () => 'https://img/uploaded.png'),
}));
vi.mock('../lib/muapi.js', () => ({ muapi: muapiMock }));

const BRAND = {
  id: 'b1', brandName: 'Beta Co', industry: 'y', logoUrl: 'https://x/logo.png', fonts: ['Poppins'],
  toneOfVoice: ['bold'], brandPersonality: ['fun'], primaryColors: ['#112233'], secondaryColors: ['#445566'], imageryStyle: 'cinematic', layoutStyle: 'modern',
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  localStorage.setItem('brand_dna_list', JSON.stringify([BRAND]));
});

describe('Photo Studio presets', () => {
  it('has 6 categories × 5 styles = 30 presets, each with an aspect and prompt', async () => {
    const { PHOTO_CATEGORIES, ALL_PHOTO_PRESETS } = await import('../lib/photoStudio.js');
    expect(PHOTO_CATEGORIES).toHaveLength(6);
    PHOTO_CATEGORIES.forEach((c) => expect(c.styles).toHaveLength(5));
    expect(ALL_PHOTO_PRESETS).toHaveLength(30);
    ALL_PHOTO_PRESETS.forEach(({ style }) => {
      expect(style.prompt.length).toBeGreaterThan(20);
      expect(['1:1', '4:5', '16:9']).toContain(style.aspect);
    });
  });
  it('builds a brand-aware prompt and sends the product + logo as references at the preset aspect', async () => {
    const { generateProductPhoto } = await import('../lib/photoStudio.js');
    const r = await generateProductPhoto({ productImageUrl: 'https://x/p.png', logoUrl: 'https://x/logo.png', brand: BRAND, category: 'home', style: 'scandi_living', direction: 'plus a mug' });
    const [prompt, refs, opts] = muapiMock.imageEdit2.mock.calls[0];
    expect(refs).toEqual(['https://x/p.png', 'https://x/logo.png']);
    expect(opts.aspectRatio).toBe('16:9');
    expect(prompt).toContain('#112233');
    expect(prompt).toContain('Brand imagery style: cinematic');
    expect(prompt).toContain('plus a mug');
    expect(r).toMatchObject({ aspect: '16:9', categoryId: 'home', styleId: 'scandi_living' });
  });
  it('the page lists all 30 presets', async () => {
    window.history.replaceState({}, '', '/?brandId=b1#/x');
    const { PhotoStudioPage } = await import('../components/PhotoStudioPage.js');
    const el = PhotoStudioPage();
    expect(el.querySelectorAll('[data-photo-preset]')).toHaveLength(30);
    expect(el.querySelectorAll('[data-photo-category]')).toHaveLength(6);
  });
});

describe('asset generation', () => {
  const concept = { index: 2, title: 'T', theme: 'th', key_message: 'km', hook: 'h', cta: 'Go', tone_notes: 'tn', visual_direction: 'vd' };
  it('passes the brand logo (not the prompt text) as the reference image', async () => {
    muapiMock.text.mockResolvedValue('{"headline":"One two three","body":"b","cta":"Shop now please ok"}');
    const { generateAssetForConcept } = await import('../lib/campaignGenerator.js');
    const asset = await generateAssetForConcept(BRAND, concept, 'instagram-feed');
    const [prompt, refs, aspect] = muapiMock.imageEdit.mock.calls[0];
    expect(refs).toEqual(['https://x/logo.png']);
    expect(prompt).toContain('NO text');
    expect(prompt).toContain('#112233');
    expect(aspect).toBe('1:1');
    expect(asset.cta.split(' ').length).toBeLessThanOrEqual(3); // word cap
    expect(asset.variants).toEqual({ conceptIndex: 2, platformId: 'instagram-feed' });
    expect(asset.layout.headline.text).toBe('One two three');
  });
  it('uses text-to-image when the brand has no logo', async () => {
    muapiMock.text.mockResolvedValue('{"headline":"h","body":"b","cta":"c"}');
    const { generateAssetForConcept } = await import('../lib/campaignGenerator.js');
    await generateAssetForConcept({ ...BRAND, logoUrl: null }, concept, 'instagram-story');
    expect(muapiMock.imageEdit).not.toHaveBeenCalled();
    expect(muapiMock.image).toHaveBeenCalledWith(expect.any(String), '9:16');
  });
  it('generates exactly 4 concepts max', async () => {
    muapiMock.text.mockResolvedValue(JSON.stringify({ concepts: Array.from({ length: 6 }, (_, i) => ({ title: `c${i}` })) }));
    const { generateCampaignConcepts } = await import('../lib/campaignGenerator.js');
    expect(await generateCampaignConcepts(BRAND, 'sales')).toHaveLength(4);
  });
});

describe('canvas editor', () => {
  const seedAsset = () => {
    localStorage.setItem('brand_campaigns', JSON.stringify([{ id: 'c1', brandId: 'b1', concepts: [{ title: 'T', visual_direction: 'vd' }] }]));
    localStorage.setItem('brand_assets', JSON.stringify([{ id: 'a1', campaignId: 'c1', platform: 'instagram-feed', headline: 'Hello', body: 'World', cta: 'Go', imageUrl: 'https://img/old.png', variants: { conceptIndex: 0, platformId: 'instagram-feed' } }]));
    window.history.replaceState({}, '', '/?id=a1#/asset-edit');
  };
  const mount = async () => (await import('../components/AssetCanvasEditor.js')).AssetCanvasEditor();

  it('shows a not-found state for an unknown asset', async () => {
    window.history.replaceState({}, '', '/?id=nope#/asset-edit');
    expect((await mount()).textContent).toContain('Asset not found');
  });
  it('loads the saved asset onto the canvas with a 9-position grid', async () => {
    seedAsset();
    const el = await mount();
    expect(el.querySelector('[data-block="headline"]').textContent).toBe('Hello');
    expect(el.querySelectorAll('[data-choice^="top-"],[data-choice^="middle-"],[data-choice^="bottom-"]')).toHaveLength(9);
  });
  it('moves a block, then saves layout + text back to the asset', async () => {
    seedAsset();
    const el = await mount();
    el.querySelector('[data-choice="top-right"]').click();
    el.querySelector('textarea').value = 'Edited';
    el.querySelector('textarea').dispatchEvent(new Event('input'));
    el.querySelector('[data-action="save"]').click();
    const saved = JSON.parse(localStorage.getItem('brand_assets'))[0];
    expect(saved.headline).toBe('Edited');
    expect(saved.layout.headline.position).toBe('top-right');
  });
  it('"Clean background" regenerates a text-free image with the logo reference', async () => {
    seedAsset();
    const el = await mount();
    el.querySelector('[data-action="clean-background"]').click();
    await vi.waitFor(() => expect(muapiMock.imageEdit).toHaveBeenCalled());
    expect(muapiMock.imageEdit.mock.calls[0][0]).toContain('NO text');
    await vi.waitFor(() => expect(el.querySelector('#asset-canvas img').getAttribute('src')).toBe('https://img/edit.png'));
  });
});

describe('campaign persistence', () => {
  it('the wizard saves the campaign and each asset', () => {
    const src = fs.readFileSync('src/components/CampaignWizard.js', 'utf8');
    expect(src).toContain('saveCampaign({');
    expect(src).toContain('saveAsset(asset);');
    expect(src).toContain("navigate('asset-edit'");
  });
});
