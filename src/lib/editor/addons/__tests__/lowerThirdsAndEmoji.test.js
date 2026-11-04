import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildLowerThirdLottie, lowerThirdFrame, LOWER_THIRD_TEMPLATES, getAddon, createAddonClip, buildOverlayElement,
  ANIMATED_EMOJI, renderAddonEditor, STICKER_LIBRARY,
} from '../index.js';

const PUBLIC = resolve(__dirname, '../../../../../public');

const textLayers = (anim) => anim.layers.filter((l) => l.ty === 5).map((l) => l.t.d.k[0].s.t);

describe('original lower-third templates', () => {
  it('ships 8 templates', () => {
    expect(LOWER_THIRD_TEMPLATES.map(([, l]) => l)).toEqual([
      'Classic Bar', 'Split Bars', 'Minimal Line', 'Pill', 'Boxed Accent', 'News Strap', 'Side Rule', 'Bold Underline',
    ]);
  });

  it.each(LOWER_THIRD_TEMPLATES.map(([id]) => id))('%s builds a valid Lottie with the text in it', (template) => {
    const anim = buildLowerThirdLottie({ template, name: 'Ada Lovelace', title: 'Analyst', accentColor: '#00ff00' });
    expect(anim).toMatchObject({ fr: 30, ip: 0, op: 60, w: 1000, h: 250 });
    expect(anim.fonts.list.map((f) => f.fFamily)).toEqual(['Montserrat', 'Montserrat']);
    expect(anim.layers.length).toBeGreaterThanOrEqual(3);
    const texts = textLayers(anim).join(' | ').toUpperCase();
    expect(texts).toContain('ADA LOVELACE');
    anim.layers.forEach((l, i) => {
      expect(l.ind).toBe(i + 1);
      expect([4, 5]).toContain(l.ty);
      expect(l.op).toBe(60);
    });
    // accent colour reaches a fill or a text colour
    expect(JSON.stringify(anim)).toContain('[0,1,0');
    expect(() => JSON.parse(JSON.stringify(anim))).not.toThrow();
  });

  it('plays in, holds, then plays out at the end of the clip', () => {
    expect(lowerThirdFrame(0, 5)).toBe(0);
    expect(lowerThirdFrame(0.3, 5)).toBeCloseTo(9);
    expect(lowerThirdFrame(2, 5)).toBe(30);
    expect(lowerThirdFrame(4.75, 5)).toBeCloseTo(52.5);
    expect(lowerThirdFrame(4.99, 5)).toBeLessThan(60);
  });

  it('registers as an upstream Creative overlay and renders with tokens resolved', () => {
    const d = getAddon('overlay-lower-third');
    expect(d).toMatchObject({ label: 'Lower Thirds', section: 'Creative', category: 'overlay' });
    const clip = createAddonClip('overlay-lower-third', { startSec: 0, timelineSeconds: 60, id: 'lt' });
    clip.addon.name = 'Hi {{firstName}}';
    const el = buildOverlayElement(clip, { profile: { variables: { firstName: 'Sam' } } });
    expect(el.classList.contains('popcorn-json-animation')).toBe(true);
    expect(el.dataset.sync).toBe('lower-third');
    expect(textLayers(el._lottieData)).toContain('Hi Sam');
  });
});

describe('animated emoji stickers (Noto, CC BY 4.0)', () => {
  it('bundles the files, with attribution kept in CREDITS.md only', () => {
    expect(ANIMATED_EMOJI.length).toBeGreaterThanOrEqual(60);
    ANIMATED_EMOJI.forEach((e) => {
      const file = resolve(PUBLIC, `.${e.src}`);
      expect(existsSync(file), e.src).toBe(true);
    });
    const sample = JSON.parse(readFileSync(resolve(PUBLIC, `.${ANIMATED_EMOJI[0].src}`), 'utf8'));
    expect(Array.isArray(sample.layers)).toBe(true);
    expect(readFileSync(resolve(PUBLIC, 'assets/sticker/animated-emoji/CREDITS.md'), 'utf8')).toContain('CC BY 4.0');
  });

  it('picker tab sets a Lottie sticker and shows no licence text', () => {
    const box = document.createElement('div');
    const onChange = vi.fn();
    const d = getAddon('overlay-sticker');
    renderAddonEditor(box, {
      fields: d.fields, options: d.defaults(), onChange,
      services: { stickers: STICKER_LIBRARY, animatedEmoji: ANIMATED_EMOJI },
    });
    box.querySelector('[data-sticker-tab="animatedEmoji"]').click();
    expect(box.textContent).not.toMatch(/CC BY|licen[cs]e|Noto/i);
    box.querySelector('.addon-sticker--emoji').click();
    expect(onChange.mock.calls.at(-1)[0]).toMatchObject({ kind: 'lottie', src: ANIMATED_EMOJI[0].src });
  });
});
