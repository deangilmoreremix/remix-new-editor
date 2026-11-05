import { describe, it, expect, beforeEach } from 'vitest';
import { createMarketingAdMode, validateAd, buildAdParams, AVATARS, AD_FORMATS } from '../components/studios/MarketingAdMode.js';
import { closeComposerPopover } from '../components/studio/promptComposer.js';

beforeEach(() => { document.body.innerHTML = ''; closeComposerPopover(); });

describe('ad validation and payload', () => {
  it('uses upstream messages for a missing script or product', () => {
    expect(validateAd({ script: '  ', productUrl: 'p.png' })).toBe('Please enter an ad script.');
    expect(validateAd({ script: 'hi', productUrl: null })).toBe('Please upload a product image.');
    expect(validateAd({ script: 'hi', productUrl: 'p.png' })).toBeNull();
  });

  it('orders images product, avatar, references and sends the format video', () => {
    const state = { ratio: '9:16', res: '1080p', duration: 5, format: AD_FORMATS[0], avatarUrl: 'a.webp', refs: ['r1.png', 'r2.png'] };
    expect(buildAdParams(state, { script: 'ad', productUrl: 'p.png' })).toEqual({
      prompt: 'ad', aspect_ratio: '9:16', duration: 5, resolution: '1080p',
      images_list: ['p.png', 'a.webp', 'r1.png', 'r2.png'], video_files: [AD_FORMATS[0].url],
    });
  });

  it('drops the avatar when none is chosen', () => {
    const state = { ratio: '16:9', res: '720p', duration: 8, format: AD_FORMATS[3], avatarUrl: null, refs: [] };
    expect(buildAdParams(state, { script: 's', productUrl: 'p.png' }).images_list).toEqual(['p.png']);
  });

  it('ships upstream presets: 8 avatars, 6 formats', () => {
    expect(AVATARS.map((a) => a.name)).toEqual(['Priya', 'Elena', 'Kai', 'Sora', 'Minji', 'Margot', 'Niko', 'Jin']);
    expect(AD_FORMATS.map((f) => f.name)).toEqual(['UGC', 'Tutorial', 'Unboxing', 'Hyper Motion', 'Product Review', 'TV Spot']);
  });
});

describe('ad mode controls', () => {
  it('defaults to 9:16, 1080p, 5s and the UGC format, and is hidden until activated', () => {
    const mode = createMarketingAdMode();
    expect(mode.state).toMatchObject({ ratio: '9:16', res: '1080p', duration: 5 });
    expect(mode.state.format.name).toBe('UGC');
    expect(mode.el.classList.contains('hidden')).toBe(true);
    mode.setActive(true);
    expect(mode.el.classList.contains('hidden')).toBe(false);
  });

  it('picks an avatar from the preview dialog, with prev/next and Select', () => {
    const mode = createMarketingAdMode();
    document.body.appendChild(mode.el);
    const avatarPill = [...mode.el.querySelectorAll('button')].find((b) => b.title === 'Avatar presets');
    avatarPill.click();
    const tiles = document.querySelectorAll('.grid-cols-3 button');
    expect(tiles).toHaveLength(8);
    tiles[2].click(); // Kai
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    expect(dialog.querySelector('[data-name]').textContent).toBe('Kai');
    dialog.querySelector('[data-next]').click();
    expect(dialog.querySelector('[data-name]').textContent).toBe('Sora');
    dialog.querySelector('[data-select]').click();
    expect(mode.state.avatarUrl).toContain('Sora.webp');
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
  });

  it('changes format, ratio, resolution and duration from popover menus', () => {
    const mode = createMarketingAdMode();
    document.body.appendChild(mode.el);
    const pick = (title, label) => {
      [...mode.el.querySelectorAll('button')].find((b) => b.title === title).click();
      [...document.querySelectorAll('[role="menuitemradio"]')].find((r) => r.textContent.trim() === label).click();
    };
    pick('Video format presets', 'Unboxing');
    pick('Aspect Ratio', '16:9');
    pick('Resolution', '720p');
    pick('Duration', '12s');
    expect(mode.state.format.name).toBe('Unboxing');
    expect(mode.state).toMatchObject({ ratio: '16:9', res: '720p', duration: 12 });
  });
});
