/**
 * Ported from CineGen: src/components/create/node-palette.tsx
 * Original: https://github.com/deangilmoreremix/CineGen/blob/main/src/components/create/node-palette.tsx
 *
 * Sub-task 1 port: palette only, no per-node UI.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NODE_REGISTRY, CATEGORY_COLORS } from '../../lib/workflows/node-registry.js';
import { ALL_MODELS } from '../../lib/fal/models.js';

/**
 * @typedef {Object} NodePaletteProps
 * @property {{x:number,y:number}} position
 * @property {(nodeType: string) => void} onSelect
 * @property {() => void} onClose
 */

/** @type {Readonly<Array<{id:'all'|'cloud'|'local'|'runpod'|'pod', label: string}>>} */
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'local', label: 'Local' },
  { id: 'runpod', label: 'RunPod' },
  { id: 'pod', label: 'Pod' },
];

/** @type {Readonly<string[]>} */
const CATEGORY_ORDER = ['utility', 'text', 'image', 'image-edit', 'video', 'audio'];
/** @type {Record<string, string>} */
const CATEGORY_LABELS = {
  utility: 'UTILITY',
  text: 'TEXT / LLM',
  image: 'IMAGE',
  'image-edit': 'IMAGE EDIT',
  video: 'VIDEO',
  audio: 'AUDIO',
};

/** @type {Record<string, string>} */
const PROVIDER_LABEL = {
  fal: 'fal.ai',
  kie: 'kie.ai',
  local: 'local',
  runpod: 'runpod',
  pod: 'pod',
};

export function NodePalette({ position, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);

  const openAbove = position.y > window.innerHeight / 2;

  const filteredGroups = useMemo(() => {
    const entries = Object.values(NODE_REGISTRY).filter((n) => {
      const modelDef = ALL_MODELS[n.type];
      const provider = modelDef ? (modelDef.provider ?? 'fal') : null;

      if (tab === 'cloud') {
        if (!n.isModel) return false;
        return provider === 'fal' || provider === 'kie';
      }
      if (tab === 'local') {
        if (!n.isModel) return false;
        return provider === 'local';
      }
      if (tab === 'runpod') {
        if (!n.isModel) return false;
        return provider === 'runpod';
      }
      if (tab === 'pod') {
        if (!n.isModel) return false;
        return provider === 'pod';
      }
      return true;
    });

    const filtered = search
      ? entries.filter((n) => n.label.toLowerCase().includes(search.toLowerCase()))
      : entries;

    return CATEGORY_ORDER
      .map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat],
        nodes: filtered.filter((n) => n.category === cat),
      }))
      .filter((g) => g.nodes.length > 0);
  }, [search, tab]);

  const flatList = useMemo(
    () => filteredGroups.flatMap((g) => g.nodes),
    [filteredGroups],
  );

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setSelectedIndex(0); }, [search, tab]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.querySelector('.np__item--selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatList[selectedIndex]) onSelect(flatList[selectedIndex].type);
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.code === 'Space' && !search) {
        e.preventDefault();
        onClose();
      }
    },
    [flatList, selectedIndex, onSelect, onClose, search],
  );

  return (
    <div
      ref={panelRef}
      className="np"
      style={{
        left: position.x,
        ...(openAbove
          ? { bottom: window.innerHeight - position.y }
          : { top: position.y }),
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Search */}
      <div className="np__search-row">
        <svg className="np__search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="np__search"
          placeholder="Search nodes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="np__search-clear" onClick={() => setSearch('')}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="np__tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`np__tab${tab === t.id ? ' np__tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="np__list" ref={listRef}>
        {flatList.length === 0 ? (
          <div className="np__empty">No results for &quot;{search}&quot;</div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.category} className="np__group">
              <div className="np__category">{group.label}</div>
              {group.nodes.map((node) => {
                const idx = flatList.indexOf(node);
                const modelDef = ALL_MODELS[node.type];
                const provider = modelDef ? (modelDef.provider ?? 'fal') : null;
                const providerLabel = provider ? PROVIDER_LABEL[provider] ?? provider : null;
                const typeBadge = node.isModel
                  ? (node.category === 'video' ? 'VID' : node.category === 'audio' ? 'AUD' : 'IMG')
                  : null;

                 return (
                  <button
                    key={node.type}
                    className={`np__item${idx === selectedIndex ? ' np__item--selected' : ''}`}
                    onClick={() => { console.log('[NodePalette] onSelect', node.type); onSelect(node.type); }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="np__item-label">{node.label}</span>
                    <span className="np__item-badges">
                      {providerLabel && (
                        <span className={`np__provider np__provider--${provider}`}>
                          ({providerLabel})
                        </span>
                      )}
                      {typeBadge && (
                        <span className={`np__badge np__badge--${node.category}`}>
                          {typeBadge}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
