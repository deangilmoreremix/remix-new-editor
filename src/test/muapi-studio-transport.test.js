import { describe, expect, it } from 'vitest';
import { createMuapiStudioFetch, STUDIO_BASE } from '../lib/muapiStudioTransport.js';

const PROXY = 'https://project.supabase.co/functions/v1/muapi-proxy';

function setup({ key = 'user-key', uploadLimit = 100 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return new Response('{"ok":true}', { status: 200 }); };
  const studioFetch = createMuapiStudioFetch({ proxyUrl: PROXY, getKey: () => key, fetchImpl, uploadLimit });
  const body = (i) => JSON.parse(calls[i].init.body);
  return { studioFetch, calls, body };
}

describe('muapiStudioTransport', () => {
  it('turns reads into proxy list calls with the user key', async () => {
    const { studioFetch, calls, body } = setup();
    await studioFetch(`${STUDIO_BASE}/api/v1/models/flux-schnell`);
    expect(calls[0].url).toBe(PROXY);
    expect(calls[0].init.headers['x-api-key']).toBe('user-key');
    expect(body(0)).toMatchObject({ endpoint: 'models/flux-schnell', generationType: 'list', params: {} });
  });

  it('keeps query strings in the endpoint (history paging)', async () => {
    const { studioFetch, body } = setup();
    await studioFetch(`${STUDIO_BASE}/api/v1/history?limit=30&cursor=abc`);
    expect(body(0).endpoint).toBe('history?limit=30&cursor=abc');
  });

  it('polls with generationType poll', async () => {
    const { studioFetch, body } = setup();
    await studioFetch(`${STUDIO_BASE}/api/v1/predictions/abc-123/result`);
    expect(body(0)).toMatchObject({ endpoint: 'predictions/abc-123/result', generationType: 'poll' });
  });

  it('turns a submit into a POST with the payload as params and a kind-based type', async () => {
    const { studioFetch, body } = setup();
    await studioFetch(`${STUDIO_BASE}/api/v1/flux-schnell-image`, { method: 'POST', headers: { 'x-ms-kind': 'image' }, body: JSON.stringify({ prompt: 'x', width: 512 }) });
    expect(body(0)).toMatchObject({ endpoint: 'flux-schnell-image', generationType: 'image', params: { prompt: 'x', width: 512 } });
    await studioFetch(`${STUDIO_BASE}/api/v1/some-tool`, { method: 'POST', headers: { 'x-ms-kind': 'tool' }, body: '{}' });
    expect(body(1).generationType).toBe('video-tool');
  });

  it('sends estimate-cost as a POST', async () => {
    const { studioFetch, body } = setup();
    await studioFetch(`${STUDIO_BASE}/api/v1/models/flux-schnell/estimate-cost`, { method: 'POST', body: '{"prompt":"x"}' });
    expect(body(0)).toMatchObject({ endpoint: 'models/flux-schnell/estimate-cost', generationType: 'image', params: { prompt: 'x' } });
  });

  it('maps DELETE to apiMethod DELETE', async () => {
    const { studioFetch, body } = setup();
    await studioFetch(`${STUDIO_BASE}/api/v1/predictions/abc/media?delete_record=true`, { method: 'DELETE' });
    expect(body(0)).toMatchObject({ endpoint: 'predictions/abc/media?delete_record=true', generationType: 'list', apiMethod: 'DELETE' });
  });

  it('answers 404 for /app/* so the studio hides the media library', async () => {
    const { studioFetch, calls } = setup();
    const res = await studioFetch(`${STUDIO_BASE}/app/media-library?page=1`);
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it('does not touch the network without a key', async () => {
    const { studioFetch, calls } = setup({ key: null });
    const res = await studioFetch(`${STUDIO_BASE}/api/v1/models`);
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('rejects a malformed submit body without calling the proxy', async () => {
    const { studioFetch, calls } = setup();
    const res = await studioFetch(`${STUDIO_BASE}/api/v1/x`, { method: 'POST', body: '{nope' });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('uploads small files through the proxy and large files directly', async () => {
    const { studioFetch, calls } = setup({ uploadLimit: 10 });
    const small = new FormData(); small.append('file', new Blob(['12345']), 'a.png');
    await studioFetch(`${STUDIO_BASE}/api/v1/upload_file`, { method: 'POST', body: small });
    expect(calls[0].url).toBe(PROXY);
    expect(calls[0].init.headers).toMatchObject({ 'x-api-key': 'user-key', 'x-endpoint': 'upload_file' });
    const big = new FormData(); big.append('file', new Blob(['x'.repeat(50)]), 'b.png');
    await studioFetch(`${STUDIO_BASE}/api/v1/upload_file`, { method: 'POST', body: big });
    expect(calls[1].url).toBe('https://api.muapi.ai/api/v1/upload_file');
    expect(calls[1].init.headers).toEqual({ 'x-api-key': 'user-key' });
  });
});

describe('muapiStudioTransport failures', () => {
  const make = (fetchImpl) => createMuapiStudioFetch({ proxyUrl: PROXY, getKey: () => 'k', fetchImpl });

  it('returns 502 when the network fails', async () => {
    const res = await make(async () => { throw new TypeError('Failed to fetch'); })(`${STUDIO_BASE}/api/v1/models`);
    expect(res.status).toBe(502);
  });

  it('returns 504 when the proxy hangs past the timeout', async () => {
    const hang = (_u, init) => new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    const vi_ = await import('vitest');
    vi_.vi.useFakeTimers();
    const p = make(hang)(`${STUDIO_BASE}/api/v1/models`);
    await vi_.vi.advanceTimersByTimeAsync(61000);
    expect((await p).status).toBe(504);
    vi_.vi.useRealTimers();
  });

  it('rethrows when the caller aborts', async () => {
    const ac = new AbortController();
    ac.abort();
    const f = make(async () => { throw new DOMException('Aborted', 'AbortError'); });
    await expect(f(`${STUDIO_BASE}/api/v1/models`, { signal: ac.signal })).rejects.toThrow();
  });
});
