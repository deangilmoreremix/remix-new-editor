import { describe, it, expect, vi, beforeEach } from 'vitest';
import { segmentImage } from '../../ai/sam3Service.js';

describe('segmentImage', () => {
  const originalEnv = import.meta.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetchOnce(body, ok = true, status = 200) {
    globalThis.fetch.mockResolvedValueOnce({
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
  }

  function withFalKey() {
    return { ...originalEnv, FAL_KEY: 'test-fal-key' };
  }

  it('throws when FAL_KEY is missing', async () => {
    vi.stubEnv('FAL_KEY', '');

    await expect(
      segmentImage({ imageUrl: 'https://example.com/img.png', promptType: 'text', prompt: 'a cat' })
    ).rejects.toThrow('FAL_KEY is not configured');
  });

  it('segments with text prompt', async () => {
    vi.stubEnv('FAL_KEY', 'test-fal-key');
    mockFetchOnce({ images: [{ url: 'https://example.com/mask.png' }] });

    const result = await segmentImage({
      imageUrl: 'https://example.com/img.png',
      promptType: 'text',
      prompt: 'a cat',
    });

    expect(result.maskUrl).toBe('https://example.com/mask.png');
    expect(result.raw).toEqual({ images: [{ url: 'https://example.com/mask.png' }] });
    const call = globalThis.fetch.mock.calls[0];
    expect(call[0]).toBe('https://fal.run/fal-ai/sam-3/image');
    expect(JSON.parse(call[1].body)).toEqual({
      input: { image: 'https://example.com/img.png', text_prompt: 'a cat' },
    });
  });

  it('segments with click prompt and points', async () => {
    vi.stubEnv('FAL_KEY', 'test-fal-key');
    mockFetchOnce({ images: [{ url: 'https://example.com/mask-click.png' }] });

    const result = await segmentImage({
      imageUrl: 'https://example.com/img.png',
      promptType: 'click',
      prompt: 'click',
      points: [10, 20, 30, 40],
    });

    expect(result.maskUrl).toBe('https://example.com/mask-click.png');
    const call = globalThis.fetch.mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({
      input: { image: 'https://example.com/img.png', point_coords: [10, 20, 30, 40] },
    });
  });

  it('segments with box prompt', async () => {
    vi.stubEnv('FAL_KEY', 'test-fal-key');
    mockFetchOnce({ images: [{ url: 'https://example.com/mask-box.png' }] });

    const result = await segmentImage({
      imageUrl: 'https://example.com/img.png',
      promptType: 'box',
      prompt: 'box',
      box: [0, 0, 100, 100],
    });

    expect(result.maskUrl).toBe('https://example.com/mask-box.png');
    const call = globalThis.fetch.mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({
      input: { image: 'https://example.com/img.png', box: [0, 0, 100, 100] },
    });
  });

  it('throws on unsupported promptType', async () => {
    vi.stubEnv('FAL_KEY', 'test-fal-key');

    await expect(
      segmentImage({ imageUrl: 'https://example.com/img.png', promptType: 'unknown', prompt: 'x' })
    ).rejects.toThrow('Unsupported promptType');
  });

  it('throws when click prompt has no points', async () => {
    vi.stubEnv('FAL_KEY', 'test-fal-key');

    await expect(
      segmentImage({ imageUrl: 'https://example.com/img.png', promptType: 'click', prompt: 'click' })
    ).rejects.toThrow('click prompt requires at least one');
  });

  it('throws when box prompt has no box', async () => {
    vi.stubEnv('FAL_KEY', 'test-fal-key');

    await expect(
      segmentImage({ imageUrl: 'https://example.com/img.png', promptType: 'box', prompt: 'box' })
    ).rejects.toThrow('box prompt requires a');
  });

  it('throws on API error', async () => {
    vi.stubEnv('FAL_KEY', 'test-fal-key');
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    });

    await expect(
      segmentImage({ imageUrl: 'https://example.com/img.png', promptType: 'text', prompt: 'cat' })
    ).rejects.toThrow(/fal\.ai API error 500/);
  });

  it('throws on rate limit (429)', async () => {
    vi.stubEnv('FAL_KEY', 'test-fal-key');
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    });

    await expect(
      segmentImage({ imageUrl: 'https://example.com/img.png', promptType: 'text', prompt: 'cat' })
    ).rejects.toThrow('Rate limited by fal.ai');
  });

  it('throws when response has no mask URL', async () => {
    vi.stubEnv('FAL_KEY', 'test-fal-key');
    mockFetchOnce({});

    await expect(
      segmentImage({ imageUrl: 'https://example.com/img.png', promptType: 'text', prompt: 'cat' })
    ).rejects.toThrow('fal.ai response did not contain a mask URL');
  });
});
