import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const muapiPost = vi.fn();
vi.mock('../cinegenProviders.js', async (orig) => ({ ...(await orig()), muapiPost: (...a) => muapiPost(...a) }));
const { handle, buildRequest } = await import('../agent-audio.js');

describe('agent-audio function', () => {
  const env = { ...process.env };
  const keys = { muapi: 'mu_test_key_0123456789' };
  beforeEach(() => { muapiPost.mockReset(); });
  afterEach(() => { process.env = { ...env }; });

  it('builds TTS and music requests with validation', () => {
    expect(buildRequest({ kind: 'tts', text: 'Hi', voice: 'Calm_Woman', speed: 9 })).toMatchObject({ endpoint: '/minimax-speech-2.6-hd', payload: { text: 'Hi', voice_id: 'Calm_Woman', speed: 2 } });
    expect(buildRequest({ kind: 'tts', text: 'Hi', voice: 'evil' }).payload.voice_id).toBe('Wise_Woman');
    expect(buildRequest({ kind: 'tts', text: 'x'.repeat(3001) }).error).toMatch(/too long/);
    expect(buildRequest({ kind: 'music', mood: 'calm', duration: 500 })).toMatchObject({ endpoint: '/suno-create-music', payload: { mood: 'calm', duration: 180, instrumental: true } });
    expect(buildRequest({ kind: 'music' }).error).toBeTruthy();
    expect(buildRequest({ kind: 'video' }).error).toBeTruthy();
  });

  it('submits and reports status', async () => {
    muapiPost.mockResolvedValueOnce({ request_id: 'abc123' });
    expect(JSON.parse((await handle({ action: 'submit', kind: 'tts', text: 'Hello' }, 'u1', { keys })).body)).toEqual({ ok: true, requestId: 'abc123' });
    muapiPost.mockResolvedValueOnce({ status: 'processing' });
    expect(JSON.parse((await handle({ action: 'status', requestId: 'abc123' }, 'u1', { keys })).body)).toEqual({ ok: true, status: 'pending' });
    expect(muapiPost.mock.calls[1][0]).toBe('/predictions/abc123/result');
    expect(muapiPost.mock.calls[0][3]).toBe('mu_test_key_0123456789');
    muapiPost.mockResolvedValueOnce({ status: 'completed', outputs: ['https://cdn.muapi.ai/out/a.mp3'] });
    expect(JSON.parse((await handle({ action: 'status', requestId: 'abc123' }, 'u1', { keys })).body)).toEqual({ ok: true, status: 'done', url: 'https://cdn.muapi.ai/out/a.mp3' });
    expect((await handle({ action: 'status', requestId: '../x' }, 'u1', { keys })).statusCode).toBe(400);
  });

  it('needs the user\'s own MuAPI key (BYOK), even when a server key exists', async () => {
    process.env.MUAPI_API_KEY = 'server-key';
    const res = await handle({ action: 'submit', kind: 'tts', text: 'x' }, 'u');
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error.message).toMatch(/MuAPI/);
    muapiPost.mockRejectedValueOnce(Object.assign(new Error('nope'), { status: 401 }));
    expect(JSON.parse((await handle({ action: 'submit', kind: 'tts', text: 'x' }, 'u2', { keys })).body).error.code).toBe('bad_key');
  });
});

describe('agent-audio OpenAI speech', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it('builds an OpenAI request with clamped speed and instructions', () => {
    expect(buildRequest({ kind: 'tts', provider: 'openai', text: 'Hi', voice: 'cedar', speed: 9, instructions: 'warm' })).toMatchObject({
      provider: 'openai', payload: { model: 'gpt-4o-mini-tts', input: 'Hi', voice: 'cedar', speed: 4, instructions: 'warm', response_format: 'mp3' },
    });
    expect(buildRequest({ kind: 'tts', provider: 'openai', text: 'Hi', voice: 'bogus' }).payload.voice).toBe('marin');
    expect(buildRequest({ kind: 'tts', provider: 'openai', text: 'x'.repeat(1501) }).error).toMatch(/too long/);
    expect(buildRequest({ kind: 'tts', text: 'Hi', pitch: 40 }).payload.pitch).toBe(12);
  });

  it('returns the speech as a data URL, and needs its own key', async () => {
    process.env.OPENAI_API_KEY = 'sk-server-key-not-used';
    expect((await handle({ action: 'submit', kind: 'tts', provider: 'openai', text: 'x' }, 'u')).statusCode).toBe(401);
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const res = await handle({ action: 'submit', kind: 'tts', provider: 'openai', text: 'Hello', voice: 'marin' }, 'u-openai', { fetchImpl, keys: { openai: 'sk-test' } });
    const body = JSON.parse(res.body);
    expect(body).toEqual({ ok: true, status: 'done', url: 'data:audio/mpeg;base64,AQID' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/speech');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body)).toMatchObject({ input: 'Hello', voice: 'marin' });
  });
});
