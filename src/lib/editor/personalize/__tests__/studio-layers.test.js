import { describe, it, expect } from 'vitest';
import { studioLayersToPlan } from '../studioLayers.js';

const layer = (o) => ({ id: o.kind, visible: true, x: 0.1, y: 0.2, scale: 1, animation: 'none', animationDelay: 0, startFrame: 0, opacity: 1, ...o });
const opts = { fps: 30, durationInFrames: 300, timelineSeconds: 60 };

describe('studioLayersToPlan', () => {
  it('maps a logo layer to a tokenised Personalized Image, in percent and seconds', () => {
    const [clip] = studioLayersToPlan([layer({ kind: 'logo', x: 0.7, y: 0.05, startFrame: 30, endFrame: 150 })], opts);
    expect(clip.type).toBe('overlay-personalized-image');
    expect(clip.addon.src).toBe('{{logoUrl}}');
    expect(clip.addon.fallbackSrc).toBe('');
    expect(clip.addon.geometry).toMatchObject({ left: 70, top: 5, width: 20, height: 14 });
    expect(clip.startSec).toBe(1);
    expect(clip.endSec).toBe(5);
  });

  it('uses tokens for brand text so each contact gets their own', () => {
    const plan = studioLayersToPlan([layer({ kind: 'businessName' }), layer({ kind: 'cta' }), layer({ kind: 'offer' })], opts);
    expect(plan.map((c) => c.addon.text)).toEqual(['{{businessName}}', '{{callToAction}}', '{{offer}}']);
  });

  it('turns a design layer whose text is a brand value back into its token, keeps other text literal', () => {
    const brand = { businessName: 'Acme Plumbing', cta: 'Call now' };
    const plan = studioLayersToPlan([
      layer({ kind: 'design', text: 'Acme Plumbing' }),
      layer({ kind: 'tagline', text: 'Since 1999' }),
    ], { ...opts, brand });
    expect(plan.map((c) => c.addon.text)).toEqual(['{{businessName}}', 'Since 1999']);
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

  it('keeps the box inside the frame and scales it', () => {
    const [clip] = studioLayersToPlan([layer({ kind: 'cta', x: 0.95, y: 0.95, scale: 2 })], opts);
    const g = clip.addon.geometry;
    expect(g.left + g.width).toBeLessThanOrEqual(100);
    expect(g.top + g.height).toBeLessThanOrEqual(100);
    expect(g.width).toBe(72);
  });

  it('returns [] for no layers', () => {
    expect(studioLayersToPlan(undefined, opts)).toEqual([]);
  });
});
