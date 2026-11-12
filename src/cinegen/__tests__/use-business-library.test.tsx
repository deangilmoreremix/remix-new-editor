import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const tables: Record<string, any[]> = { business_profiles: [], business_assets: [], asset_assignments: [] };
let n = 0;
function fakeClient() {
  return {
    from(name: string) {
      const filters: Array<[string, unknown]> = []; let op = 'select'; let payload: any; let conflict = ''; let patch: any;
      const match = (r: any) => filters.every(([k, v]) => r[k] === v);
      const run = () => {
        const rows = tables[name];
        if (op === 'upsert') { const keys = conflict.split(','); let row = rows.find((r) => keys.every((k) => (r[k] ?? null) === (payload[k] ?? null))); if (row) Object.assign(row, payload); else { row = { id: `id${++n}`, state: 'imported', ...payload }; rows.push(row); } return [row]; }
        if (op === 'update') { rows.filter(match).forEach((r) => Object.assign(r, patch)); return []; }
        if (op === 'delete') { tables[name] = rows.filter((r) => !match(r)); if (name === 'business_assets') tables.asset_assignments.forEach((a) => { if (!tables.business_assets.find((x) => x.id === a.asset_id)) a.asset_id = null; }); return []; }
        return rows.filter(match);
      };
      const b: any = {
        select: () => b, upsert: (p: any, o: any) => { op = 'upsert'; payload = p; conflict = o.onConflict; return b; }, update: (p: any) => { op = 'update'; patch = p; return b; }, delete: () => { op = 'delete'; return b; },
        eq: (k: string, v: unknown) => { filters.push([k, v]); return b; }, order: () => b,
        single: async () => ({ data: run()[0], error: null }), maybeSingle: async () => ({ data: run()[0] ?? null, error: null }), then: (res: any) => res({ data: run(), error: null }),
      };
      return b;
    },
  };
}
const client = fakeClient();
vi.mock('@cinegen/components/workspace/workspace-shell', () => ({
  useWorkspace: () => ({ projectId: 'p1', state: { overlays: [{ id: 'o1', type: 'overlay-personalized-image', name: 'Logo', start: 0, end: 5, addon: { src: '{{logoUrl}}', fallbackSrc: '' } }] } }),
}));
vi.mock('../components/leads/use-publish', () => ({ getClient: async () => client }));
vi.mock('../../lib/hybrid-supabase.js', () => ({ uploadFileToStorage: vi.fn(async (f: File) => `https://cdn.test/up/${f.name}`) }));

import { useBusinessLibrary } from '../components/leads/use-business-library';
import * as contacts from '../../lib/contactStore.js';

const seedContact = (id: string, business: string, site: string) => {
  contacts.saveContact({ id, name: business });
  contacts.saveProfile({ id, name: business, variables: { firstName: 'Ann' }, personalization: { business: { businessName: business, website: site } } });
};

beforeEach(() => {
  localStorage.clear(); Object.keys(tables).forEach((k) => { tables[k] = []; });
  (window as any).Clerk = { user: { id: 'u1' } };
  seedContact('c1', 'Smith Roofing', 'smithroofing.com'); seedContact('c2', 'Wilson Plumbing', 'wilsonplumbing.com');
  contacts.setSelectedContactId('c1');
});

describe('useBusinessLibrary', () => {
  it('creates the business for the selected contact and lists only its assets', async () => {
    tables.business_profiles.push({ id: 'bW', business_key: 'wilsonplumbing.com' });
    tables.business_assets.push({ id: 'w1', business_id: 'bW', category: 'logo', storage_url: 'https://cdn.test/w.png' });
    const { result } = renderHook(() => useBusinessLibrary());
    await waitFor(() => expect(result.current.business?.name).toBe('Smith Roofing'));
    expect(result.current.assets).toEqual([]);                       // Wilson's asset is never shown for Smith
    expect(result.current.slots.map((s) => s.slot)).toEqual(['logoUrl']);
  });

  it('assign mirrors the logo into the contact profile; remove clears it again (no deleted image in preview)', async () => {
    const { result } = renderHook(() => useBusinessLibrary());
    await waitFor(() => expect(result.current.business).toBeTruthy());
    await act(async () => { await result.current.upload(new File(['x'], 'logo.png', { type: 'image/png' }), 'logo'); });
    expect(result.current.assets).toHaveLength(1);
    const id = result.current.assets[0].id;
    await act(async () => { expect(await result.current.assign('logoUrl', id, { manual: true })).toBe(true); });
    expect(contacts.getProfile('c1').variables).toMatchObject({ firstName: 'Ann', logoUrl: 'https://cdn.test/up/logo.png' });
    expect(contacts.getProfile('c2').variables.logoUrl).toBeUndefined();              // other business untouched
    await act(async () => { await result.current.remove(id); });
    expect(contacts.getProfile('c1').variables.logoUrl).toBeUndefined();
    expect(contacts.getProfile('c1').variables.firstName).toBe('Ann');
  });

  it('does not auto-replace a manual choice and says so', async () => {
    const { result } = renderHook(() => useBusinessLibrary());
    await waitFor(() => expect(result.current.business).toBeTruthy());
    await act(async () => { await result.current.upload(new File(['x'], 'a.png', { type: 'image/png' }), 'logo'); await result.current.upload(new File(['y'], 'b.png', { type: 'image/png' }), 'logo'); });
    const [first, second] = [result.current.assets[1], result.current.assets[0]];
    await act(async () => { await result.current.assign('logoUrl', first.id, { manual: true }); });
    await act(async () => { expect(await result.current.assign('logoUrl', second.id, { manual: false })).toBe(false); });
    expect(result.current.notice).toMatch(/chosen by you/);
    expect(contacts.getProfile('c1').variables.logoUrl).toBe(`https://cdn.test/up/${first.storage_url.split('/').pop()}`);
  });

  it('syncs only assets the modal added in this session, never older ones from other businesses', async () => {
    const { assetLibraryStore } = await import('../../components/personalize/assetLibraryStore.js');
    const old = assetLibraryStore.addAsset({ role: 'logo', name: 'wilson', url: 'https://cdn.test/wilson-logo.png' });
    await new Promise((r) => setTimeout(r, 15));
    const { result } = renderHook(() => useBusinessLibrary());
    await waitFor(() => expect(result.current.business).toBeTruthy());
    const since = Date.now();
    await new Promise((r) => setTimeout(r, 15));
    assetLibraryStore.addAsset({ role: 'logo', name: 'smith', url: 'https://cdn.test/smith-logo.png' });
    assetLibraryStore.addAsset({ role: 'product', name: 'blob', url: 'blob:http://x/9' });
    let saved = 0;
    await act(async () => { saved = await result.current.syncFromModal(since); });
    expect(saved).toBe(1);
    expect(result.current.assets.map((a) => a.storage_url)).toEqual(['https://cdn.test/smith-logo.png']);
    assetLibraryStore.removeAsset(old.id);
  });

  it('rejects non-image uploads without touching storage', async () => {
    const { result } = renderHook(() => useBusinessLibrary());
    await waitFor(() => expect(result.current.business).toBeTruthy());
    await act(async () => { await result.current.upload(new File(['x'], 'a.pdf', { type: 'application/pdf' }), 'logo'); });
    expect(result.current.error).toMatch(/image/);
    expect(result.current.assets).toHaveLength(0);
  });

  it('stays idle when signed out', async () => {
    (window as any).Clerk = undefined;
    const { result } = renderHook(() => useBusinessLibrary());
    expect(result.current.signedIn).toBe(false);
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.business).toBeNull();
    expect(tables.business_profiles).toHaveLength(0);
  });
});
