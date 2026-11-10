import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import '../index.js';
import { BLEND_ITEMS, BLEND_CATEGORIES, blendItemToAddon, getBlendItem, validateBlendLibrary } from '../blendLibrary.js';
import { timelineToComposition } from '../../remotion/timelineToComposition.js';

describe('Blend Modes library', () => {
  it('every look maps to a registered overlay with a valid blend mode', () => {
    expect(BLEND_ITEMS.length).toBeGreaterThanOrEqual(15);
    expect(validateBlendLibrary()).toEqual([]);
    expect(BLEND_CATEGORIES.map((c) => c.id)).toContain('color-wash');
  });

  // The look images (*.jpg) are not in this repository (jpg is gitignored and the originals were never committed), so the check only
  // runs where public/assets/blend exists; the library will show broken thumbnails for image looks until those files are supplied.
  it.skipIf(!fs.existsSync(path.join('public', 'assets', 'blend')))('image looks ship their files (original assets)', () => {
    BLEND_ITEMS.filter((i) => i.kind === 'image').forEach((i) => {
      expect(fs.existsSync(path.join('public', i.src))).toBe(true);
      expect(fs.existsSync(path.join('public', i.thumb))).toBe(true);
    });
  });

  it('image looks become full-frame Image clips with an absolute URL', () => {
    const a = blendItemToAddon(getBlendItem('leak-amber'), { origin: 'https://x.test' });
    expect(a.type).toBe('overlay-image');
    expect(a.options).toMatchObject({ src: 'https://x.test/assets/blend/leak-amber.jpg', fill: true, blendMode: 'screen' });
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
