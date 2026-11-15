import { describe, it, expect } from 'vitest';
import { normalizeRel, parseStart, computeWindows, childTime, instanceOverrides } from '../nested.js';

const dom = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
describe('nested composition helpers', () => {
  it('normalises relative paths and rejects escapes, schemes and absolute paths', () => {
    expect(normalizeRel('./compositions/a.html')).toBe('compositions/a.html');
    expect(normalizeRel('compositions/../assets/x.svg')).toBe('assets/x.svg');
    for (const bad of ['../x.html', '/etc/passwd', 'https://x/y.html', 'javascript:alert(1)', 'a/../../b', '', 'C:\\x', '\\\\srv\\x']) expect(normalizeRel(bad), bad).toBeNull();
  });
  it('parses numeric and clip-relative starts', () => {
    expect(parseStart('1.5')).toBe(1.5); expect(parseStart('')).toBe(0);
    expect(parseStart('intro', { intro: 4 })).toBe(4); expect(parseStart('intro + 1.5', { intro: 4 })).toBe(5.5); expect(parseStart('intro-0.5', { intro: 4 })).toBe(3.5);
    expect(parseStart('missing', {})).toBeNull(); expect(parseStart('1; alert(1)', {})).toBeNull();
  });
  it('computes absolute windows through nested parents (local starts add up)', () => {
    const root = dom('<div id="root" data-start="0" data-duration="20"><div id="a" data-start="2" data-duration="10" data-composition-id="a"><div id="b" data-start="1" data-duration="3" data-composition-id="b"></div></div><div id="c" data-start="a" data-duration="4"></div></div>').firstChild;
    const w = Object.fromEntries(computeWindows(root).map((x) => [x.id, x]));
    expect(w.a.absStart).toBe(2); expect(w.b.absStart).toBe(3); expect(w.c.absStart).toBe(12); // c starts when a ends (2+10)
    expect(w.b.duration).toBe(3);
  });
  it('reports unresolvable starts instead of guessing', () => {
    const root = dom('<div data-start="0"><div id="x" data-start="nope"></div></div>').firstChild;
    expect(computeWindows(root)[0].error).toMatch(/unresolvable/);
  });
  it('applies playback rate and media offset to child time, clamped', () => {
    const win = { absStart: 2, rate: 2, mediaStart: 1 };
    expect(childTime(win, 3, 10)).toBe(3); expect(childTime(win, 1, 10)).toBe(0); expect(childTime(win, 100, 10)).toBe(10);
  });
  it('reads instance variables from data-variable-values and ignores bad keys/types', () => {
    const el = document.createElement('div'); el.setAttribute('data-variable-values', JSON.stringify({ title: 'Hi', n: 2, ok: true, 'bad key': 1, obj: { a: 1 } }));
    expect(instanceOverrides(el)).toEqual({ 'var.title': 'Hi', 'var.n': 2, 'var.ok': true });
    el.setAttribute('data-variable-values', '{nope'); expect(instanceOverrides(el)).toEqual({});
  });
});
