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
