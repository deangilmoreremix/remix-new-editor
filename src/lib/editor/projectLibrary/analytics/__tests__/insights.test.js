import { describe, it, expect } from 'vitest';
import { buildInsights, biggestDrop, MAX_INSIGHTS } from '../insights.js';
import { audienceRows, revisionRows, revisionDeltas } from '../audienceData.js';

const curve = (vals) => vals.map((v, i) => ({ positionPercent: i * 5, retentionPercent: v }));
// 100 -> ... a sharp 20-point fall between 45% and 50% of a 100 s video (0:45 - 0:50)
const RETENTION = curve([100, 98, 96, 94, 92, 90, 88, 86, 84, 82, 80, 78, 76, 74, 72, 70, 68, 66, 64, 62, 60].map((v, i) => (i >= 10 ? v - 20 : v)));
const FORM = { id: 'f', kind: 'lead-form', label: 'Lead form', startMs: 48000, endMs: 55000 };

describe('biggestDrop', () => {
  it('finds the steepest step and the nearest marker', () => {
    const d = biggestDrop(RETENTION, 100000, [{ id: 'x', kind: 'cta', label: 'CTA button', startMs: 90000, endMs: 95000 }, FORM]);
    expect(d).toMatchObject({ points: 22, fromMs: 45000, toMs: 50000, fromPercent: 82, toPercent: 60 });
    expect(d.marker.id).toBe('f');
  });
  it('is null for flat / short / empty curves, and has no marker when none is near', () => {
    expect(biggestDrop(curve([100, 99, 98, 97]), 100000)).toBeNull();
    expect(biggestDrop(curve([100, 50]), 100000)).toBeNull();
    expect(biggestDrop([], 100000)).toBeNull();
    expect(biggestDrop(RETENTION, 0)).toBeNull();
    expect(biggestDrop(RETENTION, 100000, [{ id: 'z', kind: 'cta', label: 'CTA', startMs: 5000, endMs: 6000 }]).marker).toBeNull();
  });
});

describe('buildInsights', () => {
  const audience = audienceRows([
    { dimension: 'referrer', key: 'news.com', sessions: 20, completed_sessions: 14, lead_sessions: 0 },
    { dimension: 'referrer', key: null, sessions: 30, completed_sessions: 6, lead_sessions: 0 },
    { dimension: 'referrer', key: 'tiny.io', sessions: 2, completed_sessions: 2, lead_sessions: 0 },
    { dimension: 'device', key: 'mobile', sessions: 36, completed_sessions: 9, lead_sessions: 0 },
    { dimension: 'device', key: 'desktop', sessions: 14, completed_sessions: 9, lead_sessions: 0 },
  ]);
  const versions = revisionDeltas(revisionRows([
    { revision: 1, plays: 30, completed_sessions: 12, completion_rate: 0.4, avg_percent_watched: 0.5, lead_sessions: 0, cta_sessions: 0 },
    { revision: 2, plays: 40, completed_sessions: 26, completion_rate: 0.65, avg_percent_watched: 0.7, lead_sessions: 0, cta_sessions: 0 },
  ]));

  it('writes one sentence per rule with the numbers, at most four', () => {
    const out = buildInsights({ retention: RETENTION, durationMs: 100000, markers: [FORM], audience, versions });
    expect(out).toHaveLength(4);
    expect(out.length).toBeLessThanOrEqual(MAX_INSIGHTS);
    expect(out[0]).toBe('Biggest drop: 22 points between 0:45 and 0:50 (82% to 60% still watching), right at the Lead form (0:48).');
    expect(out[1]).toBe('news.com viewers finish the video 70% of the time versus 20% from Direct.');
    expect(out[2]).toBe('72% of viewers are on mobile, and they finish 25% of the time versus 64.3% on desktop. Check text size and overlays on that screen.');
    expect(out[3]).toBe('Version 2 completes best (65% over 40 plays); version 1 is lowest (40% over 30 plays).');
  });

  it('prefers lead rate for sources when leads exist', () => {
    const a = audienceRows([
      { dimension: 'referrer', key: 'ads.com', sessions: 20, completed_sessions: 5, lead_sessions: 6 },
      { dimension: 'referrer', key: null, sessions: 20, completed_sessions: 9, lead_sessions: 1 },
    ]);
    expect(buildInsights({ audience: a })[0]).toBe('ads.com is your best source for leads (30% of 20 viewers submit) versus 5% from Direct.');
  });

  it('says nothing without enough data (empty input, small samples, a single revision)', () => {
    expect(buildInsights()).toEqual([]);
    expect(buildInsights({ retention: [], durationMs: 0, markers: [FORM], audience: null, versions: [] })).toEqual([]);
    const small = audienceRows([{ dimension: 'referrer', key: 'a.com', sessions: 2, completed_sessions: 2, lead_sessions: 0 }, { dimension: 'referrer', key: null, sessions: 3, completed_sessions: 0, lead_sessions: 0 }]);
    expect(buildInsights({ audience: small })).toEqual([]);
    expect(buildInsights({ versions: versions.slice(0, 1) })).toEqual([]);
  });

  it('a drop with no nearby marker is still reported, without the marker clause', () => {
    expect(buildInsights({ retention: RETENTION, durationMs: 100000, markers: [] })[0]).toBe('Biggest drop: 22 points between 0:45 and 0:50 (82% to 60% still watching).');
  });
});
