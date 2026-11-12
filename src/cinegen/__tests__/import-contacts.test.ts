import { describe, it, expect } from 'vitest';
import { importedToRecords } from '@cinegen/lib/leads/import-contacts';

describe('importedToRecords', () => {
  const rows = [{ firstName: 'Ann', lastName: 'Lee', email: 'ANN@x.com', company: 'Smith Roofing', phone: '555' }, { firstName: 'Bo', email: 'ann@x.com' }, { company: '' }, { firstName: 'Cy\u0000', company: 'Wilson Plumbing' }];
  it('imports real CSV rows with unique ids, skipping blanks and duplicate emails', () => {
    const r = importedToRecords({ source: 'csv', contacts: rows });
    expect(r.records).toHaveLength(2);
    expect(r.skipped).toBe(2);
    expect(new Set(r.records.map((x) => x.contact.id)).size).toBe(2);
    expect(r.records.every((x) => /^[A-Za-z0-9_-]{1,80}$/.test(x.contact.id))).toBe(true);
    expect(r.records[0].profile).toMatchObject({ name: 'Ann Lee', personalization: { business: { businessName: 'Smith Roofing' } } });
    expect(r.records[1].contact.name).toBe('Cy');
  });
  it('refuses sample data from non-CSV sources', () => {
    const r = importedToRecords({ source: 'google', contacts: rows });
    expect(r.records).toHaveLength(0);
    expect(r.reason).toMatch(/CSV/);
  });
  it('does not re-import emails that already exist', () => {
    expect(importedToRecords({ source: 'csv', contacts: rows }, new Set(['ann@x.com'])).records.map((x) => x.contact.name)).toEqual(['Cy']);
  });
});
