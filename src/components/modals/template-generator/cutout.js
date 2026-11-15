/**
 * Template Generator — remove the background from a picked clip (presenter cut-out).
 *
 * Uses the editor's own on-device model (MODNet, `lib/editor/remotion/bgRemoval.js`): nothing is uploaded for processing, no key is needed.
 * The first use downloads the ~25 MB model. The result (a transparent WebM, or a PNG for photos) is stored in the customer's storage so it
 * survives saving and exporting; the original link is kept on the clip so it can be restored.
 */
import { clipDuration } from './rules.js';
import { uploadFileToStorage } from '../../../lib/uploadService.js';

/** Photos can always be cut out; video needs WebCodecs (Chrome / Edge). */
export const canCutOut = (item, env = globalThis) => !!item && (item.kind === 'image' || typeof env.VideoEncoder === 'function');

/** How much of the picture the cut-out kept (0..1), sampled from a middle frame. null when it can't be measured. */
export async function opaqueShare(blob, kind = 'video') {
  if (typeof document === 'undefined') return null;
  const url = URL.createObjectURL(blob);
  try {
    let source; let w; let h;
    if (kind === 'image') {
      source = new Image(); source.src = url; await source.decode(); w = source.naturalWidth; h = source.naturalHeight;
    } else {
      source = document.createElement('video'); source.muted = true; source.src = url;
      await new Promise((ok, no) => { source.onloadeddata = ok; source.onerror = () => no(new Error('x')); setTimeout(() => no(new Error('x')), 8000); });
      source.currentTime = Math.min((source.duration || 1) / 2, 2);
      await new Promise((ok) => { source.onseeked = ok; setTimeout(ok, 2000); });
      w = source.videoWidth; h = source.videoHeight;
    }
    if (!w || !h) return null;
    const scale = 96 / Math.max(w, h);
    const cw = Math.max(1, Math.round(w * scale)); const ch = Math.max(1, Math.round(h * scale));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(source, 0, 0, cw, ch);
    const px = g.getImageData(0, 0, cw, ch).data;
    let kept = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 40) kept += 1;
    return kept / (cw * ch);
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

/** A cut-out that keeps less than this is almost certainly a failure (the model found no person), so it is not applied. */
export const MIN_KEPT = 0.06;

const isDurable = (url) => typeof url === 'string' && !!url && !/^(blob|data):/.test(url);

/** @returns {Promise<{ url: string, durable: boolean }>} */
export async function removeClipBackground(item, { onProgress, signal, deps = {} } = {}) {
  const lib = deps.lib || (await import('../../../lib/editor/remotion/bgRemoval.js'));
  const upload = deps.upload || uploadFileToStorage;
  const isVideo = item.kind !== 'image';
  let blob;
  try {
    blob = isVideo
      ? await lib.removeVideoBackground(item.url, { fromSec: 0, toSec: clipDuration(item), maskEvery: 2, edge: 0, maxSize: 1280, onProgress, signal })
      : await lib.removeImageBackground(item.url, { edge: 0, onProgress, signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    // a cross-origin host that does not allow reading its files shows up as a failed fetch
    if (err instanceof TypeError || /fetch|network|cors/i.test(String(err?.message))) {
      throw new Error('This clip\'s host does not let the browser read the file, so it can\'t be cut out here. Upload the clip, or use a Video template or My media clip.');
    }
    throw err;
  }
  const kept = await (deps.opaqueShare || opaqueShare)(blob, isVideo ? 'video' : 'image');
  if (kept != null && kept < MIN_KEPT) {
    throw new Error('Almost nothing was kept, so your clip was left as it is. The cut-out works best on a person who is close to the camera, in good light.');
  }
  const name = `${String(item.title || 'clip').replace(/[^\w-]+/g, '_').slice(0, 40)}-no-background.${isVideo ? 'webm' : 'png'}`;
  const file = new File([blob], name, { type: blob.type || (isVideo ? 'video/webm' : 'image/png') });
  let url = '';
  try { const out = await upload(file); url = typeof out === 'string' ? out : out?.url || ''; } catch { url = ''; }
  const durable = isDurable(url);
  if (!durable) url = (deps.localUrl || ((b) => URL.createObjectURL(b)))(blob);
  return { url, durable };
}
