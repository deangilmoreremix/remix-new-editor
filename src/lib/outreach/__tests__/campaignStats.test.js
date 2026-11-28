import { describe, it, expect } from 'vitest';
import { summarizeCampaign, combineSummaries } from '../campaignStats.js';

const row = (o) => ({ contactId: 'c', views: 1, plays: 1, completes: 0, ctaClicks: 0, leads: 0, progress: 0, ...o });

describe('campaign summary', () => {
  it('counts only what was recorded, per prospect', () => {
    const s = summarizeCampaign([
      row({ contactId: 'a', progress: 30, ctaClicks: 1 }),
      row({ contactId: 'b', progress: 80, leads: 1 }),
      row({ contactId: 'c', completes: 1, progress: 100, ctaClicks: 2 }),
      row({ contactId: 'd', plays: 0, progress: 0 }), // opened, never played
      row({ contactId: null, views: 4, plays: 2, ctaClicks: 1 }), // a visit nobody was named for
    ]);
    expect(s.watched).toBe(3);
    expect(s.opened).toBe(4);
    expect(s.views).toBe(8);
    expect(s.clicks).toBe(4);
    expect(s.leads).toBe(1);
    expect(s.finished).toBe(1);
    expect(s.reach).toEqual({ 25: 3, 50: 2, 75: 2, 100: 1 });
    expect(s.avgProgress).toBe(70); // (30 + 80 + 100) / 3
    expect(s.hasProgress).toBe(true);
  });
  it('says so when the database does not report progress', () => {
    const s = summarizeCampaign([row({ contactId: 'a' }), row({ contactId: 'b' })]);
    expect(s.hasProgress).toBe(false);
    expect(s.reach).toEqual({ 25: 0, 50: 0, 75: 0, 100: 0 });
  });
  it('a finished prospect is past every quartile even if progress is missing', () => {
    expect(summarizeCampaign([row({ contactId: 'a', completes: 1 })]).reach).toEqual({ 25: 1, 50: 1, 75: 1, 100: 1 });
  });
  it('handles nothing and bad values', () => {
    expect(summarizeCampaign(null)).toMatchObject({ watched: 0, finished: 0, avgProgress: 0, leads: 0 });
    expect(summarizeCampaign([row({ contactId: 'a', progress: 'x', views: undefined })]).avgProgress).toBe(0);
  });
});

describe('combining campaigns', () => {
  it('adds counts and weights the average by watchers', () => {
    const a = summarizeCampaign([row({ contactId: 'a', progress: 100, completes: 1 })]);
    const b = summarizeCampaign([row({ contactId: 'b', progress: 20 }), row({ contactId: 'c', progress: 20 }), row({ contactId: 'd', progress: 20 })]);
    const all = combineSummaries([a, b]);
    expect(all.watched).toBe(4);
    expect(all.avgProgress).toBe(40); // (100 + 20 + 20 + 20) / 4
    expect(all.reach[25]).toBe(1);
    expect(combineSummaries([])).toMatchObject({ watched: 0, avgProgress: 0 });
  });
});

describe('combining without rounding twice', () => {
  it('averages the exact totals, not averages that were already rounded', () => {
    const a = summarizeCampaign([row({ contactId: 'a', progress: 0 }), row({ contactId: 'b', progress: 1 })]); // 0.5 -> shown as 1
    const b = summarizeCampaign([row({ contactId: 'c', progress: 0 })]);
    expect(a.avgProgress).toBe(1);
    expect(b.avgProgress).toBe(0);
    expect(combineSummaries([a, b]).avgProgress).toBe(0); // (0 + 1 + 0) / 3 = 0.33, not the 0.67 that two rounded averages give
    expect(combineSummaries([a, b]).progressSum).toBe(1);
  });
});
