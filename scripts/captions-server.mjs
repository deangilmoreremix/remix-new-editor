#!/usr/bin/env node
/**
 * A tiny localhost server so the Template Generator can use the native Whisper.cpp (`@remotion/install-whisper-cpp`) on your computer.
 *
 *   node scripts/captions-server.mjs [--port=8787] [--model=base]
 *
 * It listens on 127.0.0.1 only. The generator probes GET /health and, when it answers, offers "Whisper.cpp (local server)" in the
 * Styled captions panel. POST /transcribe?model=base&language=auto with a 16 kHz mono WAV body returns { ok, captions: [{ text, startMs, endMs }] }.
 * Nothing leaves your computer. Only pages on the allowed origins may call it (CORS), and one listen runs at a time.
 */
import { createServer } from 'node:http';
import { writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS, transcribeWav } from './transcribe-whisper-cpp.mjs';

export const MAX_BODY = 200 * 1024 * 1024;   // about 100 minutes of 16 kHz mono 16-bit audio
export const DEFAULT_ORIGINS = [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/, /^https:\/\/([a-z0-9-]+\.)*smartvid\.app$/, /^https:\/\/[a-z0-9-]+--smartvideo2\.netlify\.app$/, /^https:\/\/smartvideo2\.netlify\.app$/];

export const originAllowed = (origin, list = DEFAULT_ORIGINS) => !!origin && list.some((r) => r.test(origin));

/** `{ ok, status, body }` for a request; `transcribe(wavPath, opts)` is injectable so the routing can be tested without Whisper. */
export function createHandler({ transcribe = transcribeWav, origins = DEFAULT_ORIGINS } = {}) {
  let busy = false;
  const cors = (origin) => (originAllowed(origin, origins) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Private-Network': 'true', Vary: 'Origin' } : {});
  return async function handle(req, res) {
    const origin = req.headers.origin;
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', ...cors(origin), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(JSON.stringify(body)); };
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'OPTIONS') return send(204, {});
    if (origin && !originAllowed(origin, origins)) return send(403, { ok: false, error: 'This page is not allowed to use the local Whisper.cpp server.' });
    if (req.method === 'GET' && url.pathname === '/health') return send(200, { ok: true, engine: 'whisper.cpp', models: MODELS });
    if (req.method === 'POST' && url.pathname === '/transcribe') {
      if (busy) return send(429, { ok: false, error: 'The local Whisper.cpp server is already listening to something. Try again in a moment.' });
      const model = url.searchParams.get('model') || 'base';
      if (!MODELS.includes(model)) return send(400, { ok: false, error: `Unknown model "${model}".` });
      const chunks = []; let size = 0;
      for await (const c of req) { size += c.length; if (size > MAX_BODY) return send(413, { ok: false, error: 'That audio is too long.' }); chunks.push(c); }
      const body = Buffer.concat(chunks);
      if (body.length < 100 || body.toString('ascii', 0, 4) !== 'RIFF') return send(400, { ok: false, error: 'Send a 16 kHz mono WAV file as the request body.' });
      busy = true;
      const wav = join(tmpdir(), `captions-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.wav`);
      try {
        await writeFile(wav, body);
        const words = await transcribe(wav, { model, language: url.searchParams.get('language') || 'auto' });
        return send(200, { ok: true, captions: words.map((w) => ({ text: w.text, startMs: w.start, endMs: w.end })) });
      } catch (err) { return send(500, { ok: false, error: err?.message || 'Whisper.cpp failed.' }); } finally { busy = false; await rm(wav, { force: true }); }
    }
    return send(404, { ok: false, error: 'Not found' });
  };
}

function main() {
  const args = process.argv.slice(2);
  const flag = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || d;
  const port = Number(flag('port', '8787'));
  createServer(createHandler()).listen(port, '127.0.0.1', () => console.log(`Local Whisper.cpp captions server on http://127.0.0.1:${port} (Ctrl+C to stop). The first listen installs Whisper.cpp and the model into ./.whisper.`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
