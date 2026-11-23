// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMBEDDED_FONTS, FALLBACK_FONT, WEIGHTS, embeddedFont, fontAlias, fontStack, resolveWeight, loadEmbeddedFont,
} from '../fonts/captionFonts.js';
import { BASE_FONTS, CAPITE_CAPTION_STYLES } from '../styles.js';
import { captionFont } from '../painter.js';

const fontsLoad = vi.fn(async () => [{}]);
beforeEach(() => {
  Object.defineProperty(document, 'fonts', { configurable: true, value: { load: fontsLoad, check: () => false, ready: Promise.resolve() } });
  fontsLoad.mockClear();
});
afterEach(() => { document.head.querySelectorAll('style[data-caption-font]').forEach((e) => e.remove()); });

describe('embedded caption fonts', () => {
  it('has the 16 families of Capite and the 6 of the picker, once each, and covers the font of every look', () => {
    expect(EMBEDDED_FONTS).toHaveLength(22);
    expect(new Set(EMBEDDED_FONTS.map((f) => f.name)).size).toBe(22);
    for (const n of ['Roboto', 'Open Sans', 'Lato', 'Oswald', 'Archivo Black', 'Sora']) expect(embeddedFont(n), n).toBeTruthy();
    for (const n of BASE_FONTS) expect(embeddedFont(n), n).toBeTruthy(); // nothing in the picker needs the network
    for (const s of CAPITE_CAPTION_STYLES) expect(embeddedFont(s.fontName), s.id).toBeTruthy();
    expect(FALLBACK_FONT.name).toBe('IBM Plex Sans');
  });
  it('finds a font by name in any letter case, and nothing else', () => {
    expect(embeddedFont('  montserrat ').name).toBe('Montserrat');
    for (const bad of ['Comic Sans', '', undefined, null, 7, {}, '"; x']) expect(embeddedFont(bad), String(bad)).toBeUndefined();
  });
  it('registers each font under the alias "Capite <name>" so it can never clash with a same-named font on the page', () => {
    expect(fontAlias('Anton')).toBe('Capite Anton');
    expect(fontAlias('Comic Sans')).toBe('Comic Sans'); // not embedded: its own name
    expect(fontStack('Anton', 'Arial, sans-serif')).toBe('"Capite Anton", "Capite IBM Plex Sans", Arial, sans-serif');
    expect(fontStack('Comic Sans', 'Arial, sans-serif')).toBe('"Comic Sans", Arial, sans-serif');
  });
  it('knows five weights and resolves the one to draw: the chosen weight, else bold or medium', () => {
    expect(WEIGHTS).toEqual({ light: 300, regular: 400, medium: 500, bold: 700, 'extra-bold': 800 });
    expect(resolveWeight({ weight: 'light', bold: true })).toBe(300);
    expect(resolveWeight({ bold: true })).toBe(800);
    expect(resolveWeight({ bold: false })).toBe(500);
    expect(resolveWeight({ weight: 'heavy', bold: true })).toBe(800); // not a weight: the look's own
    expect(resolveWeight({})).toBe(500);
  });
  it('the canvas font uses the alias for an embedded font, the weight and italic', () => {
    expect(captionFont({ fontFamily: 'Montserrat', bold: true }, 40)).toMatch(/^800 40px "Capite Montserrat", "Capite IBM Plex Sans", /);
    expect(captionFont({ fontFamily: 'Montserrat', weight: 'light', italic: true }, 40)).toMatch(/^italic 300 40px "Capite Montserrat"/);
    expect(captionFont({ fontFamily: 'Comic Sans', bold: false }, 40)).toMatch(/^500 40px "Comic Sans", /);
    expect(captionFont({}, 40)).toMatch(/^500 40px "Capite Inter"/);
  });
  it('loads a font from its embedded data (no URL to fetch), once, and waits for the browser to have it', async () => {
    expect(await loadEmbeddedFont('Anton', { weight: 400 })).toBe(true);
    const style = document.head.querySelector('style[data-caption-font="Anton"]');
    expect(style.textContent).toContain('font-family:"Capite Anton"');
    expect(style.textContent).toMatch(/src:url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{100,}\)/);
    expect(style.textContent).not.toMatch(/url\((?!data:)/);
    expect(fontsLoad).toHaveBeenCalledWith('400 16px "Capite Anton"', expect.any(String));
    expect(document.head.querySelector('style[data-caption-font="IBM Plex Sans"]')).not.toBeNull();
    await loadEmbeddedFont('Anton', { italic: true, weight: 700 });
    expect(document.head.querySelectorAll('style[data-caption-font="Anton"]')).toHaveLength(1);
    expect(fontsLoad).toHaveBeenLastCalledWith('italic 700 16px "Capite Anton"', expect.any(String));
  });
  it('registers a font again when its style element was removed from the page', async () => {
    await loadEmbeddedFont('Syne')
    document.head.querySelectorAll('style[data-caption-font]').forEach((e) => e.remove())
    await loadEmbeddedFont('Syne')
    expect(document.head.querySelectorAll('style[data-caption-font="Syne"]')).toHaveLength(1)
  })
  it('does nothing for a font that is not embedded, and reports a failed load instead of throwing', async () => {
    expect(await loadEmbeddedFont('Comic Sans')).toBe(false);
    expect(fontsLoad).not.toHaveBeenCalled();
    fontsLoad.mockRejectedValueOnce(new Error('boom'));
    expect(await loadEmbeddedFont('Bangers')).toBe(false);
  });
});
