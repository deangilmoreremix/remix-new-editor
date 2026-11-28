import { describe, it, expect } from 'vitest';
import { scoreProspect, rankProspects, WEIGHTS } from '../followUp.js';

const NOW = Date.parse('2026-11-28T12:00:00Z');

describe('follow-up score', () => {
  it('scores only what was recorded, with a reason for every point', () => {
    const { score, reasons } = scoreProspect({ ctaClicks: 1, completes: 1, plays: 2 }, { now: NOW });
    expect(score).toBe(WEIGHTS.cta + WEIGHTS.complete + WEIGHTS.play);
    expect(reasons).toEqual(['Clicked the button', 'Watched to the end', 'Played the video']);
  });
  it('gives nothing for no activity', () => {
    expect(scoreProspect(undefined)).toEqual({ score: 0, reasons: ['No activity recorded yet'] });
    expect(scoreProspect({ views: 0, plays: 0 }).score).toBe(0);
  });
  it('counts 75% progress only when they did not finish, and recent activity only when there is activity', () => {
    expect(scoreProspect({ progress: 80, plays: 1 }, { now: NOW }).score).toBe(WEIGHTS.progress75 + WEIGHTS.play);
    expect(scoreProspect({ progress: 80, completes: 1, plays: 1 }, { now: NOW }).score).toBe(WEIGHTS.complete + WEIGHTS.play);
    expect(scoreProspect({ lastAt: '2026-11-28T11:00:00Z' }, { now: NOW }).score).toBe(0);
    expect(scoreProspect({ plays: 1, lastAt: '2026-11-28T11:00:00Z' }, { now: NOW }).reasons).toContain('Active in the last day');
    expect(scoreProspect({ plays: 1, lastAt: '2026-11-20T11:00:00Z' }, { now: NOW }).reasons).not.toContain('Active in the last day');
  });
  it('a form lead outranks a click which outranks watching', () => {
    expect(scoreProspect({ leads: 1 }).score).toBeGreaterThan(scoreProspect({ ctaClicks: 1 }).score);
    expect(scoreProspect({ ctaClicks: 1 }).score).toBeGreaterThan(scoreProspect({ completes: 1, plays: 1 }).score);
  });
});

describe('follow-up order', () => {
  const links = [{ contactId: 'a' }, { contactId: 'b' }, { contactId: 'c' }, { contactId: 'd' }];
  const stats = { a: { plays: 1 }, b: { ctaClicks: 1 }, c: {}, d: { plays: 1, lastAt: '2026-11-28T11:00:00Z' } };
  it('ranks by score, then recency, then the original order', () => {
    expect(rankProspects(links, stats, { now: NOW }).map((r) => r.link.contactId)).toEqual(['b', 'd', 'a', 'c']);
  });
  it('sinks prospects you already followed up within their score', () => {
    expect(rankProspects(links, stats, { now: NOW, followedUp: ['b'] }).map((r) => r.link.contactId)).toEqual(['d', 'a', 'c', 'b']);
  });
  it('copes with no stats yet', () => {
    expect(rankProspects(links, null).map((r) => r.link.contactId)).toEqual(['a', 'b', 'c', 'd']);
  });
});
