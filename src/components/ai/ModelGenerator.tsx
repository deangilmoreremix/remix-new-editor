/**
 * ModelGenerator
 *
 * Reusable, studio-agnostic model generation component.
 *
 * Usage:
 * <ModelGenerator
 *   studio="video"
 *   capability="Image to Video"
 *   features={{ modelPicker: true, costEstimate: true, advancedControls: true }}
 * />
 */

import { useState, useEffect, useCallback } from 'react';
import type { SmartModel, SmartField, GenerationInput, ModelGeneratorFeatures } from '../../types/ai';
import { getModelRegistry } from '../../lib/ai/ModelRegistry';
import { getCatalogSync } from '../../lib/ai/CatalogSync';
import { getGenerationGateway } from '../../lib/ai/GenerationGateway';
import { getPricingEngine } from '../../lib/ai/PricingEngine';
import { normalizeSchema } from '../../lib/ai/SchemaNormalizer';
import DynamicModelForm from './DynamicModelForm';
import { useAuth } from '../../lib/AuthContext';

export interface ModelGeneratorProps {
  studio: string;
  capability?: string;
  features?: ModelGeneratorFeatures;
  onComplete?: (result: { urls: string[]; type: string }) => void;
}

export default function ModelGenerator({
  studio,
  capability,
  features = {},
  onComplete,
}: ModelGeneratorProps) {
  const { user } = useAuth();
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
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const jobIdRef = useState<string | null>(null)[0];

  // Load models for studio
  useEffect(() => {
    loadModels();
  }, [studio, capability]);

  async function loadModels() {
    try {
      const allModels = await registry.listModels({ enabled: true, studios: [studio] });
      let filtered = allModels;

      if (capability) {
        filtered = allModels.filter((m) =>
          m.category?.toLowerCase().includes(capability.toLowerCase()) ||
          m.family?.toLowerCase().includes(capability.toLowerCase()) ||
          m.tags.some((t) => t.toLowerCase().includes(capability.toLowerCase()))
        );
      }

      // Sort: featured first, then recommended, then alphabetically
      filtered.sort((a: SmartModel, b: SmartModel) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        return a.displayName.localeCompare(b.displayName);
      });

      setModels(filtered);
    } catch (err) {
      console.error('[ModelGenerator] Failed to load models:', err);
    }
  }

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

        // If schema not loaded, fetch from adapter
        if (!model.inputSchema) {
          const { MuapiAdapter } = await import('../../lib/ai/MuapiAdapter');
          const adapter = new MuapiAdapter();
          model = await adapter.getModel(model.name);
          await registry.upsertModel(model);
        }

        if (cancelled) return;

        const fields = normalizeSchema(model.inputSchema);
        setSchema(fields);

        // Initialize values with defaults
        const initialValues: Record<string, unknown> = {};
        for (const field of fields) {
          if (field.defaultValue !== undefined) {
            initialValues[field.key] = field.defaultValue;
          }
        }
        setValues(initialValues);
        setCostEstimate(null);
      } catch (err) {
        console.error('[ModelGenerator] Failed to load schema:', err);
      }
    }

    loadSchema();

    return () => {
      cancelled = true;
    };
  }, [selectedModel?.name]);

  // Update cost estimate when values change
  useEffect(() => {
    if (!selectedModel || !features.costEstimate) return;
    if (Object.keys(values).length === 0) return;

    let cancelled = false;

    async function estimate() {
      if (!selectedModel) return;
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
  }, [values, selectedModel?.name, features.costEstimate]);

  const handleGenerate = useCallback(async () => {
    if (!selectedModel || !user) return;

    setLoading(true);
    setError(null);

    try {
      const input: GenerationInput = {
        provider: selectedModel.provider,
        model: selectedModel.name,
        inputs: values,
        studioType: studio,
      };

      const job = await gateway.submitGeneration(input, { user } as any);
      setJobId(job.requestId);
      setJobStatus(job.status);

      // Poll for result
      pollResult(job.requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setLoading(false);
    }
  }, [selectedModel, values, user, studio, gateway]);

  async function pollResult(requestId: string) {
    try {
      const result = await gateway.pollResult(selectedModel!.provider, requestId, { user } as any);
      setJobStatus(result.status);

      if (result.status === 'completed' && result.outputs && onComplete) {
        onComplete({
          urls: result.outputs.flatMap((o) => o.urls),
          type: result.outputs[0]?.type || 'image',
        });
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Polling failed');
      setLoading(false);
    }
  }

  const handleSync = async () => {
    setSyncing(true);
    try {
      const sync = getCatalogSync();
      const result = await sync.sync();
      console.log('[ModelGenerator] Sync result:', result);
      await loadModels();
    } catch (err) {
      console.error('[ModelGenerator] Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Model Picker */}
      {features.modelPicker && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Model
          </label>
          <div className="flex gap-2">
            <select
              value={selectedModel?.name || ''}
              onChange={(e) => {
                const model = models.find((m) => m.name === e.target.value);
                setSelectedModel(model || null);
              }}
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-[#d9ff00] focus:outline-none"
            >
              <option value="">Select a model...</option>
              {models.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.displayName}
                  {m.featured && ' ★'}
                  {m.recommended && ' ✓'}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:border-[#d9ff00] hover:text-white disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Form */}
      {selectedModel && schema.length > 0 && (
        <DynamicModelForm
          model={selectedModel}
          schema={schema}
          values={values}
          onChange={setValues}
          onSubmit={handleGenerate}
          submitLabel={jobStatus === 'processing' ? 'Generating...' : 'Generate'}
          loading={loading}
          advanced={features.advancedControls}
        />
      )}

      {/* Cost Estimate */}
      {features.costEstimate && costEstimate && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Estimated Cost</span>
            <div className="text-right">
              <div className="text-lg font-bold text-white">
                {costEstimate.credits} credits
              </div>
              <div className="text-xs text-gray-500">
                Provider: ${costEstimate.providerCost.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Job Status */}
      {jobStatus && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#d9ff00]" />
            <span className="text-sm text-gray-300 capitalize">{jobStatus}</span>
          </div>
        </div>
      )}
    </div>
  );
}
