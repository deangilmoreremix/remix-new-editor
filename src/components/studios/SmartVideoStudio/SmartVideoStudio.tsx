/**
 * SmartVideo Studio
 *
 * Note: This file uses React.createElement instead of JSX to avoid
 * build-import-analysis parse errors with SWC.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { syncCatalog, getModelsForTab, STUDIO_TABS } from './svStudio/modelRegistry';
import ModeRail from './ModeRail';
import ModelSelector from './ModelSelector';
import DynamicModelForm from './DynamicModelForm';
import GenerationsPanel from './GenerationsPanel';
import { submitGeneration, type GenerationJob } from './svStudio/generationGateway';
import './svStudio/outputRenderer';
import '../../styles/smartVideoStudio.css';

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

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setLoading(true);
      try {
        await syncCatalog();
        if (cancelled) return;
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCatalog();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (modelsByTab[activeTab]?.length > 0) {
      const currentInTab = modelsByTab[activeTab].find(m => m.id === selectedModel?.id);
      if (!currentInTab) {
        setSelectedModel(modelsByTab[activeTab][0]);
      }
    }
  }, [activeTab, modelsByTab, selectedModel]);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  const handleModelSelect = useCallback((model) => {
    setSelectedModel(model);
  }, []);

  const handleGenerate = useCallback(async (params) => {
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

  const handleRetry = useCallback(async (job) => {
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

  return h('div', { className: 'smart-video-studio' },
    // Sticky Header
    h('header', { className: 'smart-video-studio-header' },
      h('div', { className: 'smart-video-studio-header-inner' },
        h('div', { className: 'smart-video-studio-header-logo' },
          h('img', {
            alt: 'SmartVideo Logo',
            width: 32,
            height: 32,
            src: '/m-logo.png',
            style: { color: 'transparent' }
          }),
          h('span', {
            style: {
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#fff'
            }
          }, 'SmartVideo')
        ),
        h('nav', {
          className: 'smart-video-studio-header-nav',
          'aria-label': 'Main Navigation'
        },
          h('a', { href: '/playground' }, 'Explore'),
          h('a', { href: '/rankings' }, 'Rankings'),
          h('a', { href: '/docs/introduction' }, 'Docs'),
          h('a', { href: '/blog' }, 'Blog'),
          h('a', { href: 'https://discord.com/invite/zpnuBRXhKg' }, 'Discord')
        ),
        h('div', { className: 'smart-video-studio-header-actions' },
          userBalance !== null && h('div', { className: 'smart-video-balance' },
            h('span', { className: 'smart-video-balance-label' }, 'Balance:'),
            h('span', { className: 'smart-video-balance-value' }, userBalance.toFixed(2)),
            h('span', { className: 'smart-video-balance-currency' }, 'credits')
          ),
          h('button', { className: 'smart-video-studio-header-signin' }, 'Sign In')
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
        selectedModel
          ? h(DynamicModelForm, {
              modelId: selectedModel.id,
              onGenerate: handleGenerate,
              onReset: handleReset
            })
          : h('div', { className: 'smart-video-no-model' },
              h('p', null, 'Select a model to begin creating.')
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
              if (selectedModel && prompt.trim()) {
                handleGenerate({ modelId: selectedModel.id, values: {}, cost: 0 });
              }
            }
          }
        }),
        h('button', {
          type: 'button',
          onClick: () => selectedModel && prompt.trim() && handleGenerate({ modelId: selectedModel.id, values: {}, cost: 0 }),
          disabled: generating || !selectedModel || !prompt.trim(),
          className: 'smart-video-prompt-submit'
        }, generating ? 'Generating...' : 'Generate')
      )
    )
  );
}
