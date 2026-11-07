import { describe, it, expect, vi } from 'vitest';

vi.mock('../_shared/clerkAuth.js', () => ({ withClerkAuth: (fn) => fn }));

const { handle, buildSubmit } = await import('../timeline-ai.js');

const KEY = 'mu_test_key_0123456789';
const body = (res) => JSON.parse(res.body);

describe('timeline-ai (MuAPI only)', () => {
  it('requires the user\'s own MuAPI key', async () => {
    const res = await handle({ action: 'submit', tool: 'fill_gap', params: {} }, 'u1', { keys: {} });
    expect(res.statusCode).toBe(401);
    expect(body(res).error.code).toBe('need_key');
  });

  it('submits Fill Gap to the model endpoint with the user key and returns a requestId', async () => {
    const post = vi.fn(async () => ({ request_id: 'req_1234' }));
    const res = await handle({
      action: 'submit', tool: 'fill_gap',
      params: { firstFrameUrl: 'https://x.test/a.jpg', lastFrameUrl: 'https://x.test/b.jpg', duration: 3 },
    }, 'u2', { keys: { muapi: KEY }, post });
    expect(res.statusCode).toBe(200);
    expect(body(res)).toMatchObject({ ok: true, status: 'pending', requestId: 'req_1234', model: 'vidu-q2-turbo-start-end-video' });
    expect(post).toHaveBeenCalledWith('/vidu-q2-turbo-start-end-video', expect.objectContaining({ image_url: 'https://x.test/a.jpg', last_image: 'https://x.test/b.jpg' }), undefined, KEY);
  });

  it('rejects bad input before calling MuAPI', async () => {
    const post = vi.fn();
    const res = await handle({ action: 'submit', tool: 'fill_gap', params: { firstFrameUrl: 'blob:local' } }, 'u3', { keys: { muapi: KEY }, post });
    expect(res.statusCode).toBe(400);
    expect(post).not.toHaveBeenCalled();
    expect(buildSubmit({ tool: 'sam3' }).error).toMatch(/Unknown tool/);
  });

  it('maps MuAPI auth failures to a clear key message', async () => {
    const post = vi.fn(async () => { throw Object.assign(new Error('nope'), { status: 402 }); });
    const res = await handle({ action: 'submit', tool: 'watermark_remove', params: { videoUrl: 'https://x.test/v.mp4' } }, 'u4', { keys: { muapi: KEY }, post });
    expect(res.statusCode).toBe(401);
    expect(body(res).error.code).toBe('bad_key');
  });

  it('polls status → done with real urls (static demo assets filtered out)', async () => {
    const post = vi.fn(async () => ({ status: 'completed', outputs: ['https://cdn.muapi.ai/muapi/demo/x.mp4', 'https://cdn.example.com/out.mp4'] }));
    const res = await handle({ action: 'status', requestId: 'req_1234' }, 'u5', { keys: { muapi: KEY }, post });
    expect(body(res)).toEqual({ ok: true, status: 'done', urls: ['https://cdn.example.com/out.mp4'], url: 'https://cdn.example.com/out.mp4' });
    expect(post).toHaveBeenCalledWith('/predictions/req_1234/result', {}, undefined, KEY);
  });

  it('reports pending and failed states', async () => {
    const pending = await handle({ action: 'status', requestId: 'req_1234' }, 'u6', { keys: { muapi: KEY }, post: async () => ({ status: 'processing' }) });
    expect(body(pending).status).toBe('pending');
    const failed = await handle({ action: 'status', requestId: 'req_1234' }, 'u6', { keys: { muapi: KEY }, post: async () => ({ status: 'failed', error: 'nsfw' }) });
    expect(body(failed)).toMatchObject({ status: 'failed', error: 'nsfw' });
    const bad = await handle({ action: 'status', requestId: '../etc' }, 'u6', { keys: { muapi: KEY }, post: vi.fn() });
    expect(bad.statusCode).toBe(400);
  });
});

describe('timeline-ai — generic generate with MuAPI\'s live catalog', () => {
  it('runs a model that is not in the bundled snapshot (ElevenLabs TTS) and filters to its declared fields', async () => {
    const live = [{ name: 'elevenlabs-v4', endpoint_url: 'elevenlabs-v4', required_fields: ['prompt'], input_fields: ['prompt', 'voice_id'], is_enabled: true }];
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(live), { status: 200 }));
    const post = vi.fn(async () => ({ request_id: 'req_tts1' }));
    const res = await handle({ action: 'submit', tool: 'generate', params: { model: 'elevenlabs-v4', inputs: { prompt: 'Hello', voice_id: 'abc', bogus: 1 } } }, 'u3', { keys: { muapi: KEY }, post, fetchImpl });
    expect(body(res)).toMatchObject({ ok: true, status: 'pending', requestId: 'req_tts1', model: 'elevenlabs-v4' });
    expect(post).toHaveBeenCalledWith('/elevenlabs-v4', { prompt: 'Hello', voice_id: 'abc' }, undefined, KEY);
  });
  it('rejects an unknown model and a missing required field', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([{ name: 'elevenlabs-v4', endpoint_url: 'elevenlabs-v4', required_fields: ['prompt'], input_fields: ['prompt'] }]), { status: 200 }));
    const post = vi.fn();
    const a = await handle({ action: 'submit', tool: 'generate', params: { model: 'nope', inputs: {} } }, 'u4', { keys: { muapi: KEY }, post, fetchImpl });
    expect(a.statusCode).toBe(400);
    const b = await handle({ action: 'submit', tool: 'generate', params: { model: 'elevenlabs-v4', inputs: {} } }, 'u5', { keys: { muapi: KEY }, post, fetchImpl });
    expect(b.statusCode).toBe(400);
    expect(post).not.toHaveBeenCalled();
  });
});
