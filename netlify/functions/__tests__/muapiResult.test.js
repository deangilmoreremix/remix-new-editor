import { describe, it, expect, vi, afterEach } from 'vitest';
import { muapiResult } from '../cinegenProviders.js';

describe('muapiResult', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads a job result with GET (MuAPI answers a POST with 405)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'completed', outputs: ['https://cdn.muapi.ai/a.mp3'] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const data = await muapiResult('abc 123', undefined, 'mu_key');
    expect(data.status).toBe('completed');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.muapi.ai/api/v1/predictions/abc%20123/result');
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers['x-api-key']).toBe('mu_key');
  });

  it('throws with the HTTP status on an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Method Not Allowed', { status: 405, statusText: 'Method Not Allowed' })));
    await expect(muapiResult('abc123', undefined, 'mu_key')).rejects.toMatchObject({ status: 405 });
  });
});
