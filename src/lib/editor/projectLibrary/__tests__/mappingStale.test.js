import { describe, it, expect } from 'vitest';
import { mappingIsStale } from '../tabsData.js';

const entry = (label, extra = {}) => ({ id: 's1', title: 'Intro', start: 0, end: 10, interest: label ? { type: 'service', label } : null, ...extra });

describe('mappingIsStale', () => {
  it('is false when the saved and published mappings match, or neither has any', () => {
    expect(mappingIsStale([entry('Roofing')], [entry('Roofing')])).toBe(false);
    expect(mappingIsStale(undefined, undefined)).toBe(false);
    expect(mappingIsStale([], null)).toBe(false);
  });
  it('is true when a mapping was saved that the published video does not have yet', () => {
    expect(mappingIsStale([entry('Roofing')], undefined)).toBe(true);
    expect(mappingIsStale([entry('Roofing')], [entry('Gutters')])).toBe(true);
  });
  it('is true when a saved mapping was removed but the published video still has it', () => {
    expect(mappingIsStale([], [entry('Roofing')])).toBe(true);
  });
  it('ignores sections with no interest and fields that do not affect viewers', () => {
    expect(mappingIsStale([entry('Roofing', { title: 'Renamed', clipIds: ['x'] }), entry('', { id: 's2' })], [entry('Roofing')])).toBe(false);
  });
});
