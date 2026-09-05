/**
 * SmartVideo Studio — ModelSelector
 *
 * Searchable, filterable model picker with categories, providers, and badges.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { searchModels, getModelsForTab, type ModelMeta } from './svStudio/modelRegistry';
import { syncCatalog } from './svStudio/modelRegistry';

interface ModelSelectorProps {
  tabId: string;
  selectedModelId: string | null;
  onSelect: (model: ModelMeta) => void;
}

const BADGES: Record<string, { label: string; icon: string }> = {
  'new': { label: 'NEW', icon: '✨' },
  'hot': { label: 'HOT', icon: '🔥' },
  'fast': { label: 'FAST', icon: '⚡' },
  'best': { label: 'BEST', icon: '🏆' },
  'budget': { label: 'BUDGET', icon: '💰' },
  'audio': { label: 'AUDIO', icon: '🔊' },
  '4k': { label: '4K', icon: '📺' },
  'lora': { label: 'LoRA', icon: '🧬' },
};

function getModelBadges(model: ModelMeta): { label: string; icon: string }[] {
  const badges: { label: string; icon: string }[] = [];
  const name = String(model.name || '').toLowerCase();
  const desc = String(model.description || '').toLowerCase();

  if (name.includes('pro') || desc.includes('high quality') || desc.includes('best quality')) {
    badges.push(BADGES.best);
  }
  if (name.includes('fast') || name.includes('schnell') || name.includes('lite') || desc.includes('fast')) {
    badges.push(BADGES.fast);
  }
  if (name.includes('budget') || model.cost < 0.01) {
    badges.push(BADGES.budget);
  }
  if (model.capabilities.audioGeneration) {
    badges.push(BADGES.audio);
  }
  if (name.includes('4k') || desc.includes('4k')) {
    badges.push(BADGES['4k']);
  }
  if (model.capabilities.lora) {
    badges.push(BADGES.lora);
  }

  return badges;
}

export default function ModelSelector({ tabId, selectedModelId, onSelect }: ModelSelectorProps) {
  const [query, setQuery] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [catalog, setCatalog] = useState<ModelMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Load catalog on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        await syncCatalog();
        const models = getModelsForTab(tabId).filter(m => m.enabled);
        if (!cancelled) setCatalog(models);
      } catch (e) {
        console.error('[ModelSelector] Failed to load catalog', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => { cancelled = true; };
  }, [tabId]);

  // Filter models
  const filteredModels = useMemo(() => {
    let models = catalog;

    // Filter by search query
    if (query.trim()) {
      const q = query.toLowerCase();
      models = models.filter(m => {
        const haystack = `${m.name || ''} ${m.description || ''} ${m.family || ''} ${m.category || ''} ${(m.group_of || []).join(' ')}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    return models;
  }, [catalog, query]);

  const selectedModel = catalog.find(m => m.id === selectedModelId);

  const handleSelect = useCallback((model: ModelMeta) => {
    onSelect(model);
    setShowPicker(false);
    setQuery('');
  }, [onSelect]);

  return (
    <div className="model-selector" ref={pickerRef}>
      <label className="smart-field-label">Model</label>

      {/* Selected model display / trigger */}
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className={`model-selector-trigger ${selectedModel ? 'has-selection' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={showPicker}
      >
        {selectedModel ? (
          <div className="model-selector-selected">
            <span className="model-selector-name">{selectedModel.display_name || selectedModel.name}</span>
            <span className="model-selector-provider">{selectedModel.family}</span>
          </div>
        ) : (
          <span className="model-selector-placeholder">Select a model...</span>
        )}
        <svg className="model-selector-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Picker dropdown */}
      {showPicker && (
        <div className="model-selector-picker">
          {/* Search */}
          <div className="model-selector-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search models..."
              className="model-selector-search-input"
              autoFocus
            />
          </div>

          {/* Model list */}
          <div className="model-selector-list" role="listbox">
            {loading ? (
              <div className="model-selector-loading">
                <div className="smart-skeleton" />
                <div className="smart-skeleton" />
                <div className="smart-skeleton" />
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="model-selector-empty">
                <p>No models found.</p>
              </div>
            ) : (
              filteredModels.map(model => {
                const badges = getModelBadges(model);
                return (
                  <button
                    key={model.id}
                    type="button"
                    role="option"
                    aria-selected={model.id === selectedModelId}
                    onClick={() => handleSelect(model)}
                    className={`model-card ${model.id === selectedModelId ? 'is-selected' : ''}`}
                  >
                    <div className="model-card-header">
                      <span className="model-card-name">{model.display_name || model.name}</span>
                      <div className="model-card-badges">
                        {badges.map(b => (
                          <span key={b.label} className="model-card-badge" title={b.label}>
                            {b.icon} {b.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="model-card-desc">{model.description}</p>
                    <div className="model-card-meta">
                      <span className="model-card-family">{model.family}</span>
                      <span className="model-card-cost">
                        {model.dynamic_pricing ? 'Dynamic' : `${model.cost.toFixed(4)} credits`}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
