// [remix] Port I1: one module worker for all local models (Whisper ASR, CLIP embeddings, SmolVLM captions) via Transformers.js (Apache-2.0).
// Model files are fetched from huggingface.co and cached in IndexedDB through ModelCache (env.customCache). WebGPU is used when the adapter exists, else WASM
// (single-threaded unless the page is cross-origin isolated). The pipeline structure follows FreeCut's whisper.worker.ts / clip-worker.ts (MIT).
import { AutoModelForVision2Seq, AutoProcessor, AutoTokenizer, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, RawImage, env, pipeline } from '@huggingface/transformers';
import { ModelCache, idbBlobStore } from './model-cache';
import type { WorkerModelRef, WorkerRequest, WorkerResponse } from './worker-protocol';

/* eslint-disable @typescript-eslint/no-explicit-any -- transformers.js tensor / pipeline types vary by version */
env.allowLocalModels = false;
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = new ModelCache(idbBlobStore()) as any;

const post = (m: WorkerResponse, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);
const cache = new Map<string, Promise<any>>();
const once = <T,>(key: string, make: () => Promise<T>): Promise<T> => { let p = cache.get(key); if (!p) { p = make(); cache.set(key, p); p.catch(() => cache.delete(key)); } return p as Promise<T>; };

const progressFor = (id: number) => {
  const files = new Map<string, [number, number]>();
  return (e: { status?: string; file?: string; loaded?: number; total?: number }) => {
    if (e.status !== 'progress' || !e.total || !e.file) return;
    files.set(e.file, [e.loaded ?? 0, e.total]);
    let l = 0; let t = 0; for (const [a, b] of files.values()) { l += a; t += b; }
    post({ type: 'progress', id, loaded: l, total: t });
  };
};

async function webgpuOk(): Promise<boolean> { try { return !!(self.navigator as any)?.gpu && !!(await (self.navigator as any).gpu.requestAdapter()); } catch { return false; } }

async function loadAsr(m: WorkerModelRef, id: number) {
  return once(`asr:${m.repo}:${m.backend}`, async () => {
    const load = (device: 'webgpu' | 'wasm') => pipeline('automatic-speech-recognition', m.repo, {
      device, dtype: device === 'webgpu' ? ({ encoder_model: 'fp32', decoder_model_merged: 'q4' } as any) : 'q8', progress_callback: progressFor(id) as any,
    } as any);
    if (m.backend === 'webgpu' && await webgpuOk()) { try { return { asr: await load('webgpu'), backend: 'webgpu' as const }; } catch { /* fall back to WASM */ } }
    return { asr: await load('wasm'), backend: 'wasm' as const };
  });
}

async function loadClip(m: WorkerModelRef, id: number) {
  return once(`clip:${m.repo}`, async () => {
    const o = { dtype: 'q8', progress_callback: progressFor(id) } as any;
    const [tokenizer, processor, text, vision] = await Promise.all([
      AutoTokenizer.from_pretrained(m.repo), AutoProcessor.from_pretrained(m.repo),
      CLIPTextModelWithProjection.from_pretrained(m.repo, o), CLIPVisionModelWithProjection.from_pretrained(m.repo, o),
    ]);
    return { tokenizer, processor, text, vision };
  });
}

async function loadVlm(m: WorkerModelRef, id: number) {
  return once(`vlm:${m.repo}`, async () => {
    const processor = await AutoProcessor.from_pretrained(m.repo);
    const model = await (AutoModelForVision2Seq as any).from_pretrained(m.repo, { dtype: 'q8', device: 'wasm', progress_callback: progressFor(id) });
    return { processor, model };
  });
}

const l2 = (v: Float32Array) => { let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * v[i]; const n = Math.sqrt(s) || 1; const o = new Float32Array(v.length); for (let i = 0; i < v.length; i++) o[i] = v[i] / n; return o; };
const split = (data: Float32Array, count: number) => { const dim = Math.round(data.length / count); const out: Float32Array[] = []; for (let i = 0; i < count; i++) out.push(l2(data.slice(i * dim, (i + 1) * dim))); return { out, dim }; };

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  const id = data.id;
  try {
    if (data.type === 'prepare') {
      const m = data.model;
      if (m.kind === 'asr') { const { asr, backend } = await loadAsr(m, id); void asr; post({ type: 'prepared', id, backend }); return; }
      if (m.kind === 'embedding') { await loadClip(m, id); post({ type: 'prepared', id, backend: 'wasm' }); return; }
      await loadVlm(m, id); post({ type: 'prepared', id, backend: 'wasm' }); return;
    }
    if (data.type === 'asr') {
      const { asr, backend } = await loadAsr(data.model, id);
      const opts: Record<string, unknown> = {
        sampling_rate: 16000, chunk_length_s: 30, stride_length_s: 5, task: 'transcribe', force_full_sequences: false, top_k: 0, do_sample: false,
        batch_size: backend === 'webgpu' ? data.batchSize : 1, ...(data.language && data.language !== 'auto' ? { language: data.language } : {}),
      };
      let out: any;
      try { out = await asr(data.audio, { ...opts, return_timestamps: 'word' }); } catch (e) { if (/timestamp|cross_attentions|alignment/i.test(String((e as Error)?.message))) out = await asr(data.audio, { ...opts, return_timestamps: true }); else throw e; }
      post({ type: 'asr-result', id, text: out.text || '', chunks: out.chunks || [], backend });
      return;
    }
    if (data.type === 'embed-images') {
      const { processor, vision } = await loadClip(data.model, id);
      const images = await Promise.all(data.blobs.map((b) => RawImage.fromBlob(b)));
      const inputs = await (processor as any)(images);
      const out: any = await (vision as any)(inputs);
      const { out: vectors, dim } = split(out.image_embeds.data as Float32Array, data.blobs.length);
      post({ type: 'vectors', id, vectors, dim }, vectors.map((v) => v.buffer));
      return;
    }
    if (data.type === 'embed-text') {
      const { tokenizer, text } = await loadClip(data.model, id);
      const tokens = (tokenizer as any)(data.texts, { padding: true, truncation: true });
      const out: any = await (text as any)(tokens);
      const { out: vectors, dim } = split(out.text_embeds.data as Float32Array, data.texts.length);
      post({ type: 'vectors', id, vectors, dim }, vectors.map((v) => v.buffer));
      return;
    }
    if (data.type === 'caption') {
      const { processor, model } = await loadVlm(data.model, id);
      const image = await RawImage.fromBlob(data.blob);
      const messages = [{ role: 'user', content: [{ type: 'image' }, { type: 'text', text: data.prompt }] }];
      const prompt = (processor as any).apply_chat_template(messages, { add_generation_prompt: true });
      const inputs = await (processor as any)(prompt, [image]);
      const ids = await (model as any).generate({ ...inputs, max_new_tokens: 48, do_sample: false });
      const decoded = (processor as any).batch_decode(ids.slice(null, [inputs.input_ids.dims.at(-1), null]), { skip_special_tokens: true });
      post({ type: 'caption-result', id, text: String(decoded[0] ?? '').trim() });
    }
  } catch (e) {
    post({ type: 'error', id, message: String((e as Error)?.message ?? e) });
  }
};
/* eslint-enable @typescript-eslint/no-explicit-any */
