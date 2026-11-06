import { describe, it, expect, vi } from 'vitest';

vi.mock('../_shared/clerkAuth.js', () => ({ withClerkAuth: (fn) => fn }));
const { handle, buildSession, sanitizeTools } = await import('../timeline-voice.js');
const KEY = 'sk-test0123456789abcdefghijkl';

describe('timeline-voice (Realtime client secret, user key)', () => {
  it('needs the user key', async () => {
    const f = vi.fn();
    expect((await handle({}, { fetchImpl: f })).statusCode).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });
  it('mints a secret with the user key and passes the editor tools through', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ value: 'ek_abc', expires_at: 1234 }), { status: 200 }));
    const r = await handle({ voice: 'cedar', tools: [{ name: 'get_timeline', description: 'x', parameters: { type: 'object', properties: {} } }, { name: 'bad name!' }] }, { key: KEY, fetchImpl: f });
    expect(JSON.parse(r.body)).toMatchObject({ ok: true, secret: 'ek_abc', expiresAt: 1234 });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/realtime/client_secrets');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    const session = JSON.parse(init.body).session;
    expect(session).toMatchObject({ type: 'realtime', audio: { output: { voice: 'cedar' } } });
    expect(session.tools.map((t) => t.name)).toEqual(['get_timeline']);
    expect(JSON.stringify(r)).not.toContain(KEY); // the key never goes back to the browser
  });
  it('falls back to a safe voice, drops bad tools and explains key problems', async () => {
    expect(buildSession({ voice: 'evil' }).audio.output.voice).toBe('marin');
    expect(sanitizeTools([{ name: 'ok_1' }, null, { name: '' }, { name: 'x'.repeat(80) }])).toHaveLength(1);
    const bad = await handle({}, { key: KEY, fetchImpl: async () => new Response('{}', { status: 401 }) });
    expect(JSON.parse(bad.body).error.code).toBe('bad_key');
  });
});
