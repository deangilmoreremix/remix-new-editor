// [remix] Port I1: local transcription -> CineGen words / segments / Remotion captions. Pipeline (FreeCut-style): decode to 16 kHz mono -> plan 120 s spans with 2 s
// overlap -> one worker call per span (transformers.js windows each into 30 s and batches) -> resolve word timings -> de-duplicate the overlaps -> captions.
// Cancellation: AbortSignal terminates the worker mid-inference and is also checked between spans. Never downloads a model: the model must already be installed
// through the Local AI panel (consent + licence shown there), otherwise ConsentRequiredError.
import { modelById, type ModelEntry } from './catalog';
import { ConsentRequiredError } from './consent';
import type { ModelManager } from './manager';
import { wordsToCaptions, wordsToSegments, wordsToText, type RemotionCaption, type TranscriptSegment } from './transcript';
import { OverlapDeduper, SAMPLE_RATE, planSpans, resolveWhisperWordTimings, type TranscriptWord } from './whisper-words';
import { abortError, refOf, type LocalAiClient } from './worker-client';
import type { WorkerResponse } from './worker-protocol';

export interface TranscribeProgress { stage: 'decode' | 'transcribe'; progress: number }
export interface TranscribeOptions {
  modelId?: string; language?: string; fromSec?: number; toSec?: number;
  signal?: AbortSignal; onProgress?: (p: TranscribeProgress) => void;
  /** test seam / custom decode */
  decode?: (src: string, o: { fromSec: number; toSec: number; signal?: AbortSignal }) => Promise<Float32Array>;
  spanSec?: number; overlapSec?: number;
}
export interface TranscribeResult {
  words: TranscriptWord[]; text: string; segments: TranscriptSegment[]; captions: RemotionCaption[];
  /** language requested, or 'en' for English-only models; null when Whisper auto-detected it (transformers.js does not expose the detected code) */
  language: string | null; modelId: string; backend: 'webgpu' | 'wasm'; durationSec: number;
}

/** Best installed model: whisper-base when WebGPU is present, else whisper-tiny; falls back to any installed ASR model. */
export function pickInstalledAsr(manager: ModelManager, language?: string, preferGpu = true): ModelEntry | null {
  const order = language && language !== 'en' && language !== 'auto' ? ['whisper-base', 'whisper-tiny'] : preferGpu ? ['whisper-base', 'whisper-tiny', 'whisper-tiny-en'] : ['whisper-tiny', 'whisper-tiny-en', 'whisper-base'];
  for (const id of order) if (manager.isInstalled(id)) return modelById(id) ?? null;
  return null;
}

export async function transcribeLocal(src: string, manager: ModelManager, client: LocalAiClient, o: TranscribeOptions = {}): Promise<TranscribeResult> {
  const model = o.modelId ? modelById(o.modelId) : pickInstalledAsr(manager, o.language);
  if (!model || model.kind !== 'asr') throw new ConsentRequiredError(o.modelId ?? 'whisper-base', 'No speech model is installed. Open Media tools > Local AI and download one (licence and size are shown there).');
  manager.requireInstalled(model.id);
  if (model.languages === 'en' && o.language && !/^en/i.test(o.language) && o.language !== 'auto') throw new Error(`${model.name} is English only; pick a multilingual Whisper model for "${o.language}".`);
  const backend = manager.state(model.id)?.backend ?? 'wasm';
  const fromSec = o.fromSec ?? 0; const toSec = o.toSec ?? Infinity;
  o.onProgress?.({ stage: 'decode', progress: 0 });
  const decode = o.decode ?? (async (s, d) => (await import('../../../lib/editor/remotion/transcribe.js')).decodeAudio(s, d));
  const audio = await decode(src, { fromSec, toSec, signal: o.signal });
  if (o.signal?.aborted) throw abortError('Transcription cancelled');
  if (!audio.length) throw new Error('The clip has no audio to transcribe');
  const spans = planSpans(audio.length, o.spanSec, o.overlapSec);
  const dedupe = new OverlapDeduper();
  const words: TranscriptWord[] = [];
  let usedBackend: 'webgpu' | 'wasm' = backend;
  const batchSize = model.id === 'whisper-base' || model.id.startsWith('whisper-tiny') ? 8 : 4;
  for (let i = 0; i < spans.length; i++) {
    if (o.signal?.aborted) throw abortError('Transcription cancelled');
    const sp = spans[i];
    o.onProgress?.({ stage: 'transcribe', progress: sp.startSample / audio.length });
    const slice = audio.slice(sp.startSample, sp.endSample); // copy: the buffer is transferred to the worker
    const res = await client.request<Extract<WorkerResponse, { type: 'asr-result' }>>(
      { type: 'asr', model: refOf(model, backend), audio: slice, language: o.language, batchSize, multilingual: model.languages === 'multilingual' }, { signal: o.signal, transfer: [slice.buffer] });
    usedBackend = res.backend;
    words.push(...dedupe.filter(resolveWhisperWordTimings(res.chunks, sp.startSec, (sp.endSample - sp.startSample) / SAMPLE_RATE)));
  }
  o.onProgress?.({ stage: 'transcribe', progress: 1 });
  words.sort((a, b) => a.start - b.start);
  const language = o.language && o.language !== 'auto' ? o.language : model.languages === 'en' ? 'en' : null;
  return { words, text: wordsToText(words), segments: wordsToSegments(words), captions: wordsToCaptions(words), language, modelId: model.id, backend: usedBackend, durationSec: audio.length / SAMPLE_RATE };
}
