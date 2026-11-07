/**
 * Free, in-browser AI for the Timeline Editor (Transformers.js).
 *
 * One worker serves every local model listed in modelRegistry.js. Models load
 * lazily on first use (WebGPU when available, WASM otherwise), download once
 * from the Hugging Face hub and are cached by the browser. Nothing is sent to a
 * paid API.
 *
 * in:  { id, task, input }
 * out: { id, type: 'progress', stage, progress, file? }
 *      | { id, type: 'done', result } | { id, type: 'error', message }
 *
 * Images travel as { width, height, data: Uint8ClampedArray RGBA }.
 * Audio travels as Float32Array mono PCM at the rate each task documents.
 */
import {
  env,
  pipeline,
  RawImage,
  SamModel,
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  Florence2ForConditionalGeneration,
  AutoModelForAudioFrameClassification,
} from '@huggingface/transformers';
import { LOCAL_MODELS } from './modelRegistry.js';

env.allowLocalModels = false;
env.useBrowserCache = true;

// WebGPU capability: { gpu, fp16 }. fp16 weights need the 'shader-f16' feature.
let gpuPromise = null;
const gpuInfo = () => {
  if (!gpuPromise) {
    gpuPromise = (async () => {
      const adapter = self.navigator?.gpu ? await self.navigator.gpu.requestAdapter().catch(() => null) : null;
      return { gpu: !!adapter, fp16: !!adapter?.features?.has?.('shader-f16') };
    })();
  }
  return gpuPromise;
};
const hasGpu = async () => (await gpuInfo()).gpu;

const loaded = new Map();
let currentId = 0;

/** Progress callback that sums bytes across a model's files. */
function progressFor(id, key) {
  const files = new Map();
  return (e) => {
    if (e.status !== 'progress' || !e.total) return;
    files.set(e.file, [e.loaded, e.total]);
    const [l, t] = [...files.values()].reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
    self.postMessage({ id, type: 'progress', stage: 'download', model: key, progress: t ? l / t : 0 });
  };
}

const modelId = (key) => LOCAL_MODELS[key].id;

// Models that failed on WebGPU in this session run on WASM from then on.
const forceWasm = new Set();

async function common(key) {
  const { gpu: hasAdapter, fp16 } = await gpuInfo();
  const gpu = hasAdapter && !forceWasm.has(key);
  return {
    device: gpu ? 'webgpu' : 'wasm',
    gpu,
    // Half precision only where the GPU supports it.
    half: gpu && fp16 ? 'fp16' : 'fp32',
    progress_callback: progressFor(currentId, key),
  };
}

/** Load on WebGPU, and fall back to WASM if the GPU path fails (missing ops, fp16, drivers). */
function once(key, factory) {
  if (!loaded.has(key)) {
    const p = (async () => {
      try {
        return await factory();
      } catch (err) {
        if (forceWasm.has(key) || !(await hasGpu())) throw err;
        forceWasm.add(key);
        return factory();
      }
    })();
    loaded.set(key, p);
    p.catch(() => loaded.delete(key));
  }
  return loaded.get(key);
}

const LOADERS = {
  sam: () => once('sam', async () => {
    const { device, gpu, half, progress_callback } = await common('sam');
    const model = await SamModel.from_pretrained(modelId('sam'), { device, dtype: gpu ? half : 'q8', progress_callback });
    const processor = await AutoProcessor.from_pretrained(modelId('sam'), { progress_callback });
    return { model, processor };
  }),
  clip: () => once('clip', async () => {
    const { device, gpu, half, progress_callback } = await common('clip');
    const dtype = gpu ? half : 'q8';
    const [tokenizer, text, processor, vision] = await Promise.all([
      AutoTokenizer.from_pretrained(modelId('clip'), { progress_callback }),
      CLIPTextModelWithProjection.from_pretrained(modelId('clip'), { device, dtype, progress_callback }),
      AutoProcessor.from_pretrained(modelId('clip'), { progress_callback }),
      CLIPVisionModelWithProjection.from_pretrained(modelId('clip'), { device, dtype, progress_callback }),
    ]);
    return { tokenizer, text, processor, vision };
  }),
  detr: () => once('detr', async () => {
    const { device, gpu, progress_callback } = await common('detr');
    return pipeline('object-detection', modelId('detr'), { device, dtype: gpu ? 'fp32' : 'q8', progress_callback });
  }),
  florence: () => once('florence', async () => {
    const { device, gpu, half, progress_callback } = await common('florence');
    const dtype = gpu
      ? { embed_tokens: half, vision_encoder: half, encoder_model: 'q4', decoder_model_merged: 'q4' }
      : { embed_tokens: 'fp32', vision_encoder: 'fp32', encoder_model: 'q8', decoder_model_merged: 'q8' };
    const model = await Florence2ForConditionalGeneration.from_pretrained(modelId('florence'), { device, dtype, progress_callback });
    const processor = await AutoProcessor.from_pretrained(modelId('florence'), { progress_callback });
    return { model, processor };
  }),
  whisper: () => once('whisper', async () => {
    const { device, gpu, progress_callback } = await common('whisper');
    return pipeline('automatic-speech-recognition', modelId('whisper'), {
      device,
      dtype: gpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
      progress_callback,
    });
  }),
  clap: () => once('clap', async () => {
    const { device, gpu, progress_callback } = await common('clap');
    return pipeline('zero-shot-audio-classification', modelId('clap'), { device: gpu ? device : 'wasm', dtype: 'q8', progress_callback });
  }),
  diarize: () => once('diarize', async () => {
    const { progress_callback } = await common('diarize');
    // Tiny model: WASM is plenty and avoids WebGPU op gaps.
    const model = await AutoModelForAudioFrameClassification.from_pretrained(modelId('diarize'), { device: 'wasm', dtype: 'fp32', progress_callback });
    const processor = await AutoProcessor.from_pretrained(modelId('diarize'), { progress_callback });
    return { model, processor };
  }),
  translate: () => once('translate', async () => {
    const { progress_callback } = await common('translate');
    return pipeline('translation', modelId('translate'), { device: 'wasm', dtype: 'q8', progress_callback });
  }),
  depth: () => once('depth', async () => {
    const { device, gpu, half, progress_callback } = await common('depth');
    return pipeline('depth-estimation', modelId('depth'), { device, dtype: gpu ? half : 'q8', progress_callback });
  }),
  upscale: () => once('upscale', async () => {
    const { device, gpu, progress_callback } = await common('upscale');
    return pipeline('image-to-image', modelId('upscale'), { device, dtype: gpu ? 'fp32' : 'q8', progress_callback });
  }),
};

const toRaw = (img) => new RawImage(img.data, img.width, img.height, 4).rgb();

function l2norm(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i += 1) s += arr[i] * arr[i];
  const n = Math.sqrt(s) || 1;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i += 1) out[i] = arr[i] / n;
  return out;
}

function rows(tensor) {
  const [n, d] = tensor.dims;
  const data = tensor.data;
  return Array.from({ length: n }, (_, i) => l2norm(data.subarray ? data.subarray(i * d, (i + 1) * d) : data.slice(i * d, (i + 1) * d)));
}

/** Best SAM mask for the given prompt, as an alpha matte (0/255) at image size. */
async function samMask({ image, points = [], labels, box }) {
  const { model, processor } = await LOADERS.sam();
  const raw = toRaw(image);
  const opts = {};
  if (points.length) {
    opts.input_points = [[points.map(([x, y]) => [x, y])]];
    opts.input_labels = [[(labels && labels.length === points.length ? labels : points.map(() => 1))]];
  }
  if (box) {
    opts.input_boxes = [[box]];
    // SAM v1 needs at least one point: use the box centre as a positive click.
    if (!points.length) {
      opts.input_points = [[[(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]]];
      opts.input_labels = [[1]];
    }
  }
  const inputs = await processor(raw, opts);
  const out = await model(inputs);
  const masks = await processor.post_process_masks(out.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes);
  const scores = out.iou_scores.data;
  let best = 0;
  for (let i = 1; i < scores.length; i += 1) if (scores[i] > scores[best]) best = i;
  const m = masks[0];
  const [, , h, w] = m.dims;
  const plane = w * h;
  const alpha = new Uint8Array(plane);
  const src = m.data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let p = 0; p < plane; p += 1) {
    if (src[best * plane + p]) {
      alpha[p] = 255;
      const x = p % w, y = (p / w) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const bbox = maxX >= 0 ? [minX, minY, maxX, maxY] : null;
  return { result: { alpha, width: w, height: h, score: scores[best], bbox }, transfer: [alpha.buffer] };
}

/** Boxes ([x1,y1,x2,y2] in image px) for a phrase, via Florence-2 grounding. */
async function groundPhrase(image, query) {
  const { model, processor } = await LOADERS.florence();
  const raw = toRaw(image);
  const task = '<CAPTION_TO_PHRASE_GROUNDING>';
  const prompts = processor.construct_prompts(task + String(query).slice(0, 80));
  const inputs = await processor(raw, prompts);
  const ids = await model.generate({ ...inputs, max_new_tokens: 64 });
  const text = processor.batch_decode(ids, { skip_special_tokens: false })[0];
  const parsed = processor.post_process_generation(text, task, raw.size)?.[task];
  return (parsed?.bboxes || []).filter((b) => Array.isArray(b) && b.length === 4 && b[2] > b[0] && b[3] > b[1]);
}

const TASKS = {
  async preload({ key }) {
    if (key === 'kokoro') throw new Error('Kokoro loads in its own worker');
    const load = LOADERS[key];
    if (!load) throw new Error(`Unknown model: ${key}`);
    await load();
    return { result: { key, device: (await hasGpu()) && !forceWasm.has(key) ? 'webgpu' : 'wasm' } };
  },

  'sam.mask': samMask,

  /**
   * Find an object by name with Florence-2 phrase grounding, then mask it
   * with SAM. (OWL-ViT/OWLv2 can't run in onnxruntime-web: unsupported Cast op.)
   */
  async 'text.mask'({ image, query }) {
    const boxes = await groundPhrase(image, query);
    if (!boxes.length) return { result: { alpha: null, detections: [] } };
    const { result, transfer } = await samMask({ image, box: boxes[0] });
    return { result: { ...result, detections: boxes.map((box) => ({ label: query, box })) }, transfer };
  },

  async 'text.locate'({ image, query }) {
    return { result: (await groundPhrase(image, query)).map((box) => ({ label: query, box })) };
  },

  async 'clip.image'({ images }) {
    const { processor, vision } = await LOADERS.clip();
    const raws = images.map(toRaw);
    const inputs = await processor(raws);
    const { image_embeds } = await vision(inputs);
    const embeds = rows(image_embeds);
    return { result: embeds, transfer: embeds.map((e) => e.buffer) };
  },

  async 'clip.text'({ texts }) {
    const { tokenizer, text } = await LOADERS.clip();
    const inputs = tokenizer(texts, { padding: true, truncation: true });
    const { text_embeds } = await text(inputs);
    const embeds = rows(text_embeds);
    return { result: embeds, transfer: embeds.map((e) => e.buffer) };
  },

  async 'detr.detect'({ image, threshold = 0.85 }) {
    const det = await LOADERS.detr();
    const out = await det(toRaw(image), { threshold, percentage: true });
    return { result: out.map((d) => ({ label: d.label, score: d.score, box: d.box })) };
  },

  async 'florence.describe'({ image, task = '<MORE_DETAILED_CAPTION>', maxTokens = 120 }) {
    const { model, processor } = await LOADERS.florence();
    const raw = toRaw(image);
    const prompts = processor.construct_prompts(task);
    const inputs = await processor(raw, prompts);
    const ids = await model.generate({ ...inputs, max_new_tokens: maxTokens });
    const text = processor.batch_decode(ids, { skip_special_tokens: false })[0];
    const parsed = processor.post_process_generation(text, task, raw.size);
    const caption = typeof parsed?.[task] === 'string' ? parsed[task] : String(Object.values(parsed || {})[0] || '');
    return { result: { text: caption.trim() } };
  },

  /** Speech to text (16 kHz mono). Returns { text, words: [{ text, start, end }] } with times in seconds. */
  async 'asr.transcribe'({ audio, language }) {
    const asr = await LOADERS.whisper();
    const out = await asr(audio, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
      ...(language ? { language, task: 'transcribe' } : {}),
    });
    const words = (out.chunks || [])
      .map((c) => ({ text: String(c.text || '').trim(), start: c.timestamp?.[0] ?? 0, end: c.timestamp?.[1] ?? c.timestamp?.[0] ?? 0 }))
      .filter((w) => w.text);
    return { result: { text: String(out.text || '').trim(), words } };
  },

  /** Zero-shot labels for consecutive windows of 48 kHz audio. */
  async 'clap.classify'({ audio, labels, windowSec = 5, stepSec = 5, sampleRate = 48000 }) {
    const clf = await LOADERS.clap();
    const win = Math.round(windowSec * sampleRate);
    const step = Math.round(stepSec * sampleRate);
    const out = [];
    const total = Math.max(1, Math.ceil(Math.max(0, audio.length - win) / step) + 1);
    for (let i = 0, n = 0; i < Math.max(1, audio.length); i += step, n += 1) {
      const slice = audio.subarray(i, Math.min(audio.length, i + win));
      if (slice.length < sampleRate * 0.5) break;
      const scores = await clf(slice, labels);
      out.push({ start: i / sampleRate, end: (i + slice.length) / sampleRate, scores });
      self.postMessage({ id: currentId, type: 'progress', stage: 'process', progress: Math.min(1, (n + 1) / total) });
      if (i + win >= audio.length) break;
    }
    return { result: out };
  },

  /** Speaker turns from 16 kHz audio: [{ speaker, start, end, confidence }]. */
  async diarize({ audio }) {
    const { model, processor } = await LOADERS.diarize();
    const chunk = 16000 * 10;
    const turns = [];
    for (let off = 0; off < audio.length; off += chunk) {
      const slice = audio.subarray(off, Math.min(audio.length, off + chunk));
      const inputs = await processor(slice);
      const { logits } = await model(inputs);
      const [segs] = processor.post_process_speaker_diarization(logits, slice.length);
      segs.forEach((s) => turns.push({ speaker: s.id, start: s.start + off / 16000, end: s.end + off / 16000, confidence: s.confidence }));
      self.postMessage({ id: currentId, type: 'progress', stage: 'process', progress: Math.min(1, (off + chunk) / audio.length) });
    }
    return { result: turns };
  },

  async translate({ texts, src = 'en', tgt }) {
    const tr = await LOADERS.translate();
    const out = [];
    const batch = 16;
    for (let i = 0; i < texts.length; i += batch) {
      const part = texts.slice(i, i + batch);
      const res = await tr(part, { src_lang: src, tgt_lang: tgt });
      (Array.isArray(res) ? res : [res]).forEach((r) => out.push(r.translation_text ?? ''));
      self.postMessage({ id: currentId, type: 'progress', stage: 'process', progress: Math.min(1, (i + batch) / texts.length) });
    }
    return { result: out };
  },

  /** Depth map (0 = far, 255 = near) resized to the input size. */
  async depth({ image }) {
    const est = await LOADERS.depth();
    const { depth } = await est(toRaw(image));
    const resized = await depth.resize(image.width, image.height);
    const data = new Uint8Array(resized.data.length === image.width * image.height
      ? resized.data
      : resized.data.filter((_, i) => i % resized.channels === 0));
    return { result: { width: image.width, height: image.height, data }, transfer: [data.buffer] };
  },

  async upscale({ image }) {
    const up = await LOADERS.upscale();
    const out = await up(toRaw(image));
    const img = Array.isArray(out) ? out[0] : out;
    const rgba = img.rgba();
    const data = new Uint8ClampedArray(rgba.data);
    return { result: { width: rgba.width, height: rgba.height, data }, transfer: [data.buffer] };
  },
};

self.onmessage = async ({ data }) => {
  const { id, task, input } = data || {};
  if (!id) return;
  currentId = id;
  const fn = TASKS[task];
  if (!fn) { self.postMessage({ id, type: 'error', message: `Unknown local AI task: ${task}` }); return; }
  try {
    const { result, transfer = [] } = await fn(input || {});
    self.postMessage({ id, type: 'done', result }, transfer);
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String(err?.message || err) });
  }
};
