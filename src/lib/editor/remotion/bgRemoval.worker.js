/**
 * Background removal (person matting) in the browser: MODNet
 * (Xenova/modnet, Apache-2.0) through Transformers.js. WebGPU when
 * available, WASM otherwise. The model (~25 MB) downloads once and is cached.
 *
 * in:  { type: 'init', id } | { type: 'mask', id, width, height, data: Uint8ClampedArray (RGBA) }
 * out: { type: 'progress', id, progress } | { type: 'ready', id, device }
 *      | { type: 'mask', id, alpha: Uint8Array (width*height) } | { type: 'error', id, message }
 */
import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers';

env.allowLocalModels = false;
const MODEL = 'Xenova/modnet';

let loading = null;

function load(id) {
  if (loading) return loading;
  loading = (async () => {
    const hasGpu = !!(self.navigator?.gpu && await self.navigator.gpu.requestAdapter().catch(() => null));
    const files = new Map();
    const progress_callback = (e) => {
      if (e.status !== 'progress' || !e.total) return;
      files.set(e.file, [e.loaded, e.total]);
      const [l, t] = [...files.values()].reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
      self.postMessage({ type: 'progress', id, progress: t ? l / t : 0 });
    };
    const device = hasGpu ? 'webgpu' : 'wasm';
    // Quantized weights on CPU are ~2–3× faster with little visible difference.
    const model = await AutoModel.from_pretrained(MODEL, { device, dtype: hasGpu ? 'fp32' : 'q8', progress_callback });
    const processor = await AutoProcessor.from_pretrained(MODEL, { progress_callback });
    return { model, processor, device };
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

self.onmessage = async ({ data }) => {
  const { id } = data || {};
  try {
    if (data?.type === 'init') {
      const { device } = await load(id);
      self.postMessage({ type: 'ready', id, device });
      return;
    }
    if (data?.type !== 'mask') return;
    const { model, processor } = await load(id);
    const image = new RawImage(data.data, data.width, data.height, 4);
    const { pixel_values } = await processor(image);
    const { output } = await model({ input: pixel_values });
    const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(data.width, data.height);
    const alpha = new Uint8Array(mask.data.length === data.width * data.height ? mask.data : mask.data.filter((_, i) => i % mask.channels === 0));
    self.postMessage({ type: 'mask', id, alpha }, [alpha.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String(err?.message || err) });
  }
};
