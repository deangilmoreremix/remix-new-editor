import { describe, expect, it } from 'vitest';
import { wordsToSegments } from '../src/platform/browser-transcription';

describe('wordsToSegments', () => {
  it('splits Whisper word chunks into sentences with word timings', () => {
    const segments = wordsToSegments([
      { text: ' Hello', timestamp: [0, 0.4] },
      { text: ' world.', timestamp: [0.4, 0.9] },
      { text: ' Next', timestamp: [1.0, 1.3] },
      { text: ' line', timestamp: [1.3, 1.6] },
    ]);
    expect(segments).toEqual([
      { text: 'Hello world.', start: 0, end: 0.9, speaker: null, words: [
        { word: 'Hello', start: 0, end: 0.4 }, { word: 'world.', start: 0.4, end: 0.9 },
      ] },
      { text: 'Next line', start: 1.0, end: 1.6, speaker: null, words: [
        { word: 'Next', start: 1.0, end: 1.3 }, { word: 'line', start: 1.3, end: 1.6 },
      ] },
    ]);
  });

  it('breaks on long pauses and tolerates a missing end time', () => {
    const segments = wordsToSegments([
      { text: ' before', timestamp: [0, 0.5] },
      { text: ' after', timestamp: [3, null] },
    ]);
    expect(segments.map((s) => [s.text, s.start, s.end])).toEqual([['before', 0, 0.5], ['after', 3, 3]]);
  });
});
