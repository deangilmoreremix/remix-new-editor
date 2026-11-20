// Free, in-browser Whisper for the web build.
//
// The desktop app runs Faster-Whisper / WhisperX locally; the web server can
// only do that through a separate worker (CINEGEN_TRANSCRIPTION_WORKER_URL).
// Without one, those "local" engines run here instead, in the user's browser,
// with Transformers.js — no API key and no server compute. Results use the same
// start/get/onProgress shape as the server engines.

import type { WhisperWorkerMessage, WhisperWorkerRequest } from './browser-whisper.worker';

type Engine = 'faster-whisper-local' | 'whisperx-local' | 'whisper-cloud';

interface Word { word: string; start: number; end: number }
interface Segment { text: string; start: number; end: number; speaker: null; words: Word[] }

export interface BrowserTranscriptionJob {
  status: 'pending' | 'running' | 'done' | 'error';
  fullText: string;
  segments: Segment[];
  language: string;
  engine: Engine;
  error?: string;
}

type ProgressEvent = {
  jobId: string;
  assetId?: string;
  engine: Engine;
  type: 'status' | 'progress' | 'done' | 'error';
  message?: string;
  text?: string;
  segments?: Segment[];
  language?: string;
  error?: string;
};

const SAMPLE_RATE = 16_000;
// `large` (≈1.5 GB) is not practical to download into a browser tab, so every
// requested size maps to a browser-sized model with word timestamps.
const BROWSER_MODELS: Record<string, string> = {
  tiny: 'onnx-community/whisper-tiny_timestamped',
  base: 'onnx-community/whisper-base_timestamped',
};
const DEFAULT_BROWSER_MODEL = BROWSER_MODELS.base;

const jobs = new Map<string, BrowserTranscriptionJob>();
const listeners = new Set<(event: ProgressEvent) => void>();
let worker: Worker | null = null;
const workerCallbacks = new Map<string, (message: WhisperWorkerMessage) => void>();

function emit(event: ProgressEvent) {
  for (const listener of listeners) {
    try { listener(event); } catch (error) { console.error('[cinegen] transcription listener failed', error); }
  }
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./browser-whisper.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WhisperWorkerMessage>) => workerCallbacks.get(event.data.id)?.(event.data);
  }
  return worker;
}

/** Decode any audio/video the browser can play into 16 kHz mono samples. */
async function decodeAudio(url: string): Promise<Float32Array> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Could not read the media file (${response.status}).`);
  const bytes = await response.arrayBuffer();
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    const decoded = await context.decodeAudioData(bytes);
    if (decoded.numberOfChannels === 1) return decoded.getChannelData(0);
    const mono = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const data = decoded.getChannelData(channel);
      for (let i = 0; i < data.length; i += 1) mono[i] += data[i] / decoded.numberOfChannels;
    }
    return mono;
  } catch {
    throw new Error('This file has no audio track the browser can decode.');
  } finally {
    void context.close();
  }
}

/** Group word chunks into sentence-like segments the editor can display and cut. */
export function wordsToSegments(chunks: Array<{ text: string; timestamp: [number, number | null] }>): Segment[] {
  const segments: Segment[] = [];
  let current: Word[] = [];
  const flush = () => {
    if (current.length === 0) return;
    segments.push({
      text: current.map((w) => w.word).join('').trim(),
      start: current[0].start,
      end: current[current.length - 1].end,
      speaker: null,
      words: current.map((w) => ({ ...w, word: w.word.trim() })),
    });
    current = [];
  };
  for (const chunk of chunks) {
    const start = chunk.timestamp[0] ?? 0;
    const end = chunk.timestamp[1] ?? start;
    const previous = current[current.length - 1];
    if (previous && start - previous.end > 1) flush();
    current.push({ word: chunk.text, start, end });
    if (/[.!?]["')\]]?$/.test(chunk.text.trim()) || current.length >= 40) flush();
  }
  flush();
  return segments;
}

export function startBrowserTranscription(params: {
  assetId: string;
  filePath: string;
  model?: string;
  language?: string;
  engine?: Engine;
}): { jobId: string } {
  const jobId = `browser-${crypto.randomUUID()}`;
  const engine = params.engine ?? 'faster-whisper-local';
  const job: BrowserTranscriptionJob = { status: 'pending', fullText: '', segments: [], language: params.language ?? 'auto', engine };
  jobs.set(jobId, job);
  const progress = (message: string) => {
    job.status = 'running';
    emit({ jobId, assetId: params.assetId, engine, type: 'status', message });
  };
  const fail = (error: string) => {
    job.status = 'error';
    job.error = error;
    workerCallbacks.delete(jobId);
    emit({ jobId, assetId: params.assetId, engine, type: 'error', error });
  };

  // Let the caller store the jobId before the first event arrives.
  setTimeout(async () => {
    try {
      progress('Decoding audio');
      const audio = await decodeAudio(params.filePath);
      const model = BROWSER_MODELS[params.model ?? ''] ?? DEFAULT_BROWSER_MODEL;
      workerCallbacks.set(jobId, (message) => {
        if (message.type === 'status') progress(message.message);
        else if (message.type === 'error') fail(message.error);
        else {
          workerCallbacks.delete(jobId);
          job.status = 'done';
          job.fullText = message.text;
          job.segments = wordsToSegments(message.chunks);
          emit({ jobId, assetId: params.assetId, engine, type: 'done', text: job.fullText, segments: job.segments, language: job.language });
        }
      });
      const request: WhisperWorkerRequest = { id: jobId, audio, model, language: params.language };
      getWorker().postMessage(request, [audio.buffer]);
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
  }, 0);

  return { jobId };
}

export function isBrowserTranscriptionJob(jobId: string): boolean {
  return jobs.has(jobId);
}

export function getBrowserTranscription(jobId: string): BrowserTranscriptionJob | null {
  return jobs.get(jobId) ?? null;
}

export function onBrowserTranscriptionProgress(callback: (event: ProgressEvent) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
