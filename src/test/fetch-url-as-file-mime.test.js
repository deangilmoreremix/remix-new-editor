import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchUrlAsFile } from '../lib/editor/uploadPipeline.js';

function mockResponse(bytes, headers) {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  let sent = false;
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (k) => h.get(k.toLowerCase()) ?? null },
    body: {
      getReader: () => ({
        read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: bytes })),
      }),
    },
  };
}

function fetchReturning(headers, url = 'https://cdn.test/media') {
  globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(new Uint8Array([1, 2, 3]), headers));
  return fetchUrlAsFile(url);
}

describe('fetchUrlAsFile MIME type', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the response Content-Type for an audio URL, even with no extension', async () => {
    const file = await fetchReturning({ 'content-type': 'audio/mpeg' });
    expect(file.type).toBe('audio/mpeg');
    expect(file.size).toBe(3);
  });

  it('drops Content-Type parameters and normalises case', async () => {
    const file = await fetchReturning({ 'content-type': 'Image/PNG; charset=binary' });
    expect(file.type).toBe('image/png');
  });

  it('treats a generic octet-stream as unknown so extension fallbacks still apply', async () => {
    const file = await fetchReturning({ 'content-type': 'application/octet-stream' });
    expect(file.type).toBe('');
  });

  it('stays untyped when the server sends no Content-Type', async () => {
    const file = await fetchReturning({});
    expect(file.type).toBe('');
  });
});
