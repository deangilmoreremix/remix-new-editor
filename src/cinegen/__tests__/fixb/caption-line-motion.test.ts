import { describe, it, expect } from 'vitest';
import { captionLineIndexes, captionLineStarts } from '../../../openchatcut/captions/captionLines';
import { captionWordMotionStyle, captionPageMotionStyle, isCaptionMotionPreset, CAPTION_MOTION_OPTIONS } from '../../../openchatcut/captions/captionMotion';
import { unitStyle, TEXT_MOTION_PRESETS } from '@cinegen/lib/editor/stage2/text-motion';

const words = ['Welcome', 'to', 'the', 'show', 'today', 'we', 'cover', 'captions'].map((text, i) => ({ text, start: 1000 + i * 400, end: 1000 + i * 400 + 350 }));
describe('per-line caption motion', () => {
  it('groups words into lines by the 24 character budget', () => {
    // "Welcome to the show today" = 7+1+2+1+3+1+4+1+5 = 25 > 24 -> "today" starts line 2
    expect(captionLineIndexes(words)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
    expect(captionLineStarts(words)).toEqual([1000, 1000, 1000, 1000, 2600, 2600, 2600, 2600]);
    expect(captionLineIndexes([{ text: 'a'.repeat(40) }, { text: 'b' }])).toEqual([0, 1]); // a long word keeps its own line
    expect(captionLineIndexes([])).toEqual([]);
  });
  it('is a registered preset', () => {
    expect(isCaptionMotionPreset('line-rise')).toBe(true); expect(isCaptionMotionPreset('line-fade')).toBe(true);
    expect(CAPTION_MOTION_OPTIONS.map((o) => o.id)).toContain('line-rise');
  });
  it('line-rise: words of a line share one style that starts at the line start; hidden before, settled after', () => {
    const starts = captionLineStarts(words);
    const at = (i: number, ms: number) => captionWordMotionStyle('line-rise', words[i], ms, starts[i]);
    expect(at(0, 999)).toMatchObject({ opacity: 0, transform: 'translateY(0.4em)', display: 'inline-block' });
    expect(at(0, 1000)).toMatchObject({ opacity: 0 });
    // line 1 words speak later but belong to line 0 -> identical style at the same time
    expect(at(3, 1160)).toEqual(at(0, 1160));
    const mid = at(0, 1160); expect(mid.opacity).toBeGreaterThan(0); expect(mid.opacity).toBeLessThanOrEqual(1);
    expect(at(0, 1000 + 320)).toEqual({ display: 'inline-block', opacity: 1 });
    // second line is still hidden while the first has settled, then rises from its own start
    expect(at(4, 2000)).toMatchObject({ opacity: 0 });
    expect(at(4, 2600 + 320)).toEqual({ display: 'inline-block', opacity: 1 });
    // expected value of the evaluator itself at 160 ms (half of 320)
    expect(mid).toEqual({ display: 'inline-block', opacity: unitStyle(TEXT_MOTION_PRESETS['line-rise'], 0, 1, 160).opacity, transform: unitStyle(TEXT_MOTION_PRESETS['line-rise'], 0, 1, 160).transform });
  });
  it('deterministic: same input, same output, no page-level transform for line presets', () => {
    expect(captionWordMotionStyle('line-fade', words[2], 1234, 1000)).toEqual(captionWordMotionStyle('line-fade', words[2], 1234, 1000));
    expect(captionWordMotionStyle('line-fade', words[2], 1100, 1000).transform).toBeUndefined();
    expect(captionPageMotionStyle('line-rise', { words, start: 1000, end: 4000 }, 1100)).toEqual({});
  });
});
