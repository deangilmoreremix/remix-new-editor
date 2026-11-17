// [remix] Port I1: one module worker for all local models (Whisper ASR, CLIP embeddings, SmolVLM captions) via Transformers.js (Apache-2.0).
// Plain JavaScript on purpose: this app's dev server does not strip TypeScript from module-worker graphs (only the production worker pipeline does),
// so the worker and model-cache.js must stay .js; the shapes are described by worker-protocol.ts / model-cache.d.ts.
// Model files come from huggingface.co and are cached in IndexedDB through ModelCache (env.customCache). WebGPU is used when an adapter exists, else WASM
// (single-threaded unless the page is cross-origin isolated). The pipeline structure follows FreeCut's whisper.worker.ts / clip-worker.ts (MIT).
import { AutoModelForVision2Seq, AutoProcessor, AutoTokenizer, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, RawImage, env, pipeline } from "@huggingface/transformers";
import { ModelCache, idbBlobStore } from "./model-cache.js";
env.allowLocalModels = false;
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = new ModelCache(idbBlobStore());
const post = (m, transfer = []) => self.postMessage(m, transfer);
const cache = /* @__PURE__ */ new Map();
const once = (key, make) => {
  let p = cache.get(key);
  if (!p) {
    p = make();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
};
const progressFor = (id) => {
  const files = /* @__PURE__ */ new Map();
  return (e) => {
    if (e.status !== "progress" || !e.total || !e.file) return;
    files.set(e.file, [e.loaded ?? 0, e.total]);
    let l = 0;
    let t = 0;
    for (const [a, b] of files.values()) {
      l += a;
      t += b;
    }
    post({ type: "progress", id, loaded: l, total: t });
  };
};
async function webgpuOk() {
  try {
    // [remix] Fix Q: an adapter is not enough. When requestDevice() fails, onnxruntime-web fails to start and cannot start a WASM session afterwards in the same
    // worker either (both threw the same bare number), so prove a device can be created BEFORE handing the session to the runtime; otherwise load on WASM.
    const adapter = self.navigator?.gpu ? await self.navigator.gpu.requestAdapter() : null;
    if (!adapter) return false;
    const device = await adapter.requestDevice();
    try { device.destroy?.(); } catch { /* probe device only */ }
    return true;
  } catch {
    return false;
  }
}
async function loadAsr(m, id) {
  return once(`asr:${m.repo}:${m.backend}`, async () => {
    const load = (device) => pipeline("automatic-speech-recognition", m.repo, {
      device,
      dtype: device === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
      progress_callback: progressFor(id)
    });
    if (m.backend === "webgpu" && await webgpuOk()) {
      try {
        return { asr: await load("webgpu"), backend: "webgpu" };
      } catch {
        /* WebGPU init failed: fall back to WASM below */
      }
    }
    return { asr: await load("wasm"), backend: "wasm" };
  });
}
async function loadClip(m, id) {
  return once(`clip:${m.repo}`, async () => {
    const o = { dtype: "q8", progress_callback: progressFor(id) };
    const [tokenizer, processor, text, vision] = await Promise.all([
      AutoTokenizer.from_pretrained(m.repo),
      AutoProcessor.from_pretrained(m.repo),
      CLIPTextModelWithProjection.from_pretrained(m.repo, o),
      CLIPVisionModelWithProjection.from_pretrained(m.repo, o)
    ]);
    return { tokenizer, processor, text, vision };
  });
}
async function loadVlm(m, id) {
  return once(`vlm:${m.repo}`, async () => {
    const processor = await AutoProcessor.from_pretrained(m.repo);
    const model = await AutoModelForVision2Seq.from_pretrained(m.repo, { dtype: "q8", device: "wasm", progress_callback: progressFor(id) });
    return { processor, model };
  });
}
const l2 = (v) => {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  const o = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) o[i] = v[i] / n;
  return o;
};
const split = (data, count) => {
  const dim = Math.round(data.length / count);
  const out = [];
  for (let i = 0; i < count; i++) out.push(l2(data.slice(i * dim, (i + 1) * dim)));
  return { out, dim };
};
self.onmessage = async ({ data }) => {
  const id = data.id;
  try {
    if (data.type === "prepare") {
      const m = data.model;
      if (m.kind === "asr") {
        const { asr, backend } = await loadAsr(m, id);
        void asr;
        post({ type: "prepared", id, backend });
        return;
      }
      if (m.kind === "embedding") {
        await loadClip(m, id);
        post({ type: "prepared", id, backend: "wasm" });
        return;
      }
      await loadVlm(m, id);
      post({ type: "prepared", id, backend: "wasm" });
      return;
    }
    if (data.type === "asr") {
      const { asr, backend } = await loadAsr(data.model, id);
      const opts = {
        sampling_rate: 16e3,
        chunk_length_s: 30,
        stride_length_s: 5,
        // English-only Whisper models reject `task` / `language` (generate() throws), so they are only set for multilingual models
        ...data.multilingual ? { task: "transcribe" } : {},
        force_full_sequences: false,
        top_k: 0,
        do_sample: false,
        batch_size: backend === "webgpu" ? data.batchSize : 1,
        ...data.multilingual && data.language && data.language !== "auto" ? { language: data.language } : {}
      };
      let out;
      try {
        out = await asr(data.audio, { ...opts, return_timestamps: "word" });
      } catch (e) {
        if (/timestamp|cross_attentions|alignment/i.test(String(e?.message))) out = await asr(data.audio, { ...opts, return_timestamps: true });
        else throw e;
      }
      post({ type: "asr-result", id, text: out.text || "", chunks: out.chunks || [], backend });
      return;
    }
    if (data.type === "embed-images") {
      const { processor, vision } = await loadClip(data.model, id);
      const images = await Promise.all(data.blobs.map((b) => RawImage.fromBlob(b)));
      const inputs = await processor(images);
      const out = await vision(inputs);
      const { out: vectors, dim } = split(out.image_embeds.data, data.blobs.length);
      post({ type: "vectors", id, vectors, dim }, vectors.map((v) => v.buffer));
      return;
    }
    if (data.type === "embed-text") {
      const { tokenizer, text } = await loadClip(data.model, id);
      const tokens = tokenizer(data.texts, { padding: true, truncation: true });
      const out = await text(tokens);
      const { out: vectors, dim } = split(out.text_embeds.data, data.texts.length);
      post({ type: "vectors", id, vectors, dim }, vectors.map((v) => v.buffer));
      return;
    }
    if (data.type === "caption") {
      const { processor, model } = await loadVlm(data.model, id);
      // one 512 px tile instead of up to 17 split tiles: keeps WASM memory and time small (thumbnails are tiny anyway)
      const image = await RawImage.fromBlob(data.blob);
      const messages = [{ role: "user", content: [{ type: "image" }, { type: "text", text: data.prompt }] }];
      const prompt = processor.apply_chat_template(messages, { add_generation_prompt: true });
      const inputs = await processor(prompt, [image], { do_image_splitting: false });
      const ids = await model.generate({ ...inputs, max_new_tokens: 48, do_sample: false });
      const decoded = processor.batch_decode(ids.slice(null, [inputs.input_ids.dims.at(-1), null]), { skip_special_tokens: true });
      post({ type: "caption-result", id, text: String(decoded[0] ?? "").trim() });
    }
  } catch (e) {
    post({ type: "error", id, message: String(e?.message ?? e) });
  }
};
