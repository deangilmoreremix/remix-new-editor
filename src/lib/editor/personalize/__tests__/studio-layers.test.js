import { describe, it, expect } from 'vitest';
import { studioLayersToPlan } from '../studioLayers.js';

const layer = (o) => ({ id: o.kind, visible: true, x: 0.5, y: 0.5, scale: 0.2, animation: 'none', animationDelay: 0, startFrame: 0, opacity: 1, ...o });
const opts = { fps: 30, durationInFrames: 300, timelineSeconds: 60 };

// A design shaped like the Studio registry's (templates/types.ts).
const design = {
  id: 'promo-cta',
  name: 'Promo CTA',
  textSlots: [
    { key: 'title', field: 'headline', primary: true },
    { key: 'button', field: 'cta' },
    { key: 'site', field: 'website' },
  ],
};

describe('studioLayersToPlan', () => {
  it('centres boxes on x/y like the Studio does, and sizes images as squares', () => {
    const [clip] = studioLayersToPlan([layer({ kind: 'logo', x: 0.8, y: 0.1, scale: 0.1, startFrame: 30, endFrame: 150 })], opts);
    expect(clip.type).toBe('overlay-personalized-image');
    expect(clip.addon.src).toBe('{{logoUrl}}');
    expect(clip.addon.fallbackSrc).toBe('');
    // width 10% of the frame; square in pixels on 16:9 -> 17.8% of the height
    expect(clip.addon.geometry).toMatchObject({ left: 75, top: 1.1, width: 10, height: 17.8 });
    expect(clip.startSec).toBe(1);
    expect(clip.endSec).toBe(5);
  });

  it('uses tokens for brand text and scale as the font size', () => {
    const plan = studioLayersToPlan([layer({ kind: 'businessName', scale: 0.06 }), layer({ kind: 'cta' }), layer({ kind: 'offer' })], opts);
    expect(plan.map((c) => c.addon.text)).toEqual(['{{businessName}}', '{{callToAction}}', '{{offer}}']);
    expect(plan[0].addon.fontSize).toBe(6);
  });

  it('turns literal text equal to a brand value back into its token, keeps other text', () => {
    const brand = { businessName: 'Acme Plumbing', cta: 'Call now' };
    const plan = studioLayersToPlan([
      layer({ kind: 'tagline', text: 'Acme Plumbing' }),
      layer({ kind: 'tagline', text: 'Since 1999' }),
    ], { ...opts, brand });
    expect(plan.map((c) => c.addon.text)).toEqual(['{{businessName}}', 'Since 1999']);
  });

  it('maps a design layer to a Studio Design clip with tokenised slots', () => {
    const [clip] = studioLayersToPlan([
      layer({ kind: 'design', designId: 'promo-cta', scale: 0.5, text: 'Spring sale', textSlotOverrides: { site: 'acme.test' } }),
    ], { ...opts, designFor: (id) => (id === 'promo-cta' ? design : undefined), brand: { website: 'acme.test' } });
    expect(clip.type).toBe('overlay-studio-design');
    expect(clip.addon.designId).toBe('promo-cta');
    expect(clip.addon.slots).toEqual({ title: 'Spring sale', button: '{{callToAction}}', site: '{{website}}' });
    expect(clip.addon.geometry).toMatchObject({ left: 25, top: 25, width: 50, height: 50 });
  });

  it('keeps a design layer whose design is unknown (its overrides only) and skips one with no design id', () => {
    const plan = studioLayersToPlan([
      layer({ kind: 'design', designId: 'gone', textSlotOverrides: { title: 'Hi' } }),
      layer({ kind: 'design' }),
    ], opts);
    expect(plan).toHaveLength(1);
    expect(plan[0].addon.slots).toEqual({ title: 'Hi' });
  });

  it('offsets onto the timeline, clamps to its length and skips hidden or empty layers', () => {
    const plan = studioLayersToPlan([
      layer({ kind: 'logo' }),
      layer({ kind: 'headline', visible: false }),
      layer({ kind: 'tagline', text: '   ' }),
    ], { fps: 30, durationInFrames: 3000, timelineSeconds: 20, startSec: 10 });
    expect(plan).toHaveLength(1);
    expect(plan[0].startSec).toBe(10);
    expect(plan[0].endSec).toBe(20);
  });

  it('keeps every box inside the frame', () => {
    const [clip] = studioLayersToPlan([layer({ kind: 'design', designId: 'a', x: 0.98, y: 0.98, scale: 0.6 })], opts);
    const g = clip.addon.geometry;
    expect(g.left + g.width).toBeLessThanOrEqual(100);
    expect(g.top + g.height).toBeLessThanOrEqual(100);
  });

  it('returns [] for no layers', () => {
    expect(studioLayersToPlan(undefined, opts)).toEqual([]);
  });
});
