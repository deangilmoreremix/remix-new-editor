/**
 * Admin Model Registry Page
 *
 * Protected admin route at /admin/model-registry
 * Allows admins to:
 * - View all models from MuAPI catalog
 * - Enable/disable models
 * - Set featured/recommended flags
 * - Manage studio mappings
 * - Preview generated forms
 * - Manage pricing rules
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import AdminGuard from '../../components/AdminGuard/AdminGuard';
import { getModelRegistry } from '../../lib/ai/ModelRegistry';
import { getCatalogSync } from '../../lib/ai/CatalogSync';
import type { SmartModel, ModelUIOverride } from '../../types/ai';
import DynamicModelForm from '../../components/ai/DynamicModelForm';

type Tab = 'models' | 'overrides' | 'pricing';

export default function AdminModelRegistry() {
  const { user } = useAuth();
  const registry = getModelRegistry();
  const [activeTab, setActiveTab] = useState<Tab>('models');
  const [models, setModels] = useState<SmartModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [previewModel, setPreviewModel] = useState<SmartModel | null>(null);
  const [previewSchema, setPreviewSchema] = useState<any>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [filter, setFilter] = useState({ enabled: 'all', category: 'all', search: '' });

  useEffect(() => {
    loadModels();
  }, []);

  async function loadModels() {
    setLoading(true);
    try {
      const allModels = await registry.listModels();
      setModels(allModels);
    } catch (err) {
      console.error('[AdminModelRegistry] Failed to load models:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const sync = getCatalogSync();
      const result = await sync.sync();
      setLastSync(result.syncedAt);
      console.log('[AdminModelRegistry] Sync result:', result);
      await loadModels();
    } catch (err) {
      console.error('[AdminModelRegistry] Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }

  async function toggleEnabled(model: SmartModel) {
    await registry.enableModel(model.provider, model.name, !model.enabled);
    await loadModels();
  }

  async function toggleFeatured(model: SmartModel) {
    await registry.setFeatured(model.provider, model.name, !model.featured);
    await loadModels();
  }

  async function toggleRecommended(model: SmartModel) {
    await registry.setRecommended(model.provider, model.name, !model.recommended);
    await loadModels();
  }

  async function handlePreview(model: SmartModel) {
    setPreviewModel(model);
    setPreviewSchema(model.inputSchema);
    setPreviewValues({});
  }

  const filteredModels = models.filter((m) => {
    if (filter.enabled !== 'all' && m.enabled !== (filter.enabled === 'true')) return false;
    if (filter.category !== 'all' && m.category !== filter.category) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      return (
        m.displayName.toLowerCase().includes(search) ||
        m.name.toLowerCase().includes(search) ||
        m.category?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const categories = Array.from(new Set(models.map((m) => m.category).filter(Boolean)));

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#050505] p-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Model Registry</h1>
              <p className="mt-1 text-gray-400">
                Manage MuAPI models, enablement, and UI overrides
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:border-[#d9ff00] hover:text-white disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Sync MuAPI Catalog'}
              </button>
              <button
                onClick={loadModels}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:border-[#d9ff00] hover:text-white"
              >
                Refresh
              </button>
            </div>
          </div>

          {lastSync && (
            <div className="mb-4 text-sm text-gray-500">
              Last synced: {new Date(lastSync).toLocaleString()}
            </div>
          )}

          {/* Tabs */}
          <div className="mb-6 flex gap-1 border-b border-gray-800">
            {(['models', 'overrides', 'pricing'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize ${
                  activeTab === tab
                    ? 'border-b-2 border-[#d9ff00] text-[#d9ff00]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Models Tab */}
          {activeTab === 'models' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Search models..."
                  value={filter.search}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                />
                <select
                  value={filter.enabled}
                  onChange={(e) => setFilter({ ...filter, enabled: e.target.value })}
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                >
                  <option value="all">All Status</option>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
                <select
                  value={filter.category}
                  onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Model Grid */}
              {loading ? (
                <div className="text-center text-gray-400">Loading...</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredModels.map((model) => (
                    <div
                      key={model.id}
                      className={`rounded-lg border p-4 ${
                        model.enabled ? 'border-gray-700 bg-gray-900' : 'border-gray-800 bg-gray-900/50'
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-white">{model.displayName}</h3>
                          <p className="text-xs text-gray-500">{model.name}</p>
                        </div>
                        <div className="flex gap-1">
                          {model.featured && (
                            <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
                              Featured
                            </span>
                          )}
                          {model.recommended && (
                            <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                              Recommended
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mb-3 text-xs text-gray-400">
                        <div>Category: {model.category || 'N/A'}</div>
                        <div>Family: {model.family || 'N/A'}</div>
                        <div>Studios: {model.studios.join(', ')}</div>
                        {model.cost && <div>Cost: ${model.cost}</div>}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleEnabled(model)}
                          className={`rounded px-3 py-1 text-xs font-medium ${
                            model.enabled
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          }`}
                        >
                          {model.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => toggleFeatured(model)}
                          className={`rounded px-3 py-1 text-xs font-medium ${
                            model.featured
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          {model.featured ? 'Unfeature' : 'Feature'}
                        </button>
                        <button
                          onClick={() => toggleRecommended(model)}
                          className={`rounded px-3 py-1 text-xs font-medium ${
                            model.recommended
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          {model.recommended ? 'Unrecommend' : 'Recommend'}
                        </button>
                        <button
                          onClick={() => handlePreview(model)}
                          className="rounded bg-gray-700 px-3 py-1 text-xs font-medium text-gray-300 hover:bg-gray-600"
                        >
                          Preview Form
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Overrides Tab */}
          {activeTab === 'overrides' && (
            <div className="text-center text-gray-400">
              Model UI overrides are managed per-model. Use the "Preview Form" button
              on a model card to see its current schema.
            </div>
          )}

          {/* Pricing Tab */}
          {activeTab === 'pricing' && (
            <div className="text-center text-gray-400">
              Pricing rules are managed via the model_pricing_rules table.
              Use the Supabase Dashboard to configure markup multipliers,
              minimum credits, and credit rates per model.
            </div>
          )}

          {/* Preview Modal */}
          {previewModel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8">
              <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-gray-700 bg-[#0a0a0a] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">
                    Preview: {previewModel.displayName}
                  </h2>
                  <button
                    onClick={() => setPreviewModel(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {previewSchema ? (
                  <DynamicModelForm
                    model={previewModel}
                    schema={typeof previewSchema === 'string' ? JSON.parse(previewSchema) : previewSchema}
                    values={previewValues}
                    onChange={setPreviewValues}
                    advanced
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    No schema loaded for this model.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}
