import { describe, it, expect } from 'vitest';
import { buildBulkRows, summarize, linkStatusOf, type Recipient } from '@cinegen/lib/leads/bulk-rows';

const N = 20;
const contacts = Array.from({ length: N }, (_, i) => ({ id: `c${i}`, name: `Person ${i}`, variables: { firstName: `P${i}` }, personalization: { business: { businessName: `Biz ${i}`, website: `biz${i}.com` } } }));
const businesses = contacts.map((_, i) => ({ id: `b${i}`, business_key: `biz${i}.com`, name: `Biz ${i}` }));
const assets = businesses.flatMap((b, i) => [
  { id: `l${i}`, business_id: b.id, category: 'logo', origin: 'discovered', state: 'assigned', storage_url: `https://cdn.test/logo${i}.png` },
  { id: `s${i}`, business_id: b.id, category: 'service', origin: 'discovered', state: 'assigned', storage_url: `https://cdn.test/svc${i}.jpg` },
]);
const assignments = businesses.flatMap((b, i) => [{ business_id: b.id, slot: 'logoUrl', asset_id: `l${i}`, manual: true }, { business_id: b.id, slot: 'productImageUrl', asset_id: `s${i}`, manual: false }]);
const base = { contacts, businesses, assets, assignments, recipients: [] as Recipient[], requiredSlots: ['logoUrl', 'productImageUrl'] };

describe('bulk rows', () => {
  it('builds 20 rows, each with only its own business assets', () => {
    const rows = buildBulkRows(base);
    expect(rows).toHaveLength(N);
    expect(summarize(rows)).toMatchObject({ total: 20, ready: 20, missing: 0, linked: 0 });
    rows.forEach((r, i) => { expect(r.plan.variables.logoUrl).toBe(`https://cdn.test/logo${i}.png`); expect(r.businessId).toBe(`b${i}`); });
  });

  it('flags a business with no saved assets or no business row as missing, never borrowing another\'s', () => {
    const rows = buildBulkRows({ ...base, assignments: assignments.filter((a) => a.business_id !== 'b4'), businesses: businesses.filter((b) => b.id !== 'b7') });
    expect(rows[4].plan).toMatchObject({ status: 'missing-assets', missingSlots: ['logoUrl', 'productImageUrl'] });
    expect(rows[7].businessId).toBeNull();
    expect(rows[7].plan.status).toBe('missing-assets');
    expect(rows[4].plan.variables.logoUrl).toBeUndefined();
    expect(summarize(rows).missing).toBe(2);
  });

  it('shows link status, skips contacts with an active link, and lets revoked/expired ones be re-linked', () => {
    const t = (id: string, ref: string, status: 'active' | 'revoked', extra: Partial<Recipient> = {}): Recipient => ({ id, token: 'x'.repeat(64), contact_ref: ref, status, created_at: '2026-11-12T10:00:00Z', variables: {}, ...extra });
    const now = Date.parse('2026-11-12T12:00:00Z');
    const rows = buildBulkRows({ ...base, now, recipients: [t('r0', 'c0', 'active'), t('r1', 'c1', 'revoked'), t('r2', 'c2', 'active', { expires_at: '2026-11-12T11:00:00Z' })] });
    expect(rows.slice(0, 4).map((r) => [r.linkStatus, r.plan.status])).toEqual([['active', 'already-linked'], ['revoked', 'ready'], ['expired', 'ready'], ['none', 'ready']]);
  });

  it('marks an active link stale only when its business assets changed', () => {
    const fresh = { id: 'r0', token: 'x'.repeat(64), contact_ref: 'c0', status: 'active' as const, created_at: '2026-11-12T10:00:00Z', variables: { firstName: 'P0', logoUrl: 'https://cdn.test/logo0.png', productImageUrl: 'https://cdn.test/svc0.jpg' } };
    expect(buildBulkRows({ ...base, recipients: [fresh] })[0].stale).toBe(false);
    const old = { ...fresh, variables: { ...fresh.variables, logoUrl: 'https://cdn.test/OLD.png' } };
    const row = buildBulkRows({ ...base, recipients: [old] })[0];
    expect(row.stale).toBe(true);
    expect(summarize(buildBulkRows({ ...base, recipients: [old] })).stale).toBe(1);
  });

  it('computes link status', () => {
    expect(linkStatusOf(null)).toBe('none');
    expect(linkStatusOf({ id: 'a', token: 't', status: 'revoked' })).toBe('revoked');
  });
});
