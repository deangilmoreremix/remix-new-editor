// [remix] Library drag payloads and overlay row placement.
import { describe, it, expect } from 'vitest';
import { decodeLibraryDrag, encodeLibraryDrag, freeOverlayRow, hasLibraryDrag, LIBRARY_DND } from '../lib/occ/library-dnd';

describe('library drag payload', () => {
  it('round-trips and rejects junk', () => {
    expect(decodeLibraryDrag(encodeLibraryDrag({ kind: 'fx', id: 'bloom' }))).toEqual({ kind: 'fx', id: 'bloom' });
    expect(decodeLibraryDrag('{"kind":"nope","id":"x"}')).toBeNull();
    expect(decodeLibraryDrag('not json')).toBeNull();
    expect(decodeLibraryDrag('')).toBeNull();
    expect(decodeLibraryDrag(undefined)).toBeNull();
  });
  it('recognises the drag type', () => {
    expect(hasLibraryDrag(['Files', LIBRARY_DND])).toBe(true);
    expect(hasLibraryDrag(['application/x-asset-id'])).toBe(false);
    expect(hasLibraryDrag(undefined)).toBe(false);
  });
});

describe('freeOverlayRow', () => {
  const others = [{ id: 'a', start: 0, end: 5, row: 0 }, { id: 'b', start: 2, end: 6, row: 1 }, { id: 'c', start: 10, end: 12 }];
  const auto = new Map([['c', 0]]);
  it('keeps the wanted row when free', () => expect(freeOverlayRow(others, { id: 'x', start: 7, end: 9 }, 1, auto)).toBe(1));
  it('moves to the next free row on overlap', () => expect(freeOverlayRow(others, { id: 'x', start: 1, end: 4 }, 0, auto)).toBe(2));
  it('ignores itself', () => expect(freeOverlayRow(others, { id: 'a', start: 1, end: 4 }, 0, auto)).toBe(0));
  it('uses auto rows for overlays without a manual row', () => expect(freeOverlayRow(others, { id: 'x', start: 10.5, end: 11 }, 0, auto)).toBe(1));
});
