import { describe, it, expect, vi } from 'vitest';
import { CUTOUT_TOKEN_KEYS, findSavedAsset, planPrepareImages, prepareImages } from '../prepareImages.js';

const profile = (id, name, assets) => ({ id, name, personalization: { assets } });
const logo = (id, extra = {}) => ({ id, role: 'logo', url: `https://a.test/${id}.jpg`, ...extra });
const ann = profile('c1', 'Ann', { logos: [logo('l1')], primaryLogoId: 'l1', identities: [{ id: 'h1', role: 'presenter_identity', url: 'https://a.test/h1.jpg' }] });
const raj = profile('c2', 'Raj', { logos: [logo('l2', { hasTransparency: true })], primaryLogoId: 'l2' });
const lee = profile('c3', 'Lee', { logos: [] });

describe('planPrepareImages', () => {
  it('plans a cutout per contact and wanted token, skipping done and missing ones', () => {
    const { items, skipped } = planPrepareImages([ann, raj, lee], ['logoUrl', 'avatarUrl']);
    expect(items.map((i) => i.name)).toEqual(['Ann · Logo', 'Ann · Photo']);
    expect(skipped).toEqual({ done: 1, missing: 3 }); // Raj's logo done; Raj/Lee photo + Lee logo missing
  });
  it('never plans full-frame token images', () => {
    expect(planPrepareImages([ann], ['ctaImageUrl', 'firstFrameUrl', 'lastFrameUrl']).items).toEqual([]);
    expect(CUTOUT_TOKEN_KEYS).not.toContain('ctaImageUrl');
  });
  it('plans one job when two tokens share an asset', () => {
    const shared = profile('c9', 'Sam', { products: [{ id: 'p1', url: 'https://a.test/p1.jpg' }], brandReferences: [] });
    expect(planPrepareImages([shared], ['productImageUrl', 'productImageUrl']).items).toHaveLength(1);
  });
  it('copes with nothing', () => {
    expect(planPrepareImages([], ['logoUrl'])).toEqual({ items: [], skipped: { done: 0, missing: 0 } });
    expect(planPrepareImages(null, null).items).toEqual([]);
  });
});

describe('findSavedAsset', () => {
  it('finds an asset in any list', () => {
    expect(findSavedAsset(ann, 'h1').role).toBe('presenter_identity');
    expect(findSavedAsset(ann, 'nope')).toBeNull();
  });
});

describe('prepareImages', () => {
  it('cuts out and saves each, continuing past a failure', async () => {
    const { items } = planPrepareImages([ann], ['logoUrl', 'avatarUrl']);
    const save = vi.fn();
    const cutout = vi.fn(async (asset) => { if (asset.id === 'h1') throw new Error('no face found'); return { patch: { ...asset, url: 'https://a.test/cut.png', hasTransparency: true }, uploaded: true }; });
    const out = await prepareImages({ items, cutout, save });
    expect(out.results.map((r) => [r.name, r.ok])).toEqual([['Ann · Logo', true], ['Ann · Photo', false]]);
    expect(out.results[1].error).toBe('no face found');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toBe('l1');
  });
  it('reports a vanished asset as a failure, not a crash', async () => {
    const out = await prepareImages({ items: [{ id: 'x', name: 'X', profile: lee, assetId: 'gone' }], cutout: vi.fn(), save: vi.fn() });
    expect(out.results[0]).toMatchObject({ ok: false, error: 'image no longer saved' });
  });
  it('stops when cancelled', async () => {
    const ctl = new AbortController();
    const { items } = planPrepareImages([ann], ['logoUrl', 'avatarUrl']);
    const cutout = vi.fn(async (a) => { ctl.abort(); return { patch: a, uploaded: false }; });
    const out = await prepareImages({ items, cutout, save: vi.fn(), signal: ctl.signal });
    expect(out.cancelled).toBe(true);
    expect(cutout).toHaveBeenCalledTimes(1);
  });
});
