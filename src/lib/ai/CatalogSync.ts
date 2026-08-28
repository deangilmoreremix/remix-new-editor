/**
 * Catalog Sync
 *
 * Server-side catalog synchronization from MuAPI to the SmartVideo Model Registry.
 *
 * 1. Fetches GET https://api.muapi.ai/api/v1/models
 * 2. Normalizes every model
 * 3. Upserts models into ai_models
 * 4. Preserves SmartVideo-specific metadata (enabled, featured, studios, tags)
 * 5. Detects new/disappeared models
 * 6. Records synced_at
 *
 * New models default to enabled=false (safe review state).
 */

import type { SmartModel, CatalogSyncResult } from '../../types/ai';
import { MuapiAdapter } from './MuapiAdapter';
import { getModelRegistry } from './ModelRegistry';

export class CatalogSync {
  private adapter: MuapiAdapter;
  private registry: ReturnType<typeof getModelRegistry>;

  constructor() {
    this.adapter = new MuapiAdapter();
    this.registry = getModelRegistry();
  }

  async sync(): Promise<CatalogSyncResult> {
    const errors: CatalogSyncResult['errors'] = [];
    const startTime = new Date().toISOString();

    try {
      // 1. Fetch catalog from MuAPI
      const muapiModels = await this.adapter.listModels();

      // 2. Load existing registry models
      const existingModels = await this.registry.listModels();
      const existingMap = new Map(
        existingModels.map((m) => [`${m.provider}:${m.name}`, m])
      );

      // 3. Prepare upsert batch
      const toUpsert: SmartModel[] = [];
      let newCount = 0;
      let updatedCount = 0;

      for (const muapiModel of muapiModels) {
        const key = `${muapiModel.provider}:${muapiModel.name}`;
        const existing = existingMap.get(key);

        if (existing) {
          // Merge: preserve SmartVideo-specific metadata
          const merged: SmartModel = {
            ...muapiModel,
            id: existing.id,
            enabled: existing.enabled, // Preserve admin config
            featured: existing.featured,
            recommended: existing.recommended,
            studios: existing.studios.length > 0 ? existing.studios : muapiModel.studios,
            tags: existing.tags.length > 0 ? existing.tags : muapiModel.tags,
            inputSchema: existing.inputSchema || muapiModel.inputSchema,
            outputSchema: existing.outputSchema || muapiModel.outputSchema,
            syncedAt: startTime,
            createdAt: existing.createdAt,
            updatedAt: startTime,
          };

          // Check if anything actually changed
          const changed =
            merged.displayName !== existing.displayName ||
            merged.description !== existing.description ||
            merged.category !== existing.category ||
            merged.family !== existing.family ||
            merged.group !== existing.group ||
            merged.endpoint !== existing.endpoint ||
            merged.cost !== existing.cost ||
            merged.dynamicPricing !== existing.dynamicPricing ||
            merged.estimateEndpoint !== existing.estimateEndpoint;

          if (changed) {
            updatedCount++;
          }

          toUpsert.push(merged);
          existingMap.delete(key);
        } else {
          // New model — default to disabled for safety
          const newModel: SmartModel = {
            ...muapiModel,
            enabled: false,
            featured: false,
            recommended: false,
            syncedAt: startTime,
            createdAt: startTime,
          };
          newCount++;
          toUpsert.push(newModel);
        }
      }

      // 4. Detect removed models
      const removedCount = existingMap.size;

      // 5. Batch upsert
      if (toUpsert.length > 0) {
        await this.registry.upsertModels(toUpsert);
      }

      // 6. Optionally mark removed models (soft delete by tagging)
      if (removedCount > 0) {
        for (const [key, model] of existingMap) {
          try {
            await this.registry.upsertModel({
              ...model,
              tags: [...new Set([...model.tags, 'removed-from-catalog'])],
              syncedAt: startTime,
            });
          } catch (err) {
            errors.push({
              model: key,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }
      }

      return {
        syncedAt: startTime,
        totalModels: muapiModels.length,
        newModels: newCount,
        updatedModels: updatedCount,
        removedModels: removedCount,
        errors,
      };
    } catch (error) {
      return {
        syncedAt: startTime,
        totalModels: 0,
        newModels: 0,
        updatedModels: 0,
        removedModels: 0,
        errors: [
          {
            model: 'catalog',
            error: error instanceof Error ? error.message : 'Sync failed',
          },
        ],
      };
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let catalogSyncInstance: CatalogSync | null = null;

export function getCatalogSync(): CatalogSync {
  if (!catalogSyncInstance) {
    catalogSyncInstance = new CatalogSync();
  }
  return catalogSyncInstance;
}
