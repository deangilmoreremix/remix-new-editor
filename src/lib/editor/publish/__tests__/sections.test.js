import { describe, it, expect } from 'vitest';
import { projectSections, ctaLabels, isPricingLabel, projectDuration } from '../sections.js';

const T = 100;
const clip = (id, start, end, extra) => ({ id, type: 'video', left: start, width: end - start, ...extra });

describe('projectSections', () => {
  it('uses the owner interest map first', () => {
    const p = { timelineSeconds: T, interestMap: [{ id: 'roof', title: 'Roof repair', start: 0, end: 40, interest: { type: 'service', label: 'Roof repair' } }, { id: 'bad', start: 5, end: 5 }], tracks: [] };
    expect(projectSections(p)).toEqual([{ id: 'roof', title: 'Roof repair', start: 0, end: 40, interest: { type: 'service', label: 'Roof repair' } }]);
  });
  it('derives sections from video clips when there are at least two', () => {
    const p = { timelineSeconds: T, tracks: [{ type: 'video', items: [clip('b', 50, 100, { name: 'Pricing' }), clip('a', 0, 50, { name: 'Designs' })] }] };
    expect(projectSections(p).map((s) => [s.title, s.start, s.end])).toEqual([['Designs', 0, 50], ['Pricing', 50, 100]]);
  });
  it('does not invent sections for a single clip or no duration', () => {
    expect(projectSections({ timelineSeconds: T, tracks: [{ type: 'video', items: [clip('a', 0, 100)] }] })).toEqual([]);
    expect(projectSections({ tracks: [] })).toEqual([]);
    expect(projectDuration({ timelineSeconds: -1 })).toBe(0);
  });
});

describe('ctaLabels / pricing', () => {
  it('reads labels from CTA, form and overlay clips', () => {
    const p = { tracks: [{ items: [{ id: 'c1', type: 'click-to-call', buttonText: 'Call us' }, { id: 'f1', type: 'lead-form', heading: 'Request a quote' }, { id: 'o1', type: 'overlay-text', addon: { text: 'See pricing' } }, { id: 'x' }] }] };
    expect(ctaLabels(p)).toEqual({ c1: 'Call us', f1: 'Request a quote', o1: 'See pricing' });
  });
  it('flags pricing wording only', () => {
    expect(isPricingLabel('Get a quote')).toBe(true);
    expect(isPricingLabel('See pricing')).toBe(true);
    expect(isPricingLabel('Book consultation')).toBe(false);
  });
});
