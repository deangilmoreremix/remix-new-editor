// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { overlayFontOptions } from '../fontLibrary.js';
import { OVERLAY_FONTS } from '../overlayData.js';
import { renderAddonEditor } from '../addonEditor.js';
import { getAddon } from '../registry.js';
import '../overlayAddons.js';

describe('overlay font library', () => {
  it('has upstream\'s fonts and the captions\' Google families, once each', () => {
    const caption = ['Inter', 'Fredoka', 'Anton', 'Newsreader']; // the captions' families, passed in by the host
    const list = overlayFontOptions([], caption).map(([v]) => v);
    for (const f of OVERLAY_FONTS) expect(list).toContain(f);
    for (const f of caption) expect(list).toContain(f);
    expect(new Set(list.map((f) => f.toLowerCase())).size).toBe(list.length);
    expect(list.length).toBeGreaterThan(OVERLAY_FONTS.length);
    expect(list.slice(0, OVERLAY_FONTS.length - 1)).toContain('Lobster'); // upstream order is kept
  });
  it('lists imported fonts first and does not repeat one that is already in the list', () => {
    const opts = overlayFontOptions(['My Brand Sans', 'anton']);
    expect(opts[0]).toEqual(['anton', 'anton (imported)']);
    expect(opts[1]).toEqual(['My Brand Sans', 'My Brand Sans (imported)']);
    expect(opts.filter(([v]) => v.toLowerCase() === 'anton')).toHaveLength(1);
  });
});

describe('Font field in the overlay settings', () => {
  const render = (services) => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const onChange = vi.fn();
    const d = getAddon('overlay-text');
    renderAddonEditor(box, { fields: d.fields, options: d.defaults(), onChange, services, onFieldChange: d.onFieldChange });
    box.querySelector('[data-addon-tab="Advanced"]').click();
    return { box, onChange };
  };
  it('shows the shared list, and Import font only where the host offers it', () => {
    const plain = render({ tokens: [] });
    expect(plain.box.querySelector('.addon-font-select').options.length).toBe(OVERLAY_FONTS.length);
    expect(render({ tokens: [], extraFonts: ['Fredoka One Extra'] }).box.querySelector('.addon-font-select').options.length).toBe(OVERLAY_FONTS.length + 1);
    expect(plain.box.querySelector('[data-font-import]')).toBeNull();
    const host = render({ tokens: [], userFonts: () => ['Brand Sans'], importFont: vi.fn() });
    expect(host.box.querySelector('[data-font-import]')).not.toBeNull();
    expect(host.box.querySelector('.addon-font-select option').value).toBe('Brand Sans');
  });
  it('an imported font is chosen at once; a bad file shows its message', async () => {
    const importFont = vi.fn().mockResolvedValueOnce('Brand Sans').mockRejectedValueOnce(new Error('Choose a .ttf, .otf, .woff or .woff2 font file.'));
    const { box, onChange } = render({ tokens: [], userFonts: () => [], importFont });
    const input = () => box.querySelector('[data-font-file]');
    const pick = (name) => { const f = new File(['x'], name); Object.defineProperty(input(), 'files', { value: [f], configurable: true }); input().dispatchEvent(new Event('change', { bubbles: true })); };
    pick('Brand-Sans.ttf');
    await new Promise((r) => setTimeout(r, 0));
    expect(onChange.mock.calls.at(-1)[0].fontFamily).toBe('Brand Sans');
    pick('notes.txt');
    await new Promise((r) => setTimeout(r, 0));
    expect(box.querySelector('.addon-font-error').textContent).toContain('font file');
  });
  it('Text Mask and Lower Thirds use the same list', () => {
    for (const type of ['overlay-text-mask', 'overlay-lower-third']) {
      const f = getAddon(type).fields.find((x) => x.type === 'font');
      expect(typeof f.options).toBe('function');
      expect(f.options({ extraFonts: ['Zzz Extra'] }).length).toBe(OVERLAY_FONTS.length + 1);
    }
  });
});
