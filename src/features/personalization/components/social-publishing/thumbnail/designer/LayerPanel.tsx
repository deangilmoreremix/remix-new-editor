'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Image as ImageIcon, Lock, Shapes, Trash2, Type, Unlock } from 'lucide-react';
import type { DesignProject, Layer, MoveDirection } from './model';

export interface LayerPanelProps {
  project: DesignProject;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string, key: 'locked' | 'hidden') => void;
  onMove: (id: string, dir: MoveDirection) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

const KIND_ICON = { text: Type, image: ImageIcon, shape: Shapes } as const;

const iconBtn = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent';

function Row({ layer, index, count, selected, ...p }: { layer: Layer; index: number; count: number; selected: boolean } & Omit<LayerPanelProps, 'project' | 'selectedId'>) {
  const Icon = KIND_ICON[layer.kind];
  return (
    <li
      data-testid="layer-row"
      data-layer-id={layer.id}
      aria-current={selected ? 'true' : undefined}
      className="rounded-lg p-1"
      style={{ background: selected ? 'rgba(217,255,0,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selected ? 'rgba(217,255,0,0.35)' : 'rgba(255,255,255,0.06)'}`, opacity: layer.hidden ? 0.6 : 1 }}
    >
      <div className="flex flex-wrap items-center gap-0.5">
        <button type="button" onClick={() => p.onSelect(layer.id)} aria-label={`Select ${layer.name}`} aria-pressed={selected} className="flex min-w-[96px] flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-white/80">
          <Icon size={13} className="shrink-0 text-white/40" />
          <span className="truncate">{layer.name}</span>
        </button>
        <div className="flex flex-wrap items-center">
          <button type="button" className={iconBtn} onClick={() => p.onToggle(layer.id, 'locked')} aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`} aria-pressed={layer.locked} title={layer.locked ? 'Unlock' : 'Lock'}>
            {layer.locked ? <Lock size={13} className="text-[#d9ff00]" /> : <Unlock size={13} />}
          </button>
          <button type="button" className={iconBtn} onClick={() => p.onToggle(layer.id, 'hidden')} aria-label={`${layer.hidden ? 'Show' : 'Hide'} ${layer.name}`} aria-pressed={layer.hidden} title={layer.hidden ? 'Show' : 'Hide'}>
            {layer.hidden ? <EyeOff size={13} className="text-[#d9ff00]" /> : <Eye size={13} />}
          </button>
          <button type="button" className={iconBtn} onClick={() => p.onMove(layer.id, 'forward')} disabled={index === 0} aria-label={`Bring ${layer.name} forward`} title="Bring forward"><ArrowUp size={13} /></button>
          <button type="button" className={iconBtn} onClick={() => p.onMove(layer.id, 'backward')} disabled={index === count - 1} aria-label={`Send ${layer.name} backward`} title="Send backward"><ArrowDown size={13} /></button>
          <button type="button" className={iconBtn} onClick={() => p.onDuplicate(layer.id)} aria-label={`Duplicate ${layer.name}`} title="Duplicate"><Copy size={13} /></button>
          <button type="button" className={iconBtn} onClick={() => p.onDelete(layer.id)} aria-label={`Delete ${layer.name}`} title="Delete"><Trash2 size={13} /></button>
        </div>
      </div>
    </li>
  );
}

/** Layers listed top-most first (the project stores them bottom to top). */
export default function LayerPanel({ project, selectedId, ...handlers }: LayerPanelProps) {
  const ordered = [...project.layers].reverse();
  if (ordered.length === 0) return <p className="rounded-lg p-3 text-[11px] text-white/40" style={{ background: 'rgba(255,255,255,0.03)' }}>No layers yet. Add a headline, a logo, a photo or a shape.</p>;
  return (
    <ul className="space-y-1" aria-label="Layers">
      {ordered.map((layer, i) => (
        <Row key={layer.id} layer={layer} index={i} count={ordered.length} selected={layer.id === selectedId} {...handlers} />
      ))}
    </ul>
  );
}
