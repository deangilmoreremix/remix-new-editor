import { describe, it, expect } from 'vitest';
import { planBulkLinks, rowsToCreate, summarizePlan } from '../bulkLinks.js';

const contacts = Array.from({ length: 20 }, (_, i) => ({
  id: `c${i}`, name: `Person ${i}`, businessId: `b${i}`, variables: { FIRSTNAME: `P${i}`, COMPANY: `Biz ${i}` },
}));
const assets = Object.fromEntries(contacts.map((c, i) => [c.businessId, { logoUrl: `https://cdn.test/logo${i}.png`, serviceImage: `https://cdn.test/svc${i}.jpg` }]));

describe('bulk link planning', () => {
  it('plans 20 unique recipients, each with only its own business assets', () => {
    const plan = planBulkLinks({ contacts, assetsByBusiness: assets, requiredSlots: ['logoUrl', 'serviceImage'] });
    expect(summarizePlan(plan)).toMatchObject({ total: 20, ready: 20, missingAssets: 0 });
    plan.forEach((r, i) => {
      expect(r.variables.logoUrl).toBe(`https://cdn.test/logo${i}.png`);
      expect(r.variables.COMPANY).toBe(`Biz ${i}`);
      expect(JSON.stringify(r.variables)).not.toMatch(new RegExp(`logo(?!${i}\\.)\\d+`)); // no other business's logo
    });
    expect(new Set(plan.map((r) => r.variables.logoUrl)).size).toBe(20);
  });

  it('reports missing assets instead of borrowing another business\'s photo', () => {
    const partial = { ...assets, b3: { logoUrl: 'https://cdn.test/logo3.png' } }; // no serviceImage for b3
    const plan = planBulkLinks({ contacts, assetsByBusiness: partial, requiredSlots: ['logoUrl', 'serviceImage'] });
    const r = plan[3];
    expect(r.status).toBe('missing-assets');
    expect(r.missingSlots).toEqual(['serviceImage']);
    expect(r.variables.serviceImage).toBeUndefined();
    expect(rowsToCreate(plan)).toHaveLength(19);
    expect(rowsToCreate(plan, { allowMissing: true })).toHaveLength(20);
  });

  it('is idempotent: contacts with an active link are skipped, revoked ones are re-linkable', () => {
    const plan = planBulkLinks({ contacts: contacts.slice(0, 3), assetsByBusiness: assets, existing: [{ contactId: 'c0', status: 'active' }, { contactId: 'c1', status: 'revoked' }] });
    expect(plan.map((r) => r.status)).toEqual(['already-linked', 'ready', 'ready']);
  });

  it('drops non-durable asset URLs and flags contacts without an id', () => {
    const plan = planBulkLinks({ contacts: [{ id: 'x', businessId: 'bx', variables: {} }, { name: 'No id' }], assetsByBusiness: { bx: { logoUrl: 'blob:http://x/1' } }, requiredSlots: ['logoUrl'] });
    expect(plan[0]).toMatchObject({ status: 'missing-assets', missingSlots: ['logoUrl'] });
    expect(plan[0].variables.logoUrl).toBeUndefined();
    expect(plan[1].status).toBe('invalid');
  });
});

import { mergeAssetVariables, assetVariablesChanged } from '../bulkLinks.js';
describe('refreshing existing links from the library', () => {
  it('replaces image slots, removes ones the business no longer has, and never touches text', () => {
    const existing = { FIRSTNAME: 'John', COMPANY: 'Smith Roofing', logoUrl: 'https://old/logo.png', productImageUrl: 'https://old/p.png' };
    const merged = mergeAssetVariables(existing, { logoUrl: 'https://new/logo.png', FIRSTNAME: 'Mallory' });
    expect(merged).toEqual({ FIRSTNAME: 'John', COMPANY: 'Smith Roofing', logoUrl: 'https://new/logo.png' });
    expect(assetVariablesChanged(existing, merged)).toBe(true);
    expect(assetVariablesChanged(merged, mergeAssetVariables(merged, { logoUrl: 'https://new/logo.png' }))).toBe(false);
  });
  it('ignores non-durable planned image URLs', () => {
    expect(mergeAssetVariables({ logoUrl: 'https://old/l.png' }, { logoUrl: 'blob:x' })).toEqual({});
  });
});

describe('assigned images win over mirrored contact variables', () => {
  it('a replaced image is not pinned by an older copy on the contact; contact-only image slots stay', () => {
    const contact = { id: 'c1', name: 'A', businessId: 'b1', variables: { logoUrl: 'https://old/logo.png', productImageUrl: 'https://old/p.png', avatarUrl: 'https://me/a.png', FIRSTNAME: 'Ann' } };
    const [r] = planBulkLinks({ contacts: [contact], assetsByBusiness: { b1: { logoUrl: 'https://new/logo.png', productImageUrl: 'https://new/p.png' } }, requiredSlots: ['logoUrl'] });
    expect(r.variables).toMatchObject({ logoUrl: 'https://new/logo.png', productImageUrl: 'https://new/p.png', avatarUrl: 'https://me/a.png', FIRSTNAME: 'Ann' });
  });
});
