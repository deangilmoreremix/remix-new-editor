import { describe, it, expect } from 'vitest';
import { brandFromProfile, checkTimelineLayout, applyRecommendedPlacement } from '../layoutCheck.js';
import { createDefaultPreviewSettings } from '../../../features/personalization/shared/personalization/preview/presets';

const settings = { fps: 30, durationInFrames: 300, width: 1920, height: 1080, aspectRatio: '16:9' };
const profile = (over = {}) => ({
  id: 'c1', name: 'Ann Lee',
  contact: { name: 'Ann Lee', firstName: 'Ann', lastName: 'Lee' },
  personalization: {
    business: { businessName: 'Acme Plumbing', ctaHeadline: 'Hot water today', callToAction: 'Call now', phone: '555 0100', offer: '10% off' },
    assets: { logos: [{ id: 'l', role: 'logo', url: 'https://a.test/logo.png' }], primaryLogoId: 'l' },
  },
  ...over,
});
const layer = (over) => ({ visible: true, opacity: 1, animation: 'none', animationDelay: 0, startFrame: 0, ...over });
const logo = layer({ id: 'logo', kind: 'logo', x: 0.85, y: 0.15, scale: 0.12 });
const headline = layer({ id: 'headline', kind: 'headline', x: 0.5, y: 0.5, scale: 0.06 });

describe('brandFromProfile', () => {
  it('maps the contact to the brand fields the preview uses, with the cutout-aware logo url', () => {
    const b = brandFromProfile(profile());
    expect(b).toMatchObject({ businessName: 'Acme Plumbing', headline: 'Hot water today', cta: 'Call now', phone: '555 0100', offer: '10% off', logoUrl: 'https://a.test/logo.png', productUrl: null });
  });
  it('builds a call to action from the website or phone when none is set', () => {
    const p = profile();
    delete p.personalization.business.callToAction;
    delete p.personalization.business.ctaHeadline; // {{callToAction}} itself falls back to the headline
    expect(brandFromProfile(p).cta).toBe('Call 555 0100');
  });
  it('copes with no profile', () => {
    expect(brandFromProfile(null)).toMatchObject({ businessName: '', logoUrl: null });
  });
});

describe('checkTimelineLayout', () => {
  it('has nothing to say without layers', () => {
    expect(checkTimelineLayout({ layers: [], settings, profile: profile() })).toMatchObject({ status: 'ready', issues: [], blocksExport: false });
  });
  it('passes a sensible layout and is honest about what it did not check', () => {
    const r = checkTimelineLayout({ layers: [logo, headline], settings, profile: profile() });
    expect(r.issues.filter((i) => i.severity === 'critical')).toEqual([]);
    expect(r.notes.join(' ')).toMatch(/frames were not analysed/);
  });
  it('flags a logo layer when the contact has no logo image', () => {
    const r = checkTimelineLayout({ layers: [logo], settings, profile: profile({ personalization: { business: {}, assets: {} } }) });
    expect(r.issues.some((i) => i.code === 'missing-media' && i.layerId === 'logo')).toBe(true);
  });
  it('flags two overlays on top of each other', () => {
    const a = layer({ id: 'headline', kind: 'headline', x: 0.5, y: 0.5, scale: 0.08 });
    const b = layer({ id: 'offer', kind: 'offer', x: 0.5, y: 0.5, scale: 0.08 });
    const r = checkTimelineLayout({ layers: [a, b], settings, profile: profile() });
    expect(r.issues.some((i) => i.code === 'overlay-collision')).toBe(true);
  });
});

describe('applyRecommendedPlacement', () => {
  it('moves a colliding overlay and reports how many, leaving the others untouched', () => {
    const a = layer({ id: 'headline', kind: 'headline', x: 0.5, y: 0.5, scale: 0.08 });
    const b = layer({ id: 'offer', kind: 'offer', x: 0.5, y: 0.5, scale: 0.08 });
    const r = applyRecommendedPlacement({ layers: [a, b], settings, profile: profile() });
    expect(r.moved).toBeGreaterThan(0);
    expect(r.layers).toHaveLength(2);
    const after = checkTimelineLayout({ layers: r.layers, settings, profile: profile() });
    expect(after.issues.some((i) => i.code === 'overlay-collision')).toBe(false);
  });
  it('does nothing when there are no layers, and never moves a locked layer', () => {
    expect(applyRecommendedPlacement({ layers: [], settings, profile: profile() })).toEqual({ layers: [], moved: 0 });
    const a = layer({ id: 'headline', kind: 'headline', x: 0.5, y: 0.5, scale: 0.08, locked: true });
    const b = layer({ id: 'offer', kind: 'offer', x: 0.5, y: 0.5, scale: 0.08, locked: true });
    expect(applyRecommendedPlacement({ layers: [a, b], settings, profile: profile() }).moved).toBe(0);
  });
});
