import { describe, it, expect } from 'vitest';
import { slotsForOverlays, assetState, canAutoAssign, variablesFromAssignments, profilePatch, slotStatus, businessFromProfile, type LibAsset } from '@cinegen/lib/leads/personalize-writeback';

const ov = (id: string, src: string, fallbackSrc = '') => ({ id, type: 'overlay-personalized-image', name: 'Img', start: 0, end: 5, addon: { src, fallbackSrc } });
const asset = (id: string, url: string, state = 'imported'): LibAsset => ({ id, category: 'logo', origin: 'discovered', state, storage_url: url });

describe('personalize write-back helpers', () => {
  it('lists each image slot once, with fallback info', () => {
    const slots = slotsForOverlays([ov('a', '{{logoUrl}}'), ov('b', '{{logoUrl}}', 'https://x/f.png'), ov('c', '{{productImageUrl}}', 'https://x/p.png'), { id: 't', type: 'overlay-text', name: 't', start: 0, end: 1 }]);
    expect(slots.map((s) => s.slot).sort()).toEqual(['logoUrl', 'productImageUrl']);
    const logo = slots.find((s) => s.slot === 'logoUrl')!;
    expect(logo.clipCount).toBe(2);
    expect(logo.hasFallback).toBe(false); // one of the two overlays has no fallback
  });

  it('only calls an asset "used" when a published link carries it', () => {
    const a = asset('1', 'https://cdn/a.png', 'discovered');
    expect(assetState(a, new Set(), new Set())).toBe('discovered');
    expect(assetState(asset('2', 'https://cdn/b.png'), new Set(), new Set())).toBe('imported');
    expect(assetState(asset('3', 'https://cdn/c.png'), new Set(['3']), new Set())).toBe('assigned');
    expect(assetState(asset('4', 'https://cdn/d.png', 'assigned'), new Set(), new Set(['https://cdn/d.png']))).toBe('used');
  });

  it('never lets an automatic assignment replace a manual one', () => {
    const cur = [{ slot: 'logoUrl', asset_id: 'x', manual: true }];
    expect(canAutoAssign(cur, 'logoUrl', 'y')).toEqual({ ok: false, reason: 'manual', slot: 'logoUrl' });
    expect(canAutoAssign(cur, 'logoUrl', 'x')).toEqual({ ok: true });
    expect(canAutoAssign(cur, 'productImageUrl', 'y')).toEqual({ ok: true });
    expect(canAutoAssign([{ slot: 'logoUrl', asset_id: 'x', manual: false }], 'logoUrl', 'y')).toEqual({ ok: true });
  });

  it('turns assignments into profile variables, keeping other variables and dropping non-durable URLs', () => {
    const vars = variablesFromAssignments([{ slot: 'logoUrl', asset_id: '1', manual: true }, { slot: 'brandImageUrl', asset_id: '2', manual: false }], [asset('1', 'https://cdn/a.png'), asset('2', 'blob:http://x/1')]);
    expect(vars).toEqual({ logoUrl: 'https://cdn/a.png' });
    const patch = profilePatch({ variables: { firstName: 'Ann', logoUrl: 'https://old/l.png' } }, vars);
    expect(patch.variables).toEqual({ firstName: 'Ann', logoUrl: 'https://cdn/a.png' });
    expect(profilePatch({ variables: { logoUrl: 'https://old/l.png', firstName: 'Ann' } }, {}, ['logoUrl']).variables).toEqual({ firstName: 'Ann' });
  });

  it('reports filled / fallback / missing slots', () => {
    const slot = { slot: 'logoUrl', label: 'logo', hasFallback: false, clipCount: 1 };
    const assets = [asset('1', 'https://cdn/a.png')];
    expect(slotStatus(slot, [{ slot: 'logoUrl', asset_id: '1', manual: true }], assets)).toBe('filled');
    expect(slotStatus(slot, [], assets)).toBe('missing');
    expect(slotStatus({ ...slot, hasFallback: true }, [], assets)).toBe('fallback');
    expect(slotStatus(slot, [{ slot: 'logoUrl', asset_id: 'gone', manual: true }], assets)).toBe('missing'); // deleted asset
  });

  it('derives a business from a contact profile', () => {
    expect(businessFromProfile({ personalization: { business: { businessName: 'Smith Roofing', website: 'smithroofing.com', phone: '555' } } })).toEqual({ name: 'Smith Roofing', website: 'smithroofing.com', phone: '555' });
    expect(businessFromProfile({ name: 'Ann' })).toEqual({ name: 'Ann', website: undefined, phone: undefined });
    expect(businessFromProfile(null)).toBeNull();
  });
});
