// [remix] Port I1: pure transcription logic (word timings, overlap de-dup, span planning, captions/segments) and that the result drives the existing caption styles + Stage 2 motion presets.
import { describe, it, expect } from 'vitest';
import { OverlapDeduper, SAMPLE_RATE, joinWords, planSpans, resolveWhisperWordTimings } from '../../lib/local-ai/whisper-words';
import { wordsToCaptions, wordsToSegments, wordsToText } from '../../lib/local-ai/transcript';
import { chunksToCaptions } from '../../../lib/editor/remotion/captions.js';
import { buildCaptionPages } from '../../../openchatcut/captions/captionPages';
import { CAPTION_MOTION_OPTIONS, captionPageMotionStyle, captionWordMotionStyle } from '../../../openchatcut/captions/captionMotion';
import { CAPTION_STYLES } from '../../../openchatcut/captions/styles';
import { backfillCueIdentities } from '../../../openchatcut/transcript/identity';
import type { CaptionsData } from '../../../openchatcut/captions/types';

describe('resolveWhisperWordTimings', () => {
  it('offsets by the span start and keeps valid timestamps', () => {
    const w = resolveWhisperWordTimings([{ text: ' Hello', timestamp: [0.1, 0.5] }, { text: ' world', timestamp: [0.6, 1] }], 10, 20);
    expect(w.map((x) => [x.text, x.start, x.end])).toEqual([[' Hello', 10.1, 10.5], [' world', 10.6, 11]]);
  });
  it('infers a missing end from the next word and a missing final end from a fallback span (text is never dropped)', () => {
    const w = resolveWhisperWordTimings([{ text: 'a', timestamp: [1, null] }, { text: 'b', timestamp: [2, null] }], 0, 30);
    expect(w[0].end).toBe(2);
    expect(w[1].end).toBeCloseTo(2.5);
  });
  it('infers a missing start, clamps to the span and skips blank words', () => {
    const w = resolveWhisperWordTimings([{ text: '  ', timestamp: [0, 1] }, { text: 'x', timestamp: [null, 0.8] }, { text: 'y', timestamp: [29.99, 31] }], 0, 30);
    expect(w).toHaveLength(2);
    expect(w[0].start).toBeCloseTo(0.3);
    expect(w[1].start).toBeLessThanOrEqual(30); // the start is clamped to the span (end is kept as Whisper reported it)
  });
});

describe('OverlapDeduper', () => {
  it('drops a word re-recognised in the overlap but keeps genuine repeats later', () => {
    const d = new OverlapDeduper();
    d.filter([{ text: 'the', start: 1, end: 1.2 }, { text: 'end', start: 118.5, end: 119 }]);
    const next = d.filter([{ text: 'End.', start: 118.6, end: 119.1 }, { text: 'new', start: 120, end: 120.4 }, { text: 'the', start: 125, end: 125.2 }]);
    expect(next.map((w) => w.text)).toEqual(['new', 'the']);
  });
});

describe('planSpans', () => {
  it('returns nothing for empty audio and one final span for short audio', () => {
    expect(planSpans(0)).toEqual([]);
    const s = planSpans(5 * SAMPLE_RATE);
    expect(s).toHaveLength(1); expect(s[0]).toMatchObject({ startSample: 0, endSample: 5 * SAMPLE_RATE, final: true });
  });
  it('overlaps 120 s spans by 2 s, covers all samples and absorbs a tiny tail', () => {
    const total = 300 * SAMPLE_RATE;
    const s = planSpans(total);
    expect(s.map((x) => x.startSec)).toEqual([0, 118, 236]);
    expect(s[s.length - 1].endSample).toBe(total);
    expect(s.filter((x) => x.final)).toHaveLength(1);
    const tail = planSpans(119 * SAMPLE_RATE + 8000);
    expect(tail).toHaveLength(1);
  });
});

describe('text joining', () => {
  it('spaces Latin words, glues punctuation and leaves CJK unspaced', () => {
    expect(joinWords([' Hello', ',', 'world', '!'])).toBe('Hello, world!');
    expect(joinWords(['你好', '世界'])).toBe('你好世界');
  });
});

const words = 'Hello there and welcome back to the channel today. Let us begin'.split(' ').map((t, i) => ({ text: t, start: i * 0.4, end: i * 0.4 + 0.38 }));
describe('captions and segments', () => {
  it('produces Remotion captions identical in shape to the legacy chunksToCaptions', () => {
    const legacy = chunksToCaptions(words.map((w) => ({ text: ` ${w.text}`, timestamp: [w.start, w.end] })));
    const mine = wordsToCaptions(words.map((w) => ({ ...w, text: ` ${w.text}` })));
    expect(mine.map((c) => [c.text, c.startMs, c.endMs])).toEqual(legacy.map((c: { text: string; startMs: number; endMs: number }) => [c.text, c.startMs, c.endMs]));
    expect(mine[0].text.startsWith(' ')).toBe(false); expect(mine[1].text.startsWith(' ')).toBe(true);
  });
  it('segments at sentence ends, pauses and 18 words', () => {
    const segs = wordsToSegments(words);
    expect(segs.map((s) => s.text)).toEqual(['Hello there and welcome back to the channel today.', 'Let us begin']);
    expect(wordsToText(words)).toContain('channel today. Let');
    const gap = wordsToSegments([{ text: 'a', start: 0, end: 0.2 }, { text: 'b', start: 2, end: 2.2 }]);
    expect(gap).toHaveLength(2);
  });
  it('the transcript drives every caption style template and every Stage 2 motion preset', () => {
    const caps = wordsToCaptions(words);
    const cw = caps.map((c) => ({ text: c.text, start: c.startMs, end: c.endMs })); // same mapping as generateClipCaptions (clip at 0, speed 1)
    for (const style of CAPTION_STYLES) {
      const data = { enabled: true, template: style.id, pacing: 'phrase', motionPreset: 'pop', words: backfillCueIdentities(cw, 'clip-1'), offsetFrames: 0 } as unknown as CaptionsData;
      const pages = buildCaptionPages(data, [], 30);
      expect(pages.length, style.id).toBeGreaterThan(0);
      expect(pages.flatMap((p) => p.page.words.map((w) => w.text)).join(' ')).toContain('Hello');
    }
    const pages = buildCaptionPages({ enabled: true, template: 'tiktok', pacing: 'phrase', words: backfillCueIdentities(cw, 'clip-1'), offsetFrames: 0 } as unknown as CaptionsData, [], 30);
    for (const opt of CAPTION_MOTION_OPTIONS) {
      const page = pages[0].page;
      expect(() => captionPageMotionStyle(opt.id, page, page.start + 100)).not.toThrow();
      expect(() => captionWordMotionStyle(opt.id, page.words[0], page.start + 100, page.start)).not.toThrow();
    }
  });
});
