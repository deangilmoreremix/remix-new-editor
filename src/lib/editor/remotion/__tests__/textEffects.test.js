import { describe, it, expect } from 'vitest';
import { entrancePose, idlePose, animationStyle } from '../overlayAnimations.js';
import { TEXT_ANIMATIONS } from '../../addons/textEffects.js';
import { TEXT_STYLE_PRESETS } from '../../addons/textStylePresets.js';
import { OVERLAY_FONTS } from '../../addons/overlayData.js';

describe('Smart Text effects in the export', () => {
  it('Typing reveals the text left to right in steps', () => {
    expect(entrancePose('typing', 0).clipRight).toBe(100);
    expect(entrancePose('typing', 0.5).clipRight).toBe(50);
    expect(entrancePose('typing', 1).clipRight).toBe(0);
    const early = animationStyle({ animation: { in: 'typing' } }, 6, 100);
    expect(early.clipPath).toMatch(/^inset\(0 \d+(\.\d+)?% 0 0\)$/);
    expect(animationStyle({ animation: { in: 'typing' } }, 40, 100).clipPath).toBeUndefined(); // done: nothing clipped
  });
  it('Blur In fades and sharpens', () => {
    const start = animationStyle({ animation: { in: 'blurIn' } }, 0, 100);
    expect(start.opacity).toBe(0);
    expect(start.filter).toBe('blur(14px)');
    expect(animationStyle({ animation: { in: 'blurIn' } }, 24, 100).filter).toBeUndefined();
  });
  it('Flicker dips now and then; Blink alternates', () => {
    const dips = Array.from({ length: 60 }, (_, f) => idlePose('flicker', f).opacity).filter((o) => o < 1).length;
    expect(dips).toBeGreaterThan(0);
    expect(dips).toBeLessThan(30);
    expect(idlePose('blink', 0).opacity).toBe(1);
    expect(idlePose('blink', 20).opacity).toBe(0.15); // 20 / 30 s = in the dim half
  });
  it('every effect and style preset is well formed', () => {
    for (const phase of ['in', 'idle']) expect(new Set(TEXT_ANIMATIONS[phase].map(([v]) => v)).size).toBe(TEXT_ANIMATIONS[phase].length); // no duplicates
    for (const p of TEXT_STYLE_PRESETS) {
      expect(OVERLAY_FONTS, p.label).toContain(p.patch.fontFamily);
      expect(p.patch.fontColor, p.label).toMatch(/^#[0-9A-F]{6}$/i);
      for (const [k, v] of Object.entries(p.patch)) if (k.startsWith('animation.')) expect(TEXT_ANIMATIONS[k.split('.')[1]].some(([n]) => n === v), `${p.label} ${k}`).toBe(true);
    }
  });
});
