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

  if (meta.input_schema) {
    schemaCache.set(meta.model_name, meta.input_schema);
    return meta.input_schema;
  }

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

export async function syncCatalog(force = false): Promise<ModelMeta[]> {
  const now = Date.now();
  const SYNC_INTERVAL = 60 * 60 * 1000;

  if (!force && registry.size > 0) {
    const allMeta = Array.from(registry.values());
    const stale = allMeta.some(m => m.synced_at && now - new Date(m.synced_at).getTime() > SYNC_INTERVAL);
    if (!stale) return allMeta;
  }

  try {
    const response = await fetch('/api/model-registry');
    if (!response.ok) throw new Error(`API fetch failed: ${response.status}`);
    const data = await response.json();
    const models: SmartModel[] = data.models || [];

    const nowIso = new Date().toISOString();
    for (const raw of models) {
      const meta: ModelMeta = {
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
      };
      registry.set(meta.id, meta);
      if (raw.inputSchema) {
        schemaCache.set(raw.name, raw.inputSchema as Record<string, unknown>);
      }
    }

    return Array.from(registry.values());
  } catch (e) {
    console.error('[ModelRegistry] Catalog sync failed', e);
    return Array.from(registry.values());
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
