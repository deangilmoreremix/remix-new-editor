import { C, hintStyle, labelStyle, secondaryButtonStyle } from '../tokens'
import { ColorField } from './ColorField'
import { Tip } from './Tip'
import { NEUTRAL_LAYER_EFFECTS, isNeutralLayerEffects, type LayerEffects } from '../../preview/effects'
import type { PreviewLayer } from '../../preview/types'

/** Brightness, contrast, saturation, blur, glow and shadow for one layer. Reset removes them all. */
export function LayerEffectsControls({
  layer, onChange, brand, posterUrl,
}: {
  layer: PreviewLayer
  onChange: (effects: LayerEffects | undefined) => void
  brand: { primary: string; accent: string; text: string }
  posterUrl?: string | null
}): React.JSX.Element {
  const fx: LayerEffects = layer.effects ?? NEUTRAL_LAYER_EFFECTS
  const active = !isNeutralLayerEffects(layer.effects)
  const set = (patch: Partial<LayerEffects>) => {
    const next = { ...fx, ...patch }
    onChange(isNeutralLayerEffects(next) ? undefined : next)
  }
  const slider = (id: string, label: string, value: number, min: number, max: number, step: number, onC: (v: number) => void) => (
    <div>
      <label style={labelStyle} htmlFor={id}>{label}</label>
      <input id={id} data-testid={id} type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onC(Number(e.target.value))} style={{ width: '100%', accentColor: C.cyan }} />
    </div>
  )
  return (
    <div data-testid="layer-effects" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Tip id="layerEffects" side="top"><div style={labelStyle}>Effects</div></Tip>
      {slider('fx-brightness', 'Brightness', fx.brightness, 0.2, 2, 0.01, (v) => set({ brightness: v }))}
      {slider('fx-contrast', 'Contrast', fx.contrast, 0.5, 2, 0.01, (v) => set({ contrast: v }))}
      {slider('fx-saturation', 'Saturation', fx.saturation, 0, 2, 0.01, (v) => set({ saturation: v }))}
      {slider('fx-blur', 'Blur', fx.blur, 0, 20, 0.5, (v) => set({ blur: v }))}
      {slider('fx-shadow', 'Drop shadow', fx.shadow ?? 0, 0, 1, 0.01, (v) => set({ shadow: v > 0 ? v : undefined }))}
      {slider('fx-glow', 'Glow', fx.glow?.amount ?? 0, 0, 1, 0.01, (v) => set({ glow: v > 0 ? { color: fx.glow?.color ?? brand.primary, amount: v } : undefined }))}
      {fx.glow && (
        <ColorField id="fx-glow-color" label="Glow color" ariaLabel="Glow color" tipId="lookOverlay" value={fx.glow.color} onChange={(hex) => set({ glow: { color: hex, amount: fx.glow!.amount } })} brand={brand} posterUrl={posterUrl} />
      )}
      <p style={{ ...hintStyle, margin: 0 }}>Shown live; turn Live off and the still picture previews the video look only.</p>
      <button type="button" data-testid="fx-reset" disabled={!active} onClick={() => onChange(undefined)} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, alignSelf: 'flex-start', opacity: active ? 1 : 0.5 }}>Reset effects</button>
    </div>
  )
}
