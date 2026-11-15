import { describe, it, expect } from 'vitest';
import { recommend, followupContext, SEGMENT_LABELS, SCORE_EXPLANATION } from '../retarget/recommendations.js';

const project = { projectId: 'p1', projectName: 'Roofing promo', videoUrl: 'https://x/v/acme/roofing' };
const rows = [
  { interest: 'Roof repair', interest_type: 'service', sessions: 6, decayed_score: 310, high_interest_sessions: 2 },
  { interest: 'Kitchen remodel', interest_type: 'product', sessions: 3, decayed_score: 90, high_interest_sessions: 0 },
  { interest: 'Pricing', interest_type: 'pricing', sessions: 4, decayed_score: 120, high_interest_sessions: 1 },
  { interest: 'Barely seen', interest_type: 'topic', sessions: 1, decayed_score: 5, high_interest_sessions: 0 },
];

describe('recommend', () => {
  it('ranks by calculated score and keeps observed evidence separate from the suggestion', () => {
    const r = recommend({ interests: rows, segments: {}, project });
    expect(r.map((x) => x.interest)).toEqual(['Roof repair', 'Pricing', 'Kitchen remodel']); // 'Barely seen' has too little evidence
    const roof = r[0];
    expect(roof.observed).toBe('6 viewing sessions showed interest in "Roof repair", 2 of them strongly.');
    expect(roof.suggestion).toMatch(/^Create a follow-up video:/);
    expect(roof.kind).toBe('recommendation');
  });
  it('maps interest types to different follow-up briefs', () => {
    const r = Object.fromEntries(recommend({ interests: rows, project }).map((x) => [x.interestType, x]));
    expect(r.service.followup.ctaPurpose).toBe('book_assessment');
    expect(r.product.followup.ctaPurpose).toBe('view_examples');
    expect(r.pricing.followup.ctaPurpose).toBe('request_quote');
    expect(r.service.followup.service).toBe('Roof repair');
    expect(r.product.followup.product).toBe('Kitchen remodel');
  });
  it('carries the original project into every follow-up brief', () => {
    for (const x of recommend({ interests: rows, project })) {
      expect(x.followup).toMatchObject({ originalProjectId: 'p1', originalProjectName: 'Roofing promo', originalVideoUrl: 'https://x/v/acme/roofing' });
      expect(x.followup.suggestedMessage).toBeTruthy();
    }
  });
  it('adds repeat-viewer and pricing-segment recommendations only when the data supports them', () => {
    expect(recommend({ interests: rows, segments: { returning_viewers: 0 }, project }).some((x) => x.id === 'segment:returning')).toBe(false);
    const withReturn = recommend({ interests: rows, segments: { returning_viewers: 3 }, project });
    expect(withReturn.find((x) => x.id === 'segment:returning').observed).toBe('3 returning sessions came back to this video.');
    const noPricingRow = recommend({ interests: rows.filter((x) => x.interest_type !== 'pricing'), segments: { pricing_interested: 2 }, project });
    expect(noPricingRow.some((x) => x.id === 'segment:pricing')).toBe(true);
    expect(recommend({ interests: rows, segments: { pricing_interested: 2 }, project }).filter((x) => x.interestType === 'pricing')).toHaveLength(1);
  });
  it('recommends nothing without evidence (no fabricated suggestions)', () => {
    expect(recommend({ interests: [], segments: {}, project })).toEqual([]);
    expect(recommend({ interests: [rows[3]], segments: {}, project })).toEqual([]);
  });
  it('uses anonymous wording and never names a person', () => {
    const text = JSON.stringify(recommend({ interests: rows, segments: { returning_viewers: 1 }, project }));
    expect(text).not.toMatch(/customer|prospect named|\bJohn\b/i);
    expect(Object.values(SEGMENT_LABELS).join(' ')).not.toMatch(/customer/i);
    expect(SCORE_EXPLANATION).toMatch(/not named people/);
  });
  it('followupContext fills product/service by type only', () => {
    expect(followupContext({ projectId: 'a', interest: 'X', interestType: 'topic' })).toMatchObject({ product: null, service: null, interest: 'X' });
  });
});
