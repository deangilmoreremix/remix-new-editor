import { describe, it, expect } from 'vitest';
import { buildReadiness } from '../readiness.js';

const personalizedImage = (src, fallbackSrc = '') => ({ id: `c-${src}`, type: 'overlay-personalized-image', addon: { src, fallbackSrc } });
const project = (...clips) => ({ tracks: [{ items: clips }] });
const profile = (id, name, assets = {}) => ({ id, name, contact: { name }, personalization: { assets } });
const withLogo = (id, name) => profile(id, name, { logos: [{ id: `l${id}`, role: 'logo', url: `https://a.test/${id}.png` }], primaryLogoId: `l${id}` });

describe('buildReadiness', () => {
  it('is ready when nothing is wrong', () => {
    const r = buildReadiness({ project: project(personalizedImage('{{logoUrl}}')), contacts: [withLogo('1', 'Ann')], keys: ['logoUrl'] });
    expect(r).toMatchObject({ status: 'ready', items: [], counts: { blockers: 0, warnings: 0, info: 0, imagesChecked: false } });
  });

  it('reports a contact with no logo as a warning with a fix', () => {
    const r = buildReadiness({ project: project(personalizedImage('{{logoUrl}}')), contacts: [withLogo('1', 'Ann'), profile('2', 'Raj')], keys: ['logoUrl'] });
    expect(r.status).toBe('needs-attention');
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ kind: 'missing-image', contactId: '2', contactName: 'Raj', severity: 'warning', fix: { type: 'open-personalize' } });
    expect(r.items[0].message).toMatch(/Raj has no .*Logo|Raj has no logo/i);
  });

  it('does not flag a slot that has a fallback image', () => {
    const r = buildReadiness({ project: project(personalizedImage('{{logoUrl}}', 'https://a.test/fallback.png')), contacts: [profile('2', 'Raj')], keys: ['logoUrl'] });
    expect(r.items).toEqual([]);
  });

  it('turns layout issues into items, a critical one blocking', () => {
    const layoutReport = { issues: [
      { code: 'missing-media', severity: 'critical', layerId: 'logo', message: 'Logo has no image', fixable: false },
      { code: 'overlay-collision', severity: 'adjust', layerId: 'headline', message: 'Headline overlaps Offer', fixable: true },
    ] };
    const r = buildReadiness({ project: project(), contacts: [], layoutReport });
    expect(r.status).toBe('blocked');
    expect(r.items.map((i) => [i.severity, i.fix?.type, i.fix?.layerId])).toEqual([['blocker', 'show-layer', 'logo'], ['warning', 'show-layer', 'headline']]);
    expect(r.items[1].fixable).toBe(true);
  });

  it('only reports broken images once they have been checked', () => {
    const args = { project: project(personalizedImage('{{logoUrl}}')), contacts: [withLogo('1', 'Ann')], keys: ['logoUrl'] };
    expect(buildReadiness(args).counts.imagesChecked).toBe(false);
    const checked = buildReadiness({ ...args, broken: [{ url: 'https://a.test/gone.png', contacts: ['Ann'], slots: ['Logo'] }] });
    expect(checked.counts.imagesChecked).toBe(true);
    expect(checked.items[0]).toMatchObject({ kind: 'broken-image', severity: 'warning' });
    expect(checked.items[0].message).toMatch(/no longer loads/);
    expect(buildReadiness({ ...args, broken: [] })).toMatchObject({ status: 'ready', counts: { imagesChecked: true } });
  });

  it('lists preparable images as optional info that does not change the status', () => {
    const r = buildReadiness({ project: project(), contacts: [], preparable: 3 });
    expect(r.status).toBe('ready');
    expect(r.items[0]).toMatchObject({ kind: 'preparable', severity: 'info', fix: { type: 'prepare-all' } });
    expect(r.items[0].message).toContain('3 contact images still have a background');
  });

  it('treats a review note (readability not measured) as optional so the checklist can be ready', () => {
    const layoutReport = { issues: [{ code: 'contrast-unverified', severity: 'review', message: 'Readability has not been measured yet.', fixable: false }] };
    const r = buildReadiness({ project: project(), contacts: [], layoutReport });
    expect(r.status).toBe('ready');
    expect(r.items[0]).toMatchObject({ severity: 'info', kind: 'layout' });
  });

  it('orders blockers before warnings before info', () => {
    const layoutReport = { issues: [{ code: 'overlay-collision', severity: 'adjust', layerId: 'a', message: 'x', fixable: false }, { code: 'missing-media', severity: 'critical', layerId: 'b', message: 'y', fixable: false }] };
    const r = buildReadiness({ project: project(), contacts: [], layoutReport, preparable: 1 });
    expect(r.items.map((i) => i.severity)).toEqual(['blocker', 'warning', 'info']);
  });

  it('copes with nothing at all', () => {
    expect(buildReadiness()).toMatchObject({ status: 'ready', items: [] });
  });
});
