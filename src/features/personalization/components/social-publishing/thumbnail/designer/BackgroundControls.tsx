'use client';

import React from 'react';
import { ImagePlus, Wand2 } from 'lucide-react';
import type { CanvasAdjustments } from '../thumbnailPrompt';
import type { DesignBackground } from './model';
import { ColorField, SliderField, ToggleGroup } from './designerUi';
import { plannedBackdrop, plannedLook } from './designerAssets';

export interface BackgroundControlsProps {
  background: DesignBackground;
  onChange: (patch: Partial<DesignBackground>) => void;
  /** Values planned in the concept panel (exact colour, blur, contrast, saturation). */
  planned?: CanvasAdjustments | null;
  onUploadBackground: (file: File) => void;
  /** Open the "Edit a region" panel for the background picture. */
  onEditRegion?: () => void;
  /** Saved background versions, and saving / switching between them. */
  variants?: string[];
  onSaveVariant?: () => void;
  onPickVariant?: (src: string) => void;
}

export default function BackgroundControls({ background: b, onChange, planned, onUploadBackground, onEditRegion, variants = [], onSaveVariant, onPickVariant }: BackgroundControlsProps) {
  const backdrop = plannedBackdrop(planned);
  const adjusted = b.blur !== 0 || b.brightness !== 100 || b.contrast !== 100 || b.saturation !== 100;
  return (
    <div className="space-y-3" data-testid="designer-background">
      <ToggleGroup
        label="Background type"
        value={b.mode}
        options={[{ value: 'image', label: 'Picture' }, { value: 'solid', label: 'Solid' }, { value: 'gradient', label: 'Gradient' }]}
        onChange={(mode) => { if (mode !== 'image' || b.imageSrc) onChange({ mode }); }}
      />
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/5" style={{ border: '1px dashed rgba(255,255,255,0.2)' }}>
        <ImagePlus size={13} />
        Upload a background picture
        <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload background picture" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadBackground(f); e.target.value = ''; }} />
      </label>

      {b.mode === 'image' && b.imageSrc && (
        <div className="space-y-2" data-testid="background-variants">
          {onEditRegion && (
            <button type="button" onClick={onEditRegion} className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-semibold transition-colors hover:bg-white/5" style={{ border: '1px solid rgba(217,255,0,0.3)', color: '#d9ff00' }}>
              <Wand2 size={13} />Edit a region of the picture
            </button>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-white/40">Background versions</p>
            {onSaveVariant && (
              <button type="button" onClick={onSaveVariant} disabled={variants.includes(b.imageSrc)} className="rounded-lg px-2.5 py-1 text-[10px] text-white/60 transition-colors hover:bg-white/5 disabled:opacity-40" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Save as variant</button>
            )}
          </div>
          {variants.length > 0 && (
            <div className="flex flex-wrap gap-2" role="list" aria-label="Saved background versions">
              {variants.map((v, i) => (
                <button key={v} type="button" role="listitem" onClick={() => onPickVariant?.(v)} aria-label={`Use background version ${i + 1}`} aria-current={v === b.imageSrc} className="h-10 w-16 overflow-hidden rounded-md" style={{ border: `2px solid ${v === b.imageSrc ? '#d9ff00' : 'rgba(255,255,255,0.12)'}` }}>
                  <img src={v} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {b.mode === 'solid' && <ColorField label="Background colour" value={b.color} onChange={(color) => onChange({ color })} />}
      {b.mode === 'gradient' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Gradient from" value={b.from} onChange={(from) => onChange({ from })} />
            <ColorField label="Gradient to" value={b.to} onChange={(to) => onChange({ to })} />
          </div>
          <SliderField label="Gradient angle" value={b.angle} min={0} max={360} onChange={(angle) => onChange({ angle })} unit="°" />
        </div>
      )}

      {backdrop && (
        <button type="button" onClick={() => onChange(backdrop)} className="w-full rounded-lg px-3 py-2 text-left text-[11px] transition-colors hover:bg-white/5" style={{ border: '1px solid rgba(217,255,0,0.25)', color: '#d9ff00' }}>
          Use the planned {backdrop.mode === 'gradient' ? 'gradient' : 'colour'} from Generate concepts
        </button>
      )}

      <div className="space-y-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[11px] font-medium text-white/40">Adjust the background only (text and layers stay sharp)</p>
        <SliderField label="Blur" value={b.blur} min={0} max={40} onChange={(blur) => onChange({ blur })} unit="px" />
        <SliderField label="Brightness" value={b.brightness} min={40} max={160} onChange={(brightness) => onChange({ brightness })} unit="%" />
        <SliderField label="Contrast" value={b.contrast} min={40} max={180} onChange={(contrast) => onChange({ contrast })} unit="%" />
        <SliderField label="Saturation" value={b.saturation} min={0} max={200} onChange={(saturation) => onChange({ saturation })} unit="%" />
        <div className="flex flex-wrap gap-2">
          {planned && (
            <button type="button" onClick={() => onChange(plannedLook(planned))} className="rounded-lg px-2.5 py-1.5 text-[10px] text-white/60 transition-colors hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Use planned blur, contrast and colour</button>
          )}
          <button type="button" disabled={!adjusted} onClick={() => onChange({ blur: 0, brightness: 100, contrast: 100, saturation: 100 })} className="rounded-lg px-2.5 py-1.5 text-[10px] text-white/60 transition-colors hover:bg-white/5 disabled:opacity-40" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Reset adjustments</button>
        </div>
      </div>
    </div>
  );
}
