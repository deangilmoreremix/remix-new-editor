// [remix] Leads tab logic: forms, counts, filter/search, columns, CSV, includes, delete/list via a fake client, tab registration.
import { describe, it, expect } from 'vitest';
import { sessionOf, watchTag, watchPercent, sessionKeys, cleanFollowUp, hasFollowUp, statusLabel, LEAD_STATUSES, answerColumns, collapseRepeats, leadEmail, leadsPerDay, fromMp4, rowSource, variantOf, variantCounts, countsByForm, filterRows, leadForms, publishIncludes, rowFormKey, rowsToCsv, csvSafe, sourceLabel, whenLabel, type LeadRow } from '@cinegen/lib/leads/leads';
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
  it('filters by date range', () => {
    const now = new Date(2026, 10, 13, 12, 0);
    const at = (d: Date) => d.toISOString();
    const dated = [
      row('a', 'lead-form', 'x', { EMAIL: 'a@x.com' }, at(new Date(2026, 10, 13, 9, 0))), // today
      row('b', 'lead-form', 'x', { EMAIL: 'b@x.com' }, at(new Date(2026, 10, 8, 9, 0))), // 5 days ago
      row('c', 'lead-form', 'x', { EMAIL: 'c@x.com' }, at(new Date(2026, 9, 20, 9, 0))), // 24 days ago
      row('d', 'lead-form', 'x', { EMAIL: 'd@x.com' }, at(new Date(2026, 8, 1, 9, 0))), // old
      row('e', 'lead-form', 'x', { EMAIL: 'e@x.com' }, 'not a date'),
    ];
    const ids = (range: 'all' | 'today' | '7d' | '30d') => filterRows(dated, { range, now }).map((r) => r.id);
    expect(ids('all')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(ids('today')).toEqual(['a']);
    expect(ids('7d')).toEqual(['a', 'b']);
    expect(ids('30d')).toEqual(['a', 'b', 'c']);
    expect(filterRows(dated, { range: '7d', query: 'b@x', now }).map((r) => r.id)).toEqual(['b']);
  });
  it('shows where a lead came from, searches it and exports it', () => {
    const withSrc: LeadRow[] = [
      { ...row('s1', 'lead-form', 'x', { EMAIL: 'a@x.com' }), source: { utm: { source: 'google', campaign: 'spring', medium: 'cpc' }, referrer: 'https://news.example.com/p' } },
      { ...row('s2', 'lead-form', 'x', { EMAIL: 'b@x.com' }), source: { referrer: 'https://blog.example.org/post' } },
      row('s3', 'lead-form', 'x', { EMAIL: 'c@x.com' }),
    ];
    expect(sourceLabel(withSrc[0])).toBe('google / spring');
    expect(sourceLabel(withSrc[1])).toBe('blog.example.org');
    expect(sourceLabel(withSrc[2])).toBe('');
    expect(filterRows(withSrc, { query: 'spring' }).map((r) => r.id)).toEqual(['s1']);
    expect(filterRows(withSrc, { query: 'blog.example' }).map((r) => r.id)).toEqual(['s2']);
    const csv = rowsToCsv(withSrc, []).split('\r\n');
    expect(csv[0]).toContain('"UTM Source"');
    expect(csv[0]).toContain('"UTM Campaign"');
    expect(csv[0]).toContain('"Referrer"');
    expect(csv[1]).toContain('"google"');
    expect(rowsToCsv([row('p', 'lead-form', 'x', { EMAIL: 'a@x.com' })], []).split('\r\n')[0]).not.toContain('UTM'); // older exports keep their shape
  });
  it('neutralizes spreadsheet formulas in the attribution columns', () => {
    for (const bad of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx']) expect(csvSafe(bad)).toBe(`'${bad}`);
    for (const fine of ['google', 'spring sale', 'a=b', 'https://x.test/p']) expect(csvSafe(fine)).toBe(fine);
    const csv = rowsToCsv([{ ...row('f', 'lead-form', 'x', { EMAIL: 'a@x.com' }), source: { utm: { source: '=HYPERLINK("http://evil","x")', campaign: '@SUM(1)' }, referrer: 'https://r.test/p' } }], []);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csv).toContain(`"'@SUM(1)"`);
    expect(csv).toContain('"https://r.test/p"');
    expect(csv).not.toMatch(/(^|,)"=/m);
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

describe('MP4 attribution', () => {
  const r = (page: string | null): LeadRow => ({ id: 'x', kind: 'list-builder', clipId: 'list-builder', createdAt: 't', data: { EMAIL: 'a@b.c' }, source: { page } });
  it('reads ?src=mp4 from the page the viewer submitted on', () => {
    expect(rowSource(r('https://x.app/watch/Abc123XyZ9?src=mp4'))).toBe('mp4');
    expect(fromMp4(r('https://x.app/watch/Abc123XyZ9?src=mp4'))).toBe(true);
    expect(fromMp4(r('https://x.app/watch/Abc123XyZ9'))).toBe(false);
    expect(fromMp4(r('not a url'))).toBe(false);
    expect(fromMp4({ ...r(null), source: undefined })).toBe(false);
  });
  it('adds an optional From MP4 column to the CSV', () => {
    const csv = rowsToCsv([r('https://x.app/watch/Abc123XyZ9?src=mp4')], []);
    expect(csv).toContain('"From MP4"'); expect(csv).toContain('"Yes"');
    expect(rowsToCsv([r('https://x.app/watch/Abc123XyZ9')], [])).not.toContain('From MP4');
  });
});

describe('leads per day and repeats', () => {
  const at = (iso: string, email: string, kind = 'list-builder', clip = 'list-builder', id?: string): LeadRow => ({ id: id ?? `${iso}${email}`, kind, clipId: clip, createdAt: iso, data: email ? { EMAIL: email } : { NAME: 'x' } });
  it('zero-fills the last days, oldest first, and counts per local day', () => {
    const now = new Date(2026, 10, 18, 12, 0);
    const rows = [at(new Date(2026, 10, 18, 9, 0).toISOString(), 'a@x.co'), at(new Date(2026, 10, 18, 10, 0).toISOString(), 'b@x.co'), at(new Date(2026, 10, 16, 8, 0).toISOString(), 'c@x.co'), at(new Date(2026, 9, 1).toISOString(), 'old@x.co')];
    const days = leadsPerDay(rows, 7, now);
    expect(days).toHaveLength(7);
    expect(days[0].label).toBe('Nov 12'); expect(days[6].label).toBe('Nov 18');
    expect(days.map((d) => d.n)).toEqual([0, 0, 0, 0, 1, 0, 2]); // the October lead is outside the window
  });
  it('reads the email from any answer named like email', () => {
    expect(leadEmail({ ...at('t', ''), data: { 'Work Email': ' A@X.co ' } })).toBe('a@x.co');
    expect(leadEmail(at('t', ''))).toBe('');
  });
  it('merges the same email on the same form, keeps the newest, counts repeats', () => {
    const rows = [at('3', 'a@x.co', 'list-builder', 'list-builder', 'n'), at('2', 'A@x.co', 'list-builder', 'list-builder', 'm'), at('1', 'a@x.co', 'list-builder', 'list-builder', 'o')];
    const out = collapseRepeats(rows);
    expect(out.rows.map((r) => r.id)).toEqual(['n']); expect(out.counts.n).toBe(3);
  });
  it('does not merge across forms, or leads without an email', () => {
    const rows = [at('3', 'a@x.co', 'lead-form', 'ov1', 'a'), at('2', 'a@x.co', 'list-builder', 'list-builder', 'b'), at('1', '', 'lead-form', 'ov1', 'c'), at('0', '', 'lead-form', 'ov1', 'd')];
    expect(collapseRepeats(rows).rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('lead follow-up (status, notes, tags)', () => {
  const r = (id: string, extra: Partial<LeadRow> = {}): LeadRow => ({ id, kind: 'list-builder', clipId: 'list-builder', createdAt: '2026-11-10T10:00:00Z', data: { EMAIL: `${id}@x.co` }, ...extra });
  it('is available only when rows carry a status (the migration is applied)', () => {
    expect(hasFollowUp([r('a'), r('b')])).toBe(false);
    expect(hasFollowUp([r('a', { status: 'new' })])).toBe(true);
    expect(statusLabel('won')).toBe('Won'); expect(statusLabel(undefined)).toBe('New');
    expect(LEAD_STATUSES.map(([k]) => k)).toEqual(['new', 'contacted', 'qualified', 'won', 'lost']);
  });
  it('cleans what is saved: known status, capped note, tidy tags, unknown keys dropped', () => {
    expect(cleanFollowUp({ status: 'won' })).toEqual({ status: 'won' });
    expect(cleanFollowUp({ status: 'hacked' } as never)).toEqual({});
    expect(cleanFollowUp({ notes: 'x'.repeat(3000) }).notes).toHaveLength(2000);
    expect(cleanFollowUp({ tags: ' VIP, Hot lead ,vip,,' }).tags).toEqual(['vip', 'hot-lead']);
    expect(cleanFollowUp({ tags: Array.from({ length: 20 }, (_, i) => `t${i}`) }).tags).toHaveLength(10);
    expect(cleanFollowUp({ tags: ['x'.repeat(50)] }).tags?.[0]).toHaveLength(30);
    expect(cleanFollowUp({ clerk_user_id: 'someone-else', data: {} } as never)).toEqual({});
  });
  it('filters by status (a lead without one counts as new) and searches notes and tags', () => {
    const rows = [r('a', { status: 'new' }), r('b', { status: 'won', notes: 'Called Tuesday', tags: ['vip'] }), r('c')];
    expect(filterRows(rows, { status: 'won' }).map((x) => x.id)).toEqual(['b']);
    expect(filterRows(rows, { status: 'new' }).map((x) => x.id)).toEqual(['a', 'c']);
    expect(filterRows(rows, { query: 'tuesday' }).map((x) => x.id)).toEqual(['b']);
    expect(filterRows(rows, { query: 'vip' }).map((x) => x.id)).toEqual(['b']);
  });
  it('adds Status / Notes / Tags to the CSV only when follow-up exists', () => {
    const csv = rowsToCsv([r('b', { status: 'won', notes: '=SUM(1)', tags: ['vip', 'hot'] })], []);
    expect(csv).toContain('"Status"'); expect(csv).toContain('"Won"'); expect(csv).toContain("\"'=SUM(1)\""); expect(csv).toContain('"vip, hot"');
    expect(rowsToCsv([r('a')], [])).not.toContain('Status');
  });
  it('fetchLeadRows carries the follow-up columns when the server sends them', async () => {
    const client = { functions: { invoke: async () => ({ data: { ok: true, leads: [{ id: '1', data: {}, created_at: 't', clip_id: 'c', kind: 'lead-form', status: 'contacted', notes: null, tags: ['a'] }, { id: '2', data: {}, created_at: 't', clip_id: 'c', kind: 'lead-form' }] }, error: null }) } };
    const res = await fetchLeadRows(client, {});
    expect(res.rows[0]).toMatchObject({ status: 'contacted', notes: '', tags: ['a'] });
    expect(res.rows[1]).not.toHaveProperty('status');
  });
  it('fetchLeadRows carries updatedAt when the hardening migration is applied', async () => {
    const client = { functions: { invoke: async () => ({ data: { ok: true, leads: [{ id: '1', data: {}, created_at: 't', clip_id: 'c', kind: 'lead-form', status: 'new', tags: [], updated_at: '2026-11-18T10:00:00Z' }] }, error: null }) } };
    expect((await fetchLeadRows(client, {})).rows[0]).toMatchObject({ updatedAt: '2026-11-18T10:00:00Z' });
  });
});

describe('how much a lead watched', () => {
  const r = (session?: unknown): LeadRow => ({ id: Math.random().toString(), kind: 'list-builder', clipId: 'list-builder', createdAt: 't', data: { EMAIL: 'a@b.c' }, source: { page: 'p', ...(session !== undefined ? { session: session as string } : {}) } });
  it('reads a well-formed session id only', () => {
    expect(sessionOf(r('abcDEF1234567890abcd'))).toBe('abcDEF1234567890abcd');
    for (const bad of ['short', 'has space 1234567890abc', 12, null, undefined]) expect(sessionOf(r(bad))).toBe('');
  });
  it('tags interest: hot at 75% or finished, warm from 25%, cold below, nothing when unknown', () => {
    expect(watchTag({ progress: 0.9, completed: false })).toBe('Hot');
    expect(watchTag({ progress: 0.2, completed: true })).toBe('Hot');
    expect(watchTag({ progress: 0.75, completed: false })).toBe('Hot');
    expect(watchTag({ progress: 0.5, completed: false })).toBe('Warm');
    expect(watchTag({ progress: 0.25, completed: false })).toBe('Warm');
    expect(watchTag({ progress: 0.1, completed: false })).toBe('Cold');
    expect(watchTag(undefined)).toBe('');
    expect(watchPercent({ progress: 0.456, completed: false })).toBe('46%');
    expect(watchPercent({ progress: 3, completed: false })).toBe('100%');
    expect(watchPercent(null)).toBe('');
  });
  it('looks up each session once, capped', () => {
    const a = 'a'.repeat(20); const b = 'b'.repeat(20);
    expect(sessionKeys([r(a), r(a), r(b), r()])).toEqual([a, b]);
    expect(sessionKeys(Array.from({ length: 300 }, (_, i) => r(String(i).padStart(20, 'x'))))).toHaveLength(200);
  });
  it('adds Watched % and Interest to the CSV only for leads that have it', () => {
    const key = 'a'.repeat(20);
    const csv = rowsToCsv([r(key), r()], [], { [key]: { progress: 0.8, completed: false } });
    expect(csv).toContain('"Watched %"'); expect(csv).toContain('"80"'); expect(csv).toContain('"Hot"');
    expect(rowsToCsv([r(key)], [])).not.toContain('Watched');
  });
});

describe('A/B versions', () => {
  const r = (v?: string): LeadRow => ({ id: Math.random().toString(), kind: 'list-builder', clipId: 'list-builder', createdAt: 't', data: { EMAIL: 'a@b.c' }, source: v ? { page: 'https://x/watch/A', variant: v } : { page: 'https://x/watch/A' } });
  it('reads the version and counts leads per version', () => {
    expect(variantOf(r('B'))).toBe('B'); expect(variantOf(r())).toBe(''); expect(variantOf(r('Z'))).toBe('');
    expect(variantCounts([r('A'), r('B'), r('B'), r()])).toEqual({ A: 1, B: 2 });
    expect(variantCounts([r(), r()])).toBeNull();
  });
  it('adds a Version column to the CSV only when a lead has one', () => {
    expect(rowsToCsv([r('B')], [])).toContain('"Version"');
    expect(rowsToCsv([r()], [])).not.toContain('Version');
  });
});

describe('fetchLeadRows', () => {
  it('maps rows and reports errors', async () => {
    const ok = { functions: { invoke: async () => ({ data: { ok: true, leads: [{ id: '9', data: { EMAIL: 'z' }, created_at: 't', clip_id: 'c', kind: 'lead-form', source: { page: 'https://x/watch/Abc123XyZ9?src=mp4' } }] }, error: null }) } };
    expect(await fetchLeadRows(ok, { projectId: 'p' })).toMatchObject({ ok: true, rows: [{ id: '9', clipId: 'c', createdAt: 't', data: { EMAIL: 'z' }, source: { page: 'https://x/watch/Abc123XyZ9?src=mp4' } }] });
    const bad = { functions: { invoke: async () => ({ data: null, error: { message: 'boom' } }) } };
    expect(await fetchLeadRows(bad, {})).toMatchObject({ ok: false, error: 'boom' });
  });
});
