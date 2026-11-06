/**
 * MuAPI models the Timeline Editor uses for Fill Gap, Extend, layer
 * decomposition and watermark removal, with the exact endpoint and field
 * names from MuAPI's live catalog (api.muapi.ai/api/v1/models).
 *
 * Every MuAPI model has its OWN endpoint: POST /api/v1/<endpoint>. There is
 * no generic "/image-to-video" route, and first/last-frame field names differ
 * per model family — so payloads are built here, in one place, for both the
 * Netlify function and the browser.
 *
 * Pure module (no browser or Node APIs) so it can be shared.
 */

/** First + last frame → video (Fill Gap). costUsd is MuAPI's listed per-run price. */
export const FIRST_LAST_FRAME_MODELS = {
  'vidu-q2-turbo-start-end-video': { label: 'Vidu Q2 Turbo', costUsd: 0.06, fields: 'image_url+last_image', durations: [1, 8], resolutions: ['360p', '720p', '1080p'] },
  'vidu-q2-pro-start-end-video': { label: 'Vidu Q2 Pro', costUsd: 0.13, fields: 'image_url+last_image', durations: [1, 8], resolutions: ['360p', '720p', '1080p'] },
  'vidu-q3-turbo-first-last-frames': { label: 'Vidu Q3 Turbo', costUsd: 0.3, fields: 'image_url+last_image', durations: [1, 16] },
  'minimax-hailuo-02-standard-i2v': { label: 'Hailuo 02 Standard', costUsd: 0.15, fields: 'image_url+end_image_url', durations: [6, 10] },
  'seedance-2.5-first-last-frame-480p': { label: 'Seedance 2.5 (480p)', costUsd: 0.85, fields: 'images_list', durations: [3, 15] },
  'seedance-2.5-first-last-frame': { label: 'Seedance 2.5', costUsd: 1.7, fields: 'images_list', durations: [3, 15] },
};

export const DEFAULT_FILL_GAP_MODEL = 'vidu-q2-turbo-start-end-video';

/** Video → longer video (Extend after). Takes the clip's own video_url. */
export const VIDEO_EXTEND_MODELS = {
  'ltx-2.3-video-extend': { label: 'LTX 2.3 Extend', costUsd: 0.104, durations: [1, 10] },
  'wan2.7-video-extend': { label: 'Wan 2.7 Extend', costUsd: 0.1, durations: [2, 10], needsPrompt: true },
  'seedance-2.5-video-extend-480p': { label: 'Seedance 2.5 Extend (480p)', costUsd: 0.85, durations: [3, 15], needsPrompt: true },
  'seedance-2.5-video-extend': { label: 'Seedance 2.5 Extend', costUsd: 1.7, durations: [3, 15], needsPrompt: true },
};

export const DEFAULT_EXTEND_MODEL = 'ltx-2.3-video-extend';

/** Image → layers. */
export const LAYER_MODELS = {
  'bytedance-seedream-5.0-pro-layer': { label: 'Seedream 5.0 Pro Layers', costUsd: 0.045, needsPrompt: true },
  'seedream-5.0-flash-layerize': { label: 'Seedream 5.0 Flash Layerize', costUsd: 0.459 },
};

export const DEFAULT_LAYER_MODEL = 'bytedance-seedream-5.0-pro-layer';

/** Video → video without watermark. */
export const WATERMARK_MODELS = {
  'video-watermark-remover': { label: 'Video Watermark Remover', costUsd: 0.065 },
  'seedance-2.0-watermark-remover': { label: 'Seedance 2.0 Watermark Remover', costUsd: 0.025 },
};

export const DEFAULT_WATERMARK_MODEL = 'video-watermark-remover';

const clampInt = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Math.round(Number(v) || lo)));

const requireHttps = (url, what) => {
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
    throw Object.assign(new Error(`${what} must be a public https URL`), { code: 'BAD_INPUT' });
  }
  return url;
};

const pick = (table, model, fallback, what) => {
  const id = model || fallback;
  if (!table[id]) throw Object.assign(new Error(`Unsupported ${what} model: ${id}`), { code: 'BAD_INPUT' });
  return [id, table[id]];
};

/**
 * Fill Gap request. At least one frame is required; when only one is given it
 * is used for both ends (a held, gently moving shot).
 * @returns {{ endpoint: string, payload: object, model: string }}
 */
export function buildFirstLastFramePayload({ model, firstFrameUrl, lastFrameUrl, prompt, duration = 5, resolution } = {}) {
  const [id, info] = pick(FIRST_LAST_FRAME_MODELS, model, DEFAULT_FILL_GAP_MODEL, 'Fill Gap');
  const first = requireHttps(firstFrameUrl || lastFrameUrl, 'A boundary frame');
  const last = requireHttps(lastFrameUrl || firstFrameUrl, 'A boundary frame');
  const payload = {
    prompt: String(prompt || 'Seamless, continuous shot bridging the two frames. Natural motion, consistent lighting.').slice(0, 2000),
    duration: clampInt(duration, info.durations),
  };
  if (info.fields === 'images_list') payload.images_list = [first, last];
  else if (info.fields === 'image_url+end_image_url') { payload.image_url = first; payload.end_image_url = last; }
  else { payload.image_url = first; payload.last_image = last; }
  if (resolution && info.resolutions?.includes(resolution)) payload.resolution = resolution;
  return { endpoint: `/${id}`, payload, model: id };
}

/** Extend a clip forward from its own video. */
export function buildVideoExtendPayload({ model, videoUrl, prompt, duration = 5 } = {}) {
  const [id, info] = pick(VIDEO_EXTEND_MODELS, model, DEFAULT_EXTEND_MODEL, 'Extend');
  const payload = { video_url: requireHttps(videoUrl, 'The clip video'), duration: clampInt(duration, info.durations) };
  const p = String(prompt || '').trim();
  if (p || info.needsPrompt) payload.prompt = (p || 'Continue the shot naturally with the same subject, camera motion and lighting.').slice(0, 2000);
  return { endpoint: `/${id}`, payload, model: id };
}

/**
 * Extend a clip backwards: animate INTO its first frame. Uses a first/last
 * frame model with the clip's first frame as the end frame.
 */
export function buildExtendBeforePayload({ model, firstFrameUrl, prompt, duration = 5 } = {}) {
  return buildFirstLastFramePayload({
    model: FIRST_LAST_FRAME_MODELS[model] ? model : DEFAULT_FILL_GAP_MODEL,
    firstFrameUrl,
    lastFrameUrl: firstFrameUrl,
    prompt: prompt || 'Lead-in shot that ends exactly on this frame. Natural motion, consistent lighting.',
    duration,
  });
}

export function buildLayerPayload({ model, imageUrl, prompt } = {}) {
  const [id, info] = pick(LAYER_MODELS, model, DEFAULT_LAYER_MODEL, 'layer');
  const payload = { image_url: requireHttps(imageUrl, 'The image'), output_format: 'png' };
  const p = String(prompt || '').trim();
  if (p || info.needsPrompt) payload.prompt = (p || 'Separate the image into foreground subject, mid-ground and background layers with transparency.').slice(0, 2000);
  return { endpoint: `/${id}`, payload, model: id };
}

export function buildWatermarkPayload({ model, videoUrl } = {}) {
  const [id] = pick(WATERMARK_MODELS, model, DEFAULT_WATERMARK_MODEL, 'watermark');
  return { endpoint: `/${id}`, payload: { video_url: requireHttps(videoUrl, 'The clip video') }, model: id };
}

/** All output URLs from a MuAPI result, in order. */
export function resultUrls(result) {
  if (!result || typeof result !== 'object') return [];
  const out = [];
  const push = (v) => {
    if (typeof v === 'string' && /^https?:\/\//.test(v)) out.push(v);
    else if (v && typeof v === 'object' && typeof v.url === 'string') out.push(v.url);
  };
  (Array.isArray(result.outputs) ? result.outputs : []).forEach(push);
  (Array.isArray(result.images) ? result.images : []).forEach(push);
  [result.url, result.output?.url, result.video?.url, result.image?.url].forEach(push);
  return [...new Set(out)];
}
