import { describe, it, expect } from 'vitest';
import { leadKindFor, safeLeadKind, tokenAnswers, emailOf, LEAD_KINDS } from '../leadPipeline.js';
import { submitPageLead } from '../client.js';

describe('one lead pipeline for timeline forms and landing pages', () => {
  it('maps form types to the stored lead kinds the Leads sections use', () => {
    expect(leadKindFor('lead-generator')).toBe('lead-form'); expect(leadKindFor('list-builder')).toBe('list-builder'); expect(leadKindFor('personalizer')).toBe('personalizer'); expect(leadKindFor(undefined)).toBe('lead-form');
    expect(LEAD_KINDS).toEqual(['lead-form', 'list-builder', 'personalizer']);
    expect(safeLeadKind('call-attempt')).toBe('lead-form'); expect(safeLeadKind('<b>')).toBe('lead-form'); expect(safeLeadKind('personalizer')).toBe('personalizer');
  });
  it('keys answers by the timeline tokens: label upper-cased, duplicates numbered, empty answers dropped', () => {
    const fields = [{ key: 'a', label: 'First Name' }, { key: 'b', label: 'Phone number' }, { key: 'c', label: 'phone number' }, { key: 'd', label: 'Notes' }];
    expect(tokenAnswers(fields, { a: ' Dana ', b: '555', c: '777', d: '  ' })).toEqual({ 'FIRST NAME': 'Dana', 'PHONE NUMBER': '555', 'PHONE NUMBER_2': '777' });
    expect(tokenAnswers(fields, { zzz: 'extra' })).toEqual({ ZZZ: 'extra' });
    expect(tokenAnswers(null, null)).toEqual({});
  });
  it('finds the e-mail answer whatever the box is called', () => {
    expect(emailOf({ 'WORK ADDRESS': 'a@b.co', NAME: 'x' })).toBe('a@b.co'); expect(emailOf({ EMAIL: 'nope', 'CONTACT MAIL': 'ok@x.io' })).toBe('ok@x.io'); expect(emailOf({ NAME: 'x' })).toBe('');
  });
  it('the page sends the form kind with the lead (unknown kinds become a plain lead form)', async () => {
    const bodies = []; const fetchImpl = async (u, init) => { bodies.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ ok: true, stored: true }) }; };
    const env = { url: 'https://p.supabase.co', key: 'k', fetchImpl };
    await submitPageLead({ pageId: 'page1234', contactId: 'c1', data: { EMAIL: 'a@b.co' }, kind: 'list-builder' }, env);
    await submitPageLead({ pageId: 'page1234', data: { EMAIL: 'a@b.co' }, kind: 'evil' }, env);
    await submitPageLead({ pageId: 'page1234', data: { EMAIL: 'a@b.co' } }, env);
    expect(bodies.map((b) => b.kind)).toEqual(['list-builder', 'lead-form', 'lead-form']);
    expect(bodies[0].data).toEqual({ EMAIL: 'a@b.co' });
  });
});
