import { describe, it, expect } from 'vitest';
import { audienceRows, revisionRows, revisionDeltas, formatPoints } from '../audienceData.js';

describe('audienceRows', () => {
  const rows = [
    { dimension: 'referrer', key: null, sessions: '30', completed_sessions: 9, lead_sessions: 3 },
    { dimension: 'referrer', key: 'news.com', sessions: 10, completed_sessions: 6, lead_sessions: 0 },
    { dimension: 'device', key: 'mobile', sessions: 28, completed_sessions: 8, lead_sessions: 2 },
    { dimension: 'device', key: 'desktop', sessions: 12, completed_sessions: 7, lead_sessions: 1 },
    { dimension: 'country', key: 'US', sessions: 25, completed_sessions: 10, lead_sessions: 2 },
    { dimension: 'country', key: null, sessions: 15, completed_sessions: 5, lead_sessions: 1 },
    { dimension: 'other', key: 'x', sessions: 5 },
  ];
  it('labels direct / unknown, shares and rates', () => {
    const a = audienceRows(rows);
    expect(a.total).toBe(40);
    expect(a.referrers.map((r) => r.label)).toEqual(['Direct', 'news.com']);
    expect(a.referrers[0]).toMatchObject({ sessions: 30, sharePercent: 75, completionRate: 30, leadRate: 10 });
    expect(a.devices.map((d) => [d.label, d.sharePercent])).toEqual([['Mobile', 70], ['Desktop', 30]]);
    expect(a.countries[0].label).toBe('United States');
    expect(a.countries[1]).toMatchObject({ key: null, label: 'Unknown' });
  });
  it('shares are against ALL sessions, not just the top ten rows the database returns', () => {
    // 100 sessions in total (devices); the database returned only 3 referrers (5 sessions each = 15) because it keeps the top ten
    const many = [
      { dimension: 'device', key: 'mobile', sessions: 60 }, { dimension: 'device', key: 'desktop', sessions: 40 },
      ...[1, 2, 3].map((i) => ({ dimension: 'referrer', key: `r${i}.com`, sessions: 5 })),
      ...[1, 2].map((i) => ({ dimension: 'country', key: i === 1 ? 'US' : 'DE', sessions: 10 })),
    ];
    const a = audienceRows(many);
    expect(a.total).toBe(100);
    expect(a.referrers.map((r) => r.sharePercent)).toEqual([5, 5, 5]);   // not 33
    expect(a.countries.map((r) => r.sharePercent)).toEqual([10, 10]);    // not 50
    expect(a.devices.map((r) => r.sharePercent)).toEqual([60, 40]);
  });
  it('with no device rows the shares fall back to the list\'s own total', () => {
    const a = audienceRows([{ dimension: 'referrer', key: 'a.com', sessions: 3 }, { dimension: 'referrer', key: 'b.com', sessions: 1 }]);
    expect(a.referrers.map((r) => r.sharePercent)).toEqual([75, 25]);
  });
  it('handles empty / bad input', () => {
    expect(audienceRows(null)).toEqual({ referrers: [], devices: [], countries: [], total: 0 });
    expect(audienceRows([{ dimension: 'device', key: 'tablet', sessions: 0 }]).devices).toEqual([]);
  });
});

describe('revision comparison', () => {
  const raw = [
    { revision: 3, plays: 40, completed_sessions: 24, completion_rate: 0.6, avg_percent_watched: 0.71, lead_sessions: 6, cta_sessions: 10 },
    { revision: 1, plays: 30, completed_sessions: 12, completion_rate: 0.4, avg_percent_watched: 0.55, lead_sessions: 3, cta_sessions: 6 },
    { revision: 2, plays: 3, completed_sessions: 1, completion_rate: '0.3333', avg_percent_watched: null, lead_sessions: 0, cta_sessions: 0 },
    { revision: 4, plays: 0 },
  ];
  it('maps to percentages, oldest first, drops empty revisions and flags small samples', () => {
    const rows = revisionRows(raw);
    expect(rows.map((r) => r.revision)).toEqual([1, 2, 3]);
    expect(rows[0]).toMatchObject({ completionRate: 40, avgPercentWatched: 55, leadRate: 10, ctaRate: 20, lowSample: false });
    expect(rows[1]).toMatchObject({ completionRate: 33.3, avgPercentWatched: null, lowSample: true });
  });
  it('deltas are percentage points against the previous revision', () => {
    const d = revisionDeltas(revisionRows(raw));
    expect(d[0].delta).toBeNull();
    expect(d[1].delta).toEqual({ plays: -27, completion: -6.7, watched: null, leads: -10, cta: -20 });
    expect(d[2].delta).toMatchObject({ plays: 37, completion: 26.7, watched: null, leads: 15, cta: 25 });
    expect(revisionDeltas(undefined)).toEqual([]);
  });
  it('formats points', () => {
    expect(formatPoints(6)).toBe('+6 pts');
    expect(formatPoints(-3.5)).toBe('−3.5 pts');
    expect(formatPoints(0)).toBe('0 pts');
    expect(formatPoints(null)).toBe('—');
  });
});
