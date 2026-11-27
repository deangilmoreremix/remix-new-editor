import { describe, it, expect } from 'vitest';
import { buildCinemaShareUrl, decodeShareValues } from '../../src/lib/templateUx.js';

const inputs = [{ name: 'prompt', type: 'text' }, { name: 'mood', type: 'select', options: ['calm', 'epic'] }];
const loc = { origin: 'https://smartvid.app', pathname: '/' };

describe('Cinema share links', () => {
  it('has no fill when nothing is typed', () => {
    expect(buildCinemaShareUrl('c1', inputs, {}, loc)).toBe('https://smartvid.app/cinema-template?template=c1');
  });
  it('round-trips values through the fill parameter', () => {
    const url = new URL(buildCinemaShareUrl('c1', inputs, { prompt: 'a dog ☀️', mood: 'epic' }, loc));
    expect(url.searchParams.get('template')).toBe('c1');
    expect(url.pathname).toBe('/cinema-template');
    expect(decodeShareValues(url.searchParams.get('fill'), inputs)).toEqual({ prompt: 'a dog ☀️', mood: 'epic' });
  });
  it('ignores select values that are not options', () => {
    const url = new URL(buildCinemaShareUrl('c1', inputs, { mood: 'epic' }, loc));
    const fill = url.searchParams.get('fill')!;
    expect(decodeShareValues(fill, [{ name: 'mood', type: 'select', options: ['calm'] }])).toEqual({});
  });
});
