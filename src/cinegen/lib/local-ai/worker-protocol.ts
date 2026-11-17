// [remix] Port I1: messages between the main thread and local-ai.worker.js.
import type { Backend, ModelKind } from './catalog';
import type { RawWhisperWord } from './whisper-words';

export interface WorkerModelRef { id: string; kind: ModelKind; repo: string; backend: Backend }

export type WorkerRequest =
  | { type: 'prepare'; id: number; model: WorkerModelRef }
  | { type: 'asr'; id: number; model: WorkerModelRef; audio: Float32Array; language?: string; batchSize: number; multilingual: boolean }
  | { type: 'embed-images'; id: number; model: WorkerModelRef; blobs: Blob[] }
  | { type: 'embed-text'; id: number; model: WorkerModelRef; texts: string[] }
  | { type: 'caption'; id: number; model: WorkerModelRef; blob: Blob; prompt: string };

export type WorkerResponse =
  | { type: 'progress'; id: number; loaded: number; total: number }
  | { type: 'prepared'; id: number; backend: Backend }
  | { type: 'asr-result'; id: number; text: string; chunks: RawWhisperWord[]; backend: Backend }
  | { type: 'vectors'; id: number; vectors: Float32Array[]; dim: number }
  | { type: 'caption-result'; id: number; text: string }
  | { type: 'error'; id: number; message: string };
