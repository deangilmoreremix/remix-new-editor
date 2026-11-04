import { describe, expect, it } from 'vitest';
import {
  IMAGE_SLOTS,
  availableImageSlots,
  buildBrandOverlayClips,
  buildPersonalizedImageClip,
  listTimelineImageAssets,
  resolveClipImageSrc,
  resolveImageSlot,
} from '../lib/personalization/timelineAssets.js';

const acme = {
  id: 'c-acme',
  personalization: {
    business: { businessName: 'Acme Roofing', phone: '555-0100', callToAction: 'Book today' },
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
      // Already saved as l1 — must not show twice.
      { id: 'd1', category: 'logo', sourceUrl: 'https://acme.example/logo.png', previewUrl: 'https://acme.example/logo.png', importedAssetId: 'l1' },
      { id: 'd2', category: 'storefront', assignedRole: 'brand_reference', previewUrl: 'https://acme.example/shop.jpg', altText: 'Shop front' },
      { id: 'd3', category: 'product', previewUrl: 'https://acme.example/rejected.jpg', rejected: true },
      { id: 'd4', category: 'irrelevant', previewUrl: 'https://acme.example/icon.png' },
    ],
  },
};

const bolt = {
  id: 'c-bolt',
  personalization: {
    assets: {
      logos: [{ id: 'l9', role: 'logo', url: 'https://cdn/bolt-logo.png' }],
      primaryLogoId: 'l9',
    },
  },
};

describe('listTimelineImageAssets', () => {
  it('lists saved images first, then unsaved image-finder results', () => {
    const list = listTimelineImageAssets(acme);
    expect(list.map((a) => a.url)).toEqual([
      'https://cdn/presenter.png',
      'https://cdn/logo.png',
      'https://cdn/product.png',
      'https://cdn/cta.png',
      'https://acme.example/shop.jpg',
    ]);
    expect(list.at(-1)).toMatchObject({ saved: false, name: 'Shop front', roleLabel: 'Brand' });
    expect(list.find((a) => a.id === 'l1')).toMatchObject({ saved: true, slot: 'logo', videoReady: true });
  });

  it('skips audio, rejected, irrelevant and already-imported assets', () => {
    const urls = listTimelineImageAssets(acme).map((a) => a.url);
    expect(urls).not.toContain('https://cdn/voice.mp3');
    expect(urls).not.toContain('https://acme.example/rejected.jpg');
    expect(urls).not.toContain('https://acme.example/icon.png');
    expect(urls).not.toContain('https://acme.example/logo.png');
  });

  it('returns nothing without a profile', () => {
    expect(listTimelineImageAssets(null)).toEqual([]);
  });
});

describe('image slots', () => {
  it('resolves each slot from the profile', () => {
    expect(resolveImageSlot('logo', acme)).toBe('https://cdn/logo.png');
    expect(resolveImageSlot('presenter', acme)).toBe('https://cdn/presenter.png');
    expect(resolveImageSlot('product', acme)).toBe('https://cdn/product.png');
    expect(resolveImageSlot('cta', acme)).toBe('https://cdn/cta.png');
    expect(resolveImageSlot('firstFrame', acme)).toBe('');
  });

  it('reports which slots a contact can fill', () => {
    const slots = availableImageSlots(bolt);
    expect(slots).toHaveLength(Object.keys(IMAGE_SLOTS).length);
    expect(slots.filter((s) => s.url).map((s) => s.id)).toEqual(['logo']);
  });
});

describe('buildPersonalizedImageClip', () => {
  it('builds a fixed clip from a picked image', () => {
    const asset = listTimelineImageAssets(acme).find((a) => a.url === 'https://acme.example/shop.jpg');
    const clip = buildPersonalizedImageClip({ asset, left: 20, width: 15 });
    expect(clip).toMatchObject({
      type: 'image',
      src: 'https://acme.example/shop.jpg',
      left: 20,
      width: 15,
      personalization: { mode: 'fixed', source: 'website', assetId: null },
    });
  });

  it('builds a dynamic clip that swaps image when the contact changes', () => {
    const clip = buildPersonalizedImageClip({ slot: 'logo', profile: acme, left: 0, width: 100 });
    expect(clip.personalization).toMatchObject({ mode: 'slot', slot: 'logo', token: '{{logoUrl}}' });
    expect(resolveClipImageSrc(clip, acme)).toBe('https://cdn/logo.png');
    expect(resolveClipImageSrc(clip, bolt)).toBe('https://cdn/bolt-logo.png');
  });

  it('falls back to the original image when a contact has nothing in that slot', () => {
    const clip = buildPersonalizedImageClip({ slot: 'presenter', profile: acme });
    expect(resolveClipImageSrc(clip, bolt)).toBe('https://cdn/presenter.png');
  });

  it('keeps clips inside the timeline', () => {
    const clip = buildPersonalizedImageClip({ slot: 'logo', profile: acme, left: 95, width: 30 });
    expect(clip.left + clip.width).toBeLessThanOrEqual(100);
  });

  it('rejects calls with neither an image nor a slot', () => {
    expect(() => buildPersonalizedImageClip({})).toThrow();
    expect(() => buildPersonalizedImageClip({ slot: 'nope' })).toThrow();
  });

  it('leaves ordinary image clips alone', () => {
    expect(resolveClipImageSrc({ type: 'image', src: 'x.png' }, acme)).toBe('x.png');
  });
});

describe('buildBrandOverlayClips', () => {
  it('turns the exact overlay manifest into a logo overlay and CTA end card', () => {
    const clips = buildBrandOverlayClips(acme);
    expect(clips).toHaveLength(2);
    const [logo, cta] = clips;
    expect(logo).toMatchObject({ trackType: 'video', clip: { name: 'Logo overlay', left: 0, width: 100, placement: 'top-right' } });
    expect(logo.clip.personalization.slot).toBe('logo');
    expect(cta.clip).toMatchObject({ name: 'CTA end card', src: 'https://cdn/cta.png' });
    expect(cta.clip.left + cta.clip.width).toBeCloseTo(100);
  });

  it('uses a text end card when there is no CTA graphic', () => {
    const noGraphic = {
      personalization: {
        ...acme.personalization,
        assets: { ...acme.personalization.assets, ctaGraphic: null },
      },
    };
    const textCard = buildBrandOverlayClips(noGraphic).find((c) => c.trackType === 'text');
    expect(textCard.clip).toMatchObject({ type: 'text', heading: 'Book today' });
    expect(textCard.clip.body).toContain('555-0100');
  });

  it('respects the profile choosing AI-reference logos instead of overlays', () => {
    const aiLogo = {
      personalization: {
        ...acme.personalization,
        generationOptions: { exactLogoHandling: 'ai-reference', exactCtaHandling: 'final-end-card' },
      },
    };
    expect(buildBrandOverlayClips(aiLogo).map((c) => c.clip.name)).toEqual(['CTA end card']);
  });
});
