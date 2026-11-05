/**
 * Video Studio's Source menu workflows: edit / extend need their instructions,
 * and the keyframe model needs both frames in one images_list.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MuapiClient } from '../muapi.js';

vi.mock('../services/RateLimiter.js', () => ({
  rateLimiter: { acquire: vi.fn(() => Promise.resolve()) },
}));
vi.mock('../supabase.js', () => ({
  uploadFileToStorage: vi.fn(async (file) => `https://cdn.muapi.ai/${file?.name ?? 'file'}`),
}));
vi.mock('../analytics.js', () => ({
  analytics: { trackGeneration: vi.fn(), trackGenerationComplete: vi.fn(), trackGenerationError: vi.fn() },
}));

const makeFetchMock = (response) => vi.fn(() => Promise.resolve({
  ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(response),
}));
const submittedBody = (mockFetch) => JSON.parse(mockFetch.mock.calls[0][1].body);

describe('Source workflows reach the provider intact', () => {
  let client;
  beforeEach(async () => {
    client = new MuapiClient();
    await client.apiKeyManager.setMuapiKey('test-muapi-key');
  });

  test.each(['wan2.2-edit-video', 'wan2.7-video-extend'])('%s forwards the prompt', async (model) => {
    global.fetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/out.mp4'] });
    await client.processV2V({ model, video_url: 'https://cdn.muapi.ai/in.mp4', prompt: 'make it snow' });
    expect(submittedBody(global.fetch).params.prompt).toBe('make it snow');
  });

  test('motion transfer sends the character image and the motion video', async () => {
    global.fetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/out.mp4'] });
    await client.processV2V({
      model: 'wan2.2-animate',
      video_url: 'https://cdn.muapi.ai/motion.mp4',
      image_url: 'https://cdn.muapi.ai/character.jpg',
    });
    const { params } = submittedBody(global.fetch);
    expect(params.video_url).toBe('https://cdn.muapi.ai/motion.mp4');
    expect(params.image_url).toBe('https://cdn.muapi.ai/character.jpg');
  });

  test('image-edit models get their reference as images_list, with a declared resolution', async () => {
    global.fetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/out.png'] });
    await client.generateImage({
      model: 'nano-banana-pro-edit',
      prompt: 'recolour',
      aspect_ratio: '16:9',
      resolution: '2k',
      image_url: 'https://cdn.muapi.ai/ref.jpg',
      images_list: ['https://cdn.muapi.ai/ref.jpg'],
    });
    const { params } = submittedBody(global.fetch);
    expect(params.images_list).toEqual(['https://cdn.muapi.ai/ref.jpg']);
    expect(params.image_url).toBeUndefined();
    expect(params.resolution).toBe('2k');
  });

  test('plain text-to-image models still send image_url unchanged', async () => {
    global.fetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/out.png'] });
    await client.generateImage({ model: 'nano-banana-pro', prompt: 'x', image_url: 'https://cdn.muapi.ai/ref.jpg' });
    expect(submittedBody(global.fetch).params.image_url).toBe('https://cdn.muapi.ai/ref.jpg');
  });

  test('image-to-video accepts the aspect ratios a model advertises (Seedance 2.5 "adaptive")', async () => {
    global.fetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/out.mp4'] });
    await client.generateI2V({
      model: 'seedance-2.5-image-to-video',
      prompt: 'move',
      image_url: 'https://cdn.muapi.ai/start.jpg',
      aspect_ratio: 'adaptive',
    });
    expect(submittedBody(global.fetch).params.aspect_ratio).toBe('adaptive');
  });

  test('image-to-video accepts the durations a model advertises (Seedance 2.5 up to 30s)', async () => {
    global.fetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/out.mp4'] });
    await client.generateI2V({
      model: 'seedance-2.5-image-to-video', prompt: 'move', image_url: 'https://cdn.muapi.ai/start.jpg', duration: 20,
    });
    expect(submittedBody(global.fetch).params.duration).toBe(20);
  });

  test('a duration beyond what the model advertises is still rejected', async () => {
    global.fetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/out.mp4'] });
    await expect(client.generateI2V({
      model: 'seedance-2.5-image-to-video', prompt: 'move', image_url: 'https://cdn.muapi.ai/start.jpg', duration: 45,
    })).rejects.toThrow();
  });

  test('a ratio no model advertises is still rejected', async () => {
    global.fetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/out.mp4'] });
    await expect(client.generateI2V({
      model: 'seedance-2.5-image-to-video', prompt: 'move', image_url: 'https://cdn.muapi.ai/start.jpg', aspect_ratio: '7:5',
    })).rejects.toThrow();
  });

  test('keyframes: start and end frame both go in images_list', async () => {
    global.fetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/out.mp4'] });
    await client.generateI2V({
      model: 'seedance-2-first-last-frame',
      prompt: 'morph',
      image_url: 'https://cdn.muapi.ai/start.jpg',
      lastFrameUrl: 'https://cdn.muapi.ai/end.jpg',
    });
    expect(submittedBody(global.fetch).params.images_list).toEqual([
      'https://cdn.muapi.ai/start.jpg',
      'https://cdn.muapi.ai/end.jpg',
    ]);
  });

  test('images_list models with no end frame still send just the start', async () => {
    global.fetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/out.mp4'] });
    await client.generateI2V({ model: 'seedance-2-first-last-frame', prompt: 'x', image_url: 'https://cdn.muapi.ai/start.jpg' });
    expect(submittedBody(global.fetch).params.images_list).toEqual(['https://cdn.muapi.ai/start.jpg']);
  });
});
