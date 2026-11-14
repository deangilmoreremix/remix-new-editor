import { describe, it, expect } from 'vitest';
import { createLocalLibraryClient } from '../localLibraryClient.js';
import { upsertBusiness, saveBusinessAsset, assignAsset, listBusinessAssets, listAssignments, removeBusinessAsset, listAssetsForBusinesses } from '../businessAssetStore.js';

const memoryStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

describe('local (signed-out) business library', () => {
  it('runs the same store functions as the account library: dedupe, per-business separation, manual protection', async () => {
    const c = createLocalLibraryClient(memoryStorage());
    const a = await upsertBusiness(c, { name: 'Smith Roofing', website: 'smithroofing.com' });
    const again = await upsertBusiness(c, { name: 'Smith Roofing', website: 'https://www.smithroofing.com/x' });
    expect(again.id).toBe(a.id);                                                       // same business, not a duplicate
    const b = await upsertBusiness(c, { name: 'Wilson Plumbing', website: 'wilson.com' });
    const logo = await saveBusinessAsset(c, a.id, { url: 'https://cdn.test/a.png', role: 'logo' });
    await saveBusinessAsset(c, a.id, { url: 'https://cdn.test/a.png', role: 'logo' });
    await saveBusinessAsset(c, b.id, { url: 'https://cdn.test/b.png', role: 'logo' });
    expect((await listBusinessAssets(c, a.id)).map((x) => x.storage_url)).toEqual(['https://cdn.test/a.png']);
    expect(await listAssetsForBusinesses(c, [a.id, b.id])).toHaveLength(2);
    const base = { projectId: 'p1', businessId: a.id, slot: 'logoUrl' };
    expect((await assignAsset(c, { ...base, assetId: logo.id, manual: true })).assigned).toBe(true);
    expect((await listBusinessAssets(c, a.id))[0].state).toBe('assigned');
    expect((await assignAsset(c, { ...base, assetId: null, manual: false })).reason).toBe('manual');
    await removeBusinessAsset(c, logo.id);
    expect((await listAssignments(c, 'p1', a.id))[0].asset_id).toBeNull();            // like the database: on delete set null
  });

  it('persists across page loads in the same browser and can be reset', async () => {
    const storage = memoryStorage();
    const one = createLocalLibraryClient(storage);
    const biz = await upsertBusiness(one, { name: 'Smith Roofing', website: 'smithroofing.com' });
    await saveBusinessAsset(one, biz.id, { url: 'https://cdn.test/a.png', role: 'logo' });
    const two = createLocalLibraryClient(storage);                                     // a fresh page load
    expect(await listBusinessAssets(two, biz.id)).toHaveLength(1);
    two.reset();
    expect(await listBusinessAssets(createLocalLibraryClient(storage), biz.id)).toHaveLength(0);
  });

  it('keeps working in memory when storage is unavailable', async () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => {} };
    const c = createLocalLibraryClient(broken);
    const biz = await upsertBusiness(c, { name: 'Smith Roofing' });
    await saveBusinessAsset(c, biz.id, { url: 'https://cdn.test/a.png', role: 'logo' });
    expect(await listBusinessAssets(c, biz.id)).toHaveLength(1);
  });

  it('still refuses non-durable URLs (blob:/data:)', async () => {
    const c = createLocalLibraryClient(memoryStorage());
    const biz = await upsertBusiness(c, { name: 'Smith Roofing' });
    await expect(saveBusinessAsset(c, biz.id, { url: 'blob:http://x/1' })).rejects.toThrow(/durable/);
  });
});
