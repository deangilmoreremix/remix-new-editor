#!/usr/bin/env node
/**
 * Native Whisper.cpp captions, through `@remotion/install-whisper-cpp`.
 *
 *   node scripts/transcribe-whisper-cpp.mjs <audio-or-video-file> [--model=base] [--language=auto] [--out=captions.json]
 *
 * First run installs Whisper.cpp and downloads the model into ./.whisper (git-ignored). The input is converted to 16 kHz mono WAV with
 * ffmpeg, then listened to with word-level timestamps. Prints / writes `[{ text, start, end }]` in milliseconds, the same shape the
 * Template Generator's other caption engines return. This runs on a computer you control: a native program cannot run in a browser
 * tab or on Netlify (the browser engines are Whisper WebGPU and Whisper.cpp WASM).
 */
import { spawn } from 'node:child_process';
import { writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WHISPER_CPP_VERSION = '1.5.5';
export const WHISPER_DIR = resolve(process.env.WHISPER_DIR || '.whisper');
export const MODELS = ['tiny', 'tiny.en', 'base', 'base.en', 'small', 'small.en', 'medium', 'medium.en', 'large-v3-turbo'];

/** Remotion captions → the generator's words (ms, trimmed, non-overlapping). */
export function captionsToWords(captions = []) {
  const out = [];
  for (const c of captions) {
    const text = String(c?.text ?? '').trim();
    if (!text || !Number.isFinite(Number(c?.startMs))) continue;
    const start = Math.max(0, Math.round(Number(c.startMs)));
    out.push({ text, start, end: Math.max(start + 40, Math.round(Number(c.endMs) || start + 300)) });
  }
  out.sort((a, b) => a.start - b.start);
  for (let i = 0; i < out.length - 1; i += 1) if (out[i].end > out[i + 1].start) out[i].end = Math.max(out[i].start + 40, out[i + 1].start);
  return out;
}

/** Any audio/video file → 16 kHz mono WAV (what Whisper.cpp reads). */
export function toWav(input, output) {
  return new Promise((ok, fail) => {
    const p = spawn('ffmpeg', ['-y', '-i', input, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', output], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', () => fail(new Error('ffmpeg is needed to read this file (install ffmpeg and try again).')));
    p.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg could not read the file: ${err.split('\n').slice(-3).join(' ').trim()}`))));
  });
}

/** Install Whisper.cpp and the model once (cached in WHISPER_DIR). */
export async function ensureWhisper({ model = 'base', onLog = () => {} } = {}) {
  const { installWhisperCpp, downloadWhisperModel } = await import('@remotion/install-whisper-cpp');
  // no mkdir here: the installer clones into the folder and refuses one that already exists without the built program
  const a = await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_CPP_VERSION, printOutput: false });
  onLog(a.alreadyExisted ? 'Whisper.cpp is installed.' : 'Whisper.cpp installed.');
  const b = await downloadWhisperModel({ model, folder: WHISPER_DIR, printOutput: false });
  onLog(b.alreadyExisted ? `Model "${model}" is ready.` : `Model "${model}" downloaded.`);
}

/** Listen to a 16 kHz mono WAV file; resolves the generator's words. */
export async function transcribeWav(wavPath, { model = 'base', language = 'auto', signal, onProgress } = {}) {
  if (!MODELS.includes(model)) throw new Error(`Unknown model "${model}". Use one of: ${MODELS.join(', ')}.`);
  const { transcribe, toCaptions } = await import('@remotion/install-whisper-cpp');
  await ensureWhisper({ model });
  const json = await transcribe({
    inputPath: wavPath, whisperPath: WHISPER_DIR, whisperCppVersion: WHISPER_CPP_VERSION, model, modelFolder: WHISPER_DIR,
    tokenLevelTimestamps: true, splitOnWord: true, language: language && language !== 'auto' ? language : null, signal, onProgress,
  });
  return captionsToWords(toCaptions({ whisperCppOutput: json }).captions);
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || d;
  const input = args.find((a) => !a.startsWith('--'));
  if (!input || !existsSync(input)) { console.error('Usage: node scripts/transcribe-whisper-cpp.mjs <audio-or-video-file> [--model=base] [--language=auto] [--out=captions.json]'); process.exit(2); }
  const wav = join(tmpdir(), `whisper-${Date.now()}.wav`);
  try {
    await toWav(input, wav);
    const words = await transcribeWav(wav, { model: flag('model', 'base'), language: flag('language', 'auto'), onProgress: (p) => process.stderr.write(`\rListening… ${Math.round(p * 100)}%`) });
    process.stderr.write('\n');
    const out = flag('out', '');
    if (out) { await writeFile(out, JSON.stringify(words, null, 2)); console.log(`${words.length} words → ${out}`); } else console.log(JSON.stringify(words));
  } finally { await rm(wav, { force: true }); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main().catch((e) => { console.error(e.message); process.exit(1); });
