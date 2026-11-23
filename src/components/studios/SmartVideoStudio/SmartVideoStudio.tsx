/**
 * SmartVideo Studio
 *
 * Note: This file uses React.createElement instead of JSX to avoid
 * build-import-analysis parse errors with SWC.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { syncCatalog, getModelsForTab, getModelById, STUDIO_TABS } from './svStudio/modelRegistry';
import ModeRail from './ModeRail';
import ModelSelector from './ModelSelector';
import DynamicModelForm from './DynamicModelForm';
import GenerationsPanel from './GenerationsPanel';
import { submitGeneration, type GenerationJob } from './svStudio/generationGateway';
import './svStudio/outputRenderer';
import '../../../styles/smartVideoStudio.css';

const h = React.createElement;

export default function SmartVideoStudio() {
  const [activeTab, setActiveTab] = useState('image');
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelsByTab, setModelsByTab] = useState({});
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [userBalance, setUserBalance] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [notice, setNotice] = useState(null);
  const formValuesRef = useRef({});
  const handleValuesChange = useCallback((values) => { formValuesRef.current = values; }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setLoading(true);
      try {
        const all = await syncCatalog();
        if (cancelled) return;
        if (all.length === 0) {
          setCatalogError('No models could be loaded. Check your connection and reload the page.');
        }
        const byTab = {};
        for (const tab of STUDIO_TABS) {
          byTab[tab.id] = getModelsForTab(tab.id).filter(m => m.enabled);
        }
        setModelsByTab(byTab);
        if (byTab[activeTab]?.length > 0) {
          setSelectedModel(byTab[activeTab][0]);
        }
      } catch (e) {
        console.error('[SmartVideoStudio] Catalog load failed', e);
        if (!cancelled) setCatalogError('The model catalog failed to load. Reload the page to try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCatalog();
    return () => { cancelled = true; };
  }, []);

  const tabModels = modelsByTab[activeTab] || [];
  // Only a model that belongs to the active tab can be generated with.
  const activeModel = selectedModel && tabModels.some(m => m.id === selectedModel.id) ? selectedModel : null;
  // Which key the bottom prompt bar fills: null for models with no prompt (lip-sync, upscale...).
  const activeSchema = activeModel ? (getModelById(activeModel.id)?.input_schema || activeModel.input_schema) : null;
  const promptKey = !activeModel ? null
    : !activeSchema ? 'prompt'
      : 'prompt' in activeSchema ? 'prompt' : 'text' in activeSchema ? 'text' : null;

  useEffect(() => {
    if (tabModels.length > 0) {
      if (!tabModels.some(m => m.id === selectedModel?.id)) setSelectedModel(tabModels[0]);
    } else if (selectedModel && !loading) {
      // Empty mode (3D, AI Tools): drop the previous tab's model so it cannot be submitted from here.
      setSelectedModel(null);
    }
  }, [tabModels, selectedModel, loading]);

  useEffect(() => { setNotice(null); }, [activeTab, selectedModel]);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  const handleModelSelect = useCallback((model) => {
    setSelectedModel(model);
  }, []);

  // Shows a "processing" card right away, then swaps in the finished (or failed) job.
  const runJob = useCallback(async (modelId, values) => {
    const now = new Date().toISOString();
    const tempId = `pending_${Date.now()}`;
    const model = selectedModel?.id === modelId ? selectedModel : null;
    setJobs(prev => [{
      id: tempId, modelId, modelName: model?.display_name || model?.name || modelId,
      status: 'processing', input: values, createdAt: now, updatedAt: now,
    }, ...prev]);
    let job;
    try {
      job = await submitGeneration({ modelId, values });
    } catch (e) {
      job = {
        id: tempId, modelId, modelName: model?.display_name || model?.name || modelId,
        status: 'failed', input: values, error: e instanceof Error ? e.message : String(e),
        createdAt: now, updatedAt: new Date().toISOString(),
      };
    }
    setJobs(prev => prev.map(j => (j.id === tempId ? job : j)));
  }, [selectedModel]);

  const handleGenerate = useCallback(async (params) => {
    if (!activeModel || params.modelId !== activeModel.id) {
      setNotice('Pick a model in this mode before generating.');
      return;
    }
    const values = { ...formValuesRef.current, ...params.values };
    if (promptKey) {
      if (prompt.trim()) values[promptKey] = prompt.trim();
      if (!String(values[promptKey] ?? '').trim()) {
        setNotice('Enter a prompt first.');
        return;
      }
    }
    setNotice(null);
    setGenerating(true);
    try {
      await runJob(params.modelId, values);
      setPrompt('');
    } catch (e) {
      console.error('[SmartVideoStudio] Generation failed', e);
      const message = e instanceof Error ? e.message : String(e);
      const now = new Date().toISOString();
      setJobs(prev => [{
        id: `failed_${Date.now()}`, modelId: params.modelId,
        modelName: activeModel.display_name || activeModel.name || params.modelId,
        status: 'failed', input: values, error: message, createdAt: now, updatedAt: now,
      }, ...prev]);
      setNotice(`Generation failed: ${message}`);
    } finally {
      setGenerating(false);
    }
  }, [activeModel, promptKey, prompt, runJob]);

  const submitFromBar = useCallback(() => {
    if (!activeModel) {
      setNotice('No models are available in this mode yet. Pick another mode on the left.');
      return;
    }
    handleGenerate({ modelId: activeModel.id, values: {}, cost: 0 });
  }, [activeModel, handleGenerate]);

  const handleRetry = useCallback(async (job) => {
    setGenerating(true);
    try {
      await runJob(job.modelId, job.input);
    } finally {
      setGenerating(false);
    }
  }, [runJob]);

  const handleUseAsInput = useCallback((job) => {
    console.log('[SmartVideoStudio] Use as input:', job);
  }, []);

  const handleReset = useCallback(() => {
    setPrompt('');
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchBalance() {
      try {
        // MuAPI balance for the user's own key (null when no key is set).
        const { muapi } = await import('../../../lib/muapi.js');
        const balance = await muapi.getBalance();
        if (!cancelled && typeof balance === 'number') setUserBalance(balance);
      } catch {
        // Silently fail - balance display is optional
      }
    }
    fetchBalance();
    return () => { cancelled = true; };
  }, []);

  return h('div', { className: 'smart-video-studio' },
    // Sticky Header
    h('header', { className: 'smart-video-studio-header' },
      h('div', { className: 'smart-video-studio-header-inner' },
        h('div', { className: 'smart-video-studio-header-logo' },
          h('span', {
            style: {
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#fff'
            }
          }, 'SmartVideo Studio')
        ),
        h('div', { className: 'smart-video-studio-header-actions' },
          userBalance !== null && h('div', { className: 'smart-video-balance' },
            h('span', { className: 'smart-video-balance-label' }, 'Balance:'),
            h('span', { className: 'smart-video-balance-value' }, userBalance.toFixed(2)),
            h('span', { className: 'smart-video-balance-currency' }, 'credits')
          )
        )
      )
    ),
    // Body
    h('div', { className: 'smart-video-studio-body' },
      h(ModeRail, { activeTab, onTabChange: handleTabChange, modelsByTab }),
      h('div', { className: 'smart-video-studio-config' },
        h(ModelSelector, {
          tabId: activeTab,
          selectedModelId: selectedModel?.id || null,
          onSelect: handleModelSelect
        }),
        catalogError
          ? h('div', { className: 'smart-video-no-model', role: 'alert' },
              h('p', null, catalogError)
            )
          : activeModel
            ? h(DynamicModelForm, {
                key: activeModel.id,
                modelId: activeModel.id,
                onGenerate: handleGenerate,
                onReset: handleReset,
                onValuesChange: handleValuesChange
              })
            : h('div', { className: 'smart-video-no-model' },
                h('p', null, loading
                  ? 'Loading models...'
                  : tabModels.length
                    ? 'Select a model to begin creating.'
                    : 'No models are available in this category yet. Pick another mode on the left.')
              )
      ),
      h('div', { className: 'smart-video-studio-main' },
        h(GenerationsPanel, {
          jobs,
          loading,
          onRetry: handleRetry,
          onDelete: (jobId) => setJobs(prev => prev.filter(j => j.id !== jobId)),
          onUseAsInput: handleUseAsInput
        })
      )
    ),
    // Bottom Prompt Bar
    h('div', { className: 'smart-video-prompt-bar' },
      h('div', { className: 'smart-video-prompt-bar-inner' },
        h('textarea', {
          value: prompt,
          onChange: (e) => setPrompt(e.target.value),
          placeholder: 'Enter your prompt here...',
          className: 'smart-video-prompt-input',
          onKeyDown: (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!generating) submitFromBar();
            }
          }
        }),
        h('button', {
          type: 'button',
          onClick: submitFromBar,
          disabled: generating || !activeModel,
          title: !activeModel ? 'No model selected for this mode' : undefined,
          className: 'smart-video-prompt-submit'
        }, generating ? 'Generating...' : 'Generate')
      ),
      notice && h('div', {
        className: 'smart-video-prompt-notice',
        role: 'status',
        style: { fontSize: '12px', color: '#f87171', padding: '4px 4px 0' }
      }, notice)
    )
  );
}

/** Router entry: mounts the studio into a div and unmounts it when the route changes. */
export function SmartVideoStudioPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full';
  const root = createRoot(container);
  root.render(h(SmartVideoStudio));
  container.cleanup = () => root.unmount();
  return container;
}
