/**
 * Unified Asset Model
 *
 * Phase 3 of the SmartVideo Timeline Studio superset.
 *
 * Every media item that flows into the Timeline — uploaded, stock, generated,
 * recorded, or captured — is normalized into a single shared asset schema so
 * that all Timeline features (preview, media library, timeline insertion,
 * personalization, export) operate on one shape.
 *
 * This module owns ONLY the asset schema and its lifecycle helpers. It does NOT
 * hold state and does NOT talk to the Timeline. The Timeline Feature API
 * (timelineFeatureApi.js) is responsible for placing normalized assets onto a
 * Timeline. That keeps assets a pure, portable data contract.
 */

export const ASSET_TYPES = [
  'video',
  'image',
  'audio',
  'text',
  'caption',
  'gif',
  'sticker',
  'lower-third',
  'animation',
  'overlay',
  'interactive',
  'generated-video',
  'generated-image',
  'voice',
  'recording',
  'screen-recording',
  'url-video',
  'template',
];

const ASSET_TYPE_SET = new Set(ASSET_TYPES);

export const ASSET_SOURCES = [
  'upload',
  'media-library',
  'stock',
  'gif-search',
  'sticker-library',
  'lower-third-library',
  'video-gallery',
  'animation-library',
  'url',
  'camera',
  'screen',
  'audio-recording',
  'page-capture',
  'timeline-import',
  'ai-generation',
  'generated',
  'template-generator',
];

/**
 * Lifecycle actions every imported/generated asset must support.
 * These are capability flags (not a state machine) — the UI surfaces a control
 * for each flag the asset supports.
 */
export const ASSET_LIFECYCLE = {
  PREVIEW: 'preview',
  ADD_TO_MEDIA_LIBRARY: 'addToMediaLibrary',
  ADD_TO_TIMELINE: 'addToTimeline',
  SAVE: 'save',
  RELOAD: 'reload',
  REUSE: 'reuse',
};

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Coerce an arbitrary input into the normalized asset shape.
 *
 * Required metadata from the spec:
 *   id, type, name, source, url, thumbnail, duration, width, height, fps,
 *   codec, mimeType, provider, model, prompt, generationJobId, createdAt,
 *   metadata
 *
 * Missing fields are filled with safe defaults so downstream consumers can
 * rely on the shape. Unknown `type` values fall back to `video` so a bad
 * payload never crashes the Timeline.
 *
 * @param {Object} input
 * @returns {Object} Normalized asset
 */
export function normalizeAsset(input = {}) {
  const type = ASSET_TYPE_SET.has(input.type) ? input.type : 'video';
  const source = ASSET_SOURCES.includes(input.source) ? input.source : 'upload';

  const asset = {
    id: input.id || genId('asset'),
    type,
    name: input.name || input.alt || 'Untitled Asset',
    source,
    url: input.url || input.src || input.path || null,
    thumbnail: input.thumbnail || input.poster || null,
    duration: typeof input.duration === 'number' ? input.duration : null,
    width: typeof input.width === 'number' ? input.width : null,
    height: typeof input.height === 'number' ? input.height : null,
    fps: typeof input.fps === 'number' ? input.fps : null,
    codec: input.codec || null,
    mimeType: input.mimeType || input.mime || null,
    provider: input.provider || null,
    model: input.model || null,
    prompt: input.prompt || null,
    generationJobId: input.generationJobId || input.jobId || null,
    createdAt: input.createdAt || nowIso(),
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {},
  };

  // Merge legacy/loose fields used by the current editor into metadata so
  // nothing is silently dropped during normalization.
  for (const key of ['text', 'style', 'script', 'formConfig', 'personalization', 'token', 'cta', 'logo', 'triggers']) {
    if (input[key] !== undefined && asset.metadata[key] === undefined) {
      asset.metadata[key] = input[key];
    }
  }
  if (input.src !== undefined && asset.url === null) asset.url = input.src;
  if (input.waveformData !== undefined) asset.metadata.waveformData = input.waveformData;
  if (input.trackType !== undefined) asset.metadata.trackType = input.trackType;

  return asset;
}

/**
 * Validate that a normalized asset has the minimum fields required to be
 * placed on a Timeline. Perfect validation is not enforced (legacy/demo data
 * may be partial) but we guarantee `type` and `id` are sane and `duration` is
 * a non-negative number when present.
 *
 * @param {Object} asset
 * @returns {boolean}
 */
export function isAssetValid(asset) {
  if (!asset || typeof asset !== 'object') return false;
  if (!ASSET_TYPE_SET.has(asset.type)) return false;
  if (typeof asset.id !== 'string' || !asset.id) return false;
  if (asset.duration !== null && (typeof asset.duration !== 'number' || asset.duration < 0)) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 * Factory helpers for each ingestion path (Phase 8 / 12 / 15 / 16).
 * Each returns a normalized asset ready for addAsset().
 * ------------------------------------------------------------------ */

export function createUploadAsset({ file, url, type, name, duration, width, height, mimeType }) {
  const inferred = type
    || (file && file.type ? inferTypeFromFile(file.type) : null)
    || 'video';
  return normalizeAsset({
    type: inferred,
    name: name || (file && file.name) || 'Uploaded Asset',
    source: 'upload',
    url,
    duration,
    width,
    height,
    mimeType: mimeType || (file && file.type) || null,
    metadata: { fileName: file && file.name },
  });
}

export function createStockAsset({ url, thumbnail, type, name, duration, width, height, provider }) {
  return normalizeAsset({
    type: type || 'video',
    name: name || 'Stock Media',
    source: 'stock',
    url,
    thumbnail,
    duration,
    width,
    height,
    provider: provider || 'stock',
  });
}

export function createUrlVideoAsset({ url, name, thumbnail, duration }) {
  return normalizeAsset({
    type: 'url-video',
    name: name || 'URL Video',
    source: 'url',
    url,
    thumbnail,
    duration: duration || null,
  });
}

export function createGeneratedAsset({ provider, model, prompt, type, url, thumbnail, duration, width, height, generationJobId, negativePrompt, seed, aspectRatio, style }) {
  const genType = type || (provider ? 'generated-video' : 'generated-image');
  return normalizeAsset({
    type: genType,
    name: nameFromPrompt(prompt) || `${model || provider || 'AI'} Output`,
    source: 'ai-generation',
    url,
    thumbnail,
    duration,
    width,
    height,
    provider: provider || null,
    model: model || null,
    prompt: prompt || null,
    generationJobId: generationJobId || null,
    metadata: { negativePrompt: negativePrompt || null, seed: seed ?? null, aspectRatio: aspectRatio || null, style: style || null },
  });
}

export function createTextAsset({ text, name, duration, style }) {
  return normalizeAsset({
    type: 'text',
    name: name || text?.slice(0, 40) || 'Text',
    source: 'upload',
    duration: duration || 5,
    metadata: { text: text || '', style: style || null },
  });
}

export function createCaptionAsset({ text, name, duration, style }) {
  return normalizeAsset({
    type: 'caption',
    name: name || text?.slice(0, 40) || 'Caption',
    source: 'upload',
    duration: duration || 3,
    metadata: { text: text || '', style: style || null },
  });
}

export function createOverlayAsset({ kind = 'overlay', name, duration, config }) {
  return normalizeAsset({
    type: kind === 'lower-third' ? 'lower-third' : kind === 'sticker' ? 'sticker' : 'overlay',
    name: name || 'Overlay',
    source: 'upload',
    duration: duration || 5,
    metadata: { config: config || {} },
  });
}

export function createInteractiveAsset({ kind = 'interactive', name, duration, formConfig }) {
  return normalizeAsset({
    type: 'interactive',
    name: name || 'Interactive Element',
    source: 'upload',
    duration: duration || 5,
    metadata: { formConfig: formConfig || null },
  });
}

export function createRecordingAsset({ mode, url, name, duration, thumbnail }) {
  const type = mode === 'screen' || mode === 'screen-recording'
    ? 'screen-recording'
    : mode === 'audio' || mode === 'audio-recording'
      ? 'audio'
      : 'recording';
  return normalizeAsset({
    type,
    name: name || 'Recording',
    source: mode === 'audio' ? 'audio-recording' : 'camera',
    url,
    thumbnail,
    duration: duration || null,
  });
}

export function createTemplateAsset({ name, template }) {
  return normalizeAsset({
    type: 'template',
    name: name || 'Template',
    source: 'template-generator',
    metadata: { template: template || null },
  });
}

function inferTypeFromFile(mime = '') {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  return 'video';
}

function nameFromPrompt(prompt) {
  if (!prompt) return null;
  const trimmed = prompt.trim();
  if (trimmed.length <= 48) return trimmed;
  return `${trimmed.slice(0, 45)}…`;
}

/**
 * Map a legacy editor asset (the shape currently stored in
 * state.project.assets) to the normalized schema. Used by the bridge and the
 * Feature API so legacy media keeps working without a separate state system.
 *
 * @param {Object} legacy
 * @returns {Object}
 */
export function fromLegacyAsset(legacy = {}) {
  return normalizeAsset({
    id: legacy.id,
    type: legacy.type,
    name: legacy.name,
    source: legacy.source || 'media-library',
    url: legacy.url || legacy.path,
    thumbnail: legacy.thumbnail || legacy.poster,
    duration: legacy.duration,
    width: legacy.width,
    height: legacy.height,
    mimeType: legacy.mimeType,
    metadata: legacy.metadata,
  });
}
