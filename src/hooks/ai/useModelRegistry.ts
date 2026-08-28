/**
 * useModelRegistry
 *
 * React hook for the SmartVideo Model Registry.
 * Provides loading state, error handling, and cached model data.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SmartModel, ModelUIOverride } from '../types/ai';
import { getModelRegistry } from '../lib/ai/ModelRegistry';

export interface UseModelRegistryOptions {
  enabled?: boolean;
  studios?: string[];
  category?: string;
  search?: string;
}

export interface UseModelRegistryResult {
  models: SmartModel[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getModel: (provider: string, modelName: string) => Promise<SmartModel | null>;
}

export function useModelRegistry(options: UseModelRegistryOptions = {}): UseModelRegistryResult {
  const [models, setModels] = useState<SmartModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const registry = useMemo(() => getModelRegistry(), []);

  const loadModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await registry.listModels({
        enabled: options.enabled,
        studios: options.studios,
        category: options.category,
      });

      let filtered = result;
      if (options.search) {
        const search = options.search.toLowerCase();
        filtered = result.filter(
          (m) =>
            m.displayName.toLowerCase().includes(search) ||
            m.name.toLowerCase().includes(search) ||
            m.category?.toLowerCase().includes(search)
        );
      }

      setModels(filtered);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load models'));
    } finally {
      setLoading(false);
    }
  }, [registry, options.enabled, options.studios, options.category, options.search]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const getModel = useCallback(
    async (provider: string, modelName: string) => {
      return registry.getModel(provider, modelName);
    },
    [registry]
  );

  return {
    models,
    loading,
    error,
    refetch: loadModels,
    getModel,
  };
}
