// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import handler from '../../netlify/functions/video-agent-generate.mjs';
import { POST } from '../../netlify/functions/_shared/videoAgentGenerate.generated.mjs';
import { stripMarkdownFences, extractComponentCode } from '../../apps/motion-agent/src/helpers/sanitize-response.ts';
import { examples } from '../../apps/motion-agent/src/examples/code/index.ts';

describe('video-agent-generate function (BYOK: the user\'s own OpenAI key)', () => {
  const KEY = 'sk-test-' + 'a'.repeat(32);
  afterEach(() => vi.unstubAllGlobals());

  it('requires the user\'s OpenAI key and POST', async () => {
    const noKey = await handler(new Request('http://x/fn', { method: 'POST', body: JSON.stringify({ prompt: 'a ball' }) }));
    expect(noKey.status).toBe(401);
    expect((await noKey.json()).error).toMatch(/your own OpenAI key/);
    const badKey = await handler(new Request('http://x/fn', { method: 'POST', headers: { 'X-OpenAI-Key': 'not-a-key' }, body: JSON.stringify({ prompt: 'a ball' }) }));
    expect(badKey.status).toBe(401);
    const get = await handler(new Request('http://x/fn', { method: 'GET' }));
    expect(get.status).toBe(405);
  });

  it('never falls back to a server key', async () => {
    process.env.OPENAI_API_KEY = 'sk-server-' + 'b'.repeat(32);
    try {
      const r = await POST(new Request('http://x/fn', { method: 'POST', body: JSON.stringify({ prompt: 'a bouncing ball' }) }));
      expect(r.status).toBe(401);
    } finally {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it('calls OpenAI with the user\'s key and explains a rejected key', async () => {
    const seen = [];
    vi.stubGlobal('fetch', async (url, init = {}) => {
      seen.push(new Headers(init.headers).get('authorization'));
      return new Response(JSON.stringify({ error: { message: 'Incorrect API key provided', type: 'invalid_request_error', code: 'invalid_api_key' } }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    });
    const r = await handler(new Request('http://x/fn', { method: 'POST', headers: { 'X-OpenAI-Key': KEY }, body: JSON.stringify({ prompt: 'a bouncing ball' }) }));
    const text = await r.text();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((h) => h === `Bearer ${KEY}`)).toBe(true);
    expect(text).toMatch(/OpenAI rejected your API key/);
  });
});

describe('video agent client helpers (upstream template code)', () => {
  it('strips fences and keeps the component code', () => {
    const fenced = '```tsx\nimport { AbsoluteFill } from "remotion";\n\nexport const MyAnimation = () => {\n  return <AbsoluteFill />;\n};\n```';
    const code = extractComponentCode(stripMarkdownFences(fenced));
    expect(code.startsWith('import')).toBe(true);
    expect(code.trim().endsWith('};')).toBe(true);
    expect(code).not.toContain('```');
  });

  it('ships the template examples used as skills', () => {
    expect(examples.length).toBeGreaterThanOrEqual(9);
    for (const e of examples) {
      expect(e.code).toMatch(/export const \w+ = \(\) =>/);
      expect(e.durationInFrames).toBeGreaterThan(0);
    }
  });
});
