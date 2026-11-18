/**
 * Generic MuAPI model access for the Timeline Editor's Spaces canvas.
 * One definition of "which models exist and what they accept", shared by the browser (model catalog /
 * node inspector) and the Netlify function (validation), built from the app's MuAPI catalog.
 */
import { t2iModels, i2iModels, t2vModels, i2vModels, v2vModels, lipsyncModels, audioModels, videoToolsModels } from '../models.js';

export const KINDS = [
  ['t2i', t2iModels, 'image', 'image'],
  ['i2i', i2iModels, 'image-edit', 'image'],
  ['t2v', t2vModels, 'video', 'video'],
  ['i2v', i2vModels, 'video', 'video'],
  ['v2v', v2vModels, 'video', 'video'],
  ['lipsync', lipsyncModels, 'video', 'video'],
  ['audio', audioModels, 'audio', 'audio'],
  ['tools', videoToolsModels, 'video', 'video'],
];

let cache;
/** [{ key, kind, category, outputType, model }] — `key` is unique across kinds (first kind keeps the bare id). */
export function allCatalogModels() {
  if (cache) return cache;
  const seen = new Set();
  cache = [];
  for (const [kind, list, category, outputType] of KINDS) {
    for (const model of list || []) {
      const key = seen.has(model.id) ? `${model.id}:${kind}` : model.id;
      seen.add(model.id);
      cache.push({ key, kind, category, outputType, model });
    }
  }
  return cache;
}

export function findCatalogModel(key) {
  return allCatalogModels().find((m) => m.key === key) || null;
}

// Bundled snapshot entries whose endpoint differs from MuAPI's live catalog (found by a live route check: these 404'd).
const ENDPOINT_FIXES = {
  'ai-image-upscaler': 'ai-image-upscale',
  'bytedance-seedream-5.0-pro-edit': 'seedream-5.0-pro-edit',
  'bytedance-seedream-5.0-pro': 'seedream-5.0-pro',
};

const MEDIA_FIELD = /image|video|audio|frame|url|mask|reference/i;
const httpsOnly = (v) => /^https:\/\//i.test(String(v || ''));

/**
 * Validate and build the MuAPI request for a catalog model.
 * Only fields the model declares (plus its image/video field) are forwarded; media must be https URLs.
 * @returns {{ endpoint: string, payload: object, model: string }}
 */
export function buildGenericPayload({ model: key, inputs = {} } = {}) {
  const entry = findCatalogModel(key);
  if (!entry) throw Object.assign(new Error(`Unknown model: ${key}`), { code: 'BAD_INPUT' });
  const { model } = entry;
  const allowed = new Set(Object.keys(model.inputs || {}));
  for (const extra of [model.imageField, model.videoField, 'prompt']) if (extra) allowed.add(extra);
  const payload = {};
  for (const [name, value] of Object.entries(inputs)) {
    if (!allowed.has(name) || value === undefined || value === null || value === '') continue;
    const values = Array.isArray(value) ? value : [value];
    if (MEDIA_FIELD.test(name) && typeof value !== 'number' && typeof value !== 'boolean' && !values.every(httpsOnly)) {
      if (model.inputs?.[name]?.enum) { payload[name] = value; continue; }
      throw Object.assign(new Error(`${name} must be a public https URL`), { code: 'BAD_INPUT' });
    }
    const t = model.inputs?.[name]?.type;
    payload[name] = (t === 'int' || t === 'integer' || t === 'number') && typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : value;
  }
  if (!payload.prompt && model.hasPrompt === false) delete payload.prompt;
  return { endpoint: `/${ENDPOINT_FIXES[model.id] || model.endpoint || model.id}`, payload, model: model.id };
}
