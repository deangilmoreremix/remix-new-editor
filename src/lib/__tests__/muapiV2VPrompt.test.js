/**
 * Regression tests for the MuAPI V2V payload defect (fixed 2026-10-12).
 *
 * `processV2V` used to list `prompt`, `aspect_ratio`, `images_list`,
 * `resolution`, `output_format` (and the advanced controls) in its internal
 * `alreadyForwarded` skip-set without ever copying them into `finalPayload`.
 * Every video-to-video call therefore reached the provider with only
 * `video_url` (+ `image_url` when declared) and the user's instruction was
 * silently dropped — the personalization face-swap and motion-control recast
 * paths included. These tests pin the fixed behavior: declared inputs are
 * forwarded, undeclared inputs are not.
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
  analytics: {
    trackGeneration: vi.fn(),
    trackGenerationComplete: vi.fn(),
    trackGenerationError: vi.fn(),
  },
}));

const FACE_SWAP_PROMPT = 'Replace the face with the person from the reference photo, keep the original lighting and pose.';
const RECAST_PROMPT = 'Recast the presenter with the reference identity, keep the camera motion.';

/** Submit response without a request_id: processV2V returns immediately, no polling. */
function makeFetchMock(submitResponse) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(submitResponse),
    })
  );
}

function parseSubmittedBody(mockFetch) {
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [, init] = mockFetch.mock.calls[0];
  return JSON.parse(init.body);
}

describe('muapi.processV2V — declared inputs reach the provider', () => {
  let client;

  beforeEach(async () => {
    client = new MuapiClient();
    await client.apiKeyManager.setMuapiKey('test-muapi-key');
  });

  test('face-swap call forwards the user prompt (ai-video-face-swap)', async () => {
    const mockFetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/face-swapped.mp4'] });
    global.fetch = mockFetch;

    await client.processV2V({
      model: 'ai-video-face-swap',
      video_url: 'https://cdn.muapi.ai/source-video.mp4',
      image_url: 'https://cdn.muapi.ai/identity.jpg',
      prompt: FACE_SWAP_PROMPT,
      aspect_ratio: '16:9',
      studioType: 'personalize-faceswap',
    });

    const body = parseSubmittedBody(mockFetch);
    expect(body.endpoint).toBe('ai-video-face-swap');
    expect(body.generationType).toBe('v2v');
    expect(body.params.video_url).toBe('https://cdn.muapi.ai/source-video.mp4');
    expect(body.params.image_url).toBe('https://cdn.muapi.ai/identity.jpg');
    // The defect: this assertion failed before the fix (prompt was dropped).
    expect(body.params.prompt).toBe(FACE_SWAP_PROMPT);
  });

  test('motion-control recast call forwards the user prompt (kling-v3.0-pro-motion-control)', async () => {
    const mockFetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/recast.mp4'] });
    global.fetch = mockFetch;

    await client.processV2V({
      model: 'kling-v3.0-pro-motion-control',
      video_url: 'https://cdn.muapi.ai/source-video.mp4',
      image_url: 'https://cdn.muapi.ai/identity.jpg',
      prompt: RECAST_PROMPT,
      studioType: 'personalize-recast',
    });

    const body = parseSubmittedBody(mockFetch);
    expect(body.endpoint).toBe('kling-v3.0-pro-motion-control');
    expect(body.params.video_url).toBe('https://cdn.muapi.ai/source-video.mp4');
    expect(body.params.image_url).toBe('https://cdn.muapi.ai/identity.jpg');
    expect(body.params.prompt).toBe(RECAST_PROMPT);
  });

  test('forwards every declared input: prompt, aspect_ratio, resolution, output_format, images_list', async () => {
    const mockFetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/edit.mp4'] });
    global.fetch = mockFetch;

    await client.processV2V({
      model: 'nano-banana-2-edit', // declares prompt, images_list, aspect_ratio, resolution, output_format
      video_url: 'https://cdn.muapi.ai/source-video.mp4',
      prompt: 'restyle this clip, neon noir',
      images_list: ['https://cdn.muapi.ai/ref-1.jpg', 'https://cdn.muapi.ai/ref-2.jpg'],
      aspect_ratio: '16:9',
      resolution: '2k',
      output_format: 'png',
      studioType: 'personalize-t2v',
    });

    const body = parseSubmittedBody(mockFetch);
    expect(body.params.prompt).toBe('restyle this clip, neon noir');
    expect(body.params.images_list).toEqual(['https://cdn.muapi.ai/ref-1.jpg', 'https://cdn.muapi.ai/ref-2.jpg']);
    expect(body.params.aspect_ratio).toBe('16:9');
    expect(body.params.resolution).toBe('2k');
    expect(body.params.output_format).toBe('png');
  });

  test('only forwards what the model declares — aspect_ratio is not sent to models that do not list it', async () => {
    const mockFetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/face-swapped.mp4'] });
    global.fetch = mockFetch;

    await client.processV2V({
      model: 'ai-video-face-swap', // declares only image_url + prompt
      video_url: 'https://cdn.muapi.ai/source-video.mp4',
      image_url: 'https://cdn.muapi.ai/identity.jpg',
      prompt: FACE_SWAP_PROMPT,
      aspect_ratio: '16:9', // NOT declared by this model
      resolution: '2k', // NOT declared by this model
    });

    const body = parseSubmittedBody(mockFetch);
    expect(body.params.prompt).toBe(FACE_SWAP_PROMPT);
    expect(body.params.aspect_ratio).toBeUndefined();
    expect(body.params.resolution).toBeUndefined();
  });

  test('does not leak routing/internal params or webhook_url into the payload', async () => {
    const mockFetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/out.mp4'] });
    global.fetch = mockFetch;

    await client.processV2V({
      model: 'ai-video-face-swap',
      video_url: 'https://cdn.muapi.ai/source-video.mp4',
      image_url: 'https://cdn.muapi.ai/identity.jpg',
      prompt: FACE_SWAP_PROMPT,
      webhook_url: 'https://evil.example.com/hook', // proxy-managed, never forwarded
      native_audio: true, // not declared by this model
      studioType: 'personalize-faceswap',
    });

    const body = parseSubmittedBody(mockFetch);
    expect(body.params.webhook_url).toBeUndefined();
    expect(body.params.native_audio).toBeUndefined();
    expect(body.params.model).toBeUndefined();
    expect(body.params.studioType).toBeUndefined();
    expect(body.params.signal).toBeUndefined();
  });

  test('prompt-less models keep their exact previous payload (video-watermark-remover)', async () => {
    const mockFetch = makeFetchMock({ outputs: ['https://cdn.muapi.ai/cleaned.mp4'] });
    global.fetch = mockFetch;

    await client.processV2V({
      model: 'video-watermark-remover',
      video_url: 'https://cdn.muapi.ai/wm-video.mp4',
    });

    const body = parseSubmittedBody(mockFetch);
    expect(body.params).toEqual({ video_url: 'https://cdn.muapi.ai/wm-video.mp4' });
  });
});
