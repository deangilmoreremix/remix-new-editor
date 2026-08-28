/**
 * useModelGenerator
 *
 * React hook for the ModelGenerator component.
 * Manages model selection, schema loading, form state, generation, and polling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SmartModel, SmartField, GenerationInput, ModelGeneratorFeatures } from '../../types/ai';
import { getModelRegistry } from '../../lib/ai/ModelRegistry';
import { getGenerationGateway } from '../../lib/ai/GenerationGateway';
import { getPricingEngine } from '../../lib/ai/PricingEngine';
import { normalizeSchema } from '../../lib/ai/SchemaNormalizer';

export interface UseModelGeneratorOptions {
  studio: string;
  capability?: string;
  features?: ModelGeneratorFeatures;
}

export interface UseModelGeneratorResult {
  models: SmartModel[];
  selectedModel: SmartModel | null;
  schema: SmartField[];
  values: Record<string, unknown>;
  loading: boolean;
  syncing: boolean;
  costEstimate: { credits: number; providerCost: number } | null;
  error: string | null;
  jobId: string | null;
  jobStatus: string | null;
  setSelectedModel: (model: SmartModel | null) => void;
  setValues: (values: Record<string, unknown>) => void;
  handleGenerate: () => Promise<void>;
  handleSync: () => Promise<void>;
  refetchModels: () => Promise<void>;
}

export function useModelGenerator(options: UseModelGeneratorOptions): UseModelGeneratorResult {
  const registry = getModelRegistry();
  const gateway = getGenerationGateway();
  const pricingEngine = getPricingEngine();

  const [models, setModels] = useState<SmartModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<SmartModel | null>(null);
  const [schema, setSchema] = useState<SmartField[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [costEstimate, setCostEstimate] = useState<{ credits: number; providerCost: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  // Load models for studio
  const loadModels = useCallback(async () => {
    try {
      let allModels = await registry.listModels({ enabled: true, studios: [options.studio] });
      if (options.capability) {
        allModels = allModels.filter((m) =>
          m.category?.toLowerCase().includes(options.capability!.toLowerCase()) ||
          m.family?.toLowerCase().includes(options.capability!.toLowerCase()) ||
          m.tags.some((t) => t.toLowerCase().includes(options.capability!.toLowerCase()))
        );
      }

      allModels.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        return a.displayName.localeCompare(b.displayName);
      });

      setModels(allModels);
    } catch (err) {
      console.error('[useModelGenerator] Failed to load models:', err);
    }
  }, [registry, options.studio, options.capability]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Load schema when model changes
  useEffect(() => {
    if (!selectedModel) {
      setSchema([]);
      return;
    }

    let cancelled = false;

    async function loadSchema() {
      try {
        let model = selectedModel;

        if (!model.inputSchema) {
          const { MuapiAdapter } = await import('../../lib/ai/MuapiAdapter');
          const adapter = new MuapiAdapter();
          model = await adapter.getModel(model.name);
          await registry.upsertModel(model);
        }

        if (cancelled) return;

        const fields = normalizeSchema(model.inputSchema);
        setSchema(fields);

        const initialValues: Record<string, unknown> = {};
        for (const field of fields) {
          if (field.defaultValue !== undefined) {
            initialValues[field.key] = field.defaultValue;
          }
        }
        setValues(initialValues);
        setCostEstimate(null);
      } catch (err) {
        console.error('[useModelGenerator] Failed to load schema:', err);
      }
    }

    loadSchema();

    return () => {
      cancelled = true;
    };
  }, [selectedModel?.name, registry]);

  // Update cost estimate when values change
  useEffect(() => {
    if (!selectedModel || !options.features?.costEstimate) return;
    if (Object.keys(values).length === 0) return;

    let cancelled = false;

    async function estimate() {
      try {
        const { MuapiAdapter } = await import('../../lib/ai/MuapiAdapter');
        const adapter = new MuapiAdapter();
        const estimate = await adapter.estimateCost(selectedModel.name, values);
        if (cancelled) return;

        const credits = await pricingEngine.calculateCredits(
          selectedModel.provider,
          selectedModel.name,
          estimate.providerCost,
          estimate.currency
        );

        setCostEstimate({
          credits: credits.credits,
          providerCost: estimate.providerCost,
        });
      } catch {
        // Silently fail for estimates
      }
    }

    const timeout = setTimeout(estimate, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [values, selectedModel?.name, options.features?.costEstimate, pricingEngine]);

  const handleGenerate = useCallback(async () => {
    if (!selectedModel) return;

    setLoading(true);
    setError(null);

    try {
      const input: GenerationInput = {
        provider: selectedModel.provider,
        model: selectedModel.name,
        inputs: values,
        studioType: options.studio,
      };

      const job = await gateway.submitGeneration(input, { user: { id: 'demo' } } as any);
      setJobId(job.requestId);
      setJobStatus(job.status);

      // Poll for result
      pollResult(job.requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setLoading(false);
    }
  }, [selectedModel, values, options.studio, gateway]);

  async function pollResult(requestId: string) {
    try {
      const result = await gateway.pollResult(selectedModel!.provider, requestId, { user: { id: 'demo' } } as any);
      setJobStatus(result.status);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Polling failed');
      setLoading(false);
    }
  }

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { getCatalogSync } = await import('../../lib/ai/CatalogSync');
      const sync = getCatalogSync();
      await sync.sync();
      await loadModels();
    } catch (err) {
      console.error('[useModelGenerator] Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, [loadModels]);

  return {
    models,
    selectedModel,
    schema,
    values,
    loading,
    syncing,
    costEstimate,
    error,
    jobId,
    jobStatus,
    setSelectedModel,
    setValues,
    handleGenerate,
    handleSync,
    refetchModels: loadModels,
  };
}
