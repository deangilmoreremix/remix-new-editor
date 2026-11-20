// [remix] Lead score (0-100, Hot / Warm / Cold), sorting by it, tag helpers, status counts and the CSV / Excel records.
import { describe, it, expect, vi } from 'vitest';
import { scoreLead, temperatureOf, sortRows, isFreeMail, addTag, removeTag, statusCounts, exportRecords, rowsToCsv, CALL_ATTEMPT_POINTS, type LeadRow } from '@cinegen/lib/leads/leads';
import { sheetFromRecords, downloadLeadsXlsx } from '@cinegen/lib/leads/leads-xlsx';

const row = (id: string, kind: string, data: Record<string, string>, extra: Partial<LeadRow> = {}): LeadRow => ({ id, kind, clipId: kind === 'lead-form' ? 'c1' : 'list-builder', createdAt: '2026-11-10T10:00:00Z', data, ...extra });

describe('scoreLead', () => {
  it('scores a bare wall sign-up with a personal email as Cold', () => {
    const s = scoreLead(row('a', 'list-builder', { EMAIL: 'ann@gmail.com' }));
    expect(s).toMatchObject({ score: 15, label: 'Cold' });
    expect(s.reasons).toEqual(['Personal email address']);
  });
  it('rates a company email higher than a personal one', () => {
    const biz = scoreLead(row('a', 'list-builder', { EMAIL: 'ann@acme.io' })).score;
    const free = scoreLead(row('b', 'list-builder', { EMAIL: 'ann@gmail.com' })).score;
    expect(biz).toBe(30);
    expect(biz).toBeGreaterThan(free);
  });
  it('adds points for a phone number, a name, company details and how much they filled in', () => {
    const s = scoreLead(row('a', 'lead-form', { EMAIL: 'ann@acme.io', 'FIRST NAME': 'Ann', PHONE: '+1 (555) 123-4567', COMPANY: 'Acme' }));
    expect(s.reasons).toEqual(expect.arrayContaining(['Business email address', 'Gave a phone number', 'Gave a name', 'Gave company or project details', 'Filled in a form mid-video']));
    expect(s.score).toBe(10 + 30 + 20 + 5 + 10 + 9); // form + email + phone + name + company + 3 other answers x 3
    expect(s.label).toBe('Hot');
  });
  it('ignores a "phone" with too few digits and does not call an email address a name', () => {
    expect(scoreLead(row('a', 'list-builder', { PHONE: 'n/a' })).reasons).not.toContain('Gave a phone number');
    expect(scoreLead(row('b', 'list-builder', { 'EMAIL NAME': 'x@y.io' })).reasons).not.toContain('Gave a name');
  });
  it('finds an email even when the answer is labelled something else', () => {
    expect(scoreLead(row('a', 'list-builder', { 'Contact address': 'ann@acme.io' })).reasons).toContain('Business email address');
  });
  it('gives a bonus for campaign tags, a smaller one for a referrer only', () => {
    const base = row('a', 'list-builder', { EMAIL: 'ann@acme.io' });
    expect(scoreLead({ ...base, source: { utm: { source: 'google' } } }).score).toBe(40);
    expect(scoreLead({ ...base, source: { referrer: 'https://news.example.com' } }).score).toBe(35);
    expect(scoreLead({ ...base, source: { utm: { source: '' } } }).score).toBe(30);
  });
  it('treats a call attempt as a strong signal and does not read the dialled number as the lead\'s phone', () => {
    const s = scoreLead(row('c', 'call-attempt', { PHONE: '+447700900123', CALLED_AT: '2026-11-10T10:00:00Z' }));
    expect(s.score).toBe(CALL_ATTEMPT_POINTS);
    expect(s.label).toBe('Hot');
    expect(s.reasons).toEqual(['Tapped to call you']);
  });
  it('never exceeds 100, never goes below 0, and handles an empty row', () => {
    const full = scoreLead(row('a', 'lead-form', { EMAIL: 'a@acme.io', NAME: 'A', PHONE: '555 123 4567', COMPANY: 'X', A: '1', B: '2', C: '3', D: '4', E: '5' }, { source: { utm: { source: 'g' } } }));
    expect(full.score).toBeLessThanOrEqual(100);
    expect(scoreLead(row('b', 'list-builder', {}))).toMatchObject({ score: 0, label: 'Cold', reasons: [] });
  });
  it('maps scores to labels at 30 and 65', () => {
    expect([0, 29, 30, 64, 65, 100].map(temperatureOf)).toEqual(['Cold', 'Cold', 'Warm', 'Warm', 'Hot', 'Hot']);
  });
  it('knows personal inboxes', () => {
    expect(isFreeMail('a@Gmail.com')).toBe(true);
    expect(isFreeMail('a@acme.io')).toBe(false);
  });
});

describe('sortRows', () => {
  const rows = [row('low', 'list-builder', { EMAIL: 'a@gmail.com' }), row('high', 'lead-form', { EMAIL: 'b@acme.io', PHONE: '555 123 4567' }), row('mid', 'list-builder', { EMAIL: 'c@acme.io' }), row('mid2', 'list-builder', { EMAIL: 'd@acme.io' })];
  it('keeps the given order for "newest"', () => expect(sortRows(rows, 'newest').map((r) => r.id)).toEqual(['low', 'high', 'mid', 'mid2']));
  it('sorts by score, highest first, ties in the given order', () => expect(sortRows(rows, 'score-desc').map((r) => r.id)).toEqual(['high', 'mid', 'mid2', 'low']));
  it('sorts lowest first too, without changing the input', () => {
    expect(sortRows(rows, 'score-asc').map((r) => r.id)).toEqual(['low', 'mid', 'mid2', 'high']);
    expect(rows.map((r) => r.id)).toEqual(['low', 'high', 'mid', 'mid2']);
  });
});

describe('tags and statuses', () => {
  it('adds a cleaned tag once, up to ten', () => {
    expect(addTag([], ' VIP Client ')).toEqual(['vip-client']);
    expect(addTag(['vip'], 'VIP')).toEqual(['vip']);
    expect(addTag(['vip'], '   ')).toEqual(['vip']);
    expect(addTag(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], 'k')).toHaveLength(10);
    expect(addTag([], 'x'.repeat(50))[0]).toHaveLength(30);
  });
  it('removes a tag', () => expect(removeTag(['a', 'b'], 'a')).toEqual(['b']));
  it('counts statuses, with a missing one as new', () => {
    expect(statusCounts([row('1', 'x', {}), row('2', 'x', {}, { status: 'won' }), row('3', 'x', {}, { status: 'won' })])).toEqual({ new: 1, won: 2 });
  });
});

describe('export records', () => {
  const rows = [row('1', 'lead-form', { EMAIL: 'ann@acme.io', PHONE: '+15551234567' }, { status: 'won', notes: '=HYPERLINK("x")', tags: ['vip', 'hot'] })];
  it('adds the score, rating, status, notes and tags', () => {
    const [rec] = exportRecords(rows, []);
    expect(rec).toMatchObject({ Status: 'Won', Tags: 'vip, hot', 'Lead Score': scoreLead(rows[0]).score, 'Lead Rating': scoreLead(rows[0]).label });
    expect(rec.Notes).toBe("'=HYPERLINK(\"x\")"); // formula-guarded for CSV
    expect(typeof rec['Lead Score']).toBe('number');
  });
  it('leaves values as typed for Excel (cells are typed text there)', () => {
    expect(exportRecords(rows, [], { escape: false })[0].Notes).toBe('=HYPERLINK("x")');
    {
      // an answer whose label equals a computed column keeps its value; the computed value goes to "<name> (computed)"
      const clash = row('c', 'lead-form', { EMAIL: 'a@acme.io', 'Lead Score': 'my own answer', 'Lead Rating': 'mine', Status: 'x' }, { status: 'won' as never });
      const [r2] = exportRecords([clash], []);
      expect(r2['Lead Score']).toBe('my own answer');
      expect(r2['Lead Rating']).toBe('mine');
      expect(r2['Lead Score (computed)']).toBe(scoreLead(clash).score);
      expect(r2['Lead Rating (computed)']).toBe(scoreLead(clash).label);
      expect(r2.Status).toBe('x');
      expect(Object.keys(r2).some((k) => k.startsWith('Status ('))).toBe(true);
    }
  });
  it('puts the score, status, notes and tags in the CSV', () => {
    const header = rowsToCsv(rows, []).split('\r\n')[0];
    ['"Lead Score"', '"Lead Rating"', '"Status"', '"Notes"', '"Tags"'].forEach((h) => expect(header).toContain(h));
  });
  it('leaves follow-up columns out when the database has none', () => {
    expect(rowsToCsv([row('1', 'lead-form', { EMAIL: 'a@x.io' })], []).split('\r\n')[0]).not.toContain('"Status"');
  });
});

describe('Excel export', () => {
  const records = [{ Submitted: 't1', EMAIL: 'a@x.io', 'Lead Score': 40 }, { Submitted: 't2', PHONE: '555', 'Lead Score': 10 }];
  it('builds a bold header row, typed cells and empty cells for missing values', () => {
    const { data, columns } = sheetFromRecords(records);
    expect(data[0]).toEqual([{ value: 'Submitted', fontWeight: 'bold' }, { value: 'EMAIL', fontWeight: 'bold' }, { value: 'Lead Score', fontWeight: 'bold' }, { value: 'PHONE', fontWeight: 'bold' }]);
    expect(data[1]).toEqual(['t1', 'a@x.io', 40, null]);
    expect(data[2]).toEqual(['t2', null, 10, '555']);
    expect(columns).toHaveLength(4);
    expect(columns.every((c) => c.width >= 10 && c.width <= 40)).toBe(true);
  });
  it('loads the writer only when called and saves with the given file name', async () => {
    const toFile = vi.fn(async () => undefined);
    const write = vi.fn(() => ({ toFile }));
    const load = vi.fn(async () => ({ default: write }));
    expect(load).not.toHaveBeenCalled();
    await downloadLeadsXlsx(records, 'my-leads.xlsx', load as never);
    expect(load).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toHaveLength(3);
    expect(toFile).toHaveBeenCalledWith('my-leads.xlsx');
  });
  it('really produces an .xlsx file with the installed library', async () => {
    const mod = await import('write-excel-file/universal');
    const blob = await (mod.default as never as (d: unknown, o?: unknown) => { toBlob: () => Promise<Blob> })(sheetFromRecords(records).data).toBlob();
    expect(blob.size).toBeGreaterThan(500);
    expect(blob.type).toContain('spreadsheetml');
  });
});
