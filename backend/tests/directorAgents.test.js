import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../server.js';

// The 11 Director agents that used to fail ("Unsupported tool" / "Unsupported agent").
// OpenAI is mocked at the fetch layer; supertest talks to the app over plain HTTP, not fetch.
const realFetch = global.fetch;
const calls = [];
beforeAll(() => {
  global.fetch = jest.fn(async (url, init) => {
    calls.push(String(url));
    if (String(url).includes('/v1/responses')) {
      const body = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: `{"echo":${JSON.stringify(body.input.slice(0, 40))},"title":"T","narration":"Line one.\\nLine two.","voiceover":"Hello","story":"Once upon a time","topText":"TOP","bottomText":"BOTTOM"}` }] }] }), text: async () => '' };
    }
    if (String(url).includes('/v1/audio/speech')) {
      return { ok: true, status: 200, headers: { get: () => 'audio/mpeg' }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer, text: async () => '' };
    }
    return realFetch(url, init);
  });
});
afterAll(() => { global.fetch = realFetch; });

async function run(tool, extra = {}) {
  const start = await request(app).post('/videoagent/process').send({ action: 'process-tool', tool, apiKey: 'sk-test', prompt: 'A short brief', ...extra });
  expect(start.status).toBe(200);
  for (let i = 0; i < 60; i++) {
    const r = await request(app).get(`/videoagent/job/${start.body.jobId}`);
    if (r.body.status === 'completed' || r.body.status === 'failed') { if (r.body.status === 'failed') console.log('FAILED', JSON.stringify(r.body)); return r.body; }
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error('timeout');
}

describe('Director agents that previously had no handler', () => {
  test('meme completes through process-tool', async () => {
    const job = await run('meme');
    expect(job.status).toBe('completed');
    expect(job.agent).toBe('meme');
    expect(job.meme.topText).toBe('TOP');
  });

  test.each(['trailer-narration', 'faceless-video', 'kids-storyteller'])('%s returns a plan and narration audio', async (tool) => {
    const job = await run(tool);
    expect(job.status).toBe('completed');
    expect(job.agent).toBe(tool);
    expect(job.plan).toBeTruthy();
    expect(job.audioUrl).toMatch(/\.mp3$/);
    expect(job.spokenText.length).toBeGreaterThan(0);
  });

  test.each(['ai-ad-films', 'tiktok-lyric', 'year-in-frames', 'dynamic-ads', 'intro-outro', 'brand-elements'])('%s returns a plan', async (tool) => {
    const job = await run(tool, { lyrics: 'la la la' });
    expect(job.status).toBe('completed');
    expect(job.agent).toBe(tool);
    expect(job.plan).toBeTruthy();
    expect(job.audioUrl).toBeUndefined();
  });

  test('fails clearly without an OpenAI key', async () => {
    const saved = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
    const job = await run('dynamic-ads', { apiKey: '' });
    process.env.OPENAI_API_KEY = saved ?? '';
    if (saved === undefined) delete process.env.OPENAI_API_KEY;
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/OpenAI/);
  });
});

describe('text outputs are written, not copied as a path (meme card, SRT)', () => {
  test('subtitle stores an .srt file', async () => {
    const job = await run('subtitle');
    expect(job.status).toBe('completed');
    expect(job.srtUrl).toMatch(/\.srt$/);
  });
});
