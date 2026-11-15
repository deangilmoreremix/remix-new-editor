/**
 * Project thumbnails and stored renders.
 *
 * The thumbnail is one JPEG frame rendered by the editor's existing sandboxed renderer (`renderStill`), uploaded
 * with the existing `uploadFileToStorage`, and saved on the project (`timeline_projects.thumbnail_url`). A project
 * with no visual media gets none (the card shows its placeholder instead of a black frame). Everything is
 * best-effort: a failure never blocks saving, publishing or exporting.
 */

export const THUMB_TYPES = new Set(['video', 'image', 'overlay-image', 'sticker', 'lottie']);

const clipsOf = (t) => (Array.isArray(t?.items) ? t.items : Array.isArray(t?.clips) ? t.clips : []);

/** True when the timeline has something visual to render. */
export function hasVisualMedia(state) {
  return (state?.tracks || []).some((t) => clipsOf(t).some((c) => c && (THUMB_TYPES.has(c.type) || (c.src && /\.(png|jpe?g|webp|gif|mp4|webm|mov)(\?|$)/i.test(String(c.src))))));
}

/** A representative frame: the playhead if the owner placed it, otherwise ~10% in (never the very first, often black, frame). */
export function thumbnailFrame(state, fps = 30, durationInFrames = Infinity) {
  const total = Number(state?.timelineSeconds) || 0;
  const playhead = ((Number(state?.playheadPercent) || 0) / 100) * total;
  const sec = playhead > 0.2 ? playhead : Math.min(total * 0.1, 3);
  return Math.min(Math.max(0, Math.round(sec * fps)), Math.max(0, durationInFrames - 1));
}

/**
 * @param {object} state editor state
 * @param {object} deps { buildModel(state)->model, renderStill(model, frame)->{blob}, upload(File)->url, fps? }
 * @returns {Promise<string|null>} public URL, or null when there is nothing to render / it failed
 */
export async function captureThumbnail(state, { buildModel, renderStill, upload, fps = 30 }) {
  if (!hasVisualMedia(state)) return null;
  try {
    const model = await buildModel(state);
    const { blob } = await renderStill(model, thumbnailFrame(state, fps, model?.durationInFrames));
    if (!blob || !blob.size) return null;
    const file = new File([blob], 'thumbnail.jpg', { type: blob.type || 'image/jpeg' });
    return await upload(file);
  } catch {
    return null;
  }
}

const EXT = { mp4: 'mp4', webm: 'webm', mov: 'mov' };

/**
 * Store an exported video and describe it for `timeline_projects.render`.
 * The file is uploaded to the same storage as other media; if that fails the render is still recorded
 * (status complete, no url) so the project shows it was rendered, and `stored: false` says the file was not kept.
 */
export async function storeRender(blob, { container = 'mp4', quality = '1080p', durationS = null, name = 'export', upload }) {
  const base = { status: 'complete', container, quality, bytes: blob?.size ?? null, duration_s: durationS };
  try {
    const file = new File([blob], `${String(name).replace(/[^a-z0-9 _-]+/gi, '').trim() || 'export'}.${EXT[container] || 'mp4'}`, { type: blob.type || `video/${EXT[container] || 'mp4'}` });
    const url = await upload(file);
    return { ...base, url, stored: true };
  } catch (err) {
    return { ...base, stored: false, error: String(err?.message || err).slice(0, 160) };
  }
}
