import { describe, it, expect } from 'vitest';
import { applyTemplateMediaToParams, endFrameSupport } from '../templateMedia.js';

// Keyframe models take [start, end] in images_list, not a last_frame_url input.
describe('template studios keep the end frame for list-based keyframe models', () => {
  it.each(['seedance-2-first-last-frame', 'seedance-2.5-first-last-frame'])('%s', (model) => {
    expect(endFrameSupport('i2v', model)).toBe('list');
    const params = { model, prompt: 'p' };
    applyTemplateMediaToParams(params, { imageUrl: 's.png', endImageUrl: 'e.png', videoUrl: null }, 'i2v');
    expect(params.image_url).toBe('s.png');
    expect(params.lastFrameUrl).toBe('e.png');
  });
});
