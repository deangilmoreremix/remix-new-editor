// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { runChecks, looksLikeMp3, summarize, dataUrlToBuffer } from '../../scripts/verify-template-generator-keys.mjs';

const ok = (body) => ({ statusCode: 200, body: JSON.stringify(body) });
const mp3 = Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0]), Buffer.alloc(4000, 1)]);

describe('verify-template-generator-keys', () => {
  it('recognises a real-looking mp3 and rejects junk', () => {
    expect(looksLikeMp3(mp3)).toBe(true);
    expect(looksLikeMp3(Buffer.from('{"error":"nope"}'))).toBe(false);
    expect(looksLikeMp3(Buffer.alloc(100))).toBe(false);
    expect(dataUrlToBuffer(`data:audio/mpeg;base64,${mp3.toString('base64')}`).equals(mp3)).toBe(true);
  });

  it('skips what has no key, passes what works, and fails (exit code 1) what does not', async () => {
    const handlers = {
      pexels: async (e) => (e.path.includes('videos') ? ok({ videos: [{ video_files: [{}] }] }) : { statusCode: 503, body: '{}' }),
      pixabay: async () => ok({ hits: [{}] }),
      audio: async () => ok({ ok: true, status: 'done', url: `data:audio/mpeg;base64,${mp3.toString('base64')}` }),
    };
    const none = await runChecks({ env: {}, handlers });
    expect(none.every((r) => r.status === 'SKIP')).toBe(true);
    const some = await runChecks({ env: { PEXELS_API_KEY: 'k', PIXABAY_API_KEY: 'k', OPENAI_API_KEY: 'k' }, handlers });
    const by = Object.fromEntries(some.map((r) => [r.name, r.status]));
    expect(by['Pexels videos']).toBe('PASS'); expect(by['Pexels photos']).toBe('FAIL');
    expect(by['Pixabay videos']).toBe('PASS'); expect(by['OpenAI voiceover']).toBe('PASS');
    const s = summarize(some);
    expect(s.failed).toBe(1); expect(s.text).toContain('FAIL  Pexels photos'); expect(s.text).not.toContain('"k"');
  });

  it('a voiceover that is not an mp3, or an error reply, is a failure', async () => {
    const handlers = { pexels: async () => ok({}), pixabay: async () => ok({}), audio: async () => ({ statusCode: 401, body: JSON.stringify({ ok: false, error: { code: 'bad_key' } }) }) };
    const r = await runChecks({ env: { OPENAI_API_KEY: 'k' }, handlers });
    expect(r.find((x) => x.name === 'OpenAI voiceover')).toMatchObject({ status: 'FAIL', detail: expect.stringContaining('bad_key') });
  });
});
