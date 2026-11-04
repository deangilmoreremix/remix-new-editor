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
 *
 * Remotion is used under its Free License (individuals and companies of up
 * to 3 people): https://remotion.dev/license
 */
import './sandboxShims.js';
import { renderMediaOnWeb } from '@remotion/web-renderer';
import { TimelineComposition, registerGoogleFonts } from '../lib/editor/remotion/TimelineComposition.jsx';

const jobs = new Map();
const parentWin = window.parent;

function post(msg) {
  // The parent is the editor; this frame has an opaque origin so '*' is
  // the only target that works. The payload never contains secrets.
  parentWin.postMessage(msg, '*');
}

const BITRATE = { '720p': 'high', '1080p': 'high', '4k': 'very-high' };

async function render(id, model, options = {}) {
  const controller = new AbortController();
  jobs.set(id, controller);
  try {
    if (typeof window.VideoEncoder !== 'function') {
      throw new Error('This browser cannot encode video. Use Chrome or Edge 94+, Firefox 130+ or Safari 26+.');
    }
    const container = ['mp4', 'webm', 'mov'].includes(options.container) ? options.container : 'mp4';
    // Fonts first, so frame 0 already uses them (HTML and Lottie SVG text).
    await Promise.race([registerGoogleFonts(model.fonts || []), new Promise((r) => setTimeout(r, 15000))]);
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
    post({ type: 'done', id, blob, mimeType: blob.type });
  } catch (err) {
    post({ type: 'error', id, message: controller.signal.aborted ? 'Export cancelled' : (err?.message || String(err)) });
  } finally {
    jobs.delete(id);
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== parentWin) return;
  const msg = event.data || {};
  if (msg.type === 'render' && msg.id && msg.model) render(msg.id, msg.model, msg.options);
  else if (msg.type === 'cancel' && jobs.has(msg.id)) jobs.get(msg.id).abort();
});

post({ type: 'runner-ready' });
