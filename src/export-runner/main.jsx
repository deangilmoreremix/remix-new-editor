/**
 * Export runner: renders the timeline to a video file with Remotion's web
 * renderer (renderMediaOnWeb, WebCodecs), inside a sandboxed iframe.
 *
 * Protocol (postMessage, parent ⇄ this frame):
 *   ← { type: 'runner-ready' }
 *   → { type: 'render', id, model, options: { container, videoCodec?, quality } }
 *   ← { type: 'progress', id, progress (0..1), encodedFrames }
 *   ← { type: 'done', id, blob, mimeType }
 *   ← { type: 'error', id, message }
 *   → { type: 'cancel', id }
 *   → { type: 'still', id, model, frame, options: { quality } }
 *   ← { type: 'still-done', id, blob, codeErrors }
 *
 * Remotion is used under its Free License (individuals and companies of up
 * to 3 people): https://remotion.dev/license
 */
import './sandboxShims.js';
import { renderMediaOnWeb, renderStillOnWeb } from '@remotion/web-renderer';
import { TimelineComposition, registerGoogleFonts } from '../lib/editor/remotion/TimelineComposition.jsx';
import { loadEffects, effectIdsInModel } from '../lib/editor/remotion/effects.js';
import { takeCodeErrors } from '../lib/editor/remotion/codeLayer.jsx';

const jobs = new Map();
const parentWin = window.parent;

function post(msg) {
  // The parent is the editor; this frame has an opaque origin so '*' is
  // the only target that works. The payload never contains secrets.
  parentWin.postMessage(msg, '*');
}

/** Blobs sent by the editor (local files) → object URLs in this frame. */
function materializeBlobs(v, urls) {
  if (v instanceof Blob) {
    const url = URL.createObjectURL(v);
    urls.push(url);
    return url;
  }
  if (Array.isArray(v)) return v.map((x) => materializeBlobs(x, urls));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, materializeBlobs(x, urls)]));
  return v;
}

const BITRATE = { '720p': 'high', '1080p': 'high', '4k': 'very-high' };

async function render(id, rawModel, options = {}) {
  const controller = new AbortController();
  jobs.set(id, controller);
  const urls = [];
  const model = materializeBlobs(rawModel, urls);
  try {
    if (typeof window.VideoEncoder !== 'function') {
      throw new Error('This browser cannot encode video. Use Chrome or Edge 94+, Firefox 130+ or Safari 26+.');
    }
    const container = ['mp4', 'webm', 'mov'].includes(options.container) ? options.container : 'mp4';
    // Fonts first, so frame 0 already uses them (HTML and Lottie SVG text).
    await Promise.race([registerGoogleFonts(model.fonts || []), new Promise((r) => setTimeout(r, 15000))]);
    await loadEffects(effectIdsInModel(model));
    const result = await renderMediaOnWeb({
      composition: {
        id: 'timeline',
        component: TimelineComposition,
        width: model.width,
        height: model.height,
        fps: model.fps,
        durationInFrames: model.durationInFrames,
        defaultProps: { model },
      },
      inputProps: { model },
      container,
      videoCodec: options.videoCodec || (container === 'webm' ? 'vp9' : 'h264'),
      videoBitrate: BITRATE[options.quality] || 'high',
      signal: controller.signal,
      licenseKey: 'free-license',
      onProgress: (p) => post({ type: 'progress', id, progress: p.progress, encodedFrames: p.encodedFrames }),
    });
    const blob = await result.getBlob();
    post({ type: 'done', id, blob, mimeType: blob.type, codeErrors: takeCodeErrors() });
  } catch (err) {
    post({ type: 'error', id, message: controller.signal.aborted ? 'Export cancelled' : (err?.message || String(err)) });
  } finally {
    jobs.delete(id);
    urls.forEach((u) => URL.revokeObjectURL(u));
  }
}

/** One frame as a JPEG (for the AI agent's preview_frame tool), with animation errors. */
async function still(id, rawModel, frame) {
  const urls = [];
  const model = materializeBlobs(rawModel, urls);
  try {
    takeCodeErrors();
    await Promise.race([registerGoogleFonts(model.fonts || []), new Promise((r) => setTimeout(r, 15000))]);
    await loadEffects(effectIdsInModel(model));
    const result = await renderStillOnWeb({
      composition: {
        id: 'timeline', component: TimelineComposition, width: model.width, height: model.height, fps: model.fps,
        durationInFrames: model.durationInFrames, defaultProps: { model },
      },
      inputProps: { model },
      frame: Math.max(0, Math.min(model.durationInFrames - 1, Math.round(frame))),
      licenseKey: 'free-license',
      delayRenderTimeoutInMilliseconds: 20000,
    });
    const blob = await result.blob({ format: 'jpeg', quality: 0.8 });
    post({ type: 'still-done', id, blob, codeErrors: takeCodeErrors() });
  } catch (err) {
    post({ type: 'error', id, message: err?.message || String(err), codeErrors: takeCodeErrors() });
  } finally {
    urls.forEach((u) => URL.revokeObjectURL(u));
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== parentWin) return;
  const msg = event.data || {};
  if (msg.type === 'render' && msg.id && msg.model) render(msg.id, msg.model, msg.options);
  else if (msg.type === 'still' && msg.id && msg.model) still(msg.id, msg.model, Number(msg.frame) || 0);
  else if (msg.type === 'cancel' && jobs.has(msg.id)) jobs.get(msg.id).abort();
});

post({ type: 'runner-ready' });
