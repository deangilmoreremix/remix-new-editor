// src/lib/recorder/effects.js
//
// Live camera effects, applied while recording so the take (and every AI intro made from it)
// shows what you saw: background blur, a virtual background (built-in or your own image),
// appearance touch-up and mirror. Free and on-device: the person is separated from the room
// with MediaPipe's Selfie Segmenter (@mediapipe/tasks-vision, Apache-2.0), and the frame is
// composited on a canvas whose stream replaces the camera's video track (audio is kept).

// Bundled by Vite from node_modules (14 MB WASM, not committed); the model is self-hosted.
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';

export const SEGMENTER_MODEL = '/recorder/models/selfie_segmenter.tflite';

export const BUILTIN_BACKGROUNDS = [
  { id: 'office', label: 'Office', src: '/recorder/backgrounds/office.jpg' },
  { id: 'studio', label: 'Studio', src: '/recorder/backgrounds/studio.jpg' },
  { id: 'gradient', label: 'Gradient', src: '/recorder/backgrounds/gradient.jpg' },
];

const STORE_KEY = 'recorder-camera-effects';

/** Effect settings with defaults. mode: 'none' | 'blur' | 'background'. */
export function effectsSettings(e = {}) {
  const mode = ['blur', 'background'].includes(e.mode) ? e.mode : 'none';
  const background = typeof e.background === 'string' && e.background ? e.background : 'office';
  return {
    mode,
    background,
    blur: Math.max(0, Math.min(1, Number(e.blur ?? 0.6))),
    touchUp: Math.max(0, Math.min(1, Number(e.touchUp) || 0)),
    mirror: !!e.mirror,
  };
}

/** Does anything need processing? (Off by default: the camera is passed through untouched.) */
export const effectsActive = (s) => s.mode !== 'none' || s.touchUp > 0 || s.mirror;
export const needsSegmentation = (s) => s.mode !== 'none';

/** The image URL for a background setting: a built-in id, or an uploaded image's data URL. */
export function backgroundSrc(background) {
  const builtin = BUILTIN_BACKGROUNDS.find((b) => b.id === background);
  if (builtin) return builtin.src;
  return /^(data:image\/|blob:|https:\/\/)/.test(String(background)) ? background : BUILTIN_BACKGROUNDS[0].src;
}

export function loadEffects(storage = globalThis.localStorage) {
  try { return effectsSettings(JSON.parse(storage?.getItem(STORE_KEY) || '{}')); } catch { return effectsSettings(); }
}

export function saveEffects(s, storage = globalThis.localStorage) {
  // Uploaded backgrounds are data URLs; keep them out of storage when too large.
  const keep = String(s.background).length > 1_500_000 ? { ...s, background: 'office' } : s;
  try { storage?.setItem(STORE_KEY, JSON.stringify(keep)); } catch { /* storage full or blocked */ }
}

const cover = (ctx, img, w, h) => {
  const iw = img.videoWidth || img.naturalWidth || img.width;
  const ih = img.videoHeight || img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const s = Math.max(w / iw, h / ih);
  ctx.drawImage(img, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
};

/**
 * Draw one processed frame. `person` is a canvas holding just the person (the frame masked by
 * the segmentation), or null when segmentation isn't needed. Pure canvas calls, testable with a
 * fake context.
 */
export function compositeFrame(ctx, { frame, person = null, settings, backgroundImage = null, width, height }) {
  ctx.save();
  if (settings.mirror) ctx.setTransform(-1, 0, 0, 1, width, 0);
  if (settings.mode === 'background' && person) {
    if (settings.mirror) ctx.setTransform(1, 0, 0, 1, 0, 0); // backgrounds (text, logos) stay readable
    if (backgroundImage) cover(ctx, backgroundImage, width, height);
    else { ctx.fillStyle = '#20232a'; ctx.fillRect(0, 0, width, height); }
    if (settings.mirror) ctx.setTransform(-1, 0, 0, 1, width, 0);
    ctx.drawImage(person, 0, 0, width, height);
  } else if (settings.mode === 'blur' && person) {
    ctx.filter = `blur(${Math.round(4 + settings.blur * 20)}px)`;
    ctx.drawImage(frame, 0, 0, width, height);
    ctx.filter = 'none';
    ctx.drawImage(person, 0, 0, width, height);
  } else {
    ctx.drawImage(frame, 0, 0, width, height);
  }
  if (settings.touchUp > 0) {
    // Touch-up: a softened copy of the person (or the whole frame) blended over, a little brighter.
    ctx.globalAlpha = 0.25 + settings.touchUp * 0.45;
    ctx.filter = `blur(${(1 + settings.touchUp * 2.5).toFixed(1)}px) brightness(${(1 + settings.touchUp * 0.06).toFixed(3)})`;
    ctx.drawImage(person || frame, 0, 0, width, height);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Person confidence (0..1 per pixel) → an alpha mask ImageData. */
export function maskToImageData(confidence, width, height, ImageDataCtor = globalThis.ImageData) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    // A soft ramp keeps hair edges instead of a hard cut-out.
    const a = Math.max(0, Math.min(1, (confidence[i] - 0.25) / 0.5));
    data[i * 4 + 3] = Math.round(a * 255);
  }
  return new ImageDataCtor(data, width, height);
}

let segmenterPromise = null;

/** The shared MediaPipe segmenter (GPU where available, else CPU). */
export function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const fileset = { wasmLoaderPath, wasmBinaryPath };
      const make = (delegate) => ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: SEGMENTER_MODEL, delegate },
        runningMode: 'VIDEO',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
      try { return await make('GPU'); } catch { return make('CPU'); }
    })().catch((err) => { segmenterPromise = null; throw err; });
  }
  return segmenterPromise;
}

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

/**
 * Wrap a camera stream with effects. Returns { stream, update(settings), stop() }. With no
 * effect on, the original stream is returned untouched. Stopping the returned video track also
 * stops the camera, unless `deps.keepSource` (a live preview that gets rebuilt when settings
 * change). `deps.always` processes even with no effect on. `deps.segmenter` is injectable.
 */
export async function applyCameraEffects(source, settings, deps = {}) {
  let s = effectsSettings(settings);
  const videoTrack = source.getVideoTracks()[0];
  if (!videoTrack || (!effectsActive(s) && !deps.always)) {
    return { stream: source, update: () => {}, stop: () => { if (!deps.keepSource) source.getTracks().forEach((t) => t.stop()); }, passthrough: true };
  }
  const doc = deps.document || document;
  const video = doc.createElement('video');
  video.muted = true; video.playsInline = true;
  video.srcObject = new globalThis.MediaStream([videoTrack]);
  await video.play().catch(() => {});
  if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;

  const canvas = doc.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const personCanvas = doc.createElement('canvas');
  personCanvas.width = width; personCanvas.height = height;
  const pctx = personCanvas.getContext('2d');
  const maskCanvas = doc.createElement('canvas');
  const mctx = maskCanvas.getContext('2d');

  let segmenter = deps.segmenter || null;
  let background = null;
  const prepare = async () => {
    if (needsSegmentation(s) && !segmenter) segmenter = await getSegmenter();
    background = s.mode === 'background' ? await loadImage(backgroundSrc(s.background)) : null;
  };
  await prepare();

  let stopped = false;
  let lastTs = -1;
  const draw = () => {
    if (stopped) return;
    let person = null;
    if (needsSegmentation(s) && segmenter && video.readyState >= 2) {
      const ts = Math.max(lastTs + 1, Math.round(performance.now()));
      lastTs = ts;
      const result = segmenter.segmentForVideo(video, ts);
      const mask = result?.confidenceMasks?.[0];
      if (mask) {
        const mw = mask.width; const mh = mask.height;
        if (maskCanvas.width !== mw || maskCanvas.height !== mh) { maskCanvas.width = mw; maskCanvas.height = mh; }
        mctx.putImageData(maskToImageData(mask.getAsFloat32Array(), mw, mh), 0, 0);
        result.close?.();
        pctx.globalCompositeOperation = 'copy';
        pctx.drawImage(video, 0, 0, width, height);
        pctx.globalCompositeOperation = 'destination-in';
        pctx.imageSmoothingEnabled = true;
        pctx.drawImage(maskCanvas, 0, 0, width, height);
        pctx.globalCompositeOperation = 'source-over';
        person = personCanvas;
      }
    }
    compositeFrame(ctx, { frame: video, person, settings: s, backgroundImage: background, width, height });
    schedule();
  };
  const schedule = () => {
    if (stopped) return;
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(draw);
    else setTimeout(draw, 33);
  };
  draw();

  const out = canvas.captureStream(30);
  const outTrack = out.getVideoTracks()[0];
  const stop = () => {
    if (stopped) return;
    stopped = true;
    video.srcObject = null;
    if (!deps.keepSource) source.getTracks().forEach((t) => t.stop());
  };
  // Whoever stops the recorded track (end of take, closing the recorder) also releases the camera.
  const nativeStop = outTrack.stop.bind(outTrack);
  outTrack.stop = () => { nativeStop(); stop(); };
  videoTrack.addEventListener('ended', () => { nativeStop(); stop(); outTrack.dispatchEvent(new Event('ended')); }, { once: true });
  const stream = new globalThis.MediaStream([outTrack, ...source.getAudioTracks()]);
  return {
    stream,
    update: async (next) => { s = effectsSettings(next); await prepare(); },
    stop: () => { nativeStop(); stop(); },
    passthrough: false,
  };
}
