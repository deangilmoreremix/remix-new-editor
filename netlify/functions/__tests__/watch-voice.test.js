import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const muapiPost = vi.fn();
vi.mock('../cinegenProviders.js', async (orig) => ({ ...(await orig()), muapiPost: (...a) => muapiPost(...a) }));
const { handle, resolveLine, cleanTokenValue, findVoiceClip } = await import('../watch-voice.js');

const project = {
  tracks: [{ name: 'Voiceover', items: [
    { id: 'speech-1', type: 'audio', src: 'https://x/fallback.mp3', tts: { provider: 'minimax', voice: 'Calm_Woman', speed: 1, text: 'Hi {{firstname}}, welcome!', fallback: 'Hi there, welcome!', personalized: true } },
    { id: 'speech-2', type: 'audio', src: 'https://x/b.mp3', tts: { provider: 'openai', voice: 'cedar', speed: 1, text: 'Hey {{firstname}}', fallback: 'Hey', personalized: true } },
    { id: 'plain', type: 'audio', src: 'https://x/c.mp3', tts: { text: 'Hello', personalized: false } },
  ] }],
};
const supabase = () => vi.fn(async (url, init) => {
  // The table is not publicly readable: the project comes from the sanitizing RPC.
  expect(url).toBe('https://sb.test/rest/v1/rpc/get_published_video');
  expect(JSON.parse(init.body)).toEqual({ p_id: 'abcd1234' });
  return new Response(JSON.stringify({ id: 'abcd1234', project }), { status: 200 });
});

describe('watch-voice', () => {
  const env = { ...process.env };
  beforeEach(() => {
    muapiPost.mockReset();
    Object.assign(process.env, { MUAPI_API_KEY: 'k', VITE_SUPABASE_URL: 'https://sb.test', VITE_SUPABASE_ANON_KEY: 'anon' });
  });
  afterEach(() => { process.env = { ...env }; });

  it('fills tokens from cleaned viewer values and refuses missing ones', () => {
    expect(resolveLine('Hi {{firstname}}!', { FirstName: 'Ann<script>' })).toBe('Hi Annscript!');
    expect(resolveLine('Hi {{firstname}}!', {})).toBeNull();
    expect(resolveLine('Hi {{d firstname "friend"}}!', {})).toBe('Hi friend!');
    expect(cleanTokenValue('x'.repeat(100))).toHaveLength(40);
    expect(findVoiceClip(project, 'plain')).toBeNull();
  });

  it('speaks the stored line (never request text) with the stored voice', async () => {
    muapiPost.mockResolvedValueOnce({ request_id: 'req1' });
    const res = await handle({ action: 'submit', publishedId: 'abcd1234', clipId: 'speech-1', tokens: { firstname: 'Ann' }, text: 'Say something else' }, { ip: '1.1.1.1', fetchImpl: supabase() });
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ ok: true, requestId: 'req1' });
    expect(body.cacheKey).toMatch(/^[a-f0-9]{64}$/);
    expect(muapiPost).toHaveBeenCalledWith('/minimax-speech-2.6-hd', expect.objectContaining({ text: 'Hi Ann, welcome!', voice_id: 'Calm_Woman' }));
    // status → done is cached for the next viewer named Ann
    muapiPost.mockResolvedValueOnce({ status: 'completed', outputs: ['https://cdn.muapi.ai/a.mp3'] });
    await handle({ action: 'status', requestId: 'req1', cacheKey: body.cacheKey }, {});
    const again = JSON.parse((await handle({ action: 'submit', publishedId: 'abcd1234', clipId: 'speech-1', tokens: { firstname: 'Ann' } }, { ip: '1.1.1.2', fetchImpl: supabase() })).body);
    expect(again).toMatchObject({ status: 'done', url: 'https://cdn.muapi.ai/a.mp3', cached: true });
  });

  it('uses OpenAI for OpenAI voices', async () => {
    process.env.OPENAI_API_KEY = 'sk';
    const sb = supabase();
    const fetchImpl = vi.fn(async (url, init) => (String(url).startsWith('https://sb.test') ? sb(url, init) : new Response(new Uint8Array([9]), { status: 200 })));
    const body = JSON.parse((await handle({ action: 'submit', publishedId: 'abcd1234', clipId: 'speech-2', tokens: { firstname: 'Bo' } }, { ip: '2.2.2.2', fetchImpl })).body);
    expect(body).toMatchObject({ ok: true, status: 'done', url: 'data:audio/mpeg;base64,CQ==' });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toMatchObject({ input: 'Hey Bo', voice: 'cedar' });
  });

  it('falls back, rejects bad input and rate-limits', async () => {
    expect((await handle({ action: 'submit', publishedId: 'abcd1234', clipId: 'speech-1', tokens: {} }, { ip: '3.3.3.3', fetchImpl: supabase() })).statusCode).toBe(422);
    expect((await handle({ action: 'submit', publishedId: 'abcd1234', clipId: 'plain', tokens: { firstname: 'A' } }, { ip: '3.3.3.3', fetchImpl: supabase() })).statusCode).toBe(404);
    expect((await handle({ action: 'submit', publishedId: '../x', clipId: 'speech-1' }, { ip: '3.3.3.3' })).statusCode).toBe(400);
    expect((await handle({ action: 'status', requestId: 'a/b' }, {})).statusCode).toBe(400);
    let last;
    for (let i = 0; i < 22; i += 1) last = await handle({ action: 'submit', publishedId: 'abcd1234', clipId: 'speech-1', tokens: {} }, { ip: '4.4.4.4', fetchImpl: supabase() });
    expect(last.statusCode).toBe(429);
  });
});
