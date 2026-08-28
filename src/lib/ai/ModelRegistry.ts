/**
 * Model Registry
 *
 * Persists synchronized model metadata in Supabase.
 * Provides lookup, enable/disable, studio mapping, and override APIs.
 *
 * Uses the existing `ai_models` table (created via migration).
 * If the table doesn't exist yet, falls back to in-memory cache.
 */

import type { SmartModel, ModelUIOverride } from '../../types/ai';
import { supabase } from '../supabase';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let memoryCache: { models: SmartModel[]; fetchedAt: number } | null = null;

// ── Interface ────────────────────────────────────────────────────────────────

export interface ModelRegistry {
  listModels(filters?: { enabled?: boolean; studios?: string[]; category?: string }): Promise<SmartModel[]>;
  getModel(provider: string, modelName: string): Promise<SmartModel | null>;
  upsertModel(model: SmartModel): Promise<SmartModel>;
  upsertModels(models: SmartModel[]): Promise<SmartModel[]>;
  enableModel(provider: string, modelName: string, enabled: boolean): Promise<void>;
  setFeatured(provider: string, modelName: string, featured: boolean): Promise<void>;
  setRecommended(provider: string, modelName: string, recommended: boolean): Promise<void>;
  setStudios(provider: string, modelName: string, studios: string[]): Promise<void>;
  getOverrides(provider: string, modelName: string): Promise<ModelUIOverride[]>;
  setOverride(override: ModelUIOverride): Promise<ModelUIOverride>;
  deleteOverride(provider: string, modelName: string, fieldName: string): Promise<void>;
  clearCache(): void;
}

// ── Singleton ────────────────────────────────────────────────────────────────

let instance: ModelRegistry | null = null;

export function getModelRegistry(): ModelRegistry {
  if (!instance) {
    instance = new SupabaseModelRegistry();
  }
  return instance;
}

// ── Implementation ───────────────────────────────────────────────────────────

class SupabaseModelRegistry implements ModelRegistry {
  async listModels(filters?: { enabled?: boolean; studios?: string[]; category?: string }): Promise<SmartModel[]> {
    // Check memory cache first
    if (memoryCache && Date.now() - memoryCache.fetchedAt < CACHE_TTL_MS) {
      return this.applyFilters(memoryCache.models, filters);
    }

    const models = await this.fetchFromDb();
    memoryCache = { models, fetchedAt: Date.now() };
    return this.applyFilters(models, filters);
  }

  async getModel(provider: string, modelName: string): Promise<SmartModel | null> {
    const all = await this.listModels();
    return all.find((m) => m.provider === provider && m.name === modelName) || null;
  }

  async upsertModel(model: SmartModel): Promise<SmartModel> {
    const { data, error } = await supabase
      .from('ai_models')
      .upsert(
        {
          provider: model.provider,
          model_name: model.name,
          display_name: model.displayName,
          description: model.description,
          category: model.category,
          family: model.family,
          group_of: model.group,
          endpoint: model.endpoint,
          estimate_endpoint: model.estimateEndpoint,
          cost: model.cost,
          cost_currency: model.currency,
          dynamic_pricing: model.dynamicPricing,
          input_schema: model.inputSchema,
          output_schema: model.outputSchema,
          enabled: model.enabled,
          featured: model.featured,
          recommended: model.recommended,
          studios: model.studios,
          tags: model.tags,
          synced_at: model.syncedAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'provider,model_name' }
      )
      .select()
      .single();

    if (error) {
      console.error('[ModelRegistry] upsert error:', error);
      throw error;
    }

    this.clearCache();
    return this.rowToModel(data);
  }

  async upsertModels(models: SmartModel[]): Promise<SmartModel[]> {
    const results: SmartModel[] = [];

    // Batch upsert in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < models.length; i += chunkSize) {
      const chunk = models.slice(i, i + chunkSize);
      const rows = chunk.map((m) => ({
        provider: m.provider,
        model_name: m.name,
        display_name: m.displayName,
        description: m.description,
        category: m.category,
        family: m.family,
        group_of: m.group,
        endpoint: m.endpoint,
        estimate_endpoint: m.estimateEndpoint,
        cost: m.cost,
        cost_currency: m.currency,
        dynamic_pricing: m.dynamicPricing,
        input_schema: m.inputSchema,
        output_schema: m.outputSchema,
        enabled: m.enabled,
        featured: m.featured,
        recommended: m.recommended,
        studios: m.studios,
        tags: m.tags,
        synced_at: m.syncedAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('ai_models')
        .upsert(rows, { onConflict: 'provider,model_name' })
        .select();

      if (error) {
        console.error('[ModelRegistry] batch upsert error:', error);
        continue;
      }

      if (data) {
        results.push(...data.map((row) => this.rowToModel(row)));
      }
    }

    this.clearCache();
    return results;
  }

  async enableModel(provider: string, modelName: string, enabled: boolean): Promise<void> {
    const { error } = await supabase
      .from('ai_models')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('provider', provider)
      .eq('model_name', modelName);

    if (error) {
      console.error('[ModelRegistry] enableModel error:', error);
      throw error;
    }

    this.clearCache();
  }

  async setFeatured(provider: string, modelName: string, featured: boolean): Promise<void> {
    const { error } = await supabase
      .from('ai_models')
      .update({ featured, updated_at: new Date().toISOString() })
      .eq('provider', provider)
      .eq('model_name', modelName);

    if (error) throw error;
    this.clearCache();
  }

  async setRecommended(provider: string, modelName: string, recommended: boolean): Promise<void> {
    const { error } = await supabase
      .from('ai_models')
      .update({ recommended, updated_at: new Date().toISOString() })
      .eq('provider', provider)
      .eq('model_name', modelName);

    if (error) throw error;
    this.clearCache();
  }

  async setStudios(provider: string, modelName: string, studios: string[]): Promise<void> {
    const { error } = await supabase
      .from('ai_models')
      .update({ studios, updated_at: new Date().toISOString() })
      .eq('provider', provider)
      .eq('model_name', modelName);

    if (error) throw error;
    this.clearCache();
  }

  async getOverrides(provider: string, modelName: string): Promise<ModelUIOverride[]> {
    const { data, error } = await supabase
      .from('model_ui_overrides')
      .select('*')
      .eq('provider', provider)
      .eq('model_name', modelName)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[ModelRegistry] getOverrides error:', error);
      return [];
    }

    return (data || []).map((row) => this.rowToOverride(row));
  }

  async setOverride(override: ModelUIOverride): Promise<ModelUIOverride> {
    const { data, error } = await supabase
      .from('model_ui_overrides')
      .upsert(
        {
          provider: override.provider,
          model_name: override.modelName,
          field_name: override.fieldName,
          canonical_field: override.canonicalField,
          component: override.component,
          label: override.label,
          description: override.description,
          section: override.section,
          sort_order: override.sortOrder,
          advanced: override.advanced,
          hidden: override.hidden,
          config: override.config,
        },
        { onConflict: 'provider,model_name,field_name' }
      )
      .select()
      .single();

    if (error) {
      console.error('[ModelRegistry] setOverride error:', error);
      throw error;
    }

    return this.rowToOverride(data);
  }

  async deleteOverride(provider: string, modelName: string, fieldName: string): Promise<void> {
    const { error } = await supabase
      .from('model_ui_overrides')
      .delete()
      .eq('provider', provider)
      .eq('model_name', modelName)
      .eq('field_name', fieldName);

    if (error) throw error;
  }

  clearCache(): void {
    memoryCache = null;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async fetchFromDb(): Promise<SmartModel[]> {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .order('display_name', { ascending: true });

    if (error) {
      console.error('[ModelRegistry] fetchFromDb error:', error);
      return [];
    }

    return (data || []).map((row) => this.rowToModel(row));
  }

  private applyFilters(
    models: SmartModel[],
    filters?: { enabled?: boolean; studios?: string[]; category?: string }
  ): SmartModel[] {
    let result = models;

    if (filters?.enabled !== undefined) {
      result = result.filter((m) => m.enabled === filters.enabled);
    }

    if (filters?.studios && filters.studios.length > 0) {
      result = result.filter((m) =>
        filters.studios!.some((s) => m.studios.includes(s))
      );
    }

    if (filters?.category) {
      result = result.filter((m) => m.category === filters.category);
    }

    return result;
  }

  private rowToModel(row: Record<string, unknown>): SmartModel {
    return {
      id: String(row.id),
      provider: String(row.provider),
      name: String(row.model_name),
      displayName: String(row.display_name || row.model_name),
      description: row.description ? String(row.description) : undefined,
      category: row.category ? String(row.category) : undefined,
      family: row.family ? String(row.family) : undefined,
      group: row.group_of ? String(row.group_of) : undefined,
      endpoint: String(row.endpoint),
      cost: row.cost != null ? Number(row.cost) : undefined,
      currency: row.cost_currency ? String(row.cost_currency) : undefined,
      dynamicPricing: Boolean(row.dynamic_pricing),
      estimateEndpoint: row.estimate_endpoint ? String(row.estimate_endpoint) : undefined,
      inputSchema: row.input_schema,
      outputSchema: row.output_schema,
      studios: Array.isArray(row.studios) ? (row.studios as string[]) : [],
      enabled: Boolean(row.enabled),
      featured: Boolean(row.featured),
      recommended: Boolean(row.recommended),
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      syncedAt: row.synced_at ? String(row.synced_at) : undefined,
      createdAt: row.created_at ? String(row.created_at) : undefined,
      updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    };
  }

  private rowToOverride(row: Record<string, unknown>): ModelUIOverride {
    return {
      id: String(row.id),
      provider: String(row.provider),
      modelName: String(row.model_name),
      fieldName: String(row.field_name),
      canonicalField: row.canonical_field ? String(row.canonical_field) : undefined,
      component: row.component ? String(row.component) : undefined,
      label: row.label ? String(row.label) : undefined,
      description: row.description ? String(row.description) : undefined,
      section: row.section ? String(row.section) : undefined,
      sortOrder: row.sort_order != null ? Number(row.sort_order) : undefined,
      advanced: Boolean(row.advanced),
      hidden: Boolean(row.hidden),
      config: row.config || {},
    };
  }
}
