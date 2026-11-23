/**
 * SmartVideo Studio — Model Registry
 *
 * Client-side catalog layer for the Studio.
 */

import type { SmartModel } from '../../../../types/ai';

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------

export const STUDIO_TABS = [
  { id: 'image', label: 'Image', icon: 'image' },
  { id: 'video', label: 'Video', icon: 'video' },
  { id: 'audio', label: 'Audio', icon: 'audio' },
  { id: 'avatar', label: 'Avatar', icon: 'avatar' },
  { id: '3d', label: '3D', icon: 'cube' },
  { id: 'tools', label: 'AI Tools', icon: 'wrench' },
] as const;

export const SUBCATEGORY_MAP: Record<string, { tab: string; subcategory: string }> = {
  'text-to-image': { tab: 'image', subcategory: 'Text to Image' },
  'image-to-image': { tab: 'image', subcategory: 'Image to Image' },
  'image-edit': { tab: 'image', subcategory: 'Edit' },
  'image-upscale': { tab: 'image', subcategory: 'Upscale' },
  'background-removal': { tab: 'image', subcategory: 'Background' },
  'lora': { tab: 'image', subcategory: 'LoRA' },
  'product': { tab: 'image', subcategory: 'Product' },
  'text-to-video': { tab: 'video', subcategory: 'Text to Video' },
  'image-to-video': { tab: 'video', subcategory: 'Image to Video' },
  'video-to-video': { tab: 'video', subcategory: 'Video to Video' },
  'video-edit': { tab: 'video', subcategory: 'Effects' },
  'motion-control': { tab: 'video', subcategory: 'Motion' },
  'video-upscale': { tab: 'video', subcategory: 'Upscale' },
  'first-last-frame': { tab: 'video', subcategory: 'First/Last Frame' },
  'reference-video': { tab: 'video', subcategory: 'Reference Video' },
  'text-to-audio': { tab: 'audio', subcategory: 'Text to Audio' },
  'music': { tab: 'audio', subcategory: 'Music' },
  'speech': { tab: 'audio', subcategory: 'Speech' },
  'video-to-audio': { tab: 'audio', subcategory: 'Video to Audio' },
  'audio-to-video': { tab: 'avatar', subcategory: 'Audio to Video' },
  'lip-sync': { tab: 'avatar', subcategory: 'Lip Sync' },
  'talking-avatar': { tab: 'avatar', subcategory: 'Talking Avatar' },
  'character-animation': { tab: 'avatar', subcategory: 'Character Animation' },
  'text-to-3d': { tab: '3d', subcategory: 'Text to 3D' },
  'image-to-3d': { tab: '3d', subcategory: 'Image to 3D' },
  'multi-image-to-3d': { tab: '3d', subcategory: 'Multi-image to 3D' },
  'face-swap': { tab: 'tools', subcategory: 'Face Swap' },
  'social': { tab: 'tools', subcategory: 'Social Tools' },
  'seo': { tab: 'tools', subcategory: 'SEO' },
  'enhancement': { tab: 'tools', subcategory: 'Enhancement' },
  'other': { tab: 'tools', subcategory: 'Other' },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelCapabilities {
  textInput: boolean;
  imageInput: boolean;
  multipleImages: boolean;
  videoInput: boolean;
  audioInput: boolean;
  firstFrame: boolean;
  lastFrame: boolean;
  duration: boolean;
  aspectRatio: boolean;
  resolution: boolean;
  audioGeneration: boolean;
  seed: boolean;
  lora: boolean;
  cameraMotion: boolean;
}

export interface ModelMeta {
  id: string;
  provider: string;
  model_name: string;
  name: string;
  display_name?: string;
  description?: string;
  category: string;
  subcategory?: string;
  enabled: boolean;
  capabilities: ModelCapabilities;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  ui_overrides?: Record<string, unknown>;
  family: string;
  group_of: string[];
  endpoint: string;
  estimate_endpoint: string;
  cost: number;
  cost_currency: string;
  dynamic_pricing: boolean;
  studios: string[];
  tags: string[];
  synced_at?: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// In-memory registry + cache
// ---------------------------------------------------------------------------

const registry = new Map<string, ModelMeta>();
const schemaCache = new Map<string, Record<string, unknown>>();

export async function loadModelSchema(modelId: string): Promise<Record<string, unknown>> {
  const meta = registry.get(modelId);
  if (!meta) {
    throw new Error(`Model "${modelId}" not found in registry. Run syncCatalog() first.`);
  }

  if (schemaCache.has(meta.model_name)) {
    return schemaCache.get(meta.model_name)!;
  }

  if (meta.input_schema) return meta.input_schema;

  try {
    const response = await fetch(`/api/v1/models/${encodeURIComponent(meta.model_name)}`);
    if (!response.ok) throw new Error(`Schema fetch failed: ${response.status}`);
    const data = await response.json();
    const schema = data.input_schema || data.input || {};
    schemaCache.set(meta.model_name, schema);
    return schema;
  } catch (e) {
    console.error(`[ModelRegistry] Failed to load schema for ${modelId}`, e);
    return {};
  }
}

// Local fallback: build the registry from the bundled catalog in src/lib/models.js
// when /api/model-registry is unavailable (it has no backend in this app).
let catalogSource: 'remote' | 'local' | 'none' = 'none';
let inflight: Promise<ModelMeta[]> | null = null;

/** Where the registry came from: 'remote' (/api/model-registry), 'local' (models.js) or 'none'. */
export function getCatalogSource(): 'remote' | 'local' | 'none' {
  return catalogSource;
}

type LocalModel = Record<string, unknown> & {
  id: string;
  name: string;
  endpoint?: string;
  inputs?: Record<string, Record<string, unknown>>;
};

const LOCAL_LISTS: { exportName: string; generationType: string; category: (m: LocalModel) => string }[] = [
  { exportName: 't2iModels', generationType: 'image', category: () => 'text-to-image' },
  {
    exportName: 'i2iModels', generationType: 'image', category: m => {
      const n = `${m.id} ${m.name}`.toLowerCase();
      if (n.includes('upscal')) return 'image-upscale';
      if (n.includes('background') || n.includes('remove-bg') || n.includes('rembg')) return 'background-removal';
      return 'image-to-image';
    },
  },
  { exportName: 't2vModels', generationType: 'video', category: () => 'text-to-video' },
  { exportName: 'i2vModels', generationType: 'video', category: () => 'image-to-video' },
  {
    exportName: 'v2vModels', generationType: 'video', category: m =>
      `${m.id} ${m.name}`.toLowerCase().includes('upscal') ? 'video-upscale' : 'video-to-video',
  },
  {
    exportName: 'audioModels', generationType: 'audio', category: m => {
      if (m.type === 'music') return 'music';
      if (m.type === 'tts' || m.type === 'voice-clone') return 'speech';
      return 'text-to-audio';
    },
  },
  { exportName: 'avatarModels', generationType: 'avatar', category: m => (m.subtype === 'lipsync' ? 'lip-sync' : 'talking-avatar') },
  { exportName: 'lipsyncModels', generationType: 'lipsync', category: () => 'lip-sync' },
];

/** models.js uses int/float where the normalizer expects JSON-schema integer/number. */
const TYPE_ALIASES: Record<string, string> = { int: 'integer', float: 'number', double: 'number', bool: 'boolean', text: 'string' };

/** models.js `inputs` use minValue/maxValue/minimum/maximum; the normalizer reads min/max. */
function toFieldSchema(raw: Record<string, unknown>, required = false): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  if (typeof raw.type === 'string' && TYPE_ALIASES[raw.type]) out.type = TYPE_ALIASES[raw.type];
  const min = raw.min ?? raw.minValue ?? raw.minimum;
  const max = raw.max ?? raw.maxValue ?? raw.maximum;
  if (typeof min === 'number') out.min = min;
  if (typeof max === 'number') out.max = max;
  if (required) out.required = true;
  return out;
}

/** Objects and arrays of objects (dialogue turns, speakers, LoRA lists) have no form widget. */
function isUnrenderable(field: Record<string, unknown>): boolean {
  if (field.type === 'object') return true;
  const items = field.items as Record<string, unknown> | undefined;
  return field.type === 'array' && !!items && (items.type === 'object' || !!items.properties);
}

type LiveField = { name: string; type?: string; required?: number | boolean; title?: string; enum?: unknown[]; default?: unknown; min?: number; max?: number };

/** Required fields from MuAPI's live catalog, by model name (fills in models.js entries such as MiniMax Speech's voice_id). */
let liveRequired: Map<string, LiveField[]> | null = null;
async function loadLiveRequired(): Promise<Map<string, LiveField[]>> {
  if (liveRequired) return liveRequired;
  const map = new Map<string, LiveField[]>();
  try {
    const live = (await import('../../../../lib/muapi/liveModels.json')).default as { models?: { name: string; fields?: LiveField[] }[] };
    for (const m of live.models || []) {
      const required = (m.fields || []).filter(f => f && f.name && f.required);
      if (required.length) map.set(m.name, required);
    }
  } catch (e) {
    console.warn('[ModelRegistry] Live catalog unavailable; required fields come from models.js only.', e);
  }
  liveRequired = map;
  return map;
}

function liveFieldSchema(f: LiveField): Record<string, unknown> {
  const type = TYPE_ALIASES[f.type || ''] || f.type || 'string';
  const out: Record<string, unknown> = { type, title: f.title || f.name, required: true };
  if (Array.isArray(f.enum) && f.enum.length) out.enum = f.enum;
  if (f.default !== undefined) out.default = f.default;
  if (typeof f.min === 'number') out.min = f.min;
  if (typeof f.max === 'number') out.max = f.max;
  return out;
}

/** Returns null when a required input cannot be rendered, so the model is hidden instead of shown broken. */
function buildLocalSchema(m: LocalModel, generationType: string, category: string, live: Map<string, LiveField[]>): Record<string, unknown> | null {
  const schema: Record<string, unknown> = {};
  const requiredKeys = new Set(Array.isArray(m.required) ? (m.required as string[]) : []);
  const add = (key: unknown, field: Record<string, unknown>) => {
    if (typeof key === 'string' && key && !schema[key]) schema[key] = field;
  };
  if (m.hasPrompt !== false && !(m.inputs && (m.inputs.prompt || m.inputs.text))) {
    add('prompt', { type: 'string', title: generationType === 'audio' && category === 'speech' ? 'Text' : 'Prompt' });
  }
  for (const [key, field] of Object.entries(m.inputs || {})) {
    if (!field || typeof field !== 'object') continue;
    const required = requiredKeys.has(key) || field.required === true;
    if (isUnrenderable(field)) {
      if (required) return null;
      continue; // optional: leave it out rather than render an empty widget
    }
    schema[key] = toFieldSchema(field, required);
  }
  const needsImage = ['image-to-image', 'image-upscale', 'background-removal', 'image-to-video'].includes(category)
    || (generationType === 'lipsync' && m.category === 'image')
    || (generationType === 'avatar' && m.subtype !== 'lipsync' && !m.hasVideo);
  if (needsImage) {
    const imageField = (m.imageField as string) || 'image_url';
    add(imageField, imageField.endsWith('list') || imageField.endsWith('s')
      ? { type: 'array', title: 'Images', items: { type: 'string' } }
      : { type: 'string', title: 'Image', format: 'uri' });
  }
  if (m.swapField) add(m.swapField, { type: 'string', title: 'Face Image', format: 'uri' });
  if (m.lastImageField) add(m.lastImageField, { type: 'string', title: 'Last Frame', format: 'uri' });
  if (category === 'video-to-video' || category === 'video-upscale' || m.hasVideo || (generationType === 'lipsync' && m.category === 'video')) {
    add((m.videoField as string) || 'video_url', { type: 'string', title: 'Video', format: 'uri' });
  }
  if (m.hasAudio || m.requiresAudio || generationType === 'lipsync' || m.audioField) {
    add((m.audioField as string) || 'audio_url', { type: 'string', title: 'Audio', format: 'uri' });
  }
  // models.js leaves some required inputs implicit (MiniMax Speech: voiceOptions, no voice_id).
  for (const f of live.get(String(m.endpoint || m.id)) || live.get(m.id) || []) {
    if (f.name === 'text' && schema.prompt) continue;
    add(f.name, liveFieldSchema(f));
  }
  return schema;
}

async function loadLocalCatalog(): Promise<ModelMeta[]> {
  const lib = (await import('../../../../lib/models.js')) as unknown as Record<string, LocalModel[] | undefined>;
  const nowIso = new Date().toISOString();
  const live = await loadLiveRequired();
  const metas: ModelMeta[] = [];
  for (const list of LOCAL_LISTS) {
    for (const m of lib[list.exportName] || []) {
      if (!m || !m.id) continue;
      const category = list.category(m);
      const input_schema = buildLocalSchema(m, list.generationType, category, live);
      if (!input_schema) continue;
      const has = (k: string) => Object.keys(input_schema).some(f => f.includes(k));
      metas.push({
        id: `${list.exportName}/${m.id}`,
        provider: String(m.provider || 'muapi'),
        model_name: m.id,
        name: m.name || m.id,
        display_name: m.name || m.id,
        description: typeof m.description === 'string' ? m.description : undefined,
        category,
        subcategory: SUBCATEGORY_MAP[category]?.subcategory,
        enabled: true,
        capabilities: {
          textInput: m.hasPrompt !== false,
          imageInput: has('image'),
          multipleImages: Number(m.maxImages) > 1,
          videoInput: has('video'),
          audioInput: has('audio'),
          firstFrame: false,
          lastFrame: !!m.lastImageField,
          duration: has('duration'),
          aspectRatio: has('aspect_ratio'),
          resolution: has('resolution'),
          audioGeneration: list.generationType === 'audio',
          seed: has('seed'),
          lora: has('lora'),
          cameraMotion: false,
        },
        input_schema,
        ui_overrides: { generationType: list.generationType },
        family: String(m.provider_name || m.family || m.provider || 'MuAPI'),
        group_of: [],
        endpoint: String(m.endpoint || m.id),
        estimate_endpoint: '',
        cost: 0,
        cost_currency: 'USD',
        dynamic_pricing: true,
        studios: [],
        tags: [],
        synced_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }
  }
  return metas;
}

async function loadRemoteCatalog(): Promise<ModelMeta[]> {
  const response = await fetch('/api/model-registry', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`API fetch failed: ${response.status}`);
  // The SPA fallback answers unknown paths with index.html; treat that as "no endpoint".
  if (!(response.headers.get('content-type') || '').includes('json')) throw new Error('No model registry endpoint');
  const data = await response.json();
  const models: SmartModel[] = data.models || [];

  const nowIso = new Date().toISOString();
  return models.map((raw): ModelMeta => ({
    id: raw.id || `${raw.provider}/${raw.name}`,
    provider: raw.provider,
    model_name: raw.name,
    name: raw.name,
    display_name: raw.displayName,
    description: raw.description,
    category: raw.category || 'other',
    subcategory: raw.subcategory,
    enabled: raw.enabled,
    capabilities: {
      textInput: true,
      imageInput: !!raw.inputSchema,
      multipleImages: false,
      videoInput: false,
      audioInput: false,
      firstFrame: false,
      lastFrame: false,
      duration: false,
      aspectRatio: false,
      resolution: false,
      audioGeneration: false,
      seed: false,
      lora: false,
      cameraMotion: false,
    },
    input_schema: raw.inputSchema,
    output_schema: raw.outputSchema,
    ui_overrides: raw.uiOverrides,
    family: raw.family || raw.provider,
    group_of: Array.isArray(raw.group) ? raw.group : [],
    endpoint: raw.endpoint,
    estimate_endpoint: raw.estimateEndpoint || '',
    cost: raw.cost || 0,
    cost_currency: raw.currency || 'USD',
    dynamic_pricing: raw.dynamicPricing,
    studios: raw.studios || [],
    tags: raw.tags || [],
    synced_at: raw.syncedAt || nowIso,
    created_at: raw.createdAt || nowIso,
    updated_at: raw.updatedAt || nowIso,
  }));
}

function storeModels(models: ModelMeta[]): void {
  registry.clear();
  schemaCache.clear();
  for (const meta of models) {
    registry.set(meta.id, meta);
    if (meta.input_schema) schemaCache.set(meta.model_name, meta.input_schema);
  }
}

export async function syncCatalog(force = false): Promise<ModelMeta[]> {
  const now = Date.now();
  const SYNC_INTERVAL = 60 * 60 * 1000;

  if (!force && registry.size > 0) {
    const allMeta = Array.from(registry.values());
    const stale = allMeta.some(m => m.synced_at && now - new Date(m.synced_at).getTime() > SYNC_INTERVAL);
    if (!stale) return allMeta;
  }
  // Studio and ModelSelector both sync on mount: share one request.
  if (inflight) return inflight;

  inflight = (async () => {
    let remote: ModelMeta[] = [];
    try {
      remote = await loadRemoteCatalog();
    } catch (e) {
      console.info('[ModelRegistry] /api/model-registry unavailable, using the local catalog.', e instanceof Error ? e.message : e);
    }
    if (remote.length > 0) {
      storeModels(remote);
      catalogSource = 'remote';
      return Array.from(registry.values());
    }
    try {
      const local = await loadLocalCatalog();
      if (local.length > 0) {
        storeModels(local);
        catalogSource = 'local';
      }
    } catch (e) {
      console.error('[ModelRegistry] Local catalog load failed', e);
    }
    return Array.from(registry.values());
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function getModelsForTab(tabId: string): ModelMeta[] {
  const result: ModelMeta[] = [];

  for (const meta of registry.values()) {
    if (!meta.enabled) continue;
    const mapped = SUBCATEGORY_MAP[meta.category];
    if (mapped && mapped.tab === tabId) {
      result.push(meta);
    }
  }

  for (const meta of registry.values()) {
    if (!meta.enabled) continue;
    if (meta.studios?.includes(tabId) && !result.includes(meta)) {
      result.push(meta);
    }
  }

  return result;
}

export function getModelById(id: string): ModelMeta | undefined {
  return registry.get(id);
}

export function searchModels(query: string): ModelMeta[] {
  const q = query.toLowerCase().trim();
  if (!q) return getEnabledModels();

  return getEnabledModels().filter(m => {
    const haystack = `${m.model_name || ''} ${m.display_name || ''} ${m.description || ''} ${m.family || ''} ${m.category || ''} ${m.group_of || ''}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function getEnabledModels(): ModelMeta[] {
  return Array.from(registry.values()).filter(m => m.enabled);
}
