import { describe, it, expect } from 'vitest';
import { scriptWords, advance, lineForWord } from '../voiceFollow.js';

const lines = ['[pause]', 'I made this video for you.', 'We help sales teams prepare for calls', 'in half the time.'];
const words = scriptWords(lines);

describe('teleprompter follows your voice', () => {
  it('turns the script into words with their lines (the greeting pause is skipped)', () => {
    expect(words.slice(0, 3)).toEqual([{ w: 'i', line: 1 }, { w: 'made', line: 1 }, { w: 'this', line: 1 }]);
    expect(words.at(-1)).toEqual({ w: 'time', line: 3 });
  });

  it('moves to where the heard words are, as a sequence', () => {
    const at = advance(words, 0, 'I made this video');
    expect(at).toBe(4);
    expect(lineForWord(words, at)).toBe(1);
    const next = advance(words, at, 'video for you we help sales teams');
    expect(words[next - 1].w).toBe('teams');
    expect(lineForWord(words, next)).toBe(2);
  });

  it('never moves back, ignores a lone common word, and tolerates small recognition slips', () => {
    expect(advance(words, 10, 'I made this video')).toBe(10);
    expect(advance(words, 0, 'the')).toBe(0);
    expect(words[advance(words, 6, 'help sale team prepared') - 1].w).toBe('prepare');
  });
});
