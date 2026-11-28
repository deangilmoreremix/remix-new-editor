import { describe, it, expect } from 'vitest';
import { searchLines, highlightPieces, queryWords } from '../transcriptSearch.js';

const lines = [
  { startMs: 0, endMs: 2000, text: 'Hi Maya, I took a quick look at BrightLine.' },
  { startMs: 2000, endMs: 4000, text: 'Three small changes could lift your demo bookings.' },
  { startMs: 4000, endMs: 6000, text: 'Café menus are an example of a quick win.' },
];

describe('transcript search', () => {
  it('finds lines containing every word, in any order and case', () => {
    expect(searchLines(lines, 'LOOK quick').map((m) => m.index)).toEqual([0]);
    expect(searchLines(lines, 'bookings demo').map((m) => m.index)).toEqual([1]);
    expect(searchLines(lines, 'quick').map((m) => m.index)).toEqual([0, 2]);
  });
  it('gives the time to seek to', () => { expect(searchLines(lines, 'changes')[0].startMs).toBe(2000); });
  it('ignores accents and returns nothing for an empty or missing query', () => {
    expect(searchLines(lines, 'cafe').map((m) => m.index)).toEqual([2]);
    expect(searchLines(lines, '   ')).toEqual([]);
    expect(searchLines(lines, 'zebra')).toEqual([]);
    expect(searchLines(null, 'a')).toEqual([]);
  });
  it('respects the limit', () => { expect(searchLines(lines, 'a', { limit: 1 })).toHaveLength(1); });
  it('marks the matched words and merges overlaps', () => {
    const [m] = searchLines(lines, 'quick look');
    expect(highlightPieces(m.text, m.ranges).filter((p) => p.hit).map((p) => p.text)).toEqual(['quick look'.split(' ')[0], 'look']);
    const [o] = searchLines([{ startMs: 0, text: 'abcabc' }], 'abc bc');
    expect(o.ranges).toEqual([[0, 6]]); // touching matches are drawn as one highlight
  });
  it('rebuilds the original text from the pieces', () => {
    const [m] = searchLines(lines, 'maya');
    expect(highlightPieces(m.text, m.ranges).map((p) => p.text).join('')).toBe(m.text);
  });
  it('splits a query into words', () => { expect(queryWords("  Don't stop, believing! ")).toEqual(["don't", 'stop', 'believing']); });
});
