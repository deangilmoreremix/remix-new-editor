// [remix] Real browser implementations of the parts of CineGen's `window.electronAPI` this editor needs.
// Registered into the shim (electron-shim.ts) so CineGen's own code paths run unchanged.
import { registerElectronApi } from './electron-shim';
import { webMediaApi } from './web-media';
import { uploadFileToStorage } from '../../lib/supabase.js';

import { responsesChat } from './llm-responses';
import { authHeader } from './llm-responses';
import { openaiKeyHeader } from '../../lib/openaiKeyHeader.js';
export { responsesChat };
import { clipFxInstances } from '@cinegen/lib/occ/clip-fx';
import { userLutTextSync } from '@cinegen/lib/occ/user-luts';
// [remix] OpenChatCut effects + LUT of an export clip, as plain {id, overrides} for the composition's GL layer.
const occFxList = (c: { fx?: Array<{ id: string; props: Record<string, number | number[]>; enabled?: boolean }>; lut?: { id: string; intensity: number } }) =>
  clipFxInstances(c as never).map(({ def, overrides }) => ({
    id: def.id, overrides,
    // the sandboxed export runner has no IndexedDB: user .cube LUTs travel with the render
    ...(def.id.startsWith('user:lut-') ? { name: def.name, cubeText: userLutTextSync(def.id) } : {}),
  }));

type TranscriptionEvent = { type: 'status' | 'progress' | 'done' | 'error'; jobId: string; assetId: string; engine?: string; stage?: string; message?: string; text?: string; segments?: unknown[]; language?: string; error?: string };
const transcriptionListeners = new Set<(e: TranscriptionEvent) => void>();
const emitTranscription = (e: TranscriptionEvent) => transcriptionListeners.forEach((fn) => fn(e));

/** Whisper words -> CineGen transcript segments (sentence-ish lines with word timings). */
function toSegments(words: Array<{ text: string; start: number; end: number }>) {
  const segments: Array<{ start: number; end: number; text: string; words: Array<{ word: string; start: number; end: number }> }> = [];
  let cur: (typeof segments)[number] | null = null;
  for (const w of words) {
    const gap = cur ? w.start - cur.end : 0;
    if (!cur || gap > 0.8 || cur.words.length >= 18 || /[.!?]$/.test(cur.text)) {
      cur = { start: w.start, end: w.end, text: w.text, words: [{ word: w.text, start: w.start, end: w.end }] };
      segments.push(cur);
    } else {
      cur.text += ` ${w.text}`;
      cur.end = w.end;
      cur.words.push({ word: w.text, start: w.start, end: w.end });
    }
  }
  return segments;
}

type ExportJobState = { id: string; status: 'queued' | 'rendering' | 'complete' | 'failed'; progress: number; preset: string; fps: number; outputUrl?: string; fileSize?: number; error?: string; createdAt: string; completedAt?: string };
const exportJobs = new Map<string, ExportJobState>();

const batchListeners = new Set<(e: unknown) => void>();

export function registerWebApi() {
  registerElectronApi('vision', {
    // CineGen's visual index: OpenAI vision on the user's key (adapters/main-process/vision.ts)
    indexAsset: async (p: unknown) => (await import('./main-process/vision')).analyzeAssetVisualSummary(p as never),
    detectObjects: async (p: unknown) => (await import('./main-process/vision')).detectObjectsInImage(p as never),
  });
  // [remix] Desktop-only Python runners (local SAM 3 server, local model runner): no browser equivalent.
  // The web editor's Cloud/main mask mode and the model nodes run on-device or on MuAPI/OpenAI instead.
  registerElectronApi('sam3', {
    start: async () => { throw new Error('The local SAM 3 server is desktop-only. Use the default mode: it masks on your device in the browser.'); },
  });
  registerElectronApi('localModel', {
    run: async () => { throw new Error('Local Python models are desktop-only. Pick the MuAPI or on-device version of this node.'); },
    readTranscript: async () => null,
  });
  registerElectronApi('acoustic', {
    analyzeAsset: async (p: unknown) => (await import('./main-process/acoustic')).analyzeAssetAcoustics(p as never),
  });
  registerElectronApi('sync', {
    // CineGen's audio sync, in the browser (adapters/main-process/audio-sync.ts)
    computeOffset: async (p: unknown) => {
      const a = p as { sourceFilePath: string; targetFilePath: string };
      return (await import('./main-process/audio-sync')).computeSyncOffset(a.sourceFilePath, a.targetFilePath);
    },
    batchMatch: async (p: unknown) => {
      const a = p as { videoAssets: Array<{ id: string; filePath: string; name: string }>; audioAssets: Array<{ id: string; filePath: string; name: string }> };
      return (await import('./main-process/audio-sync')).computeBatchMatch(a.videoAssets, a.audioAssets, '', '', '', (pr) => batchListeners.forEach((fn) => fn(pr)));
    },
    onBatchProgress: (cb: unknown) => { const fn = cb as (e: unknown) => void; batchListeners.add(fn); return () => batchListeners.delete(fn); },
  });
  registerElectronApi('music', {
    generatePrompt: async (p: unknown) => (await import('./main-process/music-prompt')).generateMusicPrompt(p as never),
  });
  registerElectronApi('prompts', {
    // CineGen's own message builder + edit applier; only the model call is local (OpenAI, user's key).
    rewrite: async (input: unknown) => {
      const { studioRewriteMessages, applyStudioPromptEdits } = await import('@cinegen/lib/studio/prompt-rewrite');
      const req = input as { text: string };
      const [system, user] = studioRewriteMessages(input as never);
      try {
        const r = await responsesChat({ system: system.content, user: user.content, json: true });
        return { status: 'complete', text: applyStudioPromptEdits(JSON.parse(r.message), req.text) };
      } catch (err) {
        return { status: 'error', error: err instanceof Error ? err.message : String(err) };
      }
    },
  });
  registerElectronApi('llm', {
    // Frame Chat / prompt enhancer (was the Gemini CLI): OpenAI vision on the user's key.
    geminiChat: async (p: unknown) => {
      const a = p as { userMessage: string; visualRefs?: Array<{ fileRef?: string; framePaths?: string[]; mediaType?: string }> };
      const { toVisionImage } = await import('./main-process/vision');
      const urls = (a.visualRefs ?? []).flatMap((r) => (r.mediaType === 'image' && r.fileRef ? [r.fileRef] : r.framePaths ?? []));
      const images = (await Promise.all(urls.slice(0, 6).map((u) => toVisionImage(u)))).filter((u): u is string => Boolean(u));
      const r = await responsesChat({ user: a.userMessage, images });
      return { message: r.message, sessionId: undefined };
    },
    // Assistant canvas attachments: a CORS-safe resized JPEG of an image the user already has.
    canvasImagePreview: async (source: unknown) => (await import('./main-process/vision')).toVisionImage(String(source), 1280),
  });
  registerElectronApi('llm', {
    // CineGen's cut workflow, run in the browser (src/cinegen/adapters/main-process/llm-chat.ts)
    runCutWorkflow: async (p: unknown) => (await import('./main-process/llm-chat')).runCutWorkflow(p as never),
  });
  for (const [ns, methods] of Object.entries(webMediaApi)) registerElectronApi(ns, methods as Record<string, (...a: unknown[]) => unknown>);
  registerElectronApi('export', {
    // Renders in the browser with the editor's Remotion web renderer (WebCodecs) — no FFmpeg, no server.
    start: async (p: unknown) => {
      const a = p as { preset: 'draft' | 'standard' | 'high'; fps: 24 | 30 | 60; clips: Array<{ inputPath: string; startTime: number; duration: number; trimStart: number; speed: number; volume: number; type: string; trackKind?: string; fx?: Array<{ id: string; props: Record<string, number | number[]>; enabled?: boolean }>; lut?: { id: string; intensity: number } }>; totalDuration: number };
      const quality = a.preset === 'draft' ? '720p' : a.preset === 'high' ? '4k' : '1080p';
      const job: ExportJobState = { id: `export-${Date.now().toString(36)}`, status: 'rendering', progress: 0, preset: a.preset, fps: a.fps, createdAt: new Date().toISOString() };
      exportJobs.set(job.id, job);
      void (async () => {
        try {
          const [{ timelineToComposition }, { exportModel, downloadBlob }] = await Promise.all([
            import('../../lib/editor/remotion/timelineToComposition.js'),
            import('../../lib/editor/remotion/exportClient.js'),
          ]);
          const item = (c: (typeof a.clips)[number], i: number) => ({
            id: `c${i}`, type: c.type === 'audio' ? 'audio' : c.type === 'image' ? 'image' : 'video', src: c.inputPath,
            start: c.startTime, end: c.startTime + c.duration, trimIn: c.trimStart, playbackRate: c.speed || 1, volume: c.volume ?? 1,
            // [remix] OpenChatCut effects / LUT → burned in by the composition's GL layer
            occFx: occFxList(c),
          });
          const state = {
            timelineSeconds: Math.max(1, a.totalDuration),
            tracks: [
              { id: 'v', type: 'video', items: a.clips.filter((c) => c.type !== 'audio' && c.trackKind !== 'audio').map(item) },
              { id: 'a', type: 'audio', items: a.clips.filter((c) => c.type === 'audio' || c.trackKind === 'audio').map((c, i) => item({ ...c, type: 'audio' }, 1000 + i)) },
            ],
          };
          const model = timelineToComposition(state, { fps: a.fps, quality });
          const blob = await exportModel(model, { container: 'mp4', quality, onProgress: (pr: number) => { job.progress = Math.round(pr * 100); } });
          job.outputUrl = URL.createObjectURL(blob);
          job.fileSize = blob.size;
          job.progress = 100;
          job.status = 'complete';
          job.completedAt = new Date().toISOString();
          downloadBlob(blob, 'cinegen-export.mp4');
        } catch (err) {
          job.status = 'failed';
          job.error = err instanceof Error ? err.message : String(err);
        }
      })();
      return { ...job };
    },
    poll: async (id: unknown) => {
      const job = exportJobs.get(String(id));
      if (!job) throw new Error('Unknown export');
      return { ...job };
    },
  });
  registerElectronApi('transcription', {
    // On-device Whisper (Transformers.js). The engine CineGen asks for (cloud / python) is ignored on the web.
    start: async (p: unknown) => {
      const a = p as { assetId: string; filePath: string };
      const jobId = `whisper-${Date.now().toString(36)}`;
      const base = { jobId, assetId: a.assetId, engine: 'whisper-web' };
      void (async () => {
        try {
          emitTranscription({ ...base, type: 'status', message: 'Loading speech model…' });
          // The editor's existing in-browser Whisper (Transformers.js) — one implementation, not two.
          const { transcribeInBrowser, WHISPER_MODELS } = await import('../../lib/editor/remotion/transcribe.js');
          const model = (navigator as Navigator & { gpu?: unknown }).gpu ? WHISPER_MODELS[0][0] : WHISPER_MODELS[1][0];
          const out = await transcribeInBrowser(a.filePath, {
            model,
            onProgress: (pr: { stage?: string; progress?: number }) => emitTranscription({ ...base, type: 'progress', message: `Transcribing ${Math.round((pr?.progress ?? 0) * 100)}%` }),
          });
          const words = (out.captions as Array<{ text: string; startMs: number; endMs: number }>).map((c) => ({ text: c.text, start: c.startMs / 1000, end: c.endMs / 1000 }));
          emitTranscription({ ...base, type: 'done', text: out.text, segments: toSegments(words), language: 'en' });
        } catch (err) {
          emitTranscription({ ...base, type: 'error', error: err instanceof Error ? err.message : String(err) });
        }
      })();
      return { jobId };
    },
    onProgress: (cb: unknown) => {
      const fn = cb as (e: TranscriptionEvent) => void;
      transcriptionListeners.add(fn);
      return () => transcriptionListeners.delete(fn);
    },
  });
  registerElectronApi('llm', {
    // CineGen's OpenAI path: { apiKey, model, systemPrompt, userMessage, imageUrls, jsonObject } -> { message, usage }
    openaiChat: async (p: unknown) => {
      const a = p as { systemPrompt?: string; userMessage: string; imageUrls?: string[]; jsonObject?: boolean };
      return responsesChat({ system: a.systemPrompt, user: a.userMessage, images: a.imageUrls, json: a.jsonObject !== false });
    },
    // LLM tab / skills chat: { apiKey, model, systemPrompt, messages, maxTokens, temperature } -> { message, usage }
    chat: async (p: unknown) => {
      const a = p as { systemPrompt?: string; messages: Array<{ role: string; content: string }>; userMessage?: string };
      const turns = (a.messages ?? []).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}:\n${m.content}`).join('\n\n');
      return responsesChat({ system: a.systemPrompt, user: turns || a.userMessage || '' });
    },
    // Voice Director: CineGen's session logic, run server-side so the key stays off the page.
    openaiRealtimeSession: async (p: unknown) => {
      const a = p as { sdp: string; voice?: string };
      const res = await fetch('/api/timeline-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...openaiKeyHeader() },
        body: JSON.stringify({ action: 'call', sdp: a.sdp, voice: a.voice }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error?.message || 'Add your OpenAI key in Settings to use Voice Director.');
      return { sdp: data.sdp as string };
    },
    // Detected CLIs (Claude Code / Codex / Gemini) are desktop-only.
    cliDetect: async () => ({ providers: [] }),
    localModels: async () => [],
  });
  registerElectronApi('elements', {
    // CineGen uploads reference images/frames and expects { url }. We store them in our storage bucket.
    upload: async (file: unknown) => {
      const f = file as { buffer: ArrayBuffer; name: string; type: string };
      const blob = new File([f.buffer], f.name, { type: f.type });
      const url = await uploadFileToStorage(blob);
      return { url };
    },
  });
}
