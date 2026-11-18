import { useState } from 'react'
import { Palette } from 'lucide-react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { ColorField } from './editor/ColorField'
import { Tip } from './editor/Tip'
import { C, chipStyle, hintStyle, labelStyle, panelStyle, secondaryButtonStyle } from './tokens'
import { LOOK_PRESETS, NEUTRAL_LOOK, applyLookPreset, isNeutralLook, type LookSettings } from '../preview/effects'
import type { PreviewInputProps } from '../preview/types'

/**
 * Color and film look for the footage. Applied to the video only (brand text and logos on top are not tinted), shown live in the
 * editor and drawn by the same code in the exported video. Presets just fill the sliders; Reset removes the look entirely.
 */
export function LookPanel({ inputProps }: { inputProps: PreviewInputProps }): React.JSX.Element | null {
  const { previewSettings, updatePreviewComposition } = useDemoPersonalize()
  const [open, setOpen] = useState(false)
  const look: LookSettings = previewSettings.look ?? NEUTRAL_LOOK
  const active = !isNeutralLook(previewSettings.look)
  const set = (patch: Partial<LookSettings>) => updatePreviewComposition({ look: { ...look, ...patch, preset: undefined } })
  const brand = previewSettings.brandColors

  const slider = (id: string, label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, tip?: string) => (
    <div>
      <label style={labelStyle} htmlFor={id}>{label}</label>
      <input id={id} data-testid={id} type="range" aria-label={label} title={tip} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%', accentColor: C.cyan }} />
    </div>
  )

  return (
    <div data-testid="look-panel" style={{ ...panelStyle, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Palette size={14} color={C.cyan} aria-hidden />
        <button type="button" data-testid="look-toggle-panel" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, padding: '0 10px', flex: 1, textAlign: 'left' }}>
          Color and look {active ? '· On' : ''}
        </button>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ ...hintStyle, margin: 0 }}>Changes the video's color and mood. Your text and logos are not tinted, and your original video is never altered.</p>

          <div>
            <Tip id="lookPresets" side="top"><div style={labelStyle}>Style</div></Tip>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {LOOK_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`look-preset-${p.id}`}
                  aria-pressed={previewSettings.look?.preset === p.id}
                  onClick={() => updatePreviewComposition({ look: applyLookPreset(p.id) })}
                  style={{ ...chipStyle(previewSettings.look?.preset === p.id), minHeight: 28, fontSize: 10 }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Tip id="lookLight" side="top"><div style={labelStyle}>Light</div></Tip>
            {slider('look-exposure', 'Exposure', look.exposure, -2, 2, 0.05, (v) => set({ exposure: v }))}
            {slider('look-contrast', 'Contrast', look.contrast, 0.5, 1.8, 0.01, (v) => set({ contrast: v }))}
            {slider('look-vignette', 'Vignette', look.vignette, 0, 1, 0.01, (v) => set({ vignette: v }))}
          </div>

          <div>
            <Tip id="lookColor" side="top"><div style={labelStyle}>Color</div></Tip>
            {slider('look-saturation', 'Saturation', look.saturation, 0, 2, 0.01, (v) => set({ saturation: v }))}
            {slider('look-temperature', 'Temperature (cool to warm)', look.temperature, -1, 1, 0.01, (v) => set({ temperature: v }))}
            {slider('look-tint', 'Tint (green to magenta)', look.tint, -1, 1, 0.01, (v) => set({ tint: v }))}
            <div style={{ marginTop: 6 }}>
              <ColorField
                id="look-overlay-color"
                label="Color overlay"
                ariaLabel="Color overlay"
                tipId="lookOverlay"
                value={look.overlay?.color ?? '#000000'}
                onChange={(hex) => set({ overlay: { color: hex, opacity: look.overlay?.opacity || 0.2 } })}
                brand={brand}
                posterUrl={inputProps.posterUrl}
              />
              {look.overlay && slider('look-overlay-opacity', 'Overlay strength', look.overlay.opacity, 0, 0.8, 0.01, (v) => set({ overlay: { color: look.overlay!.color, opacity: v } }))}
            </div>
          </div>

          <div>
            <Tip id="lookBlur" side="top"><div style={labelStyle}>Soften</div></Tip>
            {slider('look-blur', 'Blur', look.blur, 0, 20, 0.5, (v) => set({ blur: v }))}
          </div>

          <button type="button" data-testid="look-reset" disabled={!active} onClick={() => updatePreviewComposition({ look: undefined })} style={{ ...secondaryButtonStyle, minHeight: 30, opacity: active ? 1 : 0.5 }}>
            Reset look
          </button>
        </div>
      )}
    </div>
  )
}
