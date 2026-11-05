import { describe, expect, it } from 'vitest';
import {
  LOGO_OVERLAY_GEOMETRY,
  buildBrandOverlayPlan,
  imageTokenChoices,
  listTimelineImageAssets,
} from '../lib/personalization/timelineAssets.js';
import { resolveOverlayText } from '../lib/editor/addons/overlayRender.js';

const acme = {
  id: 'c-acme',
  personalization: {
    business: { businessName: 'Acme Roofing', phone: '555-0100', callToAction: 'Book today', website: 'https://acme.example' },
    assets: {
      identities: [{ id: 'p1', role: 'presenter_identity', name: 'Owner', url: 'https://cdn/presenter.png' }],
      primaryIdentityId: 'p1',
      logos: [{ id: 'l1', role: 'logo', name: 'Logo', url: 'https://cdn/logo.png', originalUrl: 'https://acme.example/logo.png', videoReady: true }],
      primaryLogoId: 'l1',
      products: [{ id: 'pr1', role: 'product_reference', url: 'https://cdn/product.png' }],
      ctaGraphic: { id: 'cta', role: 'cta_graphic', url: 'https://cdn/cta.png' },
      audio: [{ id: 'a1', role: 'audio_reference', url: 'https://cdn/voice.mp3', mimeType: 'audio/mpeg' }],
    },
    discoveredAssets: [
      { id: 'd1', category: 'logo', sourceUrl: 'https://acme.example/logo.png', previewUrl: 'https://acme.example/logo.png', importedAssetId: 'l1' },
      { id: 'd2', category: 'storefront', assignedRole: 'brand_reference', previewUrl: 'https://acme.example/shop.jpg', altText: 'Shop front' },
      { id: 'd3', category: 'product', previewUrl: 'https://acme.example/rejected.jpg', rejected: true },
      { id: 'd4', category: 'irrelevant', previewUrl: 'https://acme.example/icon.png' },
    ],
  },
  variables: {},
};

const noCtaGraphic = {
  ...acme,
  personalization: { ...acme.personalization, assets: { ...acme.personalization.assets, ctaGraphic: null } },
};

describe('listTimelineImageAssets', () => {
  it('lists saved images first, then unsaved image-finder results', () => {
    const list = listTimelineImageAssets(acme);
    expect(list.map((a) => a.src)).toEqual([
      'https://cdn/presenter.png',
      'https://cdn/logo.png',
      'https://cdn/product.png',
      'https://cdn/cta.png',
      'https://acme.example/shop.jpg',
    ]);
    expect(list.at(-1)).toMatchObject({ saved: false, name: 'Shop front', roleLabel: 'Brand' });
    expect(list.at(-1).discovered.id).toBe('d2');
    expect(list.find((a) => a.id === 'l1')).toMatchObject({ saved: true, videoReady: true });
  });

  it('skips audio, rejected, irrelevant and already-imported images', () => {
    const srcs = listTimelineImageAssets(acme).map((a) => a.src);
    expect(srcs).not.toContain('https://cdn/voice.mp3');
    expect(srcs).not.toContain('https://acme.example/rejected.jpg');
    expect(srcs).not.toContain('https://acme.example/icon.png');
    expect(srcs).not.toContain('https://acme.example/logo.png');
  });

  it('returns nothing without a contact', () => {
    expect(listTimelineImageAssets(null)).toEqual([]);
  });
});

describe('imageTokenChoices', () => {
  it("shows each image token with the contact's current image", () => {
    const choices = imageTokenChoices(acme);
    expect(choices.find((c) => c.key === 'logoUrl')).toMatchObject({ label: 'Logo', preview: 'https://cdn/logo.png' });
    expect(choices.find((c) => c.key === 'avatarUrl')).toMatchObject({ label: 'Presenter photo', preview: 'https://cdn/presenter.png' });
    expect(choices.find((c) => c.key === 'firstFrameUrl').preview).toBeNull();
  });

  it('works with no contact selected', () => {
    expect(imageTokenChoices(null).every((c) => c.preview === null)).toBe(true);
  });
});

describe('buildBrandOverlayPlan', () => {
  it('turns the exact overlay manifest into a logo overlay and CTA end card', () => {
    const plan = buildBrandOverlayPlan(acme, { timelineSeconds: 30 });
    expect(plan).toHaveLength(2);
    const [logo, cta] = plan;
    expect(logo).toMatchObject({
      type: 'overlay-personalized-image', name: 'Logo overlay', startSec: 0, endSec: 30,
      addon: { src: '{{logoUrl}}', fallbackSrc: '', fit: 'contain', geometry: LOGO_OVERLAY_GEOMETRY },
    });
    expect(cta).toMatchObject({ type: 'overlay-personalized-image', startSec: 26, endSec: 30, addon: { src: '{{ctaImageUrl}}' } });
  });

  it('uses tokens so each contact gets their own logo', () => {
    const [logo] = buildBrandOverlayPlan(acme, { timelineSeconds: 30 });
    const bolt = { id: 'b', personalization: { assets: { logos: [{ id: 'x', url: 'https://cdn/bolt.png' }] } } };
    expect(resolveOverlayText(logo.addon.src, acme)).toBe('https://cdn/logo.png');
    expect(resolveOverlayText(logo.addon.src, bolt)).toBe('https://cdn/bolt.png');
  });

  it('uses a Smart Text end card when there is no CTA graphic', () => {
    const textCard = buildBrandOverlayPlan(noCtaGraphic, { timelineSeconds: 30 }).find((i) => i.type === 'overlay-text');
    expect(textCard.addon.text).toBe('{{callToAction}}\n{{businessPhone}}\n{{website}}');
    expect(resolveOverlayText(textCard.addon.text, noCtaGraphic)).toBe('Book today\n555-0100\nhttps://acme.example');
  });

  it('respects the contact choosing AI-reference logos instead of overlays', () => {
    const aiLogo = {
      ...acme,
      personalization: { ...acme.personalization, generationOptions: { exactLogoHandling: 'ai-reference', exactCtaHandling: 'final-end-card' } },
    };
    expect(buildBrandOverlayPlan(aiLogo, { timelineSeconds: 30 }).map((i) => i.name)).toEqual(['CTA end card']);
  });

  it('returns nothing without a contact', () => {
    expect(buildBrandOverlayPlan(null)).toEqual([]);
  });
});
