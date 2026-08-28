/**
 * MuAPI Provider Adapter
 *
 * Implements AIProviderAdapter for MuAPI.
 * Translates between SmartVideo canonical layer and MuAPI endpoints.
 */

import type {
  AIProviderAdapter,
  SmartModel,
  CostEstimate,
  GenerationJob,
  GenerationResult,
  SmartOutput,
  FieldMapping,
} from '../../types/ai';
import { FIELD_ALIASES } from './FieldAliases';

const MUAPI_BASE = 'https://api.muapi.ai/api/v1';

// Canonical → MuAPI field mapping
const FIELD_MAPPINGS: FieldMapping[] = [
  { canonical: 'prompt', providerField: 'prompt' },
  { canonical: 'negative_prompt', providerField: 'negative_prompt' },
  { canonical: 'reference_image', providerField: 'image_url' },
  { canonical: 'reference_images', providerField: 'images_list' },
  { canonical: 'reference_video', providerField: 'video_url' },
  { canonical: 'reference_audio', providerField: 'audio_url' },
  { canonical: 'first_frame', providerField: 'first_frame_url' },
  { canonical: 'last_frame', providerField: 'last_frame_url' },
  { canonical: 'duration', providerField: 'duration' },
  { canonical: 'aspect_ratio', providerField: 'aspect_ratio' },
  { canonical: 'resolution', providerField: 'resolution' },
  { canonical: 'number_of_images', providerField: 'num_images' },
  { canonical: 'quality', providerField: 'quality' },
  { canonical: 'mode', providerField: 'mode' },
  { canonical: 'seed', providerField: 'seed' },
  { canonical: 'camera_motion', providerField: 'camera_motion' },
  { canonical: 'lora', providerField: 'lora' },
  { canonical: 'audio_enabled', providerField: 'audio_enabled' },
  { canonical: 'strength', providerField: 'strength' },
  { canonical: 'output_format', providerField: 'output_format' },
];

const canonicalToProvider = new Map(
  FIELD_MAPPINGS.map((m) => [m.canonical, m.providerField])
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function isString(val: unknown): val is string {
  return typeof val === 'string';
}

function isNumber(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val);
}

function isBoolean(val: unknown): val is boolean {
  return typeof val === 'boolean';
}

// ── MuAPI Catalog Response Types ─────────────────────────────────────────────

interface MuapiModelCatalogItem {
  name: string;
  description?: string;
  category?: string;
  family?: string;
  group_of?: string;
  cost?: number;
  cost_currency?: string;
  cost_strategy?: string;
  dynamic_pricing?: boolean;
  endpoint: string;
  estimate_endpoint?: string;
}

interface MuapiModelDetail {
  name: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
}

// ── Adapter ──────────────────────────────────────────────────────────────────

export class MuapiAdapter implements AIProviderAdapter {
  private proxyUrl: string;
  private apiKey: string | null = null;

  constructor() {
    // Use the existing proxy pattern — the Edge Function handles the real MuAPI key
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    this.proxyUrl = supabaseUrl
      ? `${supabaseUrl}/functions/v1/muapi-proxy`
      : '/functions/v1/muapi-proxy';
  }

  private async proxyRequest<T>(
    body: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<T> {
    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`MuAPI proxy error: ${response.status} ${text.slice(0, 200)}`);
    }

    return response.json();
  }

  // ── Catalog ────────────────────────────────────────────────────────────────

  async listModels(): Promise<SmartModel[]> {
    const data = await this.proxyRequest<{ models?: MuapiModelCatalogItem[] }>({
      endpoint: 'models',
      generationType: 'list',
    });

    const models = (data.models || []).map((m) => this.normalizeCatalogModel(m));
    return models;
  }

  async getModel(modelName: string): Promise<SmartModel> {
    const data = await this.proxyRequest<MuapiModelDetail>({
      endpoint: `models/${encodeURIComponent(modelName)}`,
      generationType: 'list',
    });

    const catalog = await this.listModels();
    const catalogModel = catalog.find((m) => m.name === modelName);

    return this.normalizeDetailModel(data, catalogModel);
  }

  // ── Cost Estimation ────────────────────────────────────────────────────────

  async estimateCost(
    modelName: string,
    input: Record<string, unknown>
  ): Promise<CostEstimate> {
    const model = await this.getModel(modelName);

    if (!model.dynamicPricing || !model.estimateEndpoint) {
      return {
        providerCost: model.cost ?? 0,
        currency: model.currency || 'USD',
        estimatedCredits: 0,
        dynamic: false,
      };
    }

    try {
      const data = await this.proxyRequest<{ cost?: number; currency?: string }>({
        endpoint: model.estimateEndpoint,
        params: this.translateToProvider(input),
        generationType: 'list',
      });

      const providerCost = isNumber(data.cost) ? data.cost : 0;
      return {
        providerCost,
        currency: data.currency || model.currency || 'USD',
        estimatedCredits: 0,
        dynamic: true,
        breakdown: data as Record<string, unknown>,
      };
    } catch {
      return {
        providerCost: model.cost ?? 0,
        currency: model.currency || 'USD',
        estimatedCredits: 0,
        dynamic: false,
      };
    }
  }

  // ── Generation ─────────────────────────────────────────────────────────────

  async generate(
    modelName: string,
    input: Record<string, unknown>
  ): Promise<GenerationJob> {
    const model = await this.getModel(modelName);

    const providerInput = this.translateToProvider(input);
    const generationType = this.inferGenerationType(model);

    const data = await this.proxyRequest<{
      request_id?: string;
      id?: string;
      status?: string;
    }>({
      endpoint: model.endpoint,
      params: providerInput,
      generationType,
      studioType: input.studioType as string | undefined,
    });

    const requestId = String(data.request_id || data.id || crypto.randomUUID());
    return {
      requestId,
      status: 'queued',
      provider: 'muapi',
      model: modelName,
      submittedAt: new Date().toISOString(),
    };
  }

  async getResult(requestId: string): Promise<GenerationResult> {
    const data = await this.proxyRequest<{
      status?: string;
      outputs?: unknown[];
      output?: unknown;
      url?: string;
      error?: string;
      metadata?: Record<string, unknown>;
    }>({
      endpoint: `predictions/${encodeURIComponent(requestId)}/result`,
      generationType: 'poll',
    });

    const status = this.normalizeStatus(data.status);
    const outputs = this.normalizeOutputs(data);

    return {
      requestId,
      status,
      outputs,
      error: data.error,
      metadata: data.metadata,
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    };
  }

  // ── Translation ────────────────────────────────────────────────────────────

  private translateToProvider(input: Record<string, unknown>): Record<string, unknown> {
    const output: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      const canonical = resolveCanonicalField(key);
      const providerField = canonicalToProvider.get(canonical || key) || key;

      // Handle media URLs
      if (value && typeof value === 'object' && 'url' in (value as Record<string, unknown>)) {
        output[providerField] = (value as Record<string, unknown>).url;
        continue;
      }

      output[providerField] = value;
    }

    return output;
  }

  // ── Normalization ──────────────────────────────────────────────────────────

  private normalizeCatalogModel(m: MuapiModelCatalogItem): SmartModel {
    return {
      id: `muapi-${m.name}`,
      provider: 'muapi',
      name: m.name,
      displayName: this.formatDisplayName(m.name),
      description: m.description,
      category: m.category,
      family: m.family,
      group: m.group_of,
      endpoint: m.endpoint,
      cost: m.cost,
      currency: m.cost_currency || 'USD',
      dynamicPricing: m.dynamic_pricing || false,
      estimateEndpoint: m.estimate_endpoint,
      studios: this.inferStudios(m),
      enabled: false,
      featured: false,
      recommended: false,
      tags: this.inferTags(m),
      syncedAt: new Date().toISOString(),
    };
  }

  private normalizeDetailModel(
    detail: MuapiModelDetail,
    catalog?: SmartModel
  ): SmartModel {
    return {
      id: `muapi-${detail.name}`,
      provider: 'muapi',
      name: detail.name,
      displayName: catalog?.displayName || this.formatDisplayName(detail.name),
      description: catalog?.description,
      category: catalog?.category,
      family: catalog?.family,
      group: catalog?.group,
      endpoint: catalog?.endpoint || detail.name,
      cost: catalog?.cost,
      currency: catalog?.currency || 'USD',
      dynamicPricing: catalog?.dynamicPricing || false,
      estimateEndpoint: catalog?.estimateEndpoint,
      inputSchema: detail.input_schema,
      outputSchema: detail.output_schema,
      studios: catalog?.studios || [],
      enabled: catalog?.enabled || false,
      featured: catalog?.featured || false,
      recommended: catalog?.recommended || false,
      tags: catalog?.tags || [],
      syncedAt: catalog?.syncedAt,
    };
  }

  private normalizeStatus(status?: string): GenerationResult['status'] {
    const s = String(status || '').toLowerCase();
    if (['completed', 'succeeded', 'success'].includes(s)) return 'completed';
    if (['failed', 'error'].includes(s)) return 'failed';
    if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
    if (['processing', 'running', 'queued', 'pending'].includes(s)) return 'processing';
    return 'queued';
  }

  private normalizeOutputs(data: Record<string, unknown>): SmartOutput[] {
    const outputs: SmartOutput[] = [];

    // Direct outputs array
    if (Array.isArray(data.outputs)) {
      for (const item of data.outputs) {
        if (isString(item)) {
          outputs.push({ type: this.detectOutputType(item), urls: [item] });
        } else if (item && typeof item === 'object' && 'url' in (item as Record<string, unknown>)) {
          const url = (item as Record<string, unknown>).url as string;
          outputs.push({ type: this.detectOutputType(url), urls: [url] });
        }
      }
    }

    // Single output
    if (outputs.length === 0 && isString(data.url)) {
      outputs.push({ type: this.detectOutputType(data.url), urls: [data.url] });
    }
    if (outputs.length === 0 && isString(data.output)) {
      outputs.push({ type: this.detectOutputType(data.output), urls: [data.output] });
    }

    // Text output
    if (outputs.length === 0 && isString(data.text)) {
      outputs.push({ type: 'text', value: data.text });
    }

    return outputs;
  }

  private detectOutputType(url: string): SmartOutput['type'] {
    const lower = url.toLowerCase();
    if (lower.match(/\.(mp4|webm|mov|avi|mkv)(\?|$)/)) return 'video';
    if (lower.match(/\.(mp3|wav|ogg|aac|flac|m4a)(\?|$)/)) return 'audio';
    if (lower.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?|$)/)) return 'image';
    if (lower.includes('3d') || lower.includes('model')) return '3d';
    return 'image';
  }

  private inferGenerationType(model: SmartModel): string {
    const category = (model.category || '').toLowerCase();
    const family = (model.family || '').toLowerCase();

    if (category.includes('audio') || family.includes('audio')) return 'audio';
    if (category.includes('video') || family.includes('video')) return 'video';
    if (category.includes('image') || family.includes('image')) return 'image';
    if (category.includes('text') || family.includes('text')) return 'text';
    if (category.includes('avatar') || family.includes('avatar')) return 'avatar';
    if (category.includes('3d') || family.includes('3d')) return '3d';

    return 'image';
  }

  private inferStudios(model: MuapiModelCatalogItem): string[] {
    const category = (model.category || '').toLowerCase();
    const family = (model.family || '').toLowerCase();
    const group = (model.group_of || '').toLowerCase();
    const studios: string[] = [];

    if (category.includes('text-to-image') || family.includes('image')) {
      studios.push('image');
    }
    if (category.includes('image-to-image')) {
      studios.push('image', 'edit');
    }
    if (
      category.includes('text-to-video') ||
      category.includes('image-to-video') ||
      family.includes('video')
    ) {
      studios.push('video', 'cinema');
    }
    if (category.includes('video-to-video') || category.includes('video-effects')) {
      studios.push('video', 'effects');
    }
    if (category.includes('audio') || family.includes('audio')) {
      studios.push('audio');
    }
    if (category.includes('avatar')) {
      studios.push('avatar', 'character');
    }
    if (category.includes('upscale') || category.includes('enhance')) {
      studios.push('upscale', 'edit');
    }
    if (category.includes('3d') || family.includes('3d')) {
      studios.push('3d');
    }

    // Ensure at least 'image' if we have nothing
    if (studios.length === 0) {
      studios.push('image');
    }

    return studios;
  }

  private inferTags(model: MuapiModelCatalogItem): string[] {
    const tags: string[] = [];
    const category = (model.category || '').toLowerCase();

    if (category.includes('text-to-image')) tags.push('t2i');
    if (category.includes('image-to-image')) tags.push('i2i');
    if (category.includes('text-to-video')) tags.push('t2v');
    if (category.includes('image-to-video')) tags.push('i2v');
    if (category.includes('video-to-video')) tags.push('v2v');
    if (category.includes('audio')) tags.push('audio');
    if (category.includes('avatar')) tags.push('avatar');
    if (model.dynamic_pricing) tags.push('dynamic-pricing');

    return tags;
  }

  private formatDisplayName(name: string): string {
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }
}
