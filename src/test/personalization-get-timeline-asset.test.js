import { describe, expect, it } from 'vitest';
import { getTimelineAsset, listTimelineImageAssets } from '../lib/personalization/timelineAssets.js';

const acme = {
  id: 'c-acme',
  personalization: {
    business: { businessName: 'Acme Roofing' },
    assets: {
      logos: [{ id: 'l1', role: 'logo', name: 'Logo', url: 'https://cdn/logo.png', videoReady: true }, { id: 'l2', role: 'logo', name: 'Old logo', url: 'https://cdn/old.png' }],
      primaryLogoId: 'l2',
      products: [{ id: 'pr1', role: 'product_reference', url: 'https://cdn/product.png' }],
      audio: [{ id: 'a1', role: 'audio_reference', url: 'https://cdn/voice.mp3', mimeType: 'audio/mpeg' }],
    },
    discoveredAssets: [],
  },
  variables: {},
};

describe('getTimelineAsset', () => {
  it('finds an asset by its id, in the same shape the list uses', () => {
    const a = getTimelineAsset(acme, 'pr1');
    expect(a).toEqual(listTimelineImageAssets(acme).find((x) => x.id === 'pr1'));
    expect(a).toMatchObject({ id: 'pr1', src: 'https://cdn/product.png', saved: true });
  });

  it('finds the contact\'s image for an image token: the primary logo, not just the first one', () => {
    expect(getTimelineAsset(acme, 'logoUrl')).toMatchObject({ id: 'l2', src: 'https://cdn/old.png' });
    expect(getTimelineAsset(acme, ' productImageUrl ')?.id).toBe('pr1');
  });

  it('is null when there is nothing to find: no contact, no id, an unknown id or token, a non-image asset', () => {
    expect(getTimelineAsset(null, 'l1')).toBeNull();
    expect(getTimelineAsset(acme, '')).toBeNull();
    expect(getTimelineAsset(acme, undefined)).toBeNull();
    expect(getTimelineAsset(acme, 'nope')).toBeNull();
    expect(getTimelineAsset(acme, 'ctaImageUrl')).toBeNull(); // this contact has no CTA graphic
    expect(getTimelineAsset(acme, 'a1')).toBeNull(); // audio is not a timeline image
  });
});
