import { describe, it, expect } from 'vitest';
import { applyTemplateMediaToParams, endFrameSupport, modelsForRoute } from '../templateMedia.js';

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

// Models that name their own end-frame input (lastImageField) keep the end frame too.
describe('template studios keep the end frame for models with a declared end-frame field', () => {
  it.each([
    'pixverse-v6-transition',
    'minimax-h3-image-to-video',
    'gemini-omni-flash-1-1-image-to-video',
    'flux-3-start-end-to-video',
  ])('%s', (model) => {
    expect(endFrameSupport('i2v', model)).not.toBe('none');
    const params = { model, prompt: 'p' };
    applyTemplateMediaToParams(params, { imageUrl: 's.png', endImageUrl: 'e.png', videoUrl: null }, 'i2v');
    expect(params.lastFrameUrl).toBe('e.png');
  });

  it('a model with no end-frame input still reports none', () => {
    const plain = modelsForRoute('i2v').find((m) => m.inputs && !m.lastImageField && m.imageField !== 'images_list'
      && !Object.prototype.hasOwnProperty.call(m.inputs, 'last_frame_url'));
    expect(plain).toBeTruthy();
    expect(endFrameSupport('i2v', plain.id)).toBe('none');
  });
});
