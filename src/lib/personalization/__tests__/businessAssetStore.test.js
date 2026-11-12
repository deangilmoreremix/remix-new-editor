import { describe, it, expect } from 'vitest';
import {
  businessKey, normalizeCategory, isDurableUrl, upsertBusiness, saveBusinessAsset,
  assignAsset, assignmentsToVariables, hasClient,
} from '../businessAssetStore.js';

/** Minimal chainable fake of the supabase-js query builder over in-memory tables. */
function fakeClient() {
  const tables = { business_profiles: [], business_assets: [], asset_assignments: [] };
  let n = 0;
  const from = (name) => {
    const filters = [];
    let op = null; let payload = null; let conflict = null; let patch = null;
    const matches = (r) => filters.every(([k, v]) => r[k] === v);
    const run = () => {
      const rows = tables[name];
      if (op === 'upsert') {
        const keys = conflict.split(',');
        let row = rows.find((r) => keys.every((k) => r[k] === payload[k] || (r[k] == null && payload[k] == null)));
        if (row) Object.assign(row, payload); else { row = { id: `id${++n}`, ...payload }; rows.push(row); }
        return [row];
      }
      if (op === 'update') { rows.filter(matches).forEach((r) => Object.assign(r, patch)); return []; }
      if (op === 'delete') { tables[name] = rows.filter((r) => !matches(r)); return []; }
      return rows.filter(matches);
    };
    const b = {
      select: () => { if (!op) op = 'select'; return b; },
      upsert: (p, o) => { op = 'upsert'; payload = p; conflict = o.onConflict; return b; },
      update: (p) => { op = 'update'; patch = p; return b; },
      delete: () => { op = 'delete'; return b; },
      eq: (k, v) => { filters.push([k, v]); return b; },
      order: () => b,
      single: () => Promise.resolve({ data: run()[0], error: null }),
      maybeSingle: () => Promise.resolve({ data: run()[0] || null, error: null }),
      then: (res) => res({ data: run(), error: null }),
    };
    return b;
  };
  return { from, tables };
}

describe('businessAssetStore', () => {
  it('derives a stable key from website host, else name', () => {
    expect(businessKey({ name: 'Smith Roofing', website: 'https://www.SmithRoofing.com/about' })).toBe('smithroofing.com');
    expect(businessKey({ name: '  Smith   Roofing ' })).toBe('smith roofing');
  });

  it('maps categories and rejects non-durable URLs', () => {
    expect(normalizeCategory('brand_logo')).toBe('logo');
    expect(normalizeCategory('unknown')).toBe('image');
    expect(isDurableUrl('https://x.test/a.png')).toBe(true);
    expect(isDurableUrl('blob:http://x/1')).toBe(false);
    expect(isDurableUrl('data:image/png;base64,AAAA')).toBe(false);
  });

  it('does nothing without a client', async () => {
    expect(hasClient(null)).toBe(false);
    expect(await upsertBusiness(null, { name: 'A' })).toBeNull();
  });

  it('saves assets once per durable URL and refuses blob URLs', async () => {
    const c = fakeClient();
    const biz = await upsertBusiness(c, { name: 'Smith Roofing', website: 'smithroofing.com' });
    await saveBusinessAsset(c, biz.id, { url: 'https://cdn.test/logo.png', role: 'logo' });
    await saveBusinessAsset(c, biz.id, { url: 'https://cdn.test/logo.png', role: 'logo' });
    expect(c.tables.business_assets).toHaveLength(1);
    await expect(saveBusinessAsset(c, biz.id, { url: 'blob:http://x/1' })).rejects.toThrow(/durable/);
  });

  it('keeps assets separate per business', async () => {
    const c = fakeClient();
    const a = await upsertBusiness(c, { name: 'A', website: 'a.com' });
    const b = await upsertBusiness(c, { name: 'B', website: 'b.com' });
    await saveBusinessAsset(c, a.id, { url: 'https://cdn.test/a.png', role: 'logo' });
    await saveBusinessAsset(c, b.id, { url: 'https://cdn.test/b.png', role: 'logo' });
    expect(c.tables.business_assets.filter((x) => x.business_id === a.id).map((x) => x.storage_url)).toEqual(['https://cdn.test/a.png']);
  });

  it('does not overwrite a manual assignment automatically, and marks assets assigned', async () => {
    const c = fakeClient();
    const biz = await upsertBusiness(c, { name: 'A', website: 'a.com' });
    const a1 = await saveBusinessAsset(c, biz.id, { url: 'https://cdn.test/1.png', role: 'service' });
    const a2 = await saveBusinessAsset(c, biz.id, { url: 'https://cdn.test/2.png', role: 'service' });
    const base = { projectId: 'p1', businessId: biz.id, slot: 'serviceImage' };
    expect((await assignAsset(c, { ...base, assetId: a1.id, manual: true })).assigned).toBe(true);
    expect(c.tables.business_assets.find((x) => x.id === a1.id).state).toBe('assigned');
    const auto = await assignAsset(c, { ...base, assetId: a2.id, manual: false });
    expect(auto).toMatchObject({ assigned: false, reason: 'manual' });
    expect((await assignAsset(c, { ...base, assetId: a2.id, manual: true })).assigned).toBe(true);
  });

  it('turns assignments into token variables with durable URLs only', () => {
    const vars = assignmentsToVariables(
      [{ slot: 'logoUrl', asset_id: 'x' }, { slot: 'serviceImage', asset_id: 'y' }, { slot: 'empty', asset_id: null }],
      [{ id: 'x', storage_url: 'https://cdn.test/x.png' }, { id: 'y', storage_url: 'blob:bad' }],
    );
    expect(vars).toEqual({ logoUrl: 'https://cdn.test/x.png' });
  });
});
