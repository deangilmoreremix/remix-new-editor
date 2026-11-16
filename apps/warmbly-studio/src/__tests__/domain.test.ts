import { describe, it, expect } from 'vitest';
import { spin, renderTemplate, spamCheck, extractVariables } from '../domain/template';
import { warmupVolume, daysToTarget, mailboxHealth } from '../domain/warmup';
import { validateCampaign, inSendWindow, nextSendSlot, nextStep, campaignStats, dedupeContacts, estimateCompletion } from '../domain/campaign';
import { classifyReply, matches } from '../domain/automation';
import { parseCSV, toCSV } from '../domain/analytics';
import { mailboxReport, shouldAutoPause } from '../domain/deliverability';
import { buildSeed } from '../api/seed';
import { reduce } from '../api/reducer';
import type { Campaign, CampaignEvent } from '../types';

const camp = (o: Partial<Campaign> = {}): Campaign => ({ id: 'c', name: 'n', status: 'draft', mailboxIds: ['m'], contactIds: ['k'],
  steps: [{ id: 'a', kind: 'email', subject: 's', body: 'b' }, { id: 'w', kind: 'wait', waitDays: 2 }, { id: 'b', kind: 'email', body: 'b2' }],
  schedule: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, timezone: 'UTC' }, stopOnReply: true, trackOpens: true, trackClicks: true, dailyCap: 10, createdAt: '', ...o });
const ev = (type: CampaignEvent['type'], stepId?: string): CampaignEvent => ({ id: Math.random() + '', campaignId: 'c', contactId: 'k', mailboxId: 'm', type, stepId, at: new Date().toISOString() });

describe('templates', () => {
  it('spins deterministically with injected rand', () => { expect(spin('{a|b|c}', () => 0)).toBe('a'); expect(spin('{a|b|c}', () => 0.99)).toBe('c'); });
  it('fills vars and fallbacks, reports missing', () => {
    const r = renderTemplate('Hi {{firstName | there}} at {{company}} {{nope}}', { company: 'Acme' });
    expect(r.text).toBe('Hi there at Acme {{nope}}'); expect(r.missing).toEqual(['nope']);
  });
  it('extracts variables', () => expect(extractVariables('{{a}} {{b | x}} {{a}}')).toEqual(['a', 'b']));
  it('flags spammy copy', () => { const r = spamCheck('FREE!! ACT NOW', 'click here buy now'); expect(r.score).toBeGreaterThan(30); expect(r.issues.length).toBeGreaterThan(2); });
  it('passes clean copy', () => expect(spamCheck('Quick question', 'Hi Sam, '.repeat(6)).score).toBeLessThan(20));
});
describe('warmup', () => {
  it('ramps and caps', () => { expect(warmupVolume(0, 30)).toBe(0); expect(warmupVolume(1, 30)).toBe(2); expect(warmupVolume(200, 30)).toBe(30); expect(daysToTarget(30)).toBeGreaterThan(5); });
  it('health rewards DNS', () => {
    const base = { warmup: { enabled: true, day: 10, target: 30, sentToday: 0, replyRate: 0.2 }, status: 'warming' as const };
    expect(mailboxHealth({ ...base, spf: true, dkim: true, dmarc: true })).toBeGreaterThan(mailboxHealth({ ...base, spf: false, dkim: false, dmarc: false }));
  });
});
describe('campaign logic', () => {
  it('validates', () => { expect(validateCampaign(camp(), [{ id: 'm' } as never])).toEqual([]); expect(validateCampaign(camp({ steps: [], mailboxIds: [], contactIds: [] }), []).length).toBeGreaterThan(2); });
  it('send window', () => {
    const c = camp(); expect(inSendWindow(c, new Date('2026-03-04T10:00:00'))).toBe(true); expect(inSendWindow(c, new Date('2026-03-07T10:00:00'))).toBe(false);
    expect(nextSendSlot(c, new Date('2026-03-07T10:00:00')).getDay()).toBe(1);
  });
  it('steps through sequence and stops on reply', () => {
    const c = camp(); let n = nextStep(c, 'k', []); expect('step' in n && n.step.id).toBe('a');
    n = nextStep(c, 'k', [ev('sent', 'a')]); expect('step' in n && n.step.id).toBe('b');
    expect(nextStep(c, 'k', [ev('sent', 'a'), ev('replied')])).toEqual({ done: true, reason: 'replied' });
    expect(nextStep(c, 'k', [ev('sent', 'a'), ev('sent', 'b')])).toEqual({ done: true, reason: 'sequence-complete' });
    expect(nextStep(c, 'k', [ev('bounced')])).toEqual({ done: true, reason: 'suppressed' });
  });
  it('stats use unique contacts', () => { const s = campaignStats([ev('sent'), ev('opened'), ev('opened')]); expect(s.opened).toBe(1); expect(s.openRate).toBe(1); });
  it('dedupes and rejects invalid emails', () => {
    const r = dedupeContacts([{ email: 'a@x.com' } as never], [{ email: 'A@x.com' }, { email: 'bad' }, { email: 'b@x.com' }, { email: 'b@x.com' }] as never);
    expect(r.added.map(a => a.email)).toEqual(['b@x.com']); expect(r.skipped).toHaveLength(3);
  });
  it('estimates completion', () => expect(estimateCompletion(camp({ contactIds: Array(50).fill('x'), dailyCap: 10 })).days).toBeGreaterThanOrEqual(10));
});
describe('automation + classification', () => {
  it('classifies replies', () => {
    expect(classifyReply('Not interested, remove me')).toBe('not-interested'); expect(classifyReply('Out of office until Monday')).toBe('out-of-office');
    expect(classifyReply('Sounds good, tell me more')).toBe('interested'); expect(classifyReply('How does it work?')).toBe('question'); expect(classifyReply('Does Thursday 2pm work?')).toBe('meeting-booked');
  });
  it('matches conditions', () => {
    const a = { id: 'a', name: '', enabled: true, trigger: 'reply-received' as const, conditions: [{ field: 'company' as const, op: 'contains' as const, value: 'acme' }], actions: [], runs: 0, createdAt: '' };
    expect(matches(a, { trigger: 'reply-received', contact: { company: 'ACME Inc' } as never })).toBe(true);
    expect(matches({ ...a, enabled: false }, { trigger: 'reply-received', contact: { company: 'acme' } as never })).toBe(false);
  });
});
describe('csv', () => {
  it('round-trips quotes and commas', () => { const rows = [{ a: 'x,y', b: 'say "hi"' }]; expect(parseCSV(toCSV(rows))).toEqual(rows); });
  it('handles CRLF', () => expect(parseCSV('email,name\r\na@b.co,Al\r\n')).toEqual([{ email: 'a@b.co', name: 'Al' }]));
});
describe('seed + engine', () => {
  const ws = buildSeed(new Date("2026-03-12T12:00:00"), 7, 7);
  it('generates history', () => {
    expect(ws.events.filter(e => e.type === 'sent').length).toBeGreaterThan(40);
    expect(ws.threads.length).toBeGreaterThan(10);
    expect(ws.threads.some(t => t.messages.some(m => m.direction === 'in'))).toBe(true);
  });
  it('never exceeds a campaign daily cap', () => {
    for (const c of ws.campaigns) { const per: Record<string, number> = {}; ws.events.filter(e => e.campaignId === c.id && e.type === 'sent').forEach(e => { const d = e.at.slice(0, 10); per[d] = (per[d] ?? 0) + 1; });
      Object.values(per).forEach(n => expect(n).toBeLessThanOrEqual(c.dailyCap)); }
  });
  it('never sends to suppressed contacts after suppression', () => {
    const bounced = new Set(ws.suppression.map(s => s.email));
    for (const e of ws.events.filter(e => e.type === 'sent')) { const k = ws.contacts.find(c => c.id === e.contactId)!; if (bounced.has(k.email)) {
      const sup = ws.suppression.find(s => s.email === k.email)!; expect(e.at <= sup.at).toBe(true); } }
  });
  it('automations create deals/tasks for interested replies', () => expect(ws.automations.some(a => a.runs > 0)).toBe(true));
  it('draft campaign does not send', () => expect(ws.events.some(e => e.campaignId === 'camp_3')).toBe(false));
  it('deliverability report flags missing DNS and auto-pause logic', () => {
    const mb = ws.mailboxes.find(m => !m.spf)!; const r = mailboxReport(mb, ws.events);
    expect(r.alerts.some(a => /SPF/.test(a.message))).toBe(true); expect(shouldAutoPause({ ...r, bounceRate: 0.1 })).toBe(true);
  });
  it('reducer actions', () => {
    let w = reduce(ws, { type: 'mailbox/verifyDns', id: 'mb_4' }); expect(w.mailboxes.find(m => m.id === 'mb_4')!.spf).toBe(true);
    w = reduce(w, { type: 'mailbox/warmup', id: 'mb_4', enabled: true }); expect(w.mailboxes.find(m => m.id === 'mb_4')!.status).toBe('warming');
    w = reduce(w, { type: 'deal/move', id: 'd_4', stageId: 'st_3' }); expect(w.deals.find(d => d.id === 'd_4')!.stageId).toBe('st_3');
    w = reduce(w, { type: 'campaign/duplicate', id: 'camp_1' }); expect(w.campaigns.at(-1)!.status).toBe('draft');
    w = reduce(w, { type: 'team/remove', id: 'u_1' }); expect(w.team.some(m => m.id === 'u_1')).toBe(true); // owner protected
  });
});
