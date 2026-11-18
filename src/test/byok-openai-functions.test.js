// @vitest-environment node
// BYOK: every Netlify function that calls OpenAI runs on the user's own key
// (X-OpenAI-Key, from SmartVid's API key modal) and never on a server key.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Supabase stand-in: any query chain resolves OK; inserts are recorded so we can
// check that a request without a key isn't counted as billable.
const inserts = [];
vi.mock('@supabase/supabase-js', () => {
  const result = { data: null, error: null, count: 0 };
  const chain = () => {
    const p = new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === 'then') return (res) => Promise.resolve(result).then(res);
        if (prop === 'insert') return (row) => { inserts.push(row); return chain(); };
        return () => chain();
      },
      apply: () => chain(),
    });
    return p;
  };
  return {
    createClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
      from: () => chain(),
      rpc: () => chain(),
      storage: { from: () => chain() },
    }),
  };
});

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';

const USER_KEY = 'sk-proj-' + 'u'.repeat(40);
const SERVER_KEY = 'sk-server-' + 's'.repeat(40);
const ev = (path, body, headers = {}) => ({
  httpMethod: 'POST',
  path,
  rawUrl: `https://smartvid.app${path}`,
  queryStringParameters: {},
  headers: { authorization: 'Bearer supabase-session', ...headers },
  body: JSON.stringify(body),
});

let openaiCalls;
function stubOpenAI(status = 200, payload = {}) {
  openaiCalls = [];
  vi.stubGlobal('fetch', async (url, init = {}) => {
    if (String(url).startsWith('https://api.openai.com/')) {
      openaiCalls.push({ url: String(url), auth: new Headers(init.headers).get('authorization'), body: init.body });
      return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  });
}

beforeEach(() => { inserts.length = 0; process.env.OPENAI_API_KEY = SERVER_KEY; });
afterEach(() => { vi.unstubAllGlobals(); delete process.env.OPENAI_API_KEY; });

describe('timeline-script (Template Generator AI script)', async () => {
  const { handler } = await import('../../netlify/functions/timeline-script.js');
  const body = { action: 'generate', niche: 'coffee shop' };

  it('without the user key asks for it — even when a server key exists', async () => {
    stubOpenAI();
    const r = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) });
    expect(r.statusCode).toBe(401);
    expect(JSON.parse(r.body).error).toMatch(/your own OpenAI key/);
    expect(openaiCalls).toHaveLength(0);
  });

  it('calls OpenAI with the user key', async () => {
    stubOpenAI(200, { output_text: 'A great script.', id: 'resp_1' });
    const r = await handler({ httpMethod: 'POST', headers: { 'X-OpenAI-Key': USER_KEY }, body: JSON.stringify(body) });
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body).text).toBe('A great script.');
    expect(openaiCalls.map((c) => c.auth)).toEqual([`Bearer ${USER_KEY}`]);
  });

  it('explains a rejected key', async () => {
    stubOpenAI(401, { error: { message: 'Incorrect API key' } });
    const r = await handler({ httpMethod: 'POST', headers: { 'x-openai-key': USER_KEY }, body: JSON.stringify(body) });
    expect(JSON.parse(r.body).error).toMatch(/OpenAI rejected your API key/);
  });
});

describe('timeline-image-generate (Template Generator AI image)', async () => {
  const { handler } = await import('../../netlify/functions/timeline-image-generate.js');
  const body = { prompt: 'latte art on a wooden table' };

  it('without the user key asks for it', async () => {
    stubOpenAI();
    const r = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) });
    expect(r.statusCode).toBe(401);
    expect(openaiCalls).toHaveLength(0);
  });

  it('every OpenAI call uses the user key; a rejected key is explained', async () => {
    stubOpenAI(401, { error: { message: 'Incorrect API key' } });
    const r = await handler({ httpMethod: 'POST', headers: { 'X-OpenAI-Key': USER_KEY }, body: JSON.stringify(body) });
    expect(openaiCalls.length).toBeGreaterThan(0);
    expect(openaiCalls.every((c) => c.auth === `Bearer ${USER_KEY}`)).toBe(true);
    expect(JSON.parse(r.body).error).toMatch(/OpenAI rejected your API key/);
  });
});

describe('timeline-image-generate — Images 2.6 and reference images', async () => {
  const { handler } = await import('../../netlify/functions/timeline-image-generate.js');

  it('defaults to gpt-image-2.6-flare when no model is pinned', async () => {
    stubOpenAI(200, { data: [{ b64_json: 'aGVsbG8=' }] });
    const ok = await handler({ httpMethod: 'POST', headers: { 'X-OpenAI-Key': USER_KEY }, body: JSON.stringify({ prompt: 'a cat' }) });
    expect(JSON.parse(ok.body).assets[0].model).toBe('gpt-image-2.6-flare');
    expect(JSON.parse(openaiCalls[0].body).model).toBe('gpt-image-2.6-flare');
  });

  it('an unpinned request falls back once to gpt-image-2 when the account lacks 2.6', async () => {
    openaiCalls = [];
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const body = JSON.parse(init.body || '{}');
      openaiCalls.push({ url: String(url), body: init.body });
      return body.model === 'gpt-image-2'
        ? new Response(JSON.stringify({ data: [{ b64_json: 'aGVsbG8=' }] }), { status: 200 })
        : new Response(JSON.stringify({ error: { message: 'The model `gpt-image-2.6-flare` does not exist' } }), { status: 404 });
    });
    const r = await handler({ httpMethod: 'POST', headers: { 'X-OpenAI-Key': USER_KEY }, body: JSON.stringify({ prompt: 'a cat' }) });
    expect(JSON.parse(r.body).assets[0].model).toBe('gpt-image-2');
    expect(openaiCalls).toHaveLength(2);
  });

  it('accepts the Images 2.6 models and edits with reference images on the user key', async () => {
    stubOpenAI(200, { data: [{ b64_json: 'aGVsbG8=' }] });
    const r = await handler({
      httpMethod: 'POST',
      headers: { 'X-OpenAI-Key': USER_KEY },
      body: JSON.stringify({
        prompt: 'same character, low angle',
        model: 'gpt-image-2.6-sunburst',
        referenceImageUrls: ['https://cdn.example.com/hero.png', 'data:image/png;base64,xx', 'http://insecure.example.com/x.png'],
      }),
    });
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body).assets[0].model).toBe('gpt-image-2.6-sunburst');
    expect(openaiCalls).toHaveLength(1);
    expect(openaiCalls[0].url).toBe('https://api.openai.com/v1/images/edits');
    expect(openaiCalls[0].auth).toBe(`Bearer ${USER_KEY}`);
  });

  it('rejects unknown models', async () => {
    stubOpenAI();
    const r = await handler({ httpMethod: 'POST', headers: { 'X-OpenAI-Key': USER_KEY }, body: JSON.stringify({ prompt: 'x', model: 'gpt-image-2.6-flare-image-to-image' }) });
    expect(r.statusCode).toBe(400);
    expect(openaiCalls).toHaveLength(0);
  });
});

describe('personalizer-api (Personalization AI)', async () => {
  const { handler } = await import('../../netlify/functions/personalizer-api.js');
  const vision = { mode: 'validate', originalImageUrl: 'https://cdn.example.com/a.png', editedImageUrl: 'https://cdn.example.com/b.png' };

  it('image analysis without the user key: asks for it and is NOT billed', async () => {
    stubOpenAI();
    const r = await handler(ev('/api/personalizer/image-analyze', vision));
    expect(r.statusCode).toBe(401);
    expect(JSON.parse(r.body).error).toMatch(/your own OpenAI key/);
    expect(inserts).toHaveLength(0);
    expect(openaiCalls).toHaveLength(0);
  });

  it('image analysis runs on the user key and explains a rejected key', async () => {
    stubOpenAI(401, { error: { message: 'Incorrect API key' } });
    const r = await handler(ev('/api/personalizer/image-analyze', vision, { 'X-OpenAI-Key': USER_KEY }));
    expect(openaiCalls.map((c) => c.auth)).toEqual([`Bearer ${USER_KEY}`]);
    expect(r.statusCode).toBe(401);
    expect(JSON.parse(r.body).error).toMatch(/OpenAI rejected your API key/);
  });

  it('never uses the server key on any route', async () => {
    stubOpenAI(200, { choices: [{ message: { content: 'ok' } }], output_text: '{}' });
    await handler(ev('/api/personalizer/generate', { appId: 'smart-video', mode: 'email', targetName: 'ann', manualNotes: 'hi' }));
    await handler(ev('/api/personalizer/generate', { appId: 'smart-video', mode: 'lead-summary', targetName: 'ann' }));
    await handler(ev('/api/personalizer/generate-visual', { appId: 'smart-video', targetName: 'ann' }));
    expect(openaiCalls.some((c) => c.auth === `Bearer ${SERVER_KEY}`)).toBe(false);
  });
});

describe('intelligence-api (contact enrichment)', async () => {
  const { handler } = await import('../../netlify/functions/intelligence-api.js');

  it('/enrich without the user key asks for it — even with a server key', async () => {
    stubOpenAI();
    const r = await handler(ev('/api/intelligence/enrich', { contactId: '11111111-1111-4111-8111-111111111111' }));
    expect(r.statusCode).toBe(401);
    expect(JSON.parse(r.body).error).toMatch(/your own OpenAI key/);
    expect(openaiCalls).toHaveLength(0);
  });
});

describe('browser side sends the user key (X-OpenAI-Key)', () => {
  it('openaiKeyHeader() returns the header only when the user has a key', async () => {
    const { openaiKeyHeader } = await import('../lib/openaiKeyHeader.js');
    expect(openaiKeyHeader({ getOpenAIKey: () => USER_KEY })).toEqual({ 'X-OpenAI-Key': USER_KEY });
    expect(openaiKeyHeader({ getOpenAIKey: () => null })).toEqual({});
    expect(openaiKeyHeader({ getOpenAIKey: () => { throw new Error('storage blocked'); } })).toEqual({});
  });

  it('Template Generator script, image and Personalization Vision requests carry the key', async () => {
    vi.resetModules();
    vi.doMock('../lib/apiKeyManager.js', () => ({ apiKeyManager: { getOpenAIKey: () => USER_KEY } }));
    vi.doMock('../lib/supabase.js', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } } }));
    const seen = {};
    vi.stubGlobal('fetch', async (url, init = {}) => {
      seen[String(url)] = init.headers;
      return new Response(JSON.stringify({ ok: true, text: 'x', analyses: [], assets: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const script = await import('../lib/editor/scriptAiService.js');
    const image = await import('../lib/editor/aiImageService.js');
    const vision = await import('../lib/personalization/visionService.js');
    const callScript = script.generateScript || script.runScriptAction || Object.values(script).find((f) => typeof f === 'function' && /generate/i.test(f.name));
    await callScript({ niche: 'coffee' }).catch(() => {});
    await image.generateImage({ prompt: 'latte art' }).catch(() => {});
    await vision.analyzePersonalizationImages({ images: [{ id: 'a', imageUrl: 'https://cdn.example.com/a.png' }] }).catch(() => {});
    expect(seen['/api/timeline-script']?.['X-OpenAI-Key']).toBe(USER_KEY);
    expect(seen['/api/timeline-image-generate']?.['X-OpenAI-Key']).toBe(USER_KEY);
    expect(seen['/api/personalizer/image-analyze']?.['X-OpenAI-Key']).toBe(USER_KEY);
    vi.doUnmock('../lib/apiKeyManager.js');
    vi.doUnmock('../lib/supabase.js');
  });
});
