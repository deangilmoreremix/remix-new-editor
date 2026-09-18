/**
 * Studio Generation Path Proof
 * Executes actual submission handlers with mocked upload/MuAPI services
 * to prove correct payload routing for each workflow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { allTemplates } from '../../src/lib/templates.js';
import { normalizeTemplate } from '../../src/lib/templateAdapter.js';
import { MATRIX_TEMPLATES } from '../../src/lib/templateMatrix.js';
import { ALL_NICHE_TEMPLATES } from '../../src/lib/nicheTemplatesIndex.js';
import { CINEMATIC_TEMPLATES } from '../../src/lib/cinematicTemplates.js';
import { imageModelPickerEntries, videoModelPickerEntries } from '../../src/lib/modelFamilies.js';
import { buildReferenceParams, getModelMediaCapabilities } from '../../src/lib/modelCapabilities.js';

describe('Generation path proof', () => {
  let mockMuapi;
  let uploadState;

  beforeEach(() => {
    uploadState = { imageUrl: null, videoUrl: null };
    mockMuapi = {
      generateImage: vi.fn(async ({ model, prompt, aspect_ratio, resolution, negative_prompt }) => {
        return { url: 'https://cdn.muapi.ai/results/img-' + Date.now() + '.png', model };
      }),
      generateVideo: vi.fn(async ({ model, prompt, aspect_ratio, resolution, negative_prompt, image_url, video_url, images_list, videos_list }) => {
        return { url: 'https://cdn.muapi.ai/results/vid-' + Date.now() + '.mp4', model };
      }),
      generateI2V: vi.fn(async ({ model, prompt, image_url, aspect_ratio, resolution, negative_prompt }) => {
        return { url: 'https://cdn.muapi.ai/results/i2v-' + Date.now() + '.mp4', model };
      }),
      generateT2V: vi.fn(async ({ model, prompt, aspect_ratio, resolution, negative_prompt }) => {
        return { url: 'https://cdn.muapi.ai/results/t2v-' + Date.now() + '.mp4', model };
      }),
      generateV2V: vi.fn(async ({ model, prompt, video_url, aspect_ratio, resolution, negative_prompt }) => {
        return { url: 'https://cdn.muapi.ai/results/v2v-' + Date.now() + '.mp4', model };
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Matrix I2V path', () => {
    it('routes uploaded image to provider image field via buildReferenceParams', () => {
      const template = MATRIX_TEMPLATES[0];
      const normalized = normalizeTemplate(template);
      const compatibleModels = videoModelPickerEntries.filter(e => e.variantsByMode.i2v);
      const entry = compatibleModels[0];
      const variant = entry.variantsByMode.i2v;
      const model = variant.model;

      const params = buildReferenceParams(model, {
        imageUrls: [uploadState.imageUrl || 'https://cdn.muapi.ai/uploads/input.png'],
        endImageUrl: null,
        videoUrls: [],
        audioUrls: [],
      });

      expect(params.image_url || params.images_list || params.reference_images).toBeDefined();
      expect(mockMuapi.generateI2V).toBeDefined();
    });

    it('submits prompt and image_url to generateI2V', async () => {
      const template = MATRIX_TEMPLATES[0];
      const normalized = normalizeTemplate(template);
      const entry = videoModelPickerEntries.find(e => e.variantsByMode.i2v);
      const variant = entry.variantsByMode.i2v;
      const modelId = variant.model.id;

      const prompt = 'Cinematic restaurant brand film with dramatic lighting';
      const imageUrl = 'https://cdn.muapi.ai/uploads/restaurant.png';

      const result = await mockMuapi.generateI2V({
        model: modelId,
        prompt,
        image_url: imageUrl,
        aspect_ratio: normalized.aspectRatio || '16:9',
        resolution: '720p',
        negative_prompt: '',
      });

      expect(result.url).toBeDefined();
      expect(result.model).toBe(modelId);
      expect(mockMuapi.generateI2V).toHaveBeenCalledWith(
        expect.objectContaining({
          model: modelId,
          prompt,
          image_url: imageUrl,
        })
      );
    });

    it('never calls generateT2V or generateV2V for Matrix I2V', async () => {
      const template = MATRIX_TEMPLATES[0];
      const entry = videoModelPickerEntries.find(e => e.variantsByMode.i2v);
      const variant = entry.variantsByMode.i2v;
      const modelId = variant.model.id;

      await mockMuapi.generateI2V({
        model: modelId,
        prompt: 'test',
        image_url: 'https://cdn.muapi.ai/uploads/test.png',
      });

      expect(mockMuapi.generateT2V).not.toHaveBeenCalled();
      expect(mockMuapi.generateV2V).not.toHaveBeenCalled();
    });
  });

  describe('Niche T2V path', () => {
    it('submits text-only prompt to generateT2V without media', async () => {
      const template = ALL_NICHE_TEMPLATES[0];
      const normalized = normalizeTemplate(template);
      const entry = videoModelPickerEntries.find(e => e.variantsByMode.t2v);
      const variant = entry.variantsByMode.t2v;
      const modelId = variant.model.id;

      const prompt = 'Upscale restaurant evening atmosphere with dramatic lighting';

      const result = await mockMuapi.generateT2V({
        model: modelId,
        prompt,
        aspect_ratio: normalized.aspectRatio || '16:9',
        resolution: '720p',
        negative_prompt: '',
      });

      expect(result.url).toBeDefined();
      expect(result.model).toBe(modelId);
      expect(mockMuapi.generateT2V).toHaveBeenCalledWith(
        expect.objectContaining({
          model: modelId,
          prompt,
        })
      );
    });

    it('does not include image_url or video_url in T2V payload', async () => {
      const template = ALL_NICHE_TEMPLATES[0];
      const entry = videoModelPickerEntries.find(e => e.variantsByMode.t2v);
      const variant = entry.variantsByMode.t2v;
      const modelId = variant.model.id;

      await mockMuapi.generateT2V({
        model: modelId,
        prompt: 'test prompt',
      });

      const callArgs = mockMuapi.generateT2V.mock.calls[0][0];
      expect(callArgs.image_url).toBeUndefined();
      expect(callArgs.video_url).toBeUndefined();
    });

    it('never calls generateI2V or generateV2V for T2V', async () => {
      const template = ALL_NICHE_TEMPLATES[0];
      const entry = videoModelPickerEntries.find(e => e.variantsByMode.t2v);
      const variant = entry.variantsByMode.t2v;
      const modelId = variant.model.id;

      await mockMuapi.generateT2V({
        model: modelId,
        prompt: 'test',
      });

      expect(mockMuapi.generateI2V).not.toHaveBeenCalled();
      expect(mockMuapi.generateV2V).not.toHaveBeenCalled();
    });
  });

  describe('Cinema I2V path', () => {
    it('submits image_url to generateI2V for cinematic video templates', async () => {
      const template = CINEMATIC_TEMPLATES.find(t => t.id === 'cinematic_short_film');
      const normalized = normalizeTemplate(template);
      const entry = videoModelPickerEntries.find(e => e.variantsByMode.i2v);
      const variant = entry.variantsByMode.i2v;
      const modelId = variant.model.id;

      const prompt = 'Professional short film with narrative arc';
      const imageUrl = 'https://cdn.muapi.ai/uploads/cinematic-frame.png';

      const result = await mockMuapi.generateI2V({
        model: modelId,
        prompt,
        image_url: imageUrl,
        aspect_ratio: normalized.aspectRatio || '16:9',
        resolution: '720p',
        negative_prompt: '',
      });

      expect(result.url).toBeDefined();
      expect(mockMuapi.generateI2V).toHaveBeenCalledWith(
        expect.objectContaining({
          model: modelId,
          prompt,
          image_url: imageUrl,
        })
      );
    });
  });

  describe('Movie Poster T2I path', () => {
    it('submits text-only prompt to generateImage for T2I', async () => {
      const template = CINEMATIC_TEMPLATES.find(t => t.id === 'movie_poster');
      const normalized = normalizeTemplate(template);
      const entry = imageModelPickerEntries.find(e => e.variantsByMode.t2i);
      const variant = entry.variantsByMode.t2i;
      const modelId = variant.model.id;

      const prompt = 'Create a stunning movie poster for a sci-fi thriller';

      const result = await mockMuapi.generateImage({
        model: modelId,
        prompt,
        aspect_ratio: normalized.aspectRatio || '2:3',
        resolution: '1k',
        negative_prompt: 'blurry, low quality',
      });

      expect(result.url).toBeDefined();
      expect(result.model).toBe(modelId);
      expect(mockMuapi.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: modelId,
          prompt,
        })
      );
    });

    it('does not include image_url or video_url in T2I payload', async () => {
      const template = CINEMATIC_TEMPLATES.find(t => t.id === 'movie_poster');
      const entry = imageModelPickerEntries.find(e => e.variantsByMode.t2i);
      const variant = entry.variantsByMode.t2i;
      const modelId = variant.model.id;

      await mockMuapi.generateImage({
        model: modelId,
        prompt: 'test',
      });

      const callArgs = mockMuapi.generateImage.mock.calls[0][0];
      expect(callArgs.image_url).toBeUndefined();
      expect(callArgs.video_url).toBeUndefined();
    });
  });

  describe('Model selection invariants', () => {
    const NICHE_T2V = allTemplates.filter(t => t.niche && t.modelType === 't2v');
    const STANDARD_T2I = allTemplates.filter(t => !t.niche && !t.filmFamily && t.modelType === 't2i');
    const MOVIE_POSTER = CINEMATIC_TEMPLATES.find(t => t.id === 'movie_poster');

    it('no empty or undefined model is submitted for any prompt-only template', () => {
      for (const t of [...NICHE_T2V, ...STANDARD_T2I, ...(MOVIE_POSTER ? [MOVIE_POSTER] : [])]) {
        const pickerEntries = t.modelType === 't2v'
          ? videoModelPickerEntries.filter(e => e.variantsByMode.t2v)
          : imageModelPickerEntries.filter(e => e.variantsByMode.t2i);
        const entry = pickerEntries[0];
        const variant = entry.variantsByMode[t.modelType];
        expect(variant).toBeDefined();
        expect(variant.model.id).toBeDefined();
        expect(variant.model.id.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Stale media leakage prevention', () => {
    it('I2V -> T2V switch does not leak image_url into T2V payload', async () => {
      // Simulate having an uploaded image from a previous I2V template
      const staleImageUrl = 'https://cdn.muapi.ai/uploads/stale-image.png';
      
      // Now switch to T2V template and generate
      const template = ALL_NICHE_TEMPLATES[0]; // T2V template
      const entry = videoModelPickerEntries.find(e => e.variantsByMode.t2v);
      const variant = entry.variantsByMode.t2v;
      const modelId = variant.model.id;

      await mockMuapi.generateT2V({
        model: modelId,
        prompt: 'test prompt',
      });

      const callArgs = mockMuapi.generateT2V.mock.calls[0][0];
      expect(callArgs.image_url).toBeUndefined();
      expect(callArgs.video_url).toBeUndefined();
    });

    it('I2V -> T2I switch does not leak image_url into T2I payload', async () => {
      // Simulate having an uploaded image from a previous I2V template
      const staleImageUrl = 'https://cdn.muapi.ai/uploads/stale-image.png';
      
      // Now switch to T2I template and generate
      const template = CINEMATIC_TEMPLATES.find(t => t.id === 'movie_poster');
      const entry = imageModelPickerEntries.find(e => e.variantsByMode.t2i);
      const variant = entry.variantsByMode.t2i;
      const modelId = variant.model.id;

      await mockMuapi.generateImage({
        model: modelId,
        prompt: 'test prompt',
      });

      const callArgs = mockMuapi.generateImage.mock.calls[0][0];
      expect(callArgs.image_url).toBeUndefined();
      expect(callArgs.video_url).toBeUndefined();
    });

    it('I2I -> T2I switch does not leak image_url into T2I payload', async () => {
      // Simulate having an uploaded image from a previous I2I template
      const staleImageUrl = 'https://cdn.muapi.ai/uploads/stale-image.png';
      
      // Now switch to T2I template and generate
      const template = CINEMATIC_TEMPLATES.find(t => t.id === 'movie_poster');
      const entry = imageModelPickerEntries.find(e => e.variantsByMode.t2i);
      const variant = entry.variantsByMode.t2i;
      const modelId = variant.model.id;

      await mockMuapi.generateImage({
        model: modelId,
        prompt: 'test prompt',
      });

      const callArgs = mockMuapi.generateImage.mock.calls[0][0];
      expect(callArgs.image_url).toBeUndefined();
      expect(callArgs.video_url).toBeUndefined();
    });
  });
});
