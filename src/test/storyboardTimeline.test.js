import { describe, it, expect } from 'vitest';
import {
  clampSeconds, pxPerSecond, segmentWidth, secondsAfterDrag, secondsAfterKey, secondsLabel,
  MIN_FRAME_SECONDS, MAX_FRAME_SECONDS, MIN_PX_PER_SECOND, MIN_SEGMENT_PX,
} from '../lib/storyboardTimeline.js';

describe('storyboard timeline maths', () => {
  it('keeps lengths to whole seconds inside the limits', () => {
    expect(clampSeconds(4.4)).toBe(4);
    expect(clampSeconds(4.6)).toBe(5);
    expect(clampSeconds(0)).toBe(MIN_FRAME_SECONDS);
    expect(clampSeconds(-9)).toBe(MIN_FRAME_SECONDS);
    expect(clampSeconds(999)).toBe(MAX_FRAME_SECONDS);
    expect(clampSeconds('abc')).toBe(MIN_FRAME_SECONDS);
    expect(clampSeconds(undefined)).toBe(MIN_FRAME_SECONDS);
  });

  it('scales to fill the width, but never tighter than the minimum', () => {
    expect(pxPerSecond(10, 1000)).toBe(100);
    expect(pxPerSecond(600, 1000)).toBe(MIN_PX_PER_SECOND);
    expect(pxPerSecond(0, 500)).toBe(500); // total floors at 1s
    expect(pxPerSecond(10, 0)).toBe(60);   // unknown width falls back to 600px
  });

  it('draws a segment proportional to its length, with a minimum width', () => {
    expect(segmentWidth(5, 40)).toBe(200);
    expect(segmentWidth(1, 10)).toBe(MIN_SEGMENT_PX);
  });

  it('turns a drag into whole seconds', () => {
    expect(secondsAfterDrag(5, 100, 50)).toBe(7);   // +2s
    expect(secondsAfterDrag(5, -100, 50)).toBe(3);  // -2s
    expect(secondsAfterDrag(5, 20, 50)).toBe(5);    // +0.4s rounds away
    expect(secondsAfterDrag(5, -1000, 50)).toBe(MIN_FRAME_SECONDS);
    expect(secondsAfterDrag(55, 1000, 50)).toBe(MAX_FRAME_SECONDS);
    expect(secondsAfterDrag(5, 100, 0)).toBe(5);    // no scale yet: unchanged
  });

  it('edits with the keyboard', () => {
    expect(secondsAfterKey(5, 'ArrowRight')).toBe(6);
    expect(secondsAfterKey(5, 'ArrowUp')).toBe(6);
    expect(secondsAfterKey(5, 'ArrowLeft')).toBe(4);
    expect(secondsAfterKey(5, 'ArrowDown')).toBe(4);
    expect(secondsAfterKey(5, 'ArrowRight', { shift: true })).toBe(10);
    expect(secondsAfterKey(5, 'ArrowLeft', { shift: true })).toBe(MIN_FRAME_SECONDS);
    expect(secondsAfterKey(5, 'Home')).toBe(MIN_FRAME_SECONDS);
    expect(secondsAfterKey(5, 'End')).toBe(MAX_FRAME_SECONDS);
    expect(secondsAfterKey(MAX_FRAME_SECONDS, 'ArrowRight')).toBe(MAX_FRAME_SECONDS);
    expect(secondsAfterKey(5, 'a')).toBeNull();
    expect(secondsAfterKey(5, 'Tab')).toBeNull();
  });

  it('words a length for screen readers', () => {
    expect(secondsLabel(1)).toBe('1 second');
    expect(secondsLabel(3)).toBe('3 seconds');
  });
});
