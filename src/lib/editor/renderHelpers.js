/**
 * Pure Render Studio helper functions extracted for testability.
 */

import { buildFilenameStem } from './renderMedia.js';

export const ASPECT_DIMS = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '16:9': { width: 1920, height: 1080 },
};

export function extensionForMime(mimeType) {
  if (!mimeType) return 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('avc1') || mimeType.includes('h264') || mimeType.includes('hevc')) return 'mp4';
  return 'webm';
}

export function resolveExportMimeType(format) {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const fmt = (format || 'webm').toLowerCase();
  const candidatesByFormat = {
    mp4: ['video/mp4;codecs=h264', 'video/mp4;codecs=avc1', 'video/mp4'],
    mov: ['video/mp4;codecs=h264', 'video/mp4;codecs=avc1', 'video/mp4'],
    h265: ['video/mp4;codecs=hevc', 'video/mp4;codecs=h265'],
    webm: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
  };
  const candidates = candidatesByFormat[fmt] || candidatesByFormat.webm;
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || '';
}

export function getVideoBitrate({ width = 1920, height = 1080, fps = 30, quality = 82 } = {}) {
  const normalizedQuality = Math.max(0, Math.min(100, Number(quality) || 82));
  const pixels = width * height;
  const baseBps = (pixels / (1920 * 1080)) * 2_500_000;
  const fpsFactor = fps / 30;
  const qualityFactor = 0.1 + (normalizedQuality / 100) * 1.9;
  return Math.max(500_000, Math.round(baseBps * fpsFactor * qualityFactor));
}

/**
 * COVER: fill the destination canvas, cropping the source as needed.
 * The returned rect describes the source rectangle to draw, mapped to the
 * full destination canvas.
 */
export function computeCoverRect(srcWidth, srcHeight, dstWidth, dstHeight) {
  const srcAspect = srcWidth / srcHeight;
  const dstAspect = dstWidth / dstHeight;
  let sx, sy, sw, sh;
  if (srcAspect > dstAspect) {
    sh = srcHeight;
    sw = Math.round(srcHeight * dstAspect);
    sx = Math.round((srcWidth - sw) / 2);
    sy = 0;
  } else {
    sw = srcWidth;
    sh = Math.round(srcWidth / dstAspect);
    sx = 0;
    sy = Math.round((srcHeight - sh) / 2);
  }
  return { sx, sy, sw, sh, dx: 0, dy: 0, dw: dstWidth, dh: dstHeight };
}

/**
 * CONTAIN: show the full source within the destination, letterboxing/pillarboxing.
 * The returned rect describes the destination rectangle to draw into.
 */
export function computeContainRect(srcWidth, srcHeight, dstWidth, dstHeight) {
  const srcAspect = srcWidth / srcHeight;
  const dstAspect = dstWidth / dstHeight;
  let dw, dh, dx, dy;
  if (srcAspect > dstAspect) {
    dw = dstWidth;
    dh = Math.round(dstWidth / srcAspect);
    dx = 0;
    dy = Math.round((dstHeight - dh) / 2);
  } else {
    dh = dstHeight;
    dw = Math.round(dstHeight * srcAspect);
    dx = Math.round((dstWidth - dw) / 2);
    dy = 0;
  }
  return { sx: 0, sy: 0, sw: srcWidth, sh: srcHeight, dx, dy, dw, dh };
}

export function computeTrailerDuration(timeRange, settingsDuration, sourceDurationSec) {
  if (timeRange && typeof timeRange.start === 'number' && typeof timeRange.end === 'number') {
    return Math.max(500, (timeRange.end - timeRange.start) * 1000);
  }
  if (typeof settingsDuration === 'number' && settingsDuration > 0) {
    return settingsDuration * 1000;
  }
  return (sourceDurationSec || 5) * 1000;
}

export function buildFrameFilename(baseName, format, currentTimeSec) {
  const minutes = Math.floor(currentTimeSec / 60);
  const seconds = Math.floor(currentTimeSec % 60);
  const ms = Math.floor((currentTimeSec % 1) * 1000);
  const timeTag = `${String(minutes).padStart(2, '0')}-${String(seconds).padStart(2, '0')}-${String(ms).padStart(3, '0')}`;
  const extension = format === 'image/jpeg' ? 'jpg' : format.replace('image/', '') || 'png';
  const safeBase = String(baseName || `smartvideo-frame-${timeTag}`).replace(/[^a-zA-Z0-9_-]+/g, '_');
  return `${safeBase}.${extension}`;
}

const SOURCE_FIELD_ALIASES = {
  videoUrl: ['videoUrl', 'url', 'source', 'src', 'href'],
  assetId: ['assetId', 'asset_id', 'asset'],
  videoId: ['videoId', 'video_id', 'id'],
  title: ['title', 'name', 'label', 'displayName'],
  sourceStudio: ['sourceStudio', 'source_studio', 'studio', 'provider', 'source'],
};

export function normalizeSourceDescriptor(input) {
  if (input == null) return emptySourceDescriptor();
  if (typeof input === 'string') {
    return { ...emptySourceDescriptor(), videoUrl: input };
  }
  if (typeof input !== 'object') return emptySourceDescriptor();

  const result = {};
  for (const [canonical, aliases] of Object.entries(SOURCE_FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (input[alias] !== undefined && input[alias] !== null && input[alias] !== '') {
        result[canonical] = String(input[alias]);
        break;
      }
    }
  }
  return { ...emptySourceDescriptor(), ...result, metadata: input.metadata || {} };
}

function emptySourceDescriptor() {
  return {
    assetId: '',
    videoId: '',
    videoUrl: '',
    title: '',
    sourceStudio: '',
    sourceType: '',
    metadata: {},
  };
}

export function clampTimeRange(range, sourceDuration) {
  if (
    !range ||
    typeof range.start !== 'number' ||
    typeof range.end !== 'number' ||
    !Number.isFinite(range.start) ||
    !Number.isFinite(range.end) ||
    typeof sourceDuration !== 'number' ||
    !Number.isFinite(sourceDuration) ||
    sourceDuration <= 0
  ) {
    return null;
  }
  const start = Math.max(0, range.start);
  const end = Math.min(sourceDuration, range.end);
  if (start >= end) return null;
  return { start, end };
}

const HIGHLIGHT_START_KEYS = ['startTime', 'start_time', 'start'];
const HIGHLIGHT_END_KEYS = ['endTime', 'end_time', 'end'];
const HIGHLIGHT_OPTIONAL_KEYS = ['confidence', 'type'];

export function normalizeHighlightSegments(highlights, sourceDuration) {
  if (!Array.isArray(highlights)) return [];
  const result = [];
  for (const entry of highlights) {
    if (!entry || typeof entry !== 'object') continue;
    const start = readFirstNumber(entry, HIGHLIGHT_START_KEYS);
    const end = readFirstNumber(entry, HIGHLIGHT_END_KEYS);
    if (start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start >= end) continue;
    const clamped = clampTimeRange({ start, end }, sourceDuration);
    if (!clamped) continue;
    const confidence = readFirstNumber(entry, HIGHLIGHT_OPTIONAL_KEYS.slice(0, 1));
    const type = readFirstString(entry, HIGHLIGHT_OPTIONAL_KEYS.slice(1));
    result.push({
      start: clamped.start,
      end: clamped.end,
      duration: clamped.end - clamped.start,
      confidence: confidence != null && Number.isFinite(confidence) ? confidence : 1,
      type: type || 'generic',
    });
  }
  result.sort((a, b) => a.start - b.start);
  return result;
}

const SUBTITLE_START_KEYS = ['start', 'startTime', 'start_time'];
const SUBTITLE_END_KEYS = ['end', 'endTime', 'end_time'];
const SUBTITLE_TEXT_KEYS = ['text', 'content', 'caption', 'subtitle'];

export function normalizeSubtitleSegments(segments) {
  if (!Array.isArray(segments)) return [];
  const result = [];
  for (const entry of segments) {
    if (!entry || typeof entry !== 'object') continue;
    const start = readFirstNumber(entry, SUBTITLE_START_KEYS);
    const end = readFirstNumber(entry, SUBTITLE_END_KEYS);
    const text = readFirstString(entry, SUBTITLE_TEXT_KEYS);
    if (text == null || text.trim() === '') continue;
    if (start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start >= end) continue;
    result.push({ start, end, text: text.trim() });
  }
  result.sort((a, b) => a.start - b.start);
  return result;
}

export const SUPPORTED_TRANSITIONS = ['cut', 'fade', 'dissolve', 'slide', 'wipe'];
export const SUPPORTED_EFFECTS = ['none', 'brightness', 'contrast', 'blur', 'grayscale', 'sepia', 'vignette'];
const SUPPORTED_ASPECT_RATIOS = ['9:16', '1:1', '4:5', '16:9'];

export function validateAutoEditPlan(plan, sourceDuration) {
  if (!plan || typeof plan !== 'object') {
    return { valid: false, errors: ['Plan must be a non-null object'], segments: [], subtitles: [], outputAspectRatio: '', audio: {} };
  }

  const errors = [];
  const segments = [];
  const subtitles = [];
  let outputAspectRatio = '';
  let audio = {};

  const planSegments = Array.isArray(plan.segments) ? plan.segments : undefined;
  const hasExplicitSegments = planSegments !== undefined;

  if (planSegments && planSegments.length === 0) {
    // Empty explicit segments array: treat as no segments, do NOT auto-create
  } else if (planSegments) {
    for (let i = 0; i < planSegments.length; i++) {
      const raw = planSegments[i];
      if (!raw || typeof raw !== 'object') {
        errors.push(`Segment ${i} is not a valid object`);
        continue;
      }
      const start = raw.sourceStart ?? raw.start;
      const end = raw.sourceEnd ?? raw.end;
      if (start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end)) {
        errors.push(`Segment ${i} has non-finite or missing range`);
        continue;
      }
      if (start >= end) {
        errors.push(`Segment ${i} has start >= end`);
        continue;
      }
      if (sourceDuration != null && Number.isFinite(sourceDuration) && sourceDuration > 0) {
        if (start < 0 || end > sourceDuration) {
          errors.push(`Segment ${i} is out of bounds [0, ${sourceDuration}]`);
          continue;
        }
      }
      const crop = raw.crop || 'cover';
      const transition = raw.transition ? String(raw.transition).toLowerCase() : 'cut';
      if (!SUPPORTED_TRANSITIONS.includes(transition)) {
        errors.push(`Segment ${i} uses unsupported transition "${transition}"`);
      }
      const effects = Array.isArray(raw.effects) ? raw.effects : [];
      const unsupportedEffects = effects.filter((e) => !SUPPORTED_EFFECTS.includes(String(e).toLowerCase()));
      if (unsupportedEffects.length > 0) {
        errors.push(`Segment ${i} uses unsupported effects: ${unsupportedEffects.join(', ')}`);
      }
      segments.push({
        sourceStart: start,
        sourceEnd: end,
        order: i,
        crop,
        effects: effects.map((e) => String(e).toLowerCase()),
        transition,
      });
    }
  }

  if (!hasExplicitSegments && errors.length === 0) {
    const clamped = clampTimeRange({ start: 0, end: sourceDuration || 0 }, sourceDuration || 0);
    if (clamped) {
      segments.push({
        sourceStart: clamped.start,
        sourceEnd: clamped.end,
        order: 0,
        crop: 'cover',
        effects: [],
        transition: 'cut',
      });
    }
  }

  if (plan.subtitles && Array.isArray(plan.subtitles)) {
    const normalizedSubs = normalizeSubtitleSegments(plan.subtitles);
    subtitles.push(...normalizedSubs);
  }

  if (plan.outputAspectRatio != null) {
    const ratio = String(plan.outputAspectRatio).trim();
    if (!SUPPORTED_ASPECT_RATIOS.includes(ratio)) {
      errors.push(`Unsupported output aspect ratio "${ratio}"`);
    } else {
      outputAspectRatio = ratio;
    }
  }

  if (plan.audio && typeof plan.audio === 'object') {
    audio = { ...plan.audio };
  }

  return {
    valid: errors.length === 0,
    errors,
    segments,
    subtitles,
    outputAspectRatio,
    audio,
  };
}

export function buildDeliveryManifest(entries, options = {}) {
  const generator = options.generator || 'render-studio';
  const version = options.version || '1.0.0';
  const createdAt = options.createdAt || new Date().toISOString();

  const files = (Array.isArray(entries) ? entries : []).map((entry, index) => {
    const stem = buildFilenameStem(entry.filename, `delivery-${String(index).padStart(3, '0')}`);
    const action = entry.action ? String(entry.action).toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'export';
    const filename = entry.filename || `${stem}_${action}`;
    const size = typeof entry.size === 'number' ? entry.size : 0;
    return {
      filename,
      mime: entry.mime || '',
      width: typeof entry.width === 'number' ? entry.width : 0,
      height: typeof entry.height === 'number' ? entry.height : 0,
      duration: typeof entry.duration === 'number' ? entry.duration : 0,
      size,
      action: entry.action || 'export',
      hasAudio: !!entry.hasAudio,
    };
  });

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  return {
    version,
    createdAt,
    generator,
    files,
    totals: {
      count: files.length,
      bytes: totalBytes,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RENDER OVERLAYS — personalized logo / brand-reference / text compositing
 * ═══════════════════════════════════════════════════════════════════════════
 * The capture path composites one base image per frame — the source video,
 * drawn by `ctx.drawImage(video, sourceRect…)` in `drawFrame()`. Overlays are
 * the additive step on top of that base frame, so an export can carry a client
 * logo, an optional brand reference and the business name / call to action.
 *
 * TWO-PHASE CONTRACT (the important part)
 * ---------------------------------------
 *  1. SETUP, once, before the capture starts:
 *       const prepared = await prepareRenderOverlays(overlays);
 *     Every image overlay is turned into a decoded `Image` here. This is the
 *     only async step.
 *  2. PER FRAME, fully synchronous, inside `drawFrame()`:
 *       drawOverlays(ctx, prepared, { width, height, visibleRect });
 *     No `await`, no `new Image()`, no network — a frame draw must never
 *     stall the MediaRecorder capture. An overlay whose image failed to load
 *     is skipped with a warning; a draw failure never throws.
 *
 * GEOMETRY IS RESOLUTION-INDEPENDENT
 * ----------------------------------
 * `x` / `y` / `width` / `height` / `fontSize` / `maxWidth` are FRACTIONS of
 * the visible video area (0..1), never pixels, so the same descriptor renders
 * identically at 1080p and 4K. Overlays are positioned inside the VISIBLE
 * area (the drawn video rect), so `settings.contain` letterbox bars are never
 * covered: pass the contain rect as `visibleRect`.
 *
 * DESCRIPTOR SCHEMA
 * -----------------
 * Image overlay (logo / brand reference):
 *   { id, type: 'image', url, x, y, width, height, opacity, source }
 *     x, y      top-left corner, fraction of the visible area (0..1)
 *     width     fraction of the visible width (0..1)
 *     height    fraction of the visible height (0..1), or null to preserve the
 *               decoded image's aspect ratio
 *     opacity   0..1
 * Text overlay (business name / CTA):
 *   { id, type: 'text', text, x, y, fontSize, color, fontFamily, align,
 *     opacity, maxWidth, lineHeight, fontWeight, shadow, source }
 *     x, y      anchor point, fraction of the visible area; `x` is interpreted
 *               per `align` ('left' | 'center' | 'right')
 *     fontSize  fraction of the visible height (0..1)
 *     maxWidth  wrapping width, fraction of the visible width
 * `id` is the merge key: a studio-supplied overlay with the same id replaces
 * the personalization one (studio values always win).
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Font stack used by text overlays when the descriptor does not pick one. */
export const RENDER_OVERLAY_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Text alignments `drawOverlays` understands. */
export const RENDER_OVERLAY_ALIGN = Object.freeze(['left', 'center', 'right']);

/** Per-type defaults for any descriptor field the caller left out. */
export const RENDER_OVERLAY_DEFAULTS = Object.freeze({
  image: Object.freeze({ x: 0.84, y: 0.04, width: 0.12, height: null, opacity: 0.9 }),
  text: Object.freeze({
    x: 0.5,
    y: 0.86,
    fontSize: 0.05,
    color: '#ffffff',
    fontFamily: RENDER_OVERLAY_FONT,
    align: 'center',
    opacity: 1,
    maxWidth: 0.9,
    lineHeight: 1.2,
    fontWeight: 600,
    shadow: true,
  }),
});

function clampFraction(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clampOpacity(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/**
 * Normalize the visible video area (the rect the base frame is drawn into).
 * Falls back to the whole canvas when a caller passes nothing usable.
 *
 * @param {{x?: number, y?: number, width?: number, height?: number}} [visible]
 * @param {{width: number, height: number}} canvas
 */
export function normalizeOverlayVisibleRect(visible, canvas) {
  const canvasWidth = Number(canvas && canvas.width) || 0;
  const canvasHeight = Number(canvas && canvas.height) || 0;
  const full = { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
  if (!visible || typeof visible !== 'object') return full;

  const x = Number.isFinite(visible.x) ? visible.x : 0;
  const y = Number.isFinite(visible.y) ? visible.y : 0;
  const width = Number.isFinite(visible.width) ? visible.width : canvasWidth - x;
  const height = Number.isFinite(visible.height) ? visible.height : canvasHeight - y;
  const clampedWidth = Math.max(0, Math.min(width, canvasWidth - x));
  const clampedHeight = Math.max(0, Math.min(height, canvasHeight - y));
  if (clampedWidth <= 0 || clampedHeight <= 0) return full;
  return { x, y, width: clampedWidth, height: clampedHeight };
}

/**
 * Read the aspect ratio (height / width) of a decoded image, when known.
 * @param {{naturalWidth?: number, naturalHeight?: number, width?: number, height?: number}} image
 * @returns {number|null}
 */
export function overlayImageAspect(image) {
  if (!image) return null;
  const w = Number(image.naturalWidth) || Number(image.width) || 0;
  const h = Number(image.naturalHeight) || Number(image.height) || 0;
  if (!(w > 0) || !(h > 0)) return null;
  return h / w;
}

function resolveOverlayType(raw) {
  if (raw.type === 'image' || raw.type === 'text') return raw.type;
  return typeof raw.text === 'string' && raw.text.trim() !== '' ? 'text' : 'image';
}

function fallbackOverlayId(type, raw) {
  if (typeof raw.id === 'string' && raw.id.trim() !== '') return raw.id.trim();
  if (typeof raw.key === 'string' && raw.key.trim() !== '') return raw.key.trim();
  if (type === 'image') return `image:${String(raw.url || '').slice(0, 80)}`;
  return `text:${String(raw.text || '').trim().slice(0, 40)}`;
}

/**
 * Coerce one caller-supplied overlay into the canonical descriptor shape.
 * Returns `null` for anything that cannot be drawn (no url / no text), so a
 * malformed entry is dropped instead of failing the render.
 *
 * @param {object} raw
 * @returns {object|null}
 */
export function normalizeOverlayDescriptor(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = resolveOverlayType(raw);
  const defaults = RENDER_OVERLAY_DEFAULTS[type];
  const base = {
    id: fallbackOverlayId(type, raw),
    type,
    x: clampFraction(raw.x != null ? raw.x : defaults.x),
    y: clampFraction(raw.y != null ? raw.y : defaults.y),
    opacity: clampOpacity(raw.opacity, defaults.opacity),
    source: typeof raw.source === 'string' && raw.source.trim() !== '' ? raw.source : 'studio',
  };
  if (type === 'text') {
    const text = typeof raw.text === 'string' ? raw.text : '';
    if (text.trim() === '') return null;
    const align = RENDER_OVERLAY_ALIGN.includes(raw.align) ? raw.align : defaults.align;
    const lineHeight = Number(raw.lineHeight);
    return {
      ...base,
      text,
      color: typeof raw.color === 'string' && raw.color.trim() !== '' ? raw.color : defaults.color,
      fontFamily: typeof raw.fontFamily === 'string' && raw.fontFamily.trim() !== '' ? raw.fontFamily : defaults.fontFamily,
      align,
      fontSize: clampFraction(raw.fontSize != null ? raw.fontSize : defaults.fontSize),
      maxWidth: clampFraction(raw.maxWidth != null ? raw.maxWidth : defaults.maxWidth),
      lineHeight: Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : defaults.lineHeight,
      fontWeight: raw.fontWeight != null ? raw.fontWeight : defaults.fontWeight,
      shadow: raw.shadow !== false,
    };
  }
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  if (url === '') return null;
  return {
    ...base,
    url,
    width: clampFraction(raw.width != null ? raw.width : defaults.width),
    // null = keep the decoded aspect ratio (height derived at draw time).
    height: raw.height == null ? null : clampFraction(raw.height),
  };
}

/**
 * Resolve one overlay's normalized geometry into pixel coordinates inside the
 * VISIBLE video area, so letterbox bars are never covered.
 *
 * @param {object} descriptor - raw or already-normalized descriptor
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {{x?: number, y?: number, width?: number, height?: number}} [visibleRect]
 * @param {number|null} [aspect] - decoded image height/width, for `height: null`
 * @returns {object|null} pixel placement, or null when nothing is drawable
 */
export function resolveOverlayRect(descriptor, canvasWidth, canvasHeight, visibleRect, aspect) {
  const d = normalizeOverlayDescriptor(descriptor);
  if (!d) return null;
  const canvas = { width: Number(canvasWidth) || 0, height: Number(canvasHeight) || 0 };
  const vis = normalizeOverlayVisibleRect(visibleRect, canvas);
  if (vis.width <= 0 || vis.height <= 0) return null;

  if (d.type === 'image') {
    const width = d.width * vis.width;
    const ratio = Number.isFinite(aspect) && aspect > 0
      ? aspect
      : (d.height == null ? 1 : (d.height * vis.height) / (width || 1));
    const height = Math.max(1, d.height == null ? width * ratio : d.height * vis.height);
    const maxX = Math.max(vis.x, vis.x + vis.width - width);
    const maxY = Math.max(vis.y, vis.y + vis.height - height);
    return {
      type: 'image',
      x: Math.max(vis.x, Math.min(vis.x + d.x * vis.width, maxX)),
      y: Math.max(vis.y, Math.min(vis.y + d.y * vis.height, maxY)),
      width,
      height,
      opacity: d.opacity,
    };
  }

  const fontSize = Math.max(6, d.fontSize * vis.height);
  const anchorX = vis.x + d.x * vis.width;
  // Keep the first line (and the anchor) inside the visible band.
  const lineStep = fontSize * d.lineHeight;
  const maxY = Math.max(vis.y, vis.y + vis.height - lineStep);
  // Clamp the wrap box so a long line cannot spill over a letterbox bar.
  const available = d.align === 'left'
    ? vis.x + vis.width - anchorX
    : (d.align === 'right'
      ? anchorX - vis.x
      : 2 * Math.min(anchorX - vis.x, vis.x + vis.width - anchorX));
  const maxWidth = Math.max(8, Math.min(d.maxWidth * vis.width, available));
  return {
    type: 'text',
    x: Math.max(vis.x, Math.min(anchorX, vis.x + vis.width)),
    y: Math.max(vis.y, Math.min(vis.y + d.y * vis.height, maxY)),
    width: maxWidth,
    height: lineStep,
    fontSize,
    maxWidth,
    align: d.align,
    color: d.color,
    fontFamily: d.fontFamily,
    fontWeight: d.fontWeight,
    opacity: d.opacity,
    lineHeight: d.lineHeight,
    shadow: d.shadow,
  };
}

/**
 * True when there is something to composite AND the user has not disabled
 * overlays. This is the global `overlaysEnabled` switch: when it is false the
 * render is byte-identical to an export with no overlays at all.
 *
 * @param {unknown} overlays
 * @param {unknown} [enabled]
 * @returns {boolean}
 */
export function shouldCompositeOverlays(overlays, enabled) {
  if (enabled === false) return false;
  return Array.isArray(overlays) && overlays.length > 0;
}

/**
 * Decode ONE image overlay into an `Image`. Never rejects: a failed load
 * resolves to `null` so the caller can skip that overlay.
 *
 * @param {string} url
 * @param {{ ImageCtor?: Function, timeoutMs?: number }} [options]
 * @returns {Promise<Image|null>}
 */
function loadOverlayImage(url, options = {}) {
  const ImageCtor = options.ImageCtor || (typeof globalThis !== 'undefined' ? globalThis.Image : null);
  // Same bounded decode budget as inspectMediaBlob(): a hanging asset is
  // skipped, so it can never stall the start of a capture.
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 8000;
  return new Promise((resolve) => {
    if (!ImageCtor || typeof url !== 'string' || url === '') {
      resolve(null);
      return;
    }
    let image;
    try {
      image = new ImageCtor();
    } catch {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok ? image : null);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    try {
      // Anonymous CORS: a cross-origin logo without CORS headers fails to load
      // (and is skipped) rather than tainting the canvas — a tainted canvas
      // would break canvas.captureStream() and take the whole export down.
      if ('crossOrigin' in image) image.crossOrigin = 'anonymous';
      image.src = url;
    } catch {
      finish(false);
    }
  });
}

/**
 * SETUP phase: normalize the overlay list and decode every image ONCE, before
 * the capture starts. Each entry comes back as `{ ...descriptor, ready, image }`
 * — `ready: false` means "skip this overlay", never "fail the render".
 *
 * @param {object[]} overlays - raw overlay descriptors
 * @param {{ ImageCtor?: Function, timeoutMs?: number }} [options]
 * @returns {Promise<object[]>}
 */
export async function prepareRenderOverlays(overlays, options = {}) {
  const normalized = (Array.isArray(overlays) ? overlays : [])
    .map(normalizeOverlayDescriptor)
    .filter(Boolean);
  return Promise.all(normalized.map(async (descriptor) => {
    if (descriptor.type !== 'image') return { ...descriptor, ready: true, image: null };
    const image = await loadOverlayImage(descriptor.url, options);
    if (!image) {
      console.warn('[Render] overlay image skipped (failed to load/decode):', descriptor.url);
      return { ...descriptor, ready: false, image: null };
    }
    return { ...descriptor, ready: true, image };
  }));
}

function wrapOverlayText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line === '' ? word : `${line} ${word}`;
      let width;
      try {
        width = ctx.measureText ? ctx.measureText(candidate).width : candidate.length;
      } catch {
        width = candidate.length;
      }
      if (width > maxWidth && line !== '') {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line !== '') lines.push(line);
  }
  return lines.length > 0 ? lines : [''];
}

/**
 * FRAME phase: composite prepared overlays on top of the already-drawn base
 * frame. Synchronous, never throws (a failing overlay is skipped with a
 * warning), and returns the number of overlays actually drawn.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object[]} overlays - output of `prepareRenderOverlays()`
 * @param {{ width?: number, height?: number, visibleRect?: object }} [options]
 * @returns {number}
 */
export function drawOverlays(ctx, overlays, options = {}) {
  if (!ctx || typeof ctx.drawImage !== 'function' || !Array.isArray(overlays) || overlays.length === 0) {
    return 0;
  }
  const width = Number(options.width) || 0;
  const height = Number(options.height) || 0;
  const visible = normalizeOverlayVisibleRect(options.visibleRect, { width, height });
  let drawn = 0;

  for (const entry of overlays) {
    let saved = false;
    try {
      const descriptor = normalizeOverlayDescriptor(entry);
      if (!descriptor) continue;
      if (descriptor.type === 'image' && !(entry && entry.image)) continue; // failed preload
      const placement = resolveOverlayRect(descriptor, width, height, visible, overlayImageAspect(entry && entry.image));
      if (!placement) continue;

      ctx.save();
      saved = true;
      ctx.globalAlpha = placement.opacity;
      if (descriptor.type === 'image') {
        ctx.drawImage(entry.image, placement.x, placement.y, placement.width, placement.height);
      } else {
        ctx.font = `${placement.fontWeight} ${placement.fontSize}px ${placement.fontFamily}`;
        ctx.textAlign = placement.align;
        ctx.textBaseline = 'top';
        if (placement.shadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.55)';
          ctx.shadowBlur = Math.max(2, placement.fontSize * 0.35);
          ctx.shadowOffsetY = Math.max(1, placement.fontSize * 0.06);
        }
        ctx.fillStyle = placement.color;
        wrapOverlayText(ctx, descriptor.text, placement.maxWidth).forEach((line, index) => {
          ctx.fillText(line, placement.x, placement.y + index * placement.fontSize * placement.lineHeight);
        });
      }
      drawn++;
    } catch (err) {
      console.warn('[Render] overlay skipped after a draw failure:', err && err.message);
    } finally {
      if (saved) {
        try { ctx.restore(); } catch { /* ignore */ }
      }
    }
  }
  return drawn;
}

export function buildRenderFilename(base, action, extension) {
  const safeBase = buildFilenameStem(base || 'clip', 'clip');
  const safeAction = String(action || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const safeExt = String(extension || 'webm').replace(/[^a-z0-9]+/g, '').toLowerCase();
  return `${safeBase}_${safeAction}.${safeExt}`;
}

function readFirstNumber(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      const n = Number(obj[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function readFirstString(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
      return String(obj[key]).trim();
    }
  }
  return null;
}
