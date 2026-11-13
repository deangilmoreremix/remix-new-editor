'use client'

/**
 * Text effects and exit animation for the selected layer (Stage 5): shadow, glow, outline, and how the text leaves.
 * Written to the layer's `effect` / `exit` and drawn by the shared composition.
 */
import type { PersonalizationPreviewSettings, PreviewLayer } from '../preview/types'
import { setLayerEffect, setLayerExit } from './effectsEdit'
import { MAX_OUTLINE, TEXT_LAYER_KINDS, type LayerExitId } from '../preview/layerEffects'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, softPanelStyle } from './tokens'

export interface LayerEffectsPanelProps {
  settings: PersonalizationPreviewSettings
  edit: (fn: (prev: PersonalizationPreviewSettings) => PersonalizationPreviewSettings) => void
  /** The selected layer, when exactly one is selected. */
  selected: PreviewLayer | undefined
}

const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }

export function LayerEffectsPanel({ settings, edit, selected }: LayerEffectsPanelProps) {
  void settings
  if (!selected) {
    return (
      <div style={softPanelStyle} data-testid="layer-effects-panel">
        <div style={labelStyle}>Text effects and exit</div>
        <p style={hintStyle}>Select a text layer to add a shadow, glow or outline, or to choose how it leaves.</p>
      </div>
    )
  }
  const isText = (TEXT_LAYER_KINDS as readonly string[]).includes(selected.kind)
  const fx = selected.effect
  const exit = selected.exit
  const id = selected.id
  const setFx = (p: Parameters<typeof setLayerEffect>[2]) => edit((prev) => setLayerEffect(prev, id, p))
  const setExit = (p: Parameters<typeof setLayerExit>[2]) => edit((prev) => setLayerExit(prev, id, p))
  return (
    <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="layer-effects-panel">
      <div style={labelStyle}>Text effects and exit — {selected.id}</div>
      {isText ? (
        <>
          <div>
            <label style={labelStyle} htmlFor="le-shadow">Shadow {Math.round((fx?.shadow ?? 0) * 100)}%</label>
            <input id="le-shadow" type="range" aria-label="Text shadow" min={0} max={1} step={0.05} value={fx?.shadow ?? 0} onChange={(e) => setFx({ shadow: Number(e.target.value) })} style={{ width: '100%', accentColor: C.cyan }} />
          </div>
          <div style={row}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
              <input type="checkbox" aria-label="Text glow" checked={Boolean(fx?.glow)} onChange={(e) => setFx({ glow: e.target.checked ? { color: '#ffffff', strength: 0.6 } : null })} /> Glow
            </label>
            {fx?.glow ? (
              <>
                <input type="color" aria-label="Glow colour" value={fx.glow.color} onChange={(e) => setFx({ glow: { color: e.target.value, strength: fx.glow!.strength } })} />
                <input type="range" aria-label="Glow strength" min={0.1} max={1} step={0.05} value={fx.glow.strength} onChange={(e) => setFx({ glow: { color: fx.glow!.color, strength: Number(e.target.value) } })} style={{ width: 90, accentColor: C.cyan }} />
              </>
            ) : null}
          </div>
          <div style={row}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
              <input type="checkbox" aria-label="Text outline" checked={Boolean(fx?.outline)} onChange={(e) => setFx({ outline: e.target.checked ? { color: '#000000', width: 0.03 } : null })} /> Outline
            </label>
            {fx?.outline ? (
              <>
                <input type="color" aria-label="Outline colour" value={fx.outline.color} onChange={(e) => setFx({ outline: { color: e.target.value, width: fx.outline!.width } })} />
                <input type="range" aria-label="Outline width" min={0.005} max={MAX_OUTLINE} step={0.005} value={fx.outline.width} onChange={(e) => setFx({ outline: { color: fx.outline!.color, width: Number(e.target.value) } })} style={{ width: 90, accentColor: C.cyan }} />
              </>
            ) : null}
          </div>
          {fx ? <button type="button" style={small} onClick={() => setFx(null)}>Remove text effects</button> : null}
        </>
      ) : <p style={hintStyle}>Shadow, glow and outline are for text. Pictures have their own styles above.</p>}
      <div style={row}>
        <label style={labelStyle} htmlFor="le-exit">How it leaves</label>
        <select id="le-exit" aria-label="Exit animation" value={exit?.animation ?? 'none'} onChange={(e) => setExit(e.target.value === 'none' ? null : { animation: e.target.value as LayerExitId })} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
          <option value="none">Stays</option>
          <option value="fade">Fade out</option>
          <option value="slide-up">Slide up</option>
          <option value="slide-down">Slide down</option>
          <option value="zoom-out">Shrink away</option>
        </select>
        {exit ? <input type="number" aria-label="Exit length (frames)" min={2} max={120} value={exit.frames} onChange={(e) => setExit({ frames: Number(e.target.value) })} style={{ ...inputStyle, width: 64, minHeight: 28, padding: '0 6px' }} /> : null}
      </div>
      {exit && selected.endFrame === undefined ? <p role="status" data-testid="exit-needs-end" style={hintStyle}>This layer has no end time, so it never leaves. Set when it ends first; the exit plays during the last {exit.frames} frames before that.</p> : null}
    </div>
  )
}
