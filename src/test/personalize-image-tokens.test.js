// Image tokens resolve from the images the Personalize window's image finder
// saves (profile.personalization.assets), per contact, in the editor preview
// and in exports.

import { describe, it, expect } from 'vitest';
import {
  IMAGE_TOKEN_DEFS,
  buildVariables,
  canonicalTokenKey,
  resolveToken,
} from '../components/personalize/tokenSchema.js';
import { resolveOverlayText } from '../lib/editor/addons/overlayRender.js';
import '../lib/editor/addons/index.js';
import { timelineToComposition } from '../lib/editor/remotion/timelineToComposition.js';

const acme = {
  id: 'c_acme',
  personalization: {
    assets: {
      identities: [{ id: 'p1', role: 'presenter_identity', url: 'https://cdn.example/ann.png' }],
      primaryIdentityId: 'p1',
      logos: [
        { id: 'l1', role: 'logo', url: 'https://cdn.example/acme-old.png' },
        { id: 'l2', role: 'logo', url: 'https://cdn.example/acme.png' },
      ],
      primaryLogoId: 'l2',
      products: [{ id: 'pr1', role: 'product_reference', url: 'https://cdn.example/shingles.png' }],
      ctaGraphic: { id: 'cta', role: 'cta_graphic', url: 'https://cdn.example/book-now.png' },
    },
  },
  variables: {},
};

const bolt = {
  id: 'c_bolt',
  personalization: { assets: { logos: [{ id: 'l9', role: 'logo', url: 'https://cdn.example/bolt.png' }] } },
  variables: {},
};

describe('image tokens', () => {
  it('lists the image tokens for pickers', () => {
    expect(IMAGE_TOKEN_DEFS.map((d) => d.key)).toEqual([
      'logoUrl', 'avatarUrl', 'productImageUrl', 'brandImageUrl', 'ctaImageUrl', 'firstFrameUrl', 'lastFrameUrl',
    ]);
  });

  it('resolve from image-finder assets, using the primary logo and presenter', () => {
    expect(resolveToken(acme, 'logoUrl')).toBe('https://cdn.example/acme.png');
    expect(resolveToken(acme, 'avatarUrl')).toBe('https://cdn.example/ann.png');
    expect(resolveToken(acme, 'productImageUrl')).toBe('https://cdn.example/shingles.png');
    expect(resolveToken(acme, 'ctaImageUrl')).toBe('https://cdn.example/book-now.png');
    expect(resolveToken(acme, 'firstFrameUrl')).toBeNull();
  });

  it('resolve per contact', () => {
    expect(resolveOverlayText('{{logoUrl}}', acme)).toBe('https://cdn.example/acme.png');
    expect(resolveOverlayText('{{logoUrl}}', bolt)).toBe('https://cdn.example/bolt.png');
    expect(resolveOverlayText('{{ctaImageUrl}}', bolt)).toBe('{{ctaImageUrl}}');
  });

  it('prefer live assets over a stale saved variables map', () => {
    const stale = { ...acme, variables: buildVariables({ ...acme, personalization: { assets: { logos: [{ id: 'x', url: 'https://cdn.example/stale.png' }] } } }) };
    expect(stale.variables.logoUrl).toBe('https://cdn.example/stale.png');
    expect(resolveToken(stale, 'logoUrl')).toBe('https://cdn.example/acme.png');
  });

  it('keep older profiles working', () => {
    const legacy = { assets: { logos: ['https://img.example/logo.svg'] }, contact: { avatarUrl: 'https://img.example/a.png' } };
    expect(resolveToken(legacy, 'logoUrl')).toBe('https://img.example/logo.svg');
    expect(resolveToken(legacy, 'avatarUrl')).toBe('https://img.example/a.png');
  });

  it("map the original editor's {{image}} token to the presenter photo", () => {
    expect(canonicalTokenKey('image')).toBe('avatarUrl');
    expect(resolveOverlayText('{{image}}', acme)).toBe('https://cdn.example/ann.png');
    expect(resolveOverlayText('{{d image "https://cdn.example/fallback.png"}}', bolt)).toBe('https://cdn.example/fallback.png');
  });

  it('render the right image for each contact in an export', () => {
    const project = {
      timelineSeconds: 10,
      tracks: [{
        id: 'ov', type: 'overlay', name: 'Overlays',
        items: [{
          id: 'logo', type: 'overlay-personalized-image', left: 0, width: 100,
          addon: { src: '{{logoUrl}}', fallbackSrc: 'https://cdn.example/fallback.png', geometry: { left: 70, top: 5, width: 25, height: 20 } },
        }],
      }],
    };
    const srcFor = (profile) => {
      const model = timelineToComposition(project, { fps: 30, quality: '720p', profile });
      const json = JSON.stringify(model);
      return ['acme.png', 'bolt.png', 'fallback.png'].find((name) => json.includes(name));
    };
    expect(srcFor(acme)).toBe('acme.png');
    expect(srcFor(bolt)).toBe('bolt.png');
    expect(srcFor({ id: 'c_none', variables: {} })).toBe('fallback.png');
  });
});
