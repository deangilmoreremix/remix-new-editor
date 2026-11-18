import { describe, it, expect } from 'vitest';
import { viewportClass, normalizePoint, pageBucket, ctaKind, toRanges, scrollDepth, milestonesReached, createClickGate } from '../heatmap/geometry.js';

describe('heatmap geometry: viewport + coordinate normalization', () => {
  it('classifies viewports', () => {
    expect([320, 599, 600, 1023, 1024, 1920].map(viewportClass)).toEqual(['mobile', 'mobile', 'tablet', 'tablet', 'desktop', 'desktop']);
    expect(viewportClass(undefined)).toBe('mobile');
  });
  it('normalizes into 0..1 of the container rect, independent of scroll offset', () => {
    const rect = { left: 100, top: -500, width: 400, height: 2000 }; // container scrolled partly out of view
    expect(normalizePoint(300, 500, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(normalizePoint(100, -500, rect)).toEqual({ x: 0, y: 0 });
  });
  it('clamps out-of-range points and rejects unusable rects/values', () => {
    const rect = { left: 0, top: 0, width: 200, height: 100 };
    expect(normalizePoint(-50, 500, rect)).toEqual({ x: 0, y: 1 });
    expect(normalizePoint(1, 1, { left: 0, top: 0, width: 0, height: 10 })).toBeNull();
    expect(normalizePoint(NaN, 1, rect)).toBeNull();
    expect(normalizePoint(1, 1, null)).toBeNull();
  });
  it('rounds to 4 decimals', () => {
    expect(normalizePoint(1, 1, { left: 0, top: 0, width: 3, height: 3 })).toEqual({ x: 0.3333, y: 0.3333 });
  });
  it('buckets page height in 400px units (1..40)', () => {
    expect([0, 1, 400, 401, 1200, 99999].map(pageBucket)).toEqual([1, 1, 1, 2, 3, 40]);
  });
});

describe('CTA kinds', () => {
  it('derives kinds from link mode and the owner label without breaking old data', () => {
    expect(ctaKind({ href: 'tel:+15551234567', label: 'anything' })).toBe('call_now');
    expect(ctaKind({ href: 'mailto:a@b.co' })).toBe('contact');
    expect(ctaKind({ label: 'Book a free consultation' })).toBe('book_call');
    expect(ctaKind({ href: 'https://x.co', label: 'Get 20% off' })).toBe('get_offer');
    expect(ctaKind({ href: 'https://x.co', label: 'Contact us' })).toBe('contact');
    expect(ctaKind({ href: 'https://x.co', label: 'Visit our website' })).toBe('visit_website');
    expect(ctaKind({ href: 'https://x.co', label: 'Zzz' })).toBe('visit_website');
    expect(ctaKind({ lead: true, href: 'https://x.co' })).toBe('lead_capture');
    expect(ctaKind({})).toBe('other');
    expect(ctaKind()).toBe('other');
  });
});

describe('watch ranges and scroll', () => {
  it('compresses seconds into ranges', () => {
    expect(toRanges([3, 4, 5, 9])).toEqual([[3, 5], [9, 9]]);
    expect(toRanges([5, 3, 4, 4])).toEqual([[3, 5]]);
    expect(toRanges([-1, 1.5, 4000, 2])).toEqual([[2, 2]]);
    expect(toRanges([])).toEqual([]);
  });
  it('computes depth and one-time milestones', () => {
    expect(scrollDepth({ scrollTop: 0, viewportHeight: 500, pageHeight: 2000 })).toBe(0.25);
    expect(scrollDepth({ scrollTop: 0, viewportHeight: 0, pageHeight: 2000 })).toBe(0);
    expect(scrollDepth({ scrollTop: 5000, viewportHeight: 500, pageHeight: 2000 })).toBe(1);
    expect(milestonesReached(0.25)).toEqual([25]);
    expect(milestonesReached(0.8)).toEqual([25, 50, 75]);
    expect(milestonesReached(0.995)).toEqual([25, 50, 75, 100]);
    expect(milestonesReached(1, new Set([25, 50]))).toEqual([75, 100]);
    expect(milestonesReached(0.1)).toEqual([]);
  });
});

describe('click gate', () => {
  it('de-duplicates same-cell clicks within the window and caps per session', () => {
    const g = createClickGate({ maxClicks: 3, dedupeMs: 400 });
    expect(g.allow({ x: 0.5, y: 0.5 }, 0)).toBe(true);
    expect(g.allow({ x: 0.505, y: 0.505 }, 100)).toBe(false); // double click, same 1% cell
    expect(g.allow({ x: 0.5, y: 0.5 }, 600)).toBe(true);       // later: allowed
    expect(g.allow({ x: 0.9, y: 0.1 }, 700)).toBe(true);
    expect(g.allow({ x: 0.2, y: 0.2 }, 800)).toBe(false);      // cap reached
    expect(g.count()).toBe(3);
  });
});
