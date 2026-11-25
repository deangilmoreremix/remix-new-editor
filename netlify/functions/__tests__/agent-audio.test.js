import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const muapiPost = vi.fn();
const muapiResult = vi.fn();
vi.mock('../cinegenProviders.js', async (orig) => ({ ...(await orig()), muapiPost: (...a) => muapiPost(...a), muapiResult: (...a) => muapiResult(...a) }));
const { handle, buildRequest } = await import('../agent-audio.js');

describe('agent-audio function', () => {
  const env = { ...process.env };
  const keys = { muapi: 'mu_test_key_0123456789' };
  beforeEach(() => { muapiPost.mockReset(); muapiResult.mockReset(); });
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
    muapiResult.mockResolvedValueOnce({ status: 'processing' });
    expect(JSON.parse((await handle({ action: 'status', requestId: 'abc123' }, 'u1', { keys })).body)).toEqual({ ok: true, status: 'pending' });
    expect(muapiResult.mock.calls[0][0]).toBe('abc123');
    expect(muapiResult.mock.calls[0][2]).toBe('mu_test_key_0123456789');
    expect(muapiPost.mock.calls[0][3]).toBe('mu_test_key_0123456789');
    muapiResult.mockResolvedValueOnce({ status: 'completed', outputs: ['https://cdn.muapi.ai/out/a.mp3'] });
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

describe('agent-audio voice cloning', () => {
  const keys = { muapi: 'mu_test_key_0123456789' };
  const clone = { kind: 'voice-clone', audioUrl: 'https://cdn.example.com/me.webm', voiceId: 'my_voice_001', consent: true };
  beforeEach(() => { muapiPost.mockReset(); muapiResult.mockReset(); });

  it('builds a MiniMax clone request from the sample', () => {
    expect(buildRequest(clone)).toMatchObject({
      endpoint: '/minimax-voice-clone',
      payload: { audio_url: 'https://cdn.example.com/me.webm', custom_voice_id: 'my_voice_001', model: 'speech-2.6-hd', need_noise_reduction: true },
    });
  });

  it('refuses to clone without consent or with an unsafe sample or id', () => {
    expect(buildRequest({ ...clone, consent: false }).error).toMatch(/your own voice/);
    expect(buildRequest({ ...clone, consent: undefined }).error).toMatch(/your own voice/);
    expect(buildRequest({ ...clone, audioUrl: 'http://cdn.example.com/me.webm' }).error).toMatch(/https/);
    expect(buildRequest({ ...clone, audioUrl: 'data:audio/webm;base64,AAAA' }).error).toMatch(/https/);
    expect(buildRequest({ ...clone, audioUrl: 'https://localhost/me.webm' }).error).toMatch(/https/);
    expect(buildRequest({ ...clone, voiceId: '1bad' }).error).toMatch(/voiceId/);
    expect(buildRequest({ ...clone, voiceId: '../etc/passwd' }).error).toMatch(/voiceId/);
  });

  it('speaks with a cloned voice id, and rejects a malformed one', () => {
    expect(buildRequest({ kind: 'tts', text: 'Hi Mike', cloneVoiceId: 'my_voice_001' }).payload.voice_id).toBe('my_voice_001');
    expect(buildRequest({ kind: 'tts', text: 'Hi', cloneVoiceId: 'x y' }).error).toMatch(/cloneVoiceId/);
  });

  it('needs the user key and sends the clone to MuAPI', async () => {
    expect((await handle({ action: 'submit', ...clone }, 'u1')).statusCode).toBe(401);
    muapiPost.mockResolvedValueOnce({ request_id: 'clone42' });
    expect(JSON.parse((await handle({ action: 'submit', ...clone }, 'u2', { keys })).body)).toEqual({ ok: true, requestId: 'clone42' });
    expect(muapiPost.mock.calls[0][0]).toBe('/minimax-voice-clone');
    expect(muapiPost.mock.calls[0][3]).toBe('mu_test_key_0123456789');
    expect((await handle({ action: 'submit', ...clone, consent: false }, 'u3', { keys })).statusCode).toBe(400);
  });

  it('reports a finished clone as done even with no audio file', async () => {
    muapiResult.mockResolvedValueOnce({ status: 'completed', outputs: [] });
    expect(JSON.parse((await handle({ action: 'status', requestId: 'clone42', kind: 'voice-clone' }, 'u4', { keys })).body)).toEqual({ ok: true, status: 'done' });
    muapiResult.mockResolvedValueOnce({ status: 'completed', outputs: [] });
    expect(JSON.parse((await handle({ action: 'status', requestId: 'tts9' }, 'u4', { keys })).body).status).toBe('failed');
  });
});

describe('spoken language', () => {
  it('passes an allowed language to MiniMax as language_boost, and drops anything else', async () => {
    const mod = await import('../agent-audio.js');
    const build = mod.buildRequest || mod.default?.buildRequest;
    const es = build({ kind: 'tts', text: 'Hola', voice: 'Wise_Woman', languageBoost: 'Spanish' });
    expect(es.payload.language_boost).toBe('Spanish');
    expect(build({ kind: 'tts', text: 'Hi', voice: 'Wise_Woman', languageBoost: 'Klingon' }).payload.language_boost).toBeUndefined();
  });
});
