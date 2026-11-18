import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import '../index.js';
import { BLEND_ITEMS, BLEND_CATEGORIES, blendItemToAddon, getBlendItem, validateBlendLibrary } from '../blendLibrary.js';
import { timelineToComposition } from '../../remotion/timelineToComposition.js';

describe('Blend Modes library', () => {
  it('every look maps to a registered overlay with a valid blend mode', () => {
    expect(BLEND_ITEMS.length).toBeGreaterThanOrEqual(12);
    expect(validateBlendLibrary()).toEqual([]);
    expect(BLEND_CATEGORIES.map((c) => c.id)).toContain('color-wash');
  });

  it('every offered image look has its file and thumbnail in the repository', () => {
    BLEND_ITEMS.filter((i) => i.kind === 'image').forEach((i) => {
      expect(fs.existsSync(path.join('public', i.src))).toBe(true);
      expect(fs.existsSync(path.join('public', i.thumb))).toBe(true);
    });
  });

  it('image looks become full-frame Image clips with an absolute URL', () => {
    const a = blendItemToAddon(getBlendItem('leak-1'), { origin: 'https://x.test' });
    expect(a.type).toBe('overlay-image');
    expect(a.options).toMatchObject({ src: 'https://x.test/assets/overlay/items/imgly_overlay_lightleak1.jpg', fill: true, blendMode: 'screen' });
  });

  it('colour washes become Wrapper gradients that survive the CSS allowlist', () => {
    const a = blendItemToAddon(getBlendItem('wash-teal-orange'));
    expect(a.type).toBe('overlay-background');
    const model = timelineToComposition({
      timelineSeconds: 10,
      tracks: [{ type: 'text', name: 'Blend', items: [{ id: 1, type: a.type, left: 0, width: 50, addon: a.options }] }],
    }, { quality: '720p' });
    const layer = model.layers.find((l) => l.type === 'overlay-background');
    expect(layer.options.resolvedStyles.background).toMatch(/linear-gradient/);
    expect(layer.options.blendMode).toBe('soft-light');
  });
});
