import { describe, expect, it } from 'vitest';
import '../lib/editor/addons/index.js';
import {
  PLATE_COLORS,
  assetForUrl,
  focusFor,
  luminanceFromPixels,
  personalizedImageLook,
  plateColorFor,
} from '../lib/personalization/imageStyle.js';
import {
  PERSONALIZED_LAYOUTS,
  assetForImageToken,
  buildLayoutPlan,
  imageTokenOf,
} from '../lib/personalization/timelineAssets.js';
import { timelineToComposition } from '../lib/editor/remotion/timelineToComposition.js';
import { resolveOverlayText } from '../lib/editor/addons/overlayRender.js';

const darkLogo = { id: 'l1', role: 'logo', url: 'https://cdn.example/dark-logo.png', luminance: 0.1 };
const whiteLogo = { id: 'l2', role: 'logo', url: 'https://cdn.example/white-logo.png', luminance: 0.95 };
const presenter = { id: 'p1', role: 'presenter_identity', url: 'https://cdn.example/ann.png' };
const focused = { id: 'pr1', role: 'product_reference', url: 'https://cdn.example/roof.png', focus: { x: 20, y: 80 } };

const acme = {
  id: 'c_acme',
  contact: { firstName: 'Ann' },
  personalization: {
    business: { businessName: 'Acme Roofing', offer: 'Free inspection' },
    assets: { logos: [darkLogo], primaryLogoId: 'l1', identities: [presenter], products: [focused], firstFrame: { id: 'f', url: 'https://cdn.example/first.png' } },
  },
  variables: {},
};
const bolt = { id: 'c_bolt', personalization: { assets: { logos: [whiteLogo] } }, variables: {} };

describe('crop focus', () => {
  it('uses the focus point saved on the contact image', () => {
    expect(focusFor(focused)).toEqual({ x: 20, y: 80 });
  });

  it('keeps faces in view by default', () => {
    expect(focusFor(presenter)).toEqual({ x: 50, y: 30 });
    expect(focusFor({ role: 'product_reference' })).toEqual({ x: 50, y: 50 });
  });

  it('clamps bad values', () => {
    expect(focusFor({ focus: { x: 140, y: 'x' } })).toEqual({ x: 100, y: 50 });
  });

  it('finds the saved asset behind a URL', () => {
    expect(assetForUrl(acme, 'https://cdn.example/roof.png').id).toBe('pr1');
    expect(assetForUrl(acme, 'https://elsewhere/x.png')).toBeNull();
  });
});

describe('logo backing plate', () => {
  it('auto picks a light plate for dark logos and a dark plate for light ones', () => {
    expect(plateColorFor('auto', darkLogo)).toBe(PLATE_COLORS.light);
    expect(plateColorFor('auto', whiteLogo)).toBe(PLATE_COLORS.dark);
    expect(plateColorFor('auto', { luminance: null })).toBe(PLATE_COLORS.light);
  });

  it('honours a fixed choice, and none by default', () => {
    expect(plateColorFor('dark', darkLogo)).toBe(PLATE_COLORS.dark);
    expect(plateColorFor('', darkLogo)).toBeNull();
  });

  it('measures brightness from visible pixels only', () => {
    // one white opaque pixel, one black transparent pixel
    expect(luminanceFromPixels(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0]))).toBe(1);
    expect(luminanceFromPixels(new Uint8ClampedArray([0, 0, 0, 0]))).toBeNull();
  });
});

describe('personalizedImageLook', () => {
  it('combines fit, focus and plate for a contact', () => {
    expect(personalizedImageLook({ fit: 'contain', plate: 'auto' }, whiteLogo.url, bolt))
      .toEqual({ objectFit: 'contain', objectPosition: '50% 50%', plateColor: PLATE_COLORS.dark });
    expect(personalizedImageLook({}, focused.url, acme))
      .toEqual({ objectFit: 'cover', objectPosition: '20% 80%', plateColor: null });
  });

  it('reaches the export composition per contact', () => {
    const project = {
      timelineSeconds: 10,
      tracks: [{ id: 't', items: [{ id: 'logo', type: 'overlay-personalized-image', left: 0, width: 100, addon: { src: '{{logoUrl}}', fit: 'contain', plate: 'auto', geometry: { left: 70, top: 5, width: 25, height: 20 } } }] }],
    };
    const optsFor = (profile) => {
      const layer = timelineToComposition(project, { fps: 30, quality: '720p', profile }).layers.find((l) => l.id === 'logo');
      return layer.options || layer.o || layer;
    };
    expect(JSON.stringify(optsFor(acme))).toContain(PLATE_COLORS.light);
    expect(JSON.stringify(optsFor(bolt))).toContain(PLATE_COLORS.dark);
  });
});

describe('personalized layouts', () => {
  it('offers the four layouts', () => {
    expect(PERSONALIZED_LAYOUTS.map((l) => l.id)).toEqual(['brand', 'presenterIntro', 'productSpotlight', 'openingFrame']);
  });

  it('presenter intro: circle photo and a greeting with a default', () => {
    const plan = buildLayoutPlan('presenterIntro', acme, { timelineSeconds: 30, startSec: 2 });
    expect(plan.map((i) => [i.type, i.startSec, i.endSec])).toEqual([
      ['overlay-personalized-image', 2, 7], ['overlay-text', 2, 7],
    ]);
    expect(plan[0].addon).toMatchObject({ src: '{{avatarUrl}}', imageshape: 'circle' });
    expect(resolveOverlayText(plan[1].addon.text, acme)).toBe('Hi Ann!');
    expect(resolveOverlayText(plan[1].addon.text, bolt)).toBe('Hi there!');
  });

  it('product spotlight and opening frame use their tokens', () => {
    const spot = buildLayoutPlan('productSpotlight', acme, { timelineSeconds: 30 });
    expect(spot[0].addon.src).toBe('{{productImageUrl}}');
    expect(resolveOverlayText(spot[1].addon.text, acme)).toBe('Acme Roofing\nFree inspection');
    const open = buildLayoutPlan('openingFrame', acme, { timelineSeconds: 30 });
    expect(open[0]).toMatchObject({ startSec: 0, endSec: 3, addon: { src: '{{firstFrameUrl}}' } });
  });

  it('logo layout uses an automatic backing plate', () => {
    const [logo] = buildLayoutPlan('brand', acme, { timelineSeconds: 30 });
    expect(logo.addon.plate).toBe('auto');
  });

  it('keeps layouts inside short timelines', () => {
    const plan = buildLayoutPlan('productSpotlight', acme, { timelineSeconds: 4, startSec: 3.5 });
    expect(plan.every((i) => i.startSec < i.endSec && i.endSec <= 4)).toBe(true);
  });

  it('unknown layouts add nothing', () => {
    expect(buildLayoutPlan('nope', acme)).toEqual([]);
  });
});

describe('token helpers', () => {
  it('reads the image token from a source', () => {
    expect(imageTokenOf('{{logoUrl}}')).toBe('logoUrl');
    expect(imageTokenOf('{{d image "https://x"}}')).toBe('avatarUrl');
    expect(imageTokenOf('{{firstName}}')).toBeNull();
    expect(imageTokenOf('https://x.png')).toBeNull();
  });

  it('finds the asset behind a token for a contact', () => {
    expect(assetForImageToken(acme, 'logoUrl').id).toBe('l1');
    expect(assetForImageToken(acme, 'productImageUrl').id).toBe('pr1');
    expect(assetForImageToken(bolt, 'ctaImageUrl')).toBeNull();
  });
});
