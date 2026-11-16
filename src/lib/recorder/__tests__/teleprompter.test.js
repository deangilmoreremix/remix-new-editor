import { describe, it, expect } from 'vitest';
import { scriptLines, readingPosition, readingSeconds, teleprompterSettings, createTeleprompterClock, loadTeleprompter, saveTeleprompter } from '../teleprompter.js';

describe('teleprompter', () => {
  it('splits the script into readable lines', () => {
    expect(scriptLines('[pause]\n\nHello there friend\nThis is a much longer line that should wrap onto two lines nicely', 30))
      .toEqual(['[pause]', 'Hello there friend', 'This is a much longer line', 'that should wrap onto two', 'lines nicely']);
  });

  it('follows the reading speed, line by line', () => {
    const lines = ['one two three', 'four five six'];
    expect(readingPosition(lines, 0, 60)).toEqual({ index: 0, progress: 0 });
    expect(readingPosition(lines, 1500, 60)).toEqual({ index: 0, progress: 0.5 });
    expect(readingPosition(lines, 4500, 60)).toEqual({ index: 1, progress: 0.5 });
    expect(readingPosition(lines, 9000, 60).index).toBe(2);
    expect(readingSeconds(['[pause]', 'a b'], 60)).toBe(6);
  });

  it('settings clamp, and persist', () => {
    expect(teleprompterSettings({ wpm: 1000, fontSize: 2 })).toMatchObject({ wpm: 260, fontSize: 14, on: false });
    const m = new Map(); const st = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
    saveTeleprompter({ on: true, script: 'Hi', wpm: 120 }, st);
    expect(loadTeleprompter(st)).toMatchObject({ on: true, script: 'Hi', wpm: 120 });
  });

  it('the clock starts, pauses (keeping its place) and resets', () => {
    let t = 0; const frames = [];
    const clock = createTeleprompterClock({ now: () => t, raf: () => 1, caf: () => {} });
    clock.onFrame((ms) => frames.push(ms));
    clock.start(); t = 1000;
    expect(clock.elapsed()).toBe(1000);
    clock.pause(); t = 5000;
    expect(clock.elapsed()).toBe(1000);
    clock.start(); t = 5500;
    expect(clock.elapsed()).toBe(1500);
    clock.reset();
    expect(clock.elapsed()).toBe(0);
    expect(frames).toEqual([1000, 0]);
  });
});
