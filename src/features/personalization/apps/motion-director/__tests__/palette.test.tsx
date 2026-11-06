import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AS_DESIGNED, DIRECTOR_THEMES, PRESET_PALETTES, paletteFromBrand, resolvePalette, SITE_THEME, siteFont, skinLook } from '../lib/palette';
import { LOOKS, designedLook } from '../demosrc/_fixtures/Look';
import { FONT } from '../demosrc/_fixtures/Polish';
import { setClipPalette, setFilmPalette } from '../demosrc/_fixtures/skin';

afterEach(() => {
  setFilmPalette(null);
  setClipPalette(undefined);
});

describe('palettes as upstream THEMES.md', () => {
  it('offers the upstream presets with their exact colours, plus As designed and Your site', () => {
    const ids = DIRECTOR_THEMES.map((t) => t.id);
    expect(ids).toEqual([AS_DESIGNED, SITE_THEME, 'modern-light', 'midnight', 'solar-pop', 'coral-burst', 'color-play', 'deep-ocean', 'obsidian-violet', 'vintage-kraft']);
    expect(PRESET_PALETTES.midnight.accent).toBe('#61d9ef');
    expect(Object.keys(PRESET_PALETTES['vintage-kraft']).sort()).toEqual(['accent', 'border', 'field', 'muted', 'page', 'surface', 'text']);
    expect(DIRECTOR_THEMES[0].palette).toBeUndefined(); // as designed: no palette editor, like Ink Press
  });

  it('resolves preset, then film colours, then the clip, dropping invalid values', () => {
    expect(resolvePalette(AS_DESIGNED)).toBeNull();
    const p = resolvePalette('midnight', { accent: '#ff0000', text: 'red' }, { accent: '#00ff00' })!;
    expect(p.page).toBe(PRESET_PALETTES.midnight.page);
    expect(p.text).toBe(PRESET_PALETTES.midnight.text);
    expect(p.accent).toBe('#00ff00');
  });
});

describe('re-skinning the recipe looks', () => {
  it('a same-polarity palette repaints ground, surfaces, text and accent', () => {
    const look = skinLook(designedLook('midnight'), PRESET_PALETTES['deep-ocean']);
    expect(look.bg[1]).toBe('#0b1620');
    expect(look.surface).toBe('#142735');
    expect(look.ink).toBe('#e8f1f5');
    expect(look.accent).toBe('#7cc8b4');
    expect(look.line).toBe('#304957');
  });

  it('a palette of the other polarity only brings its accent (the recipe keeps its ground)', () => {
    const look = skinLook(designedLook('midnight'), PRESET_PALETTES['coral-burst']);
    expect(look.bg).toEqual(designedLook('midnight').bg);
    expect(look.ink).toBe(designedLook('midnight').ink);
    expect(look.accent).toBe('#d94e59');
  });

  it('the film palette reaches recipes through LOOKS, and null restores the designed look', () => {
    setFilmPalette(PRESET_PALETTES['obsidian-violet']);
    expect(LOOKS.aurora.accent).toBe('#bca0e8');
    setFilmPalette(null);
    expect(LOOKS.aurora.accent).toBe(designedLook('aurora').accent);
  });

  it('two clips in one frame draw in their own palettes', () => {
    const Recipe = () => <i>{LOOKS.midnight.accent}</i>;
    const Clip: React.FC<{ palette?: Record<string, string> }> = ({ palette }) => {
      setClipPalette(palette ? resolvePalette(AS_DESIGNED, undefined, palette) : undefined);
      return <Recipe />;
    };
    setFilmPalette({ accent: '#123456' });
    const html = renderToStaticMarkup(<div><Clip palette={{ accent: '#ff0000' }} /><Clip /><Clip palette={{ accent: '#00ff00' }} /></div>);
    expect(html).toBe('<div><i>#ff0000</i><i>#123456</i><i>#00ff00</i></div>');
  });

  it('the product font leads the sans stack', () => {
    setFilmPalette({ accent: '#123456', font: '"Inter Tight"' });
    expect(FONT.sans.startsWith('"Inter Tight", ')).toBe(true);
    setFilmPalette(null);
    expect(FONT.sans.startsWith('-apple-system')).toBe(true);
  });
});

describe('the site palette ("Your site")', () => {
  it('builds the seven colours from what the capture read, keeping roles on the page ground', () => {
    // apple.com as captured: white page, near-black text, blue action, a black promo tile.
    const p = paletteFromBrand({ background: '#ffffff', text: '#1d1d1f', accent: '#0071e3', surface: '#000000', fontFamily: '"SF Pro Text", Helvetica' })!;
    expect(p.page).toBe('#ffffff');
    expect(p.accent).toBe('#0071e3');
    expect(p.surface).not.toBe('#000000');
    expect(Object.keys(p).sort()).toEqual(['accent', 'border', 'field', 'muted', 'page', 'surface', 'text']);
  });

  it('rejects an accent that is the page colour, and needs a background and text', () => {
    expect(paletteFromBrand({ background: '#f7f7f7', text: '#1c1d29', accent: '#f7f7f7' })!.accent).toBe('#2563eb');
    expect(paletteFromBrand({ background: null, text: '#000000' })).toBeNull();
  });

  it('keeps a real font name, drops a generic family', () => {
    expect(siteFont('sohne-var, "SF Pro Display", sans-serif')).toBe('sohne-var');
    expect(siteFont('sans-serif')).toBeUndefined();
  });
});

describe('native timing', () => {
  it('never speeds a recipe up to fit a short scene', async () => {
    const { planToProject } = await import('../lib/buildFilm');
    const { MOTION_TEMPLATES } = await import('../../../data/motionRecipeCatalog');
    const id = MOTION_TEMPLATES.find((t) => t.componentName === 'DeckDealFlyin')!.id;
    const p = planToProject({ title: 't', summary: '', palette: { background: '#fff', text: '#000', accent: '#f00' }, scenes: [{ kind: 'shot', recipeId: id, durationSec: 3, headline: '', caption: '', transition: 'cut' }] }, { aspectRatio: '16:9' });
    const clip = p.tracks.flatMap((t) => t.clips).find((c) => c.cardId === 'demo:DeckDealFlyin')!;
    expect(clip.speed).toBe(1);
  });
});

describe('frame size', () => {
  it('reads the size a message asks for', async () => {
    const { aspectFromText, parseFilmRequest } = await import('../lib/filmChat');
    expect(aspectFromText('a vertical promo for TikTok')).toBe('9:16');
    expect(aspectFromText('make it 1:1 square')).toBe('1:1');
    expect(aspectFromText('16:9 for YouTube')).toBe('16:9');
    expect(aspectFromText('a 30 second promo')).toBeNull();
    expect(parseFilmRequest('a 9:16 promo for https://example.com/1:1').aspectRatio).toBe('9:16');
  });
});

describe('saving a palette with "Your site" selected', () => {
  it('keeps the captured site colours, not the placeholder', async () => {
    const { paletteFromProject } = await import('../palettePresets');
    const { THEME_MANIFEST } = await import('../cards/projectCards');
    const site = { page: '#ffffff', surface: '#f2f4f7', field: '#eef0f3', text: '#1c1d29', muted: '#5b6070', accent: '#a6c937', border: '#d9dce3' };
    const preset = paletteFromProject(THEME_MANIFEST, { themeId: SITE_THEME, sitePalette: site, tracks: [] } as never, 'Mine');
    expect(preset.baseThemeId).toBe(SITE_THEME);
    expect(preset.colors.accent).toBe('#a6c937');
    expect(preset.colors.page).toBe('#ffffff');
  });
});
