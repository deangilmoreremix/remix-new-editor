// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { overlayFontOptions } from '../fontLibrary.js';
import { OVERLAY_FONTS } from '../overlayData.js';
import { supportsSystemFonts, systemFontFamilies, loadSystemFonts, refreshSystemFontsIfAllowed } from '../systemFonts.js';
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
    expect(opts[0]).toEqual(['anton', 'anton (imported)', 'Imported']);
    expect(opts[1]).toEqual(['My Brand Sans', 'My Brand Sans (imported)', 'Imported']);
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

describe('fonts installed on this computer', () => {
  it('are their own last group, without repeating a font already listed', () => {
    const opts = overlayFontOptions(['Mine'], ['Inter'], ['Arial', 'Inter', 'Zapfino', 'Anton']);
    const sys = opts.filter((o) => o[2] === 'Installed on this computer').map((o) => o[0]);
    expect(sys).toEqual(['Arial', 'Zapfino']); // Inter and Anton were already in the list
    expect(opts.at(-1)[0]).toBe('Zapfino');
  });
  it('loads through the Local Font Access API, once asked, and remembers the names', async () => {
    localStorage.clear();
    expect(supportsSystemFonts()).toBe(false);
    await expect(loadSystemFonts()).rejects.toThrow(/cannot list the fonts/);
    window.queryLocalFonts = vi.fn().mockResolvedValue([{ family: 'Zapfino' }, { family: 'Arial' }, { family: 'Arial' }, { family: ' ' }]);
    expect(supportsSystemFonts()).toBe(true);
    expect(await loadSystemFonts()).toEqual(['Arial', 'Zapfino']);
    expect(JSON.parse(localStorage.getItem('remix-system-fonts'))).toEqual(['Arial', 'Zapfino']);
    window.queryLocalFonts = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    await expect(loadSystemFonts()).rejects.toThrow(/Permission/);
    expect(systemFontFamilies()).toEqual(['Arial', 'Zapfino']); // a refusal keeps what was loaded before
    delete window.queryLocalFonts;
  });
  it('a quiet refresh does nothing unless the browser already allowed it', async () => {
    window.queryLocalFonts = vi.fn().mockResolvedValue([{ family: 'Zapfino' }]);
    Object.defineProperty(navigator, 'permissions', { value: { query: vi.fn().mockResolvedValue({ state: 'prompt' }) }, configurable: true });
    await refreshSystemFontsIfAllowed();
    expect(window.queryLocalFonts).not.toHaveBeenCalled();
    navigator.permissions.query.mockResolvedValue({ state: 'granted' });
    await refreshSystemFontsIfAllowed();
    expect(window.queryLocalFonts).toHaveBeenCalledTimes(1);
    delete window.queryLocalFonts;
  });
  it('the Font field offers the button only where the host can load them, groups them, and warns about a font only on this computer', async () => {
    const mk = (services, value) => {
      const box = document.createElement('div'); document.body.appendChild(box);
      const d = getAddon('overlay-text');
      renderAddonEditor(box, { fields: d.fields, options: { ...d.defaults(), ...(value ? { fontFamily: value } : {}) }, onChange: vi.fn(), services, onFieldChange: d.onFieldChange });
      box.querySelector('[data-addon-tab="Advanced"]').click();
      return box;
    };
    expect(mk({ tokens: [] }).querySelector('[data-system-fonts]')).toBeNull();
    let installed = [];
    const loadFonts = vi.fn(async () => { installed = ['Zapfino']; return installed; });
    const box = mk({ tokens: [], canLoadSystemFonts: () => true, systemFonts: () => installed, loadSystemFonts: loadFonts });
    expect(box.querySelector('[data-system-fonts]').textContent).toMatch(/Use fonts installed/);
    box.querySelector('[data-system-fonts]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(loadFonts).toHaveBeenCalled();
    expect(box.querySelector('optgroup[label="Installed on this computer"] option').value).toBe('Zapfino');
    expect(box.querySelector('[data-system-fonts]').textContent).toMatch(/Refresh fonts on this computer \(1\)/);
    expect(box.querySelector('[data-system-font-note]')).toBeNull();
    const withNote = mk({ tokens: [], systemFonts: () => ['Zapfino'] }, 'Zapfino');
    expect(withNote.querySelector('[data-system-font-note]').textContent).toMatch(/another device/);
    const denied = mk({ tokens: [], canLoadSystemFonts: () => true, systemFonts: () => [], loadSystemFonts: vi.fn().mockRejectedValue(new Error('Permission to read your fonts was not given.')) });
    denied.querySelector('[data-system-fonts]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(denied.querySelector('.addon-font-error').textContent).toMatch(/Permission/);
  });
});
