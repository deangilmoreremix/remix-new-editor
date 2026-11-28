import { describe, it, expect } from 'vitest';
import { validateContacts, dedupeContacts, restoreDuplicates, mergeFieldReport, isEmailSyntax, websiteProblem } from '../contactQa.js';

const c = (o) => ({ id: o.id || Math.random().toString(36).slice(2), ...o });

describe('contact validation', () => {
  it('checks email syntax only, and says so', () => {
    expect(isEmailSyntax('mike@acme.com')).toBe(true);
    expect(isEmailSyntax('mike@acme')).toBe(false);
    expect(isEmailSyntax('mike acme.com')).toBe(false);
    const { issues } = validateContacts([c({ firstName: 'Mike', email: 'nope', company: 'Acme' })]);
    const bad = issues.find((i) => i.type === 'invalid-email');
    expect(bad.level).toBe('warning');
    expect(bad.message).toMatch(/syntax only/);
  });
  it('flags missing details as info and only a missing email as a warning when email is required', () => {
    const list = [c({ lastName: 'Ross', email: 'r@x.com' })];
    const info = validateContacts(list).issues.map((i) => [i.type, i.level]);
    expect(info).toContainEqual(['missing-first-name', 'info']);
    expect(info).toContainEqual(['missing-company', 'info']);
    expect(validateContacts([c({ firstName: 'A', company: 'B' })], { requireEmail: true }).issues.find((i) => i.type === 'missing-email').level).toBe('warning');
    expect(validateContacts([c({ firstName: 'A', company: 'B' })]).issues.find((i) => i.type === 'missing-email').level).toBe('info');
  });
  it('accepts a bare domain as a website and rejects nonsense', () => {
    expect(websiteProblem('acme.com')).toBe('');
    expect(websiteProblem('https://www.acme.com/x')).toBe('');
    expect(websiteProblem('not a site')).not.toBe('');
    expect(websiteProblem('ftp://acme.com')).not.toBe('');
    expect(websiteProblem('')).toBe('');
  });
  it('finds duplicates by email (any case), else by name and company', () => {
    const list = [c({ firstName: 'Mike', email: 'Mike@Acme.com' }), c({ firstName: 'Michael', email: 'mike@acme.com' }), c({ firstName: 'Ann', lastName: 'Lee', company: 'X' }), c({ firstName: 'ann', lastName: 'LEE', company: 'x' })];
    const { duplicateGroups, counts } = validateContacts(list);
    expect(duplicateGroups).toEqual([[0, 1], [2, 3]]);
    expect(counts.duplicate).toBe(2);
  });
});

describe('reversible dedupe', () => {
  it('keeps the first of each group and restores the original list exactly', () => {
    const list = [c({ id: 'a', email: 'x@y.com' }), c({ id: 'b', email: 'z@y.com' }), c({ id: 'c', email: 'X@y.com' }), c({ id: 'd', email: 'w@y.com' }), c({ id: 'e', email: 'z@y.com' })];
    const { kept, removed } = dedupeContacts(list);
    expect(kept.map((k) => k.id)).toEqual(['a', 'b', 'd']);
    expect(removed.map((r) => [r.index, r.contact.id])).toEqual([[2, 'c'], [4, 'e']]);
    expect(restoreDuplicates(kept, removed).map((k) => k.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('does nothing to a list without duplicates', () => {
    const list = [c({ id: 'a', email: 'a@x.com' }), c({ id: 'b', email: 'b@x.com' })];
    const { kept, removed } = dedupeContacts(list);
    expect(kept).toEqual(list); expect(removed).toEqual([]);
  });
});

describe('merge-field report', () => {
  const contacts = [
    c({ id: '1', firstName: 'Mike', company: 'Acme', jobTitle: 'CEO', website: 'acme.com' }),
    c({ id: '2', firstName: '', company: 'Beta' }),
    c({ id: '3', firstName: 'Cy' }),
  ];
  const templates = { header: 'Hi {{firstname}}, {{company}}', email: 'Re {{jobTitle}}: {{link}}' };
  const r = mergeFieldReport({ templates, contacts, fallbacks: { firstname: 'there' }, linkFor: (x) => `https://s.app/w/${x.id}` });
  it('lists every token in use, case-insensitively', () => { expect(r.tokens.sort()).toEqual(['company', 'firstname', 'jobtitle', 'link']); });
  it('says where each value came from', () => {
    const second = r.rows[1];
    expect(second.fields.find((f) => f.token === 'firstname')).toMatchObject({ value: 'there', source: 'fallback' });
    expect(second.fields.find((f) => f.token === 'company')).toMatchObject({ value: 'Beta', source: 'contact' });
    expect(second.fields.find((f) => f.token === 'link')).toMatchObject({ value: 'https://s.app/w/2', source: 'contact' });
  });
  it('counts what is missing or covered by a fallback', () => {
    expect(r.usingFallback).toEqual({ firstname: 1 });
    expect(r.missing).toEqual({ company: 1, jobtitle: 2 });
    expect(r.rows.map((x) => x.ok)).toEqual([true, false, false]);
  });
  it('fills the templates with the real values', () => { expect(r.rows[0].filled.header).toBe('Hi Mike, Acme'); });
});

describe('company alone is not an identity', () => {
  it('does not treat two nameless contacts at one company as the same person', () => {
    const list = [c({ id: 'a', company: 'Acme', jobTitle: 'CEO' }), c({ id: 'b', company: 'Acme', jobTitle: 'CTO' })];
    expect(dedupeContacts(list).removed).toEqual([]);
    expect(validateContacts(list).duplicateGroups).toEqual([]);
  });
  it('still treats the same name and company as one person', () => {
    const list = [c({ id: 'a', firstName: 'Mike', company: 'Acme' }), c({ id: 'b', firstName: 'mike', company: 'ACME' })];
    expect(dedupeContacts(list).removed.map((r) => r.contact.id)).toEqual(['b']);
  });
});
