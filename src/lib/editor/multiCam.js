/**
 * Multi-Cam: picture-in-picture and split screen, drawn in the video itself
 * (preview, export and the published player all read the same layers).
 *
 *   state.multiCam = {
 *     mode: 'single' | 'pip' | 'split',
 *     mainTrackId, secondTrackId,              // two video tracks
 *     pip:   { corner: 'bottom-right' | …, size: 15–60 },   // % of the frame width
 *     split: { orientation: 'vertical' | 'horizontal', ratio: 0.2–0.8 },
 *   }
 *
 * Boxes are in % of the frame: { left, top, width, height, radius, border }.
 */
export const MULTICAM_MODES = ['single', 'pip', 'split'];
export const PIP_CORNERS = [['top-left', 'Top left'], ['top-right', 'Top right'], ['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right']];

export const DEFAULT_MULTICAM = {
  mode: 'single', mainTrackId: null, secondTrackId: null,
  pip: { corner: 'bottom-right', size: 30 },
  split: { orientation: 'vertical', ratio: 0.5 },
};

const clamp = (v, lo, hi, d) => Math.min(hi, Math.max(lo, Number.isFinite(Number(v)) ? Number(v) : d));

export function normalizeMultiCam(mc) {
  const m = mc && typeof mc === 'object' ? mc : {};
  return {
    mode: MULTICAM_MODES.includes(m.mode) ? m.mode : 'single',
    mainTrackId: m.mainTrackId || null,
    secondTrackId: m.secondTrackId || null,
    pip: { corner: PIP_CORNERS.some(([c]) => c === m.pip?.corner) ? m.pip.corner : 'bottom-right', size: clamp(m.pip?.size, 15, 60, 30) },
    split: { orientation: m.split?.orientation === 'horizontal' ? 'horizontal' : 'vertical', ratio: clamp(m.split?.ratio, 0.2, 0.8, 0.5) },
  };
}

/** The box for the main or second camera in the current mode (null = full frame). */
export function multiCamBox(mc, role) {
  const m = normalizeMultiCam(mc);
  if (m.mode === 'pip') {
    if (role === 'main') return null;
    const w = m.pip.size; const h = w; // the frame is 16:9, so a 16:9 window has equal % width and height
    const margin = 3;
    const left = m.pip.corner.endsWith('left') ? margin : 100 - w - margin;
    const top = m.pip.corner.startsWith('top') ? margin * 1.8 : 100 - h - margin * 1.8;
    return { left, top, width: w, height: h, radius: 10, border: 3 };
  }
  if (m.mode === 'split') {
    const r = m.split.ratio * 100;
    if (m.split.orientation === 'vertical') {
      return role === 'main' ? { left: 0, top: 0, width: r, height: 100 } : { left: r, top: 0, width: 100 - r, height: 100 };
    }
    return role === 'main' ? { left: 0, top: 0, width: 100, height: r } : { left: 0, top: r, width: 100, height: 100 - r };
  }
  return null;
}

/** True when the mode needs two real video tracks and has them. */
export function multiCamActive(mc, tracks = []) {
  const m = normalizeMultiCam(mc);
  if (m.mode === 'single' || !m.secondTrackId || m.secondTrackId === m.mainTrackId) return false;
  const has = (id) => tracks.some((t) => t.id === id && String(t.type || '').toLowerCase() === 'video');
  return has(m.secondTrackId) && (!m.mainTrackId || has(m.mainTrackId));
}

/**
 * Put boxes on the media layers of the two tracks, and draw the second camera
 * above the main one. Returns the new layer list (the input is not changed).
 * Layers carry `trackId`.
 */
export function applyMultiCam(layers, tracks, mc) {
  if (!multiCamActive(mc, tracks)) return layers;
  const m = normalizeMultiCam(mc);
  const mainId = m.mainTrackId || (tracks.find((t) => String(t.type || '').toLowerCase() === 'video' && t.id !== m.secondTrackId) || {}).id;
  const isMedia = (l) => l.kind === 'video' || l.kind === 'image';
  const mainBox = multiCamBox(m, 'main');
  const secondBox = multiCamBox(m, 'second');
  const out = layers.map((l) => {
    if (!isMedia(l)) return l;
    if (l.trackId === m.secondTrackId) return { ...l, box: secondBox, camera: 'second' };
    if (l.trackId === mainId && mainBox) return { ...l, box: mainBox, camera: 'main' };
    return l;
  });
  // Second camera above every other media layer.
  const second = out.filter((l) => l.camera === 'second');
  const rest = out.filter((l) => l.camera !== 'second');
  let at = -1;
  rest.forEach((l, i) => { if (isMedia(l)) at = i; });
  rest.splice(at + 1, 0, ...second);
  return rest;
}
