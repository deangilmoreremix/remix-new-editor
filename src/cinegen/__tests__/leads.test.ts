// [remix] Leads tab logic: forms, counts, filter/search, columns, CSV, includes, delete/list via a fake client, tab registration.
import { describe, it, expect } from 'vitest';
import { answerColumns, countsByForm, filterRows, leadForms, publishIncludes, rowFormKey, rowsToCsv, whenLabel, type LeadRow } from '@cinegen/lib/leads/leads';
import { createOverlay } from '@cinegen/lib/overlays/overlays';
import { setLeadsForm, getLeadsForm } from '@cinegen/lib/leads/leads-filter';
// @ts-expect-error plain JS
import { fetchLeadRows } from '../../lib/editor/addons/leadClient.js';
import { PROJECT_TABS } from '@cinegen/components/workspace/top-tabs';

const row = (id: string, kind: string, clipId: string | null, data: Record<string, string>, createdAt = '2026-11-10T10:00:00Z'): LeadRow => ({ id, kind, clipId, createdAt, data });

describe('leads logic', () => {
  const wall = createOverlay('list-builder', 0, 20);
  const lg = createOverlay('lead-form', 65, 120);
  const rows = [row('1', 'list-builder', 'list-builder', { EMAIL: 'a@x.com', 'FIRST NAME': 'Ann' }), row('2', 'lead-form', lg.id, { EMAIL: 'b@x.com' }), row('3', 'lead-form', lg.id, { EMAIL: 'c@y.com', PHONE: '1' })];

  it('names forms and maps rows to them', () => {
    const forms = leadForms([wall, lg]);
    expect(forms.map((f) => f.label)).toEqual(['List Builder', 'Lead Generator · 1:05']);
    expect(rows.map(rowFormKey)).toEqual(['list-builder', lg.id, lg.id]);
    expect(countsByForm(rows)).toEqual({ 'list-builder': 1, [lg.id]: 2 });
  });
  it('filters by form and searches answers', () => {
    expect(filterRows(rows, { form: lg.id })).toHaveLength(2);
    expect(filterRows(rows, { query: 'ANN' })).toHaveLength(1);
    expect(filterRows(rows, { form: lg.id, query: 'y.com' })).toHaveLength(1);
  });
  it('builds columns and CSV', () => {
    expect(answerColumns(rows).map((c) => c.label)).toEqual(['Email', 'First Name', 'Phone']);
    const csv = rowsToCsv(rows, leadForms([wall, lg]));
    expect(csv.split('\r\n')).toHaveLength(4);
    expect(csv).toContain('"Lead Generator · 1:05"');
  });
  it('labels time', () => {
    const now = new Date(2026, 10, 11, 12, 0);
    expect(whenLabel(new Date(2026, 10, 11, 9, 5).toISOString(), now)).toBe('Today 09:05');
    expect(whenLabel(new Date(2026, 10, 10, 19, 5).toISOString(), now)).toBe('Yesterday 19:05');
  });
  it('summarises what is published', () => {
    const inc = publishIncludes([wall, lg, createOverlay('click-to-call', 30, 120)]);
    expect(inc.map((i) => i.title)).toEqual(['List Builder', 'Lead Generator at 1:05', 'CTA button at 0:30']);
  });
  it('filter store', () => { setLeadsForm('x'); expect(getLeadsForm()).toBe('x'); setLeadsForm('all'); });
  it('registers the Leads tab', () => { expect(PROJECT_TABS.map((t: any) => t.id)).toContain('leads'); });
});

describe('fetchLeadRows', () => {
  it('maps rows and reports errors', async () => {
    const ok = { functions: { invoke: async () => ({ data: { ok: true, leads: [{ id: '9', data: { EMAIL: 'z' }, created_at: 't', clip_id: 'c', kind: 'lead-form' }] }, error: null }) } };
    expect(await fetchLeadRows(ok, { projectId: 'p' })).toMatchObject({ ok: true, rows: [{ id: '9', clipId: 'c', createdAt: 't', data: { EMAIL: 'z' } }] });
    const bad = { functions: { invoke: async () => ({ data: null, error: { message: 'boom' } }) } };
    expect(await fetchLeadRows(bad, {})).toMatchObject({ ok: false, error: 'boom' });
  });
});
