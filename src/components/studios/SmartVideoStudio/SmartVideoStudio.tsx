/**
 * SmartVideo Studio — SmartVideoStudio
 *
 * Main shell component cloned from muapi.ai/studio layout.
 * Wraps ModeRail + ModelSelector + DynamicModelForm + GenerationsPanel
 * in the muapi-inspired split layout with bottom prompt bar.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { syncCatalog, getModelsForTab, STUDIO_TABS, type ModelMeta } from './svStudio/modelRegistry';
import ModeRail from './ModeRail';
import ModelSelector from './ModelSelector';
import DynamicModelForm from './DynamicModelForm';
import GenerationsPanel from './GenerationsPanel';
import { submitGeneration, type GenerationJob } from './svStudio/generationGateway';
import './svStudio/outputRenderer';
import '../../styles/smartVideoStudio.css';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SmartVideoStudio() {
  const [activeTab, setActiveTab] = useState<string>('image');
  const [selectedModel, setSelectedModel] = useState<ModelMeta | null>(null);
  const [modelsByTab, setModelsByTab] = useState<Record<string, ModelMeta[]>>({});
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  // Load catalog
  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);
      try {
        await syncCatalog();
        if (cancelled) return;

        const byTab: Record<string, ModelMeta[]> = {};
        for (const tab of STUDIO_TABS) {
          byTab[tab.id] = getModelsForTab(tab.id).filter(m => m.enabled);
        }
        setModelsByTab(byTab);

        // Auto-select first model of active tab
        if (byTab[activeTab]?.length > 0) {
          setSelectedModel(byTab[activeTab][0]);
        }
      } catch (e) {
        console.error('[SmartVideoStudio] Catalog load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCatalog();

    return () => { cancelled = true; };
  }, []);

  // Update selected model when tab changes
  useEffect(() => {
    if (modelsByTab[activeTab]?.length > 0) {
      const currentInTab = modelsByTab[activeTab].find(m => m.id === selectedModel?.id);
      if (!currentInTab) {
        setSelectedModel(modelsByTab[activeTab][0]);
      }
    }
  }, [activeTab, modelsByTab, selectedModel]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  const handleModelSelect = useCallback((model: ModelMeta) => {
    setSelectedModel(model);
  }, []);

  const handleGenerate = useCallback(async (params: { modelId: string; values: Record<string, unknown>; cost: number }) => {
    if (!selectedModel || !prompt.trim()) return;

    setGenerating(true);
    try {
      const job = await submitGeneration({
        modelId: params.modelId,
        values: { ...params.values, prompt: prompt.trim() },
      });
      setJobs(prev => [job, ...prev]);
      setPrompt('');
    } catch (e) {
      console.error('[SmartVideoStudio] Generation failed', e);
    } finally {
      setGenerating(false);
    }
  }, [selectedModel, prompt]);

  const handleRetry = useCallback(async (job: GenerationJob) => {
    if (!selectedModel) return;
    setGenerating(true);
    try {
      const newJob = await submitGeneration({
        modelId: job.modelId,
        values: job.input,
      });
      setJobs(prev => [newJob, ...prev]);
    } catch (e) {
      console.error('[SmartVideoStudio] Retry failed', e);
    } finally {
      setGenerating(false);
    }
  }, [selectedModel]);

  const handleUseAsInput = useCallback((job: GenerationJob) => {
    console.log('[SmartVideoStudio] Use as input:', job);
  }, []);

  const handleReset = useCallback(() => {
    setPrompt('');
  }, []);

  // Fetch user balance
  useEffect(() => {
    let cancelled = false;
    async function fetchBalance() {
      try {
        const response = await fetch('/api/user/balance');
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setUserBalance(data.balance ?? data.credits ?? null);
        }
      } catch {
        // Silently fail - balance display is optional
      }
    }
    fetchBalance();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="smart-video-studio">
      {/* Sticky Header */}
      <header className="smart-video-studio-header">
        <div className="smart-video-studio-header-inner">
          <div className="smart-video-studio-header-logo">
            <img
              alt="SmartVideo Logo"
              width="32"
              height="32"
              src="/m-logo.png"
              style={{ color: 'transparent' }}
            />
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              SmartVideo
            </span>
          </div>
          <nav className="smart-video-studio-header-nav" aria-label="Main Navigation">
            <a href="/playground">Explore</a>
            <a href="/rankings">Rankings</a>
            <a href="/docs/introduction">Docs</a>
            <a href="/blog">Blog</a>
            <a href="https://discord.com/invite/zpnuBRXhKg">Discord</a>
          </nav>
          <div className="smart-video-studio-header-actions">
            {userBalance !== null && (
              <div className="smart-video-balance">
                <span className="smart-video-balance-label">Balance:</span>
                <span className="smart-video-balance-value">{userBalance.toFixed(2)}</span>
                <span className="smart-video-balance-currency">credits</span>
              </div>
            )}
            <button className="smart-video-studio-header-signin">Sign In</button>
          </div>
        </div>
      </header>

      {/* Mode Rail + Config Panel + Main Content */}
      <div className="smart-video-studio-body">
        {/* Far-left rail */}
        <ModeRail
          activeTab={activeTab}
          onTabChange={handleTabChange}
          modelsByTab={modelsByTab}
        />

        {/* Config Panel */}
        <div className="smart-video-studio-config">
          {/* Model Selector */}
          <ModelSelector
            tabId={activeTab}
            selectedModelId={selectedModel?.id || null}
            onSelect={handleModelSelect}
          />

          {/* Dynamic Form */}
          {selectedModel ? (
            <DynamicModelForm
              modelId={selectedModel.id}
              onGenerate={handleGenerate}
              onReset={handleReset}
            />
          ) : (
            <div className="smart-video-no-model">
              <p>Select a model to begin creating.</p>
            </div>
          )}
        </div>

        {/* Main Panel — Generations */}
        <div className="smart-video-studio-main">
          <GenerationsPanel
            jobs={jobs}
            loading={loading}
            onRetry={handleRetry}
            onDelete={(jobId) => setJobs(prev => prev.filter(j => j.id !== jobId))}
            onUseAsInput={handleUseAsInput}
          />
        </div>
      </div>

      {/* Bottom Prompt Bar */}
      <div className="smart-video-prompt-bar">
        <div className="smart-video-prompt-bar-inner">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="smart-video-prompt-input"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (selectedModel && prompt.trim()) {
                  handleGenerate({ modelId: selectedModel.id, values: {}, cost: 0 });
                }
              }
            }}
          />
          <button
            type="button"
            onClick={() => selectedModel && prompt.trim() && handleGenerate({ modelId: selectedModel.id, values: {}, cost: 0 })}
            disabled={generating || !selectedModel || !prompt.trim()}
            className="smart-video-prompt-submit"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
