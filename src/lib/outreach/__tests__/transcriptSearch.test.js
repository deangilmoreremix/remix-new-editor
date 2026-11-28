import { describe, it, expect } from 'vitest';
import { searchLines, highlightPieces, queryWords, firstPlayableMatch } from '../transcriptSearch.js';

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

describe('jumping to a match in an edited video', () => {
  const src = [
    { startMs: 5000, endMs: 7000, text: 'Welcome to the intro.' },
    { startMs: 15000, endMs: 17000, text: 'The pricing is simple.' },
    { startMs: 25000, endMs: 27000, text: 'Pricing questions? Ask me.' },
  ];
  // the first 10 seconds were removed: later lines move 10 s earlier, and the intro is gone
  const cutFirst10 = (l) => (l.endMs <= 10000 ? null : { ...l, startMs: l.startMs - 10000, endMs: l.endMs - 10000 });
  it('uses the time in the edited video, not the original recording', () => {
    expect(firstPlayableMatch(src, 'pricing', cutFirst10)).toMatchObject({ index: 1, startMs: 5000 });
  });
  it('skips a match that was cut out and takes the next one', () => {
    expect(firstPlayableMatch(src, 'intro welcome', cutFirst10)).toBeNull();
    expect(firstPlayableMatch(src, 'the', cutFirst10)?.index).toBe(1); // "Welcome to the intro" was cut; "The pricing" is the first one left
  });
  it('with no edits the time is the original time', () => {
    expect(firstPlayableMatch(src, 'pricing')).toMatchObject({ index: 1, startMs: 15000 });
  });
  it('finds nothing for an empty query or no match', () => {
    expect(firstPlayableMatch(src, '  ')).toBeNull();
    expect(firstPlayableMatch(src, 'zebra')).toBeNull();
  });
});

describe('matches on text with combining accents', () => {
  it('highlights the right letters when the text is not precomposed', () => {
    const text = 'Cafe\u0301 menus today';
    const [m] = searchLines([{ startMs: 0, text }], 'menus');
    const hit = highlightPieces(text, m.ranges).filter((p) => p.hit).map((p) => p.text);
    expect(hit).toEqual(['menus']);
  });
  it('highlights an accented word whole', () => {
    const text = 'Cafe\u0301 menus';
    const [m] = searchLines([{ startMs: 0, text }], 'cafe');
    expect(highlightPieces(text, m.ranges).filter((p) => p.hit).map((p) => p.text)).toEqual(['Cafe\u0301']);
  });
  it('still highlights precomposed accents and plain text', () => {
    const [a] = searchLines([{ startMs: 0, text: 'Café menus' }], 'cafe');
    expect(highlightPieces('Café menus', a.ranges).filter((p) => p.hit).map((p) => p.text)).toEqual(['Café']);
  });
});

describe('many cut-out matches before a playable one', () => {
  it('still reaches a playable match after more than 400 cut-out ones', () => {
    const many = Array.from({ length: 450 }, (_, i) => ({ startMs: i * 1000, endMs: i * 1000 + 900, text: 'pricing' }));
    const remap = (l) => (l.startMs < 440000 ? null : l);
    expect(firstPlayableMatch(many, 'pricing', remap)).toMatchObject({ index: 440 });
  });
});

describe('Greek final sigma', () => {
  it('finds a word that ends in a capital sigma, and matches a lowercase final sigma', () => {
    expect(searchLines([{ startMs: 0, text: 'ΌΣ' }], 'ΌΣ')).toHaveLength(1);
    expect(searchLines([{ startMs: 0, text: 'λόγος' }], 'ΛΟΓΟΣ')).toHaveLength(1);
    expect(searchLines([{ startMs: 0, text: 'ΛΌΓΟΣ' }], 'λόγος')).toHaveLength(1);
  });
});
