import { describe, it, expect } from 'vitest';
import { parseFormStats, formStatLine, percent, statsRange } from '@cinegen/lib/leads/form-stats';

const rpc = {
  min_cohort: 5, sessions: 80,
  ctas: [
    { cta_key: 'list-builder', kind: 'lead_capture', label: null, suppressed: false, impressions: 40, clicks: 12, clicks_suppressed: false, ctr: 0.3 },
    { cta_key: 'ov-abc', kind: 'lead_capture', suppressed: false, impressions: 20, clicks: null, clicks_suppressed: true, ctr: null },
    { cta_key: 'ov-new', kind: 'lead_capture', suppressed: true, impressions: null, clicks: null, ctr: null },
    { cta_key: '', impressions: 3 }, { impressions: 3 }, null,
  ],
};
describe('parseFormStats', () => {
  it('maps each form key to seen / signed up / rate', () => {
    const { byKey, minCohort } = parseFormStats(rpc);
    expect(minCohort).toBe(5);
    expect(byKey['list-builder']).toEqual({ seen: 40, signedUp: 12, rate: 0.3, hidden: false });
    expect(byKey['ov-abc']).toEqual({ seen: 20, signedUp: null, rate: null, hidden: false });
    expect(byKey['ov-new'].hidden).toBe(true);
    expect(Object.keys(byKey)).toEqual(['list-builder', 'ov-abc', 'ov-new']); // rows without a key are dropped
  });
  it('works out the rate when the server sent none, never above 100%', () => {
    expect(parseFormStats({ ctas: [{ cta_key: 'a', impressions: 10, clicks: 4 }] }).byKey.a.rate).toBe(0.4);
    expect(parseFormStats({ ctas: [{ cta_key: 'a', impressions: 2, clicks: 9 }] }).byKey.a.rate).toBe(1);
  });
  it('gives nothing for bad input', () => {
    for (const bad of [null, undefined, 'x', 5, {}, { ctas: 'no' }]) expect(parseFormStats(bad)).toEqual({ minCohort: 0, byKey: {} });
  });
});

describe('formStatLine', () => {
  const { byKey, minCohort } = parseFormStats(rpc);
  it('says what is known and withholds what is not', () => {
    expect(formStatLine(byKey['list-builder'], minCohort)).toBe('Seen by 40 · 12 signed up · 30%');
    expect(formStatLine(byKey['ov-abc'], minCohort)).toBe('Seen by 20');
    expect(formStatLine(byKey['ov-new'], minCohort)).toBe('Not enough views yet (shown from 5 viewers)');
    expect(formStatLine(undefined, minCohort)).toBe('No views recorded yet');
  });
  it('formats rates', () => { expect(percent(0.1234)).toBe('12.3%'); expect(percent(null)).toBe(''); expect(percent(1)).toBe('100%'); });
});

describe('statsRange', () => {
  it('is the last N UTC days including today', () => {
    expect(statsRange(90, new Date('2026-11-18T15:00:00Z'))).toEqual({ from: '2026-08-21', to: '2026-11-18' });
    expect(statsRange(1, new Date('2026-11-18T01:00:00Z'))).toEqual({ from: '2026-11-18', to: '2026-11-18' });
  });
});
