import { describe, it, expect, vi } from 'vitest';
import { lookStyle, parseReferences, expandLook, rewriteShot, matchBreakdown, makeMoodboard, emptyLook } from '../lookBible.js';
import { slug } from '../elementsStore.js';
import { shotPrompt } from '../storyboard.js';

describe('look bible', () => {
  it('parses reference chips and builds the style line', () => {
    expect(parseReferences('Blade Runner, Heat\nHeat,  ')).toEqual(['Blade Runner', 'Heat']);
    const look = { ...emptyLook(), genre: 'sci-fi', references: ['Blade Runner'], palette: ['teal', 'amber'], lens: '35mm anamorphic', notes: 'rain-soaked neon' };
    expect(lookStyle(look)).toBe('sci-fi genre. in the visual style of Blade Runner. palette: teal, amber. 35mm anamorphic. rain-soaked neon');
    expect(shotPrompt({ prompt: 'a detective walks', camera: 'wide' }, [], lookStyle(look)).prompt).toMatch(/Style: sci-fi genre/);
  });
  it('expands with the lookbible task and keeps the user\'s references', async () => {
    const llm = vi.fn(async () => ({ data: { notes: 'Moody and wet.', palette: ['teal'], lens_and_light: 'low-key', references: ['Blade Runner: neon haze'] } }));
    const r = await expandLook({ ...emptyLook(), genre: 'sci-fi', references: ['Heat'] }, { llm });
    expect(llm).toHaveBeenCalledWith('lookbible', { text: expect.stringContaining('Film references: Heat') }, expect.anything());
    expect(r).toMatchObject({ notes: 'Moody and wet.', palette: ['teal'], lens: 'low-key', references: ['Heat'] });
  });
  it('rewrites a shot from a note and requires a note', async () => {
    const llm = vi.fn(async () => ({ data: { prompt: 'Maya at dusk, low angle', camera: 'low angle' } }));
    await expect(rewriteShot({ prompt: 'p', camera: 'c' }, '  ', { llm })).rejects.toThrow(/note/);
    const r = await rewriteShot({ prompt: 'Maya at noon', camera: 'wide' }, 'make it dusk', { llm });
    expect(llm.mock.calls[0][1].text).toMatch(/DIRECTOR NOTE: make it dusk/);
    expect(r).toEqual({ prompt: 'Maya at dusk, low angle', camera: 'low angle', note: 'make it dusk' });
  });
  it('makes mood-board stills with Images 2.6 Sunburst', async () => {
    const make = vi.fn(async () => ({ url: 'https://s/1.png' }));
    expect(await makeMoodboard({}, { ...emptyLook(), genre: 'drama' }, { make, count: 2 })).toHaveLength(2);
    expect(make.mock.calls[0][2]).toMatchObject({ model: 'gpt-image-2.6-sunburst', aspectRatio: '16:9' });
  });
  it('matches a breakdown against saved Elements', () => {
    const items = matchBreakdown({ scenes: [{ characters: ['Maya', 'Jonas'], locations: ['Old Barn'], props: ['Map'] }, { characters: ['maya'], locations: [], props: [] }] }, [{ handle: 'Maya' }], slug);
    expect(items.map((i) => [i.name, i.category, !!i.existing])).toEqual([['Maya', 'character', true], ['Jonas', 'character', false], ['Old Barn', 'location', false], ['Map', 'prop', false]]);
  });
});
