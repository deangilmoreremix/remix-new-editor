import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MuapiClient } from '../../src/lib/muapi.js';

// Mock supabase upload fallback
vi.mock('../../src/lib/supabase.js', () => ({
  uploadFileToStorage: vi.fn(async (file) => {
    return `https://supabase.example.com/${file.name}`;
  })
}));

// Mock validateFile so we can control the detected type
const mockValidateFile = vi.fn();
vi.mock('../../src/lib/editor/validateFile.js', () => ({
  validateFile: (...args) => mockValidateFile(...args)
}));

vi.mock('../../src/lib/services/RateLimiter.js', () => ({
  rateLimiter: {
    acquire: vi.fn(async () => {})
  }
}));

describe('MuapiClient.uploadFile integration', () => {
  let client;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    client = new MuapiClient();
    await client.apiKeyManager.setMuapiKey('test-muapi-key');
    mockValidateFile.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('returns the upload url from a successful proxy response', async () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    mockValidateFile.mockResolvedValue({ valid: true, type: 'image' });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ url: 'https://cdn.muapi.ai/test.png' }),
      } as Response)
    );

    const result = await client.uploadFile(mockFile);
    expect(result).toBe('https://cdn.muapi.ai/test.png');
  });

  it('returns the upload url from a wrapped data response', async () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    mockValidateFile.mockResolvedValue({ valid: true, type: 'image' });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ data: { url: 'https://cdn.muapi.ai/wrapped.png' } }),
      } as Response)
    );

    const result = await client.uploadFile(mockFile);
    expect(result).toBe('https://cdn.muapi.ai/wrapped.png');
  });

  it('throws for 413 payload-too-large without falling back', async () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    mockValidateFile.mockResolvedValue({ valid: true, type: 'image' });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 413,
        statusText: 'Payload Too Large',
        json: () => Promise.resolve({ error: 'File too large' }),
        text: () => Promise.resolve('File too large'),
      } as Response)
    );

    await expect(client.uploadFile(mockFile)).rejects.toThrow('Upload failed');
  });

  it('falls back to Supabase Storage on network error', async () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    mockValidateFile.mockResolvedValue({ valid: true, type: 'image' });

    global.fetch = vi.fn(() => Promise.reject(new Error('Network down')));

    const result = await client.uploadFile(mockFile);
    expect(result).toBe('https://supabase.example.com/test.png');
  });

  it('throws when proxy response lacks a url field', async () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    mockValidateFile.mockResolvedValue({ valid: true, type: 'image' });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ message: 'ok' }),
      } as Response)
    );

    await expect(client.uploadFile(mockFile)).rejects.toThrow('No URL returned by the server');
  });

  it('uses validateFile to detect type instead of relying on file.type alone', async () => {
    // Simulate a file whose browser MIME is empty but extension is .mp4
    const mockFile = new File(['test'], 'video.mp4', { type: '' });
    mockValidateFile.mockResolvedValue({ valid: true, type: 'video' });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ url: 'https://cdn.muapi.ai/video.mp4' }),
      } as Response)
    );

    const result = await client.uploadFile(mockFile);
    expect(result).toBe('https://cdn.muapi.ai/video.mp4');
    expect(mockValidateFile).toHaveBeenCalledWith(mockFile);
  });

  it('falls back to Supabase Storage on 401 auth error', async () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    mockValidateFile.mockResolvedValue({ valid: true, type: 'image' });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: 'Invalid API key' }),
        text: () => Promise.resolve('Invalid API key'),
      } as Response)
    );

    const result = await client.uploadFile(mockFile);
    expect(result).toBe('https://supabase.example.com/test.png');
  });

  it('falls back to Supabase Storage on 500 server error', async () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    mockValidateFile.mockResolvedValue({ valid: true, type: 'image' });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Server error' }),
        text: () => Promise.resolve('Server error'),
      } as Response)
    );

    const result = await client.uploadFile(mockFile);
    expect(result).toBe('https://supabase.example.com/test.png');
  });

  it('throws on rate limit from rate limiter', async () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    mockValidateFile.mockResolvedValue({ valid: true, type: 'image' });

    const { rateLimiter } = await import('../../src/lib/services/RateLimiter.js');
    rateLimiter.acquire.mockRejectedValueOnce(new Error('Rate limit exceeded'));

    await expect(client.uploadFile(mockFile)).rejects.toThrow('Rate limit exceeded');
  });

  it('falls back to Supabase Storage on HTTP 429 after retries', async () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    mockValidateFile.mockResolvedValue({ valid: true, type: 'image' });

    const originalSetTimeout = global.setTimeout;
    global.setTimeout = ((fn, delay, ...args) => originalSetTimeout(fn, 0, ...args)) as any;

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () => Promise.resolve({ error: 'Rate limited' }),
        text: () => Promise.resolve('Rate limited'),
      } as Response)
    );

    try {
      const result = await client.uploadFile(mockFile);
      expect(result).toBe('https://supabase.example.com/test.png');
    } finally {
      global.setTimeout = originalSetTimeout;
    }
  });

  it('falls back to Supabase Storage on network timeout', async () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    mockValidateFile.mockResolvedValue({ valid: true, type: 'image' });

    global.fetch = vi.fn(() => Promise.reject(new Error('fetch timeout')));

    const result = await client.uploadFile(mockFile);
    expect(result).toBe('https://supabase.example.com/test.png');
  });

  it('throws Request cancelled by user on abort error', async () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    mockValidateFile.mockResolvedValue({ valid: true, type: 'image' });

    global.fetch = vi.fn(() => Promise.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));

    await expect(client.uploadFile(mockFile)).rejects.toThrow('Request cancelled by user');
  });

  it('falls back to Supabase Storage on video file when proxy fails', async () => {
    const mockFile = new File(['test'], 'video.mp4', { type: 'video/mp4' });
    mockValidateFile.mockResolvedValue({ valid: true, type: 'video' });

    global.fetch = vi.fn(() => Promise.reject(new Error('Network down')));

    const result = await client.uploadFile(mockFile);
    expect(result).toBe('https://supabase.example.com/video.mp4');
  });

  it('handles concurrent uploads with Promise.all', async () => {
    const files = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
      new File(['c'], 'c.png', { type: 'image/png' }),
    ];
    mockValidateFile.mockResolvedValue({ valid: true, type: 'image' });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ url: `https://cdn.muapi.ai/${Math.random().toString(36).slice(2)}.png` }),
      } as Response)
    );

    const results = await Promise.all(files.map(f => client.uploadFile(f)));
    expect(results.length).toBe(3);
    expect(results.every(r => r.startsWith('https://cdn.muapi.ai/'))).toBe(true);
  });
});
