/**
 * modelsPersonalizationRegistration.test.js
 *
 * Registration contract for the personalization-critical MuAPI model IDs
 * verified by the provider audit. These IDs are referenced as constants by
 * `src/components/personalize/modelCapabilityResolver.js` and routed by
 * `src/components/personalize/generationRouter.js`; if any of them fails to
 * resolve from `src/lib/models.js` in the correct bucket, the personalization
 * generation path silently falls back to the wrong payload field
 * (e.g. `image_url` instead of `images_list`) and MuAPI answers HTTP 422.
 */

import { describe, it, expect } from 'vitest';
import {
  getI2IModelById,
  getV2VModelById,
  getVideoModelById,
  i2iModels,
  v2vModels,
  t2vModels,
} from '../models.js';
import {
  FACE_SWAP_MODEL,
  FULL_BODY_MODEL,
  DEFAULT_T2V_MODEL,
  DEFAULT_I2I_MODEL,
} from '../../components/personalize/modelCapabilityResolver.js';

/** Personalization-critical model IDs from the provider audit. */
const PERSONALIZATION_MODELS = Object.freeze({
  'ai-video-face-swap': 'v2v',
  'veo-4-text-to-video': 't2v',
  'kling-v3.0-pro-motion-control': 'v2v',
  'add-video-watermark': 'v2v',
  'add-image-watermark': 'i2i',
  'gpt-image-2-image-to-image': 'i2i',
});

const RESOLVERS = {
  i2i: (id) => getI2IModelById(id),
  v2v: (id) => getV2VModelById(id),
  t2v: (id) => getVideoModelById(id),
};

const BUCKETS = { i2i: i2iModels, v2v: v2vModels, t2v: t2vModels };

describe('models.js — personalization model registration', () => {
  for (const [id, bucket] of Object.entries(PERSONALIZATION_MODELS)) {
    describe(`${id}`, () => {
      it(`resolves in the catalog (${bucket} bucket)`, () => {
        expect(RESOLVERS[bucket](id), `${id} must resolve via the ${bucket} lookup`).toBeTruthy();
        expect(BUCKETS[bucket].some((m) => m.id === id)).toBe(true);
      });

      it('resolves to an endpoint matching its model id (MuAPI convention)', () => {
        const model = RESOLVERS[bucket](id);
        // t2v entries conventionally omit `endpoint`; muapi falls back to the
        // model id, so the effective endpoint is always the model id itself.
        expect(model.endpoint ?? id).toBe(id);
      });
    });
  }

  it('gpt-image-2-image-to-image resolves as an I2I model with imageField images_list', () => {
    const model = getI2IModelById('gpt-image-2-image-to-image');
    expect(model).toBeTruthy();
    expect(model.imageField).toBe('images_list');
    expect(model.imageField).not.toBe('image_url');
    // generateI2I only sends `images_list` when the model resolves in i2iModels;
    // a stale v2v registration makes it fall back to `image_url` -> HTTP 422.
    expect(getV2VModelById('gpt-image-2-image-to-image')).toBeUndefined();
    expect(model.inputs?.images_list?.type).toBe('array');
    expect(model.hasPrompt).toBe(true);
  });

  it('ai-video-face-swap maps video input to video_url and identity to image_url', () => {
    const model = getV2VModelById(FACE_SWAP_MODEL);
    expect(model.videoField).toBe('video_url');
    expect(model.imageField).toBe('image_url');
    // muapi.processV2V forwards `image_url` only when the model declares it
    // in its input schema — without this the identity image is dropped.
    expect(model.inputs?.image_url).toBeTruthy();
  });

  it('kling-v3.0-pro-motion-control is registered as a V2V motion-control endpoint', () => {
    const model = getV2VModelById(FULL_BODY_MODEL);
    expect(model.videoField).toBe('video_url');
    expect(model.endpoint).toBe('kling-v3.0-pro-motion-control');
    expect(model.inputs?.image_url).toBeTruthy();
  });

  it('watermark tools stay prompt-less (no prompt payload is sent)', () => {
    expect(getI2IModelById('add-image-watermark').hasPrompt).toBe(false);
    expect(getV2VModelById('add-video-watermark').hasPrompt).toBe(false);
  });

  it('veo-4-text-to-video exposes the prompt input the T2V path requires', () => {
    const model = getVideoModelById(DEFAULT_T2V_MODEL);
    expect(model.inputs?.prompt).toBeTruthy();
  });

  it('the personalization capability constants match the catalog registrations', () => {
    expect(FACE_SWAP_MODEL).toBe('ai-video-face-swap');
    expect(FULL_BODY_MODEL).toBe('kling-v3.0-pro-motion-control');
    expect(DEFAULT_T2V_MODEL).toBe('veo-4-text-to-video');
    expect(DEFAULT_I2I_MODEL).toBe('gpt-image-2-image-to-image');

    for (const id of [FACE_SWAP_MODEL, FULL_BODY_MODEL]) {
      expect(v2vModels.some((m) => m.id === id)).toBe(true);
    }
    expect(t2vModels.some((m) => m.id === DEFAULT_T2V_MODEL)).toBe(true);
    expect(i2iModels.some((m) => m.id === DEFAULT_I2I_MODEL)).toBe(true);
  });
});
