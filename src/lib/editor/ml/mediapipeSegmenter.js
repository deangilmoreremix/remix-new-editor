/**
 * Person segmentation with MediaPipe's Image Segmenter (selfie_segmenter, Apache-2.0), in the browser.
 *
 * Why this engine: the model is 250 KB and runs on the CPU in a few milliseconds per frame, so baking a clip is
 * fast and needs no GPU and no large download. The slower MODNet engine (remotion/bgRemoval.js) gives softer
 * hair edges; the presenter panel offers both.
 *
 * Assets: the wasm runtime is imported by relative path (the package's `exports` map hides wasm/) through the bundler (hashed asset, emitted into the build) and the model is
 * served from /mediapipe/selfie_segmenter.tflite (public/, sha256 191ac952…6658b, 249,537 bytes). Nothing is
 * fetched from a third-party host at run time. Only the SIMD wasm build is bundled (every current Chromium/
 * Firefox/Safari has SIMD); a browser without it gets a clear error instead of a silent failure.
 */
import wasmLoaderUrl from '../../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url';
import wasmBinaryUrl from '../../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url';

export const MEDIAPIPE_MODEL_URL = '/mediapipe/selfie_segmenter.tflite';

const makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/**
 * @returns {Promise<{ segment(imageData: ImageData): Uint8Array, close(): void, delegate: string }>}
 *   segment() returns one byte per pixel of the INPUT (0 = background … 255 = person).
 */
export async function createMediaPipeSegmenter({ modelUrl = MEDIAPIPE_MODEL_URL, delegate = 'CPU' } = {}) {
  const { ImageSegmenter } = await import('@mediapipe/tasks-vision');
  const segmenter = await ImageSegmenter.createFromOptions(
    { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl },
    { baseOptions: { modelAssetPath: modelUrl, delegate }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false },
  );
  let input = null;
  let small = null;
  let big = null;
  const segment = (imageData) => {
    const { width: w, height: h } = imageData;
    if (!input || input.width !== w || input.height !== h) {
      input = makeCanvas(w, h);
      big = makeCanvas(w, h);
    }
    input.getContext('2d').putImageData(imageData, 0, 0);
    const result = segmenter.segment(input);
    try {
      const conf = result.confidenceMasks?.[0];
      if (!conf) throw new Error('The segmenter returned no mask');
      const values = conf.getAsFloat32Array();
      const mw = conf.width;
      const mh = conf.height;
      if (!small || small.width !== mw || small.height !== mh) small = makeCanvas(mw, mh);
      const sctx = small.getContext('2d');
      const px = sctx.createImageData(mw, mh);
      for (let i = 0; i < values.length; i += 1) {
        const v = Math.max(0, Math.min(1, values[i]));
        px.data[i * 4 + 3] = Math.round(v * 255);
      }
      sctx.putImageData(px, 0, 0);
      // Bilinear upscale of the model-resolution mask to the frame size gives a soft, natural edge.
      const bctx = big.getContext('2d', { willReadFrequently: true });
      bctx.clearRect(0, 0, w, h);
      bctx.imageSmoothingEnabled = true;
      bctx.imageSmoothingQuality = 'high';
      bctx.drawImage(small, 0, 0, w, h);
      const up = bctx.getImageData(0, 0, w, h).data;
      const out = new Uint8Array(w * h);
      for (let i = 0; i < out.length; i += 1) out[i] = up[i * 4 + 3];
      return out;
    } finally {
      result.close?.();
    }
  };
  return { segment, delegate, close: () => { try { segmenter.close(); } catch { /* already closed */ } } };
}
