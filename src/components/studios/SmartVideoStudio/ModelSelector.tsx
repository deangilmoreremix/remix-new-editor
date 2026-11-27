/**
 * SmartVideo Studio — ModelSelector
 *
 * Searchable, filterable model picker with categories, providers, and badges.
 *
 * The list is drawn on document.body with position: fixed, placed from the Model box. The settings column
 * scrolls (overflow-y: auto), so a list drawn inside it was clipped off-screen and could not be clicked.
 */

const GAP = 6;
const MAX_HEIGHT = 420;
const MIN_WIDTH = 320;
const EDGE = 8;
// With less room than this below the box, the list opens above it (when there is more room there).
const MIN_BELOW_ROOM = 240;

export interface PickerPlacement { top: number; left: number; width: number; maxHeight: number; above: boolean }

/** Where the list goes: below the box, or above it when there is more room there; always inside the window. */
export function placePicker(rect: { top: number; bottom: number; left: number; width: number }, viewport: { width: number; height: number }): PickerPlacement {
  const below = viewport.height - rect.bottom - GAP - EDGE;
  const aboveRoom = rect.top - GAP - EDGE;
  const above = below < Math.min(MAX_HEIGHT, MIN_BELOW_ROOM) && aboveRoom > below;
  const maxHeight = Math.max(160, Math.min(MAX_HEIGHT, above ? aboveRoom : below));
  const width = Math.min(Math.max(rect.width, MIN_WIDTH), viewport.width - EDGE * 2);
  const left = Math.min(Math.max(EDGE, rect.left), viewport.width - width - EDGE);
  const top = above ? Math.max(EDGE, rect.top - GAP - maxHeight) : rect.bottom + GAP;
  return { top, left, width, maxHeight, above };
}

import React, { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<PickerPlacement | null>(null);

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPlacement(placePicker(r, { width: window.innerWidth, height: window.innerHeight }));
  }, []);

  // While open: follow the box when the window resizes or anything scrolls (the settings column scrolls),
  // at most once per frame. Measured before paint on open, so the list never shows in the wrong place.
  useLayoutEffect(() => {
    if (!showPicker) { setPlacement(null); return undefined; }
    reposition();
    let frame = 0;
    const onMove = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; reposition(); });
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [showPicker, reposition]);

  // Close on a click outside the box and the list, or on Escape (focus goes back to the box).
  useEffect(() => {
    if (!showPicker) return undefined;
    // pointerdown covers mouse, touch and pen, so a tap outside closes it on phones too.
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (pickerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setShowPicker(false);
      setQuery('');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setShowPicker(false);
      setQuery('');
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showPicker]);

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
        ref={triggerRef}
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

      {/* Picker dropdown, on document.body so the scrolling settings column cannot clip it */}
      {showPicker && placement && typeof document !== 'undefined' && createPortal(
        <div
          ref={listRef}
          className={`model-selector-picker ${placement?.above ? 'is-above' : 'is-below'}`}
          data-model-picker=""
          style={{ top: placement.top, left: placement.left, width: placement.width, maxHeight: placement.maxHeight }}
        >
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
        </div>,
        document.body,
      )}
    </div>
  );
}
