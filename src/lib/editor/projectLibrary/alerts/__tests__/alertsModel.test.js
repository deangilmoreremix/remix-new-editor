import { describe, expect, it } from 'vitest';
import { PUSHABLE_TYPES, leadAnswers, pushHeadline, pushStatus, summarizeAlerts } from '../alertsModel.js';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const mk = (over = {}) => ({ id: 'n1', type: 'new_lead', title: 't', summary: 's', read_at: null, created_at: new Date(NOW - 60_000).toISOString(), pushed_at: null, ...over });
const ctx = (over = {}) => ({ pushedKnown: true, configured: true, devices: 1, now: NOW, ...over });

describe('pushStatus mirrors what push_claim_for_video really does', () => {
  it('sent when pushed_at is set', () => { expect(pushStatus(mk({ pushed_at: new Date(NOW).toISOString() }), ctx())).toMatchObject({ state: 'pushed', label: 'Sent' }); });
  it('only the five acted-on kinds are ever pushed; digests, milestones and surges are app-only', () => {
    expect([...PUSHABLE_TYPES].sort()).toEqual(['contact_cta', 'high_interest', 'new_lead', 'pricing_cta', 'returning_engagement']);
    for (const t of ['milestone', 'interest_surge', 'followup_opportunity', 'daily_digest', 'something_new']) expect(pushStatus(mk({ type: t }), ctx()).state).toBe('in-app-only');
    for (const t of PUSHABLE_TYPES) expect(pushStatus(mk({ type: t }), ctx()).state).not.toBe('in-app-only');
  });
  it('explains each reason for "not sent", most specific first', () => {
    expect(pushStatus(mk(), ctx({ configured: false })).reason).toMatch(/not set up on this server/);
    expect(pushStatus(mk(), ctx({ devices: 0 })).reason).toMatch(/No device had notifications turned on/);
    expect(pushStatus(mk({ read_at: new Date(NOW - 1000).toISOString() }), ctx()).reason).toMatch(/already read/);
    expect(pushStatus(mk({ created_at: new Date(NOW - 11 * 60_000).toISOString() }), ctx()).reason).toMatch(/within 10 minutes/);
    expect(pushStatus(mk(), ctx()).reason).toMatch(/may have been unreachable/);
  });
  it('a 9-minute-old unread alert is not blamed on the 10-minute rule', () => {
    expect(pushStatus(mk({ created_at: new Date(NOW - 9 * 60_000).toISOString() }), ctx()).reason).toMatch(/unreachable/);
  });
  it('says "unknown" (not "not sent") when the pushed_at column could not be read', () => {
    expect(pushStatus(mk(), ctx({ pushedKnown: false }))).toMatchObject({ state: 'unknown' });
  });
  it('unknown server facts do not invent a reason', () => {
    expect(pushStatus(mk(), ctx({ configured: null, devices: null })).reason).toMatch(/may have been unreachable/);
  });
  it('never throws on rubbish', () => { expect(() => pushStatus(null)).not.toThrow(); expect(pushStatus(undefined).state).toBe('in-app-only'); expect(() => pushStatus(mk({ created_at: 'nope' }), ctx())).not.toThrow(); });
});

describe('summarizeAlerts', () => {
  it('counts unread by kind, sent and not sent', () => {
    const notes = [mk({ id: 'a', pushed_at: 'x' }), mk({ id: 'b', type: 'pricing_cta' }), mk({ id: 'c', type: 'daily_digest' }), mk({ id: 'd', read_at: 'y', type: 'high_interest' })];
    expect(summarizeAlerts(notes, ctx())).toEqual({ total: 4, unread: 3, unreadByType: { new_lead: 1, pricing_cta: 1, daily_digest: 1 }, pushed: 1, notPushed: 2 });
  });
  it('handles no alerts and bad input', () => { expect(summarizeAlerts([], ctx()).total).toBe(0); expect(summarizeAlerts(null, ctx()).unread).toBe(0); });
});

describe('pushHeadline', () => {
  it('says where push stands', () => {
    expect(pushHeadline({ configured: false }).state).toBe('off-server');
    expect(pushHeadline({ configured: true, devices: 0 }).state).toBe('no-device');
    expect(pushHeadline({ configured: true, devices: 1 }).text).toBe('Notifications are on for 1 device.');
    expect(pushHeadline({ configured: true, devices: 3 }).text).toBe('Notifications are on for 3 devices.');
    expect(pushHeadline({ configured: null, error: 'Could not reach the server.' })).toMatchObject({ state: 'unknown', text: 'Could not reach the server.' });
  });
});

describe('leadAnswers', () => {
  it('shows the first few answers, trimmed', () => {
    expect(leadAnswers({ NAME: 'Ann', EMAIL: 'a@b.co', PHONE: '555', EXTRA: 'x' })).toEqual(['NAME: Ann', 'EMAIL: a@b.co', 'PHONE: 555']);
    expect(leadAnswers({ A: 'x'.repeat(200) })[0].length).toBeLessThanOrEqual(90);
  });
  it('skips empty values and survives odd data', () => { expect(leadAnswers({ A: '', B: null, C: 'ok' })).toEqual(['C: ok']); for (const bad of [null, undefined, 'str', 5, [1, 2]]) expect(leadAnswers(bad)).toEqual([]); });
});
