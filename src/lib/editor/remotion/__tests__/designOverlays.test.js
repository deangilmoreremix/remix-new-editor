import { describe, it, expect } from 'vitest';
import { designIdsInModel, getDesignOverlay, loadDesigns } from '../designOverlays.js';
import { timelineToComposition } from '../timelineToComposition.js';
import '../../addons/index.js';

const clip = (over = {}) => ({
  id: 'd1', type: 'overlay-design', start: 2, end: 8,
  addon: { designId: 'animated-headline', text: 'Hi {{firstName}}', textSlotOverrides: { business: 'For {{businessName}}' }, imageUrl: 'https://a.test/x.png', geometry: { left: 10, top: 20, width: 50, height: 28 }, opacity: 100, ...over },
});
const state = (...items) => ({ timelineSeconds: 20, tracks: [{ id: 't', name: 'Titles', type: 'text', items }] });
const profile = { id: 'c1', name: 'Ann Lee', contact: { firstName: 'Ann', name: 'Ann Lee' }, personalization: { business: { businessName: 'Acme Plumbing', ctaHeadline: 'Hot water today', callToAction: 'Call now' }, assets: { logos: [{ id: 'l', role: 'logo', url: 'https://a.test/logo.png' }], primaryLogoId: 'l' } } };

describe('design overlays in the composition model', () => {
  it('resolves the contact\'s brand, text tokens and image up front', () => {
    const m = timelineToComposition(state(clip()), { profile });
    const layer = m.layers.find((l) => l.type === 'overlay-design');
    expect(layer).toMatchObject({ kind: 'overlay', from: 60, durationInFrames: 180 });
    const o = layer.options;
    expect(o.designId).toBe('animated-headline');
    expect(o.text).toBe('Hi Ann');
    expect(o.textSlotOverrides).toEqual({ business: 'For Acme Plumbing' });
    expect(o.resolvedBrand).toMatchObject({ businessName: 'Acme Plumbing', headline: 'Hot water today', cta: 'Call now', logoUrl: 'https://a.test/logo.png' });
    expect(o.resolvedImage).toBe('https://a.test/x.png');
  });
  it('gives each contact their own brand', () => {
    const other = { ...profile, id: 'c2', personalization: { business: { businessName: 'Bright Dental' }, assets: {} } };
    const a = timelineToComposition(state(clip()), { profile }).layers.find((l) => l.type === 'overlay-design').options;
    const b = timelineToComposition(state(clip()), { profile: other }).layers.find((l) => l.type === 'overlay-design').options;
    expect([a.resolvedBrand.businessName, b.resolvedBrand.businessName]).toEqual(['Acme Plumbing', 'Bright Dental']);
    expect(b.resolvedBrand.logoUrl).toBeNull();
  });
  it('drops an unsafe image url and works with no contact', () => {
    const o = timelineToComposition(state(clip({ imageUrl: 'javascript:alert(1)' })), { profile: null }).layers.find((l) => l.type === 'overlay-design').options;
    expect(o.resolvedImage).toBeNull();
    expect(o.resolvedBrand.businessName).toBe('');
  });
});

describe('designIdsInModel / loadDesigns', () => {
  it('lists each design id once, from design overlays only', () => {
    const m = timelineToComposition(state(clip(), { ...clip(), id: 'd2' }, { id: 't1', type: 'overlay-text', start: 0, end: 3, addon: { text: 'x', geometry: { left: 0, top: 0, width: 10, height: 10 } } }), { profile });
    expect(designIdsInModel(m)).toEqual(['animated-headline']);
    expect(designIdsInModel(null)).toEqual([]);
    expect(designIdsInModel({ layers: [{ kind: 'overlay', type: 'overlay-design', options: {} }] })).toEqual([]);
  });
  it('does not load the catalog when no design is used, and loads the renderer once when one is', async () => {
    await loadDesigns([]);
    expect(getDesignOverlay()).toBeNull();
    await loadDesigns(['animated-headline']);
    expect(typeof getDesignOverlay()).toBe('function');
    const first = getDesignOverlay();
    await loadDesigns(['animated-headline']);
    expect(getDesignOverlay()).toBe(first);
  });
});
