/**
 * Template Generator — remove the background from a picked clip (presenter cut-out).
 *
 * Runs on this device (BG0 when the browser can run it, otherwise the older MODNet): nothing is uploaded for processing, no key is needed.
 * The first use downloads a model (about 190 MB for BG0, 25 MB for MODNet). The result (a transparent WebM, or a PNG for photos) is stored in the customer's storage so it
 * survives saving and exporting; the original link is kept on the clip so it can be restored.
 */
import { clipDuration } from './rules.js';
import { uploadFileToStorage } from '../../../lib/uploadService.js';
import { loadBg0 } from './bg0Engine.js';

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

/** The picture's own file (the catalog, your uploads and most stock hosts allow the browser to read it). */
async function fetchBlob(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Couldn't load the picture (${res.status})`);
  return res.blob();
}
const isCancel = (e) => e?.name === 'AbortError' || e?.code === 'cancelled';
const abortError = () => Object.assign(new Error('Cancelled'), { name: 'AbortError' });

/**
 * @returns {Promise<{ url: string, durable: boolean, engine: string }>}
 * Engine: BG0 (BiRefNet) when this browser can run it, otherwise (or if it fails) the older on-device MODNet.
 * `deps` lets tests replace the services: { lib (bgRemoval.js), bg0 (an engine, or null for none), upload, localUrl, opaqueShare }.
 */
export async function removeClipBackground(item, { onProgress, signal, deps = {} } = {}) {
  const lib = deps.lib || (await import('../../../lib/editor/remotion/bgRemoval.js'));
  const bg0 = deps.bg0 !== undefined ? deps.bg0 : await loadBg0();
  const upload = deps.upload || uploadFileToStorage;
  const isVideo = item.kind !== 'image';
  const fallback = async () => (isVideo
    ? lib.removeVideoBackground(item.url, { fromSec: 0, toSec: clipDuration(item), maskEvery: 2, edge: 0, maxSize: 1280, onProgress, signal })
    : lib.removeImageBackground(item.url, { edge: 0, onProgress, signal }));

  let blob; let engine = 'modnet';
  try {
    if (bg0) {
      try {
        if (isVideo) {
          // a big model is slow on a CPU, so it is used on sampled frames (about 90 s of masks), and every frame on a fast GPU
          blob = await lib.removeVideoBackground(item.url, { fromSec: 0, toSec: clipDuration(item), edge: 0, maxSize: 720, maskFn: bg0.maskFn, prepare: bg0.prepare, maskBudgetSec: 90, onProgress, signal });
        } else {
          blob = await bg0.removeImage(await fetchBlob(item.url, signal), { onProgress, signal });
        }
        engine = 'bg0';
      } catch (err) {
        if (isCancel(err) || signal?.aborted) throw abortError();
        if (err instanceof TypeError || /fetch|network|cors/i.test(String(err?.message))) throw err;   // an unreadable host: the older model would hit the same wall
        blob = null;                                                                                    // the model could not run here: use the older one
      }
    }
    if (!blob) blob = await fallback();
  } catch (err) {
    if (isCancel(err)) throw abortError();
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
  return { url, durable, engine };
}
