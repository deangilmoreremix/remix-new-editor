// [remix] Publish > Contacts logic: the three sources, one person once, filters and counts, CSV out and in.
import { describe, it, expect } from 'vitest';
import { CONTACT_SOURCE_LABEL, contactsToCsv, filterContacts, fromLandingRow, fromLeadRow, fromStored, importFromCsv, mergeContacts, sourceCounts } from '@cinegen/lib/publish/contacts';

const stored = fromStored({ id: 's1', firstName: 'Ana', lastName: 'Ruiz', email: ' ANA@Example.com ', company: 'Acme', createdAt: '2026-01-03T00:00:00Z' });
const lead = fromLeadRow({ id: 'l1', createdAt: '2026-01-01T00:00:00Z', data: { 'EMAIL': 'ana@example.com', 'FIRST NAME': 'Ana', 'Phone': '555-1' } });
const landing = fromLandingRow({ id: 'p1', fields: { email: 'bob@example.com', firstname: 'Bob', company: 'Bobco' }, created_at: '2026-01-02T00:00:00Z' }, 'Spring offer');

describe('normalising each source', () => {
  it('stored contact: name from parts, email lowercased and trimmed, removable', () => {
    expect(stored).toMatchObject({ name: 'Ana Ruiz', email: 'ana@example.com', company: 'Acme', sources: ['imported'], removableId: 's1', key: 'ana@example.com' });
  });
  it('lead row: reads email / first name / phone from the form answers, not removable here', () => {
    expect(lead).toMatchObject({ email: 'ana@example.com', name: 'Ana', phone: '555-1', sources: ['leads'], removableId: null });
  });
  it('landing row: names the page', () => {
    expect(landing).toMatchObject({ email: 'bob@example.com', name: 'Bob', company: 'Bobco', from: ['Landing page: Spring offer'] });
  });
  it('a person with no email is kept, keyed by source + id', () => {
    expect(fromLeadRow({ id: 'x', createdAt: '', data: { Name: 'No Mail' } }).key).toBe('leads:x');
  });
});

describe('mergeContacts', () => {
  const all = mergeContacts([stored], [lead], [landing]);
  it('shows the same email once, with every source and place, filling gaps', () => {
    expect(all).toHaveLength(2);
    const ana = all.find((c) => c.email === 'ana@example.com')!;
    expect(ana.sources).toEqual(['imported', 'leads']);
    expect(ana.from).toEqual([CONTACT_SOURCE_LABEL.imported, CONTACT_SOURCE_LABEL.leads]);
    expect(ana.phone).toBe('555-1');            // filled from the lead
    expect(ana.removableId).toBe('s1');
    expect(ana.createdAt).toBe('2026-01-01T00:00:00Z'); // the first time we heard from them
  });
  it('newest first', () => { expect(all.map((c) => c.email)).toEqual(['bob@example.com', 'ana@example.com']); });
  it('filters by source, search and has-email; counts follow the search but not the chip', () => {
    expect(filterContacts(all, 'leads', '', false).map((c) => c.email)).toEqual(['ana@example.com']);
    expect(filterContacts(all, 'all', 'bobco', false)).toHaveLength(1);
    expect(filterContacts([...all, fromLeadRow({ id: 'n', createdAt: '', data: { Name: 'X' } })], 'all', '', true)).toHaveLength(2);
    expect(sourceCounts(all, '')).toEqual({ all: 2, imported: 1, leads: 1, landing: 1 });
    expect(sourceCounts(all, 'ana')).toEqual({ all: 1, imported: 1, leads: 1, landing: 0 });
  });
});

describe('CSV', () => {
  it('exports a header and neutralises spreadsheet formulas and commas', () => {
    const csv = contactsToCsv([{ ...stored, name: '=HYPERLINK("x")', company: 'A, B' }]);
    const [head, row] = csv.split('\r\n');
    expect(head).toBe('name,email,phone,company,source,added');
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
    expect(row).toContain('"A, B"');
  });
  it('imports: guesses the columns, skips bad / duplicate rows and says why', () => {
    let n = 0;
    const r = importFromCsv('First Name,Last Name,Email,Company\nAna,Ruiz,ana@example.com,Acme\nBob,Lee,not-an-email,Bobco\nCy,Doe,CY@example.com,Cyco\nCy,Doe,cy@example.com,Cyco', new Set(['ana@example.com']), () => `id${++n}`);
    expect(r.hasEmailColumn).toBe(true);
    expect(r.contacts.map((c) => c.email)).toEqual(['cy@example.com']);
    expect(r.contacts[0]).toMatchObject({ id: 'id1', name: 'Cy Doe', company: 'Cyco', source: 'csv-import' });
    expect(r.skipped.map((s) => s.reason).sort()).toEqual(['duplicate', 'duplicate', 'invalid email']);
  });
  it('reports a file with no email column', () => {
    expect(importFromCsv('Name,Notes\nAna,hi', new Set(), () => 'x').hasEmailColumn).toBe(false);
  });
});
