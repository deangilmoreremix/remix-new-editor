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
  let start = Math.max(0, range.start);
  let end = Math.min(sourceDuration, range.end);
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
