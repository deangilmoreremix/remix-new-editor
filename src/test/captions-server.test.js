import { describe, it, expect, vi, afterEach } from 'vitest';
import { createServer, request } from 'node:http';
import { createHandler, originAllowed, MAX_BODY } from '../../scripts/captions-server.mjs';
import { captionsToWords, MODELS } from '../../scripts/transcribe-whisper-cpp.mjs';

const wav = () => { const b = Buffer.alloc(200); b.write('RIFF', 0, 'ascii'); b.write('WAVE', 8, 'ascii'); return b; };

/** The suite stubs the global fetch, so talk to the server with Node's own client. Resolves a fetch-like { status, headers, json() }. */
function fetch(url, { method = 'GET', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => { const text = Buffer.concat(chunks).toString(); resolve({ status: res.statusCode, headers: { get: (n) => res.headers[n.toLowerCase()] ?? null }, json: async () => JSON.parse(text) }); });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function serve(opts) {
  const server = createServer(createHandler(opts));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((r) => server.close(r)) };
}

describe('local Whisper.cpp captions server (@remotion/install-whisper-cpp)', () => {
  let s;
  afterEach(async () => { await s?.close(); s = null; });

  it('answers /health for pages on allowed origins, and refuses other sites', async () => {
    s = await serve({ transcribe: vi.fn() });
    const ok = await fetch(`${s.base}/health`, { headers: { Origin: 'https://smartvid.app' } });
    expect(await ok.json()).toMatchObject({ ok: true, engine: 'whisper.cpp', models: MODELS });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://smartvid.app');
    const bad = await fetch(`${s.base}/health`, { headers: { Origin: 'https://evil.example' } });
    expect(bad.status).toBe(403);
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
    expect(originAllowed('http://localhost:5173')).toBe(true);
    expect(originAllowed('https://deploy-preview-117--smartvideo2.netlify.app')).toBe(true);
    expect(originAllowed('https://smartvid.app.evil.example')).toBe(false);
    expect(originAllowed(undefined)).toBe(false);
  });

  it('transcribes a WAV body with the model and language, and returns Remotion-style captions', async () => {
    const transcribe = vi.fn(async () => [{ text: 'Hola', start: 0, end: 300 }, { text: 'mundo', start: 320, end: 800 }]);
    s = await serve({ transcribe });
    const res = await fetch(`${s.base}/transcribe?model=small&language=es`, { method: 'POST', body: wav(), headers: { Origin: 'http://localhost:5173' } });
    expect(await res.json()).toEqual({ ok: true, captions: [{ text: 'Hola', startMs: 0, endMs: 300 }, { text: 'mundo', startMs: 320, endMs: 800 }] });
    expect(transcribe.mock.calls[0][1]).toEqual({ model: 'small', language: 'es' });
  });

  it('rejects an unknown model, a body that is not a WAV, and a second listen while one runs', async () => {
    let release;
    const transcribe = vi.fn(() => new Promise((r) => { release = () => r([{ text: 'a', start: 0, end: 100 }]); }));
    s = await serve({ transcribe });
    expect((await fetch(`${s.base}/transcribe?model=nope`, { method: 'POST', body: wav() })).status).toBe(400);
    expect((await fetch(`${s.base}/transcribe`, { method: 'POST', body: Buffer.from('not audio at all, just some text'.repeat(10)) })).status).toBe(400);
    const first = fetch(`${s.base}/transcribe`, { method: 'POST', body: wav() });
    await vi.waitFor(() => expect(transcribe).toHaveBeenCalled());
    expect((await fetch(`${s.base}/transcribe`, { method: 'POST', body: wav() })).status).toBe(429);
    release();
    expect((await first).status).toBe(200);
    expect((await fetch(`${s.base}/nothing`)).status).toBe(404);
    expect(MAX_BODY).toBeGreaterThan(50 * 1024 * 1024);
  });

  it('a Whisper.cpp failure is a clear message, and the server is free for the next listen', async () => {
    const transcribe = vi.fn().mockRejectedValueOnce(new Error('ffmpeg is needed')).mockResolvedValueOnce([{ text: 'ok', start: 0, end: 100 }]);
    s = await serve({ transcribe });
    const bad = await fetch(`${s.base}/transcribe`, { method: 'POST', body: wav() });
    expect(bad.status).toBe(500); expect((await bad.json()).error).toBe('ffmpeg is needed');
    expect((await fetch(`${s.base}/transcribe`, { method: 'POST', body: wav() })).status).toBe(200);
  });

  it('the script turns Remotion captions into clean words in ms', () => {
    expect(captionsToWords([{ text: ' b', startMs: 500, endMs: 900 }, { text: ' a', startMs: 0, endMs: 700 }, { text: ' ', startMs: 1, endMs: 2 }])).toEqual([{ text: 'a', start: 0, end: 500 }, { text: 'b', start: 500, end: 900 }]);
  });
});
