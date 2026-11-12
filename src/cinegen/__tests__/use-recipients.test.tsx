import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const T: Record<string, any[]> = { video_recipients: [], business_profiles: [], business_assets: [], asset_assignments: [], published_videos: [] };
let n = 0;
const client = {
  from(name: string) {
    const f: Array<[string, unknown]> = []; let op = 'select'; let payload: any; let patch: any; let inList: [string, unknown[]] | null = null;
    const match = (r: any) => f.every(([k, v]) => r[k] === v) && (!inList || inList[1].includes(r[inList[0]]));
    const run = () => {
      const rows = T[name];
      if (op === 'insert') {
        const made = payload.map((p: any) => ({ id: `r${++n}`, token: `${'t'.repeat(60)}${String(n).padStart(4, '0')}`, status: 'active', created_at: new Date(2026, 10, 12, 10, 0, n).toISOString(), ...p }));
        for (const m of made) if (m.contact_ref && rows.some((r) => r.video_id === m.video_id && r.contact_ref === m.contact_ref && r.status === 'active')) throw Object.assign(new Error('duplicate'), { code: '23505' });
        rows.push(...made); return made;
      }
      if (op === 'update') { rows.filter(match).forEach((r) => { if (r.status === 'revoked') return; Object.assign(r, patch); }); return []; }
      return rows.filter(match);
    };
    const b: any = {
      select: () => b, insert: (p: any) => { op = 'insert'; payload = p; return b; }, update: (p: any) => { op = 'update'; patch = p; return b; },
      eq: (k: string, v: unknown) => { f.push([k, v]); return b; }, in: (k: string, v: unknown[]) => { inList = [k, v]; return b; }, order: () => b,
      then: (res: any, rej: any) => { try { return res({ data: run(), error: null }); } catch (e: any) { return res({ data: null, error: { code: e.code, message: e.message } }); } },
    };
    return b;
  },
};
const reloadPub = vi.fn(async () => {});
vi.mock('@cinegen/components/workspace/workspace-shell', () => ({ useWorkspace: () => ({ projectId: 'p1', state: { overlays: [] } }) }));
vi.mock('../components/leads/use-publish', () => ({ getClient: async () => client }));

import { useRecipients } from '../components/leads/use-recipients';
import * as contacts from '../../lib/contactStore.js';

const lib: any = { slots: [{ slot: 'logoUrl', label: 'logo', hasFallback: false, clipCount: 1 }], assets: [], assignments: [], findMore: vi.fn(async () => {}) };
const pub: any = { id: 'vidAAAA1111', business: 'smith-roofing', info: { id: 'vidAAAA1111', title: 'Spring', published: true, view_count: 0, slug: 'spring' }, title: 'Spring', signedIn: true, reload: reloadPub, loadBusiness: vi.fn(async () => {}) };

beforeEach(() => {
  localStorage.clear(); Object.keys(T).forEach((k) => { T[k] = []; }); n = 0;
  for (let i = 0; i < 20; i++) {
    contacts.saveContact({ id: `c${i}`, name: `Person ${i}` });
    contacts.saveProfile({ id: `c${i}`, name: `Person ${i}`, variables: { firstName: `P${i}` }, personalization: { business: { businessName: `Biz ${i}`, website: `biz${i}.com` } } });
    T.business_profiles.push({ id: `b${i}`, business_key: `biz${i}.com`, name: `Biz ${i}` });
    if (i !== 3) { T.business_assets.push({ id: `l${i}`, business_id: `b${i}`, storage_url: `https://cdn.test/logo${i}.png` }); T.asset_assignments.push({ business_id: `b${i}`, slot: 'logoUrl', asset_id: `l${i}`, manual: true, project_id: 'p1' }); }
  }
  (window as any).Clerk = { user: { id: 'u1' } };
});

describe('useRecipients (20 contacts, one video)', () => {
  it('creates one link per ready contact: unique opaque tokens, own assets only, nothing for the contact missing a logo', async () => {
    const { result } = renderHook(() => useRecipients(pub, lib));
    await waitFor(() => expect(result.current.summary.total).toBe(20));
    await waitFor(() => expect(result.current.summary.ready).toBe(19));
    await act(async () => { await result.current.create(result.current.rows.map((r) => r.contactId)); });
    const made = T.video_recipients;
    expect(made).toHaveLength(19);                                          // c3 (no logo) was not linked
    expect(new Set(made.map((r) => r.token)).size).toBe(19);
    expect(made.every((r) => r.video_id === 'vidAAAA1111' && r.token.length >= 64)).toBe(true);
    made.forEach((r) => { const i = Number(r.contact_ref.slice(1)); expect(r.variables.logoUrl).toBe(`https://cdn.test/logo${i}.png`); expect(JSON.stringify(r.variables).match(/logo\d+\.png/g)).toEqual([`logo${i}.png`]); });  // exactly its own image, no other business's
    await waitFor(() => expect(result.current.summary.linked).toBe(19));
    const csv = result.current.csv();
    expect(csv.split('\n')).toHaveLength(20);                                // header + 19
    expect(csv).toContain('/v/smith-roofing/spring?recipient=');
    expect(csv).not.toMatch(/@|biz\d+\.com/);                                // no PII in the exported URLs
  });

  it('is idempotent: creating again makes no duplicate links', async () => {
    const { result } = renderHook(() => useRecipients(pub, lib));
    await waitFor(() => expect(result.current.summary.ready).toBe(19));
    await act(async () => { await result.current.create(['c0', 'c1']); });
    await waitFor(() => expect(result.current.summary.linked).toBe(2));
    await act(async () => { await result.current.create(['c0', 'c1']); });
    expect(T.video_recipients).toHaveLength(2);
    expect(result.current.notice).toMatch(/already linked|Nothing to create/);
  });

  it('revokes one link and leaves the others working; a revoked contact can be linked again', async () => {
    const { result } = renderHook(() => useRecipients(pub, lib));
    await waitFor(() => expect(result.current.summary.ready).toBe(19));
    await act(async () => { await result.current.create(['c0', 'c1', 'c2']); });
    await waitFor(() => expect(result.current.summary.linked).toBe(3));
    const r1 = T.video_recipients.find((r) => r.contact_ref === 'c1')!;
    await act(async () => { await result.current.revoke(r1.id); });
    await waitFor(() => expect(result.current.summary.revoked).toBe(1));
    expect(T.video_recipients.filter((r) => r.status === 'active').map((r) => r.contact_ref).sort()).toEqual(['c0', 'c2']);
    await act(async () => { await result.current.create(['c1']); });
    expect(T.video_recipients.filter((r) => r.contact_ref === 'c1')).toHaveLength(2);
  });

  it('refresh updates only the changed business\'s image, not text, and not other recipients', async () => {
    const { result } = renderHook(() => useRecipients(pub, lib));
    await waitFor(() => expect(result.current.summary.ready).toBe(19));
    await act(async () => { await result.current.create(['c0', 'c1']); });
    T.video_recipients.find((r) => r.contact_ref === 'c0')!.variables.firstName = 'Custom text';
    T.business_assets.find((a) => a.id === 'l0')!.storage_url = 'https://cdn.test/NEW-logo0.png';
    const before1 = JSON.stringify(T.video_recipients.find((r) => r.contact_ref === 'c1')!.variables);
    await act(async () => { await result.current.reload(); });
    await waitFor(() => expect(result.current.summary.stale).toBe(1));
    await act(async () => { await result.current.refresh(['c0', 'c1']); });
    const c0 = T.video_recipients.find((r) => r.contact_ref === 'c0')!;
    expect(c0.variables).toMatchObject({ logoUrl: 'https://cdn.test/NEW-logo0.png', firstName: 'Custom text' });
    expect(JSON.stringify(T.video_recipients.find((r) => r.contact_ref === 'c1')!.variables)).toBe(before1);
  });

  it('does nothing without a published video or when signed out', async () => {
    const { result } = renderHook(() => useRecipients({ ...pub, id: null, info: null }, lib));
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.rows.every((r) => r.recipient === null)).toBe(true);
    expect(T.video_recipients).toHaveLength(0);
  });
});
