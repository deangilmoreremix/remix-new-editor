'use client'

/**
 * "Footage look and motion" tools for the overlay editor (Stage 5): colour presets and sliders, camera motion (push-in,
 * drift…) and fades for the source video, written to `settings.footageEffects` and drawn by the shared composition, so the
 * Player and the export agree.
 */
import type { PersonalizationPreviewSettings } from '../preview/types'
import { IDENTITY_LOOK, LOOK_PRESETS, MOTION_PRESETS, DEFAULT_MOTION } from '../preview/videoEffects'
import { applyLookPreset, applyMotionPreset, clearFootageEffects, patchLook, patchMotion, setFade } from './effectsEdit'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, softPanelStyle } from './tokens'

export interface FootageEffectsPanelProps {
  settings: PersonalizationPreviewSettings
  edit: (fn: (prev: PersonalizationPreviewSettings) => PersonalizationPreviewSettings) => void
  /** Whether there is footage to affect (a video or a picture source). */
  hasFootage: boolean
}

const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }

export function FootageEffectsPanel({ settings, edit, hasFootage }: FootageEffectsPanelProps) {
  const fx = settings.footageEffects
  const look = fx?.look ?? IDENTITY_LOOK
  const motion = fx?.motion ?? { ...DEFAULT_MOTION, enabled: false }
  const fps = Math.max(1, settings.fps)
  const fadeIn = fx?.fade?.inFrames ?? 0
  const fadeOut = fx?.fade?.outFrames ?? 0
  const removedBackground = settings.presenter?.enabled && settings.presenter.background.mode === 'remove'

  if (!hasFootage) {
    return (
      <div style={softPanelStyle} data-testid="footage-effects-panel">
        <div style={labelStyle}>Footage look and motion</div>
        <p style={hintStyle}>Choose a video first. These effects change how your footage looks and moves.</p>
      </div>
    )
  }

  const slider = (id: string, label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, suffix = '') => (
    <div>
      <label style={labelStyle} htmlFor={id}>{label} {value}{suffix}</label>
      <input id={id} type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} style={{ width: '100%', accentColor: C.cyan }} />
    </div>
  )
  const setLook = (p: Parameters<typeof patchLook>[1]) => edit((prev) => patchLook(prev, p))
  const setMotion = (p: Parameters<typeof patchMotion>[1]) => edit((prev) => patchMotion(prev, p))

  return (
    <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="footage-effects-panel">
      <div style={labelStyle}>Footage look and motion</div>

      <div style={row}>
        <select aria-label="Colour look preset" value="" onChange={(e) => { if (e.target.value) edit((prev) => applyLookPreset(prev, e.target.value)) }} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
          <option value="">Colour look…</option>
          {LOOK_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select aria-label="Camera motion preset" value="" onChange={(e) => { if (e.target.value) edit((prev) => applyMotionPreset(prev, e.target.value)) }} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
          <option value="">Camera motion…</option>
          {MOTION_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {fx ? <button type="button" style={small} onClick={() => edit(clearFootageEffects)}>Remove all effects</button> : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={labelStyle}>Colour</div>
        {slider('fx-bright', 'Brightness', look.brightness, 0.5, 1.5, 0.01, (v) => setLook({ brightness: v }))}
        {slider('fx-contrast', 'Contrast', look.contrast, 0.5, 1.5, 0.01, (v) => setLook({ contrast: v }))}
        {slider('fx-sat', 'Colour strength', look.saturation, 0, 2, 0.01, (v) => setLook({ saturation: v }))}
        {slider('fx-temp', 'Warm / cool (negative = cool)', look.temperature, -1, 1, 0.05, (v) => setLook({ temperature: v }))}
        {slider('fx-hue', 'Hue shift', look.hue, -180, 180, 1, (v) => setLook({ hue: v }), '°')}
        {slider('fx-sepia', 'Sepia', look.sepia, 0, 1, 0.05, (v) => setLook({ sepia: v }))}
        {slider('fx-gray', 'Black and white', look.grayscale, 0, 1, 0.05, (v) => setLook({ grayscale: v }))}
        {slider('fx-vig', 'Vignette', look.vignette, 0, 1, 0.05, (v) => setLook({ vignette: v }))}
        {slider('fx-blur', 'Soften (blur)', look.blur, 0, 20, 0.5, (v) => setLook({ blur: v }))}
        {removedBackground ? <p style={hintStyle}>Warm / cool and vignette are not drawn while the presenter's background is removed (they would tint the empty area). The other colour controls still apply.</p> : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
          <input type="checkbox" aria-label="Camera motion" checked={motion.enabled} onChange={(e) => setMotion({ enabled: e.target.checked })} /> Camera motion
        </label>
        {motion.enabled ? (
          <>
            {slider('fx-zoom-from', 'Zoom at the start', motion.zoom.from, 1, 2, 0.01, (v) => setMotion({ zoom: { from: v, to: motion.zoom.to } }), '×')}
            {slider('fx-zoom-to', 'Zoom at the end', motion.zoom.to, 1, 2, 0.01, (v) => setMotion({ zoom: { from: motion.zoom.from, to: v } }), '×')}
            {slider('fx-pan-x', 'Drift left ↔ right', Math.round((motion.pan.x.to - motion.pan.x.from) * 100) / 100, -0.3, 0.3, 0.01, (v) => setMotion({ pan: { x: { from: -v / 2, to: v / 2 }, y: motion.pan.y } }))}
            {slider('fx-pan-y', 'Drift up ↔ down', Math.round((motion.pan.y.to - motion.pan.y.from) * 100) / 100, -0.3, 0.3, 0.01, (v) => setMotion({ pan: { x: motion.pan.x, y: { from: -v / 2, to: v / 2 } } }))}
            <div style={row}>
              <label style={hintStyle} htmlFor="fx-ease">Easing</label>
              <select id="fx-ease" aria-label="Camera motion easing" value={motion.ease} onChange={(e) => setMotion({ ease: e.target.value as 'linear' | 'ease-in-out' })} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
                <option value="ease-in-out">Smooth</option>
                <option value="linear">Steady</option>
              </select>
            </div>
            <p style={hintStyle}>The picture moves slowly across the whole video. Zoom keeps the frame filled; large drift needs a matching zoom so no edge shows.</p>
          </>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={labelStyle}>Fade to black</div>
        {slider('fx-fade-in', 'Fade in', Math.round((fadeIn / fps) * 10) / 10, 0, 5, 0.1, (v) => edit((prev) => setFade(prev, { inFrames: Math.round(v * fps), outFrames: prev.footageEffects?.fade?.outFrames ?? 0 })), ' s')}
        {slider('fx-fade-out', 'Fade out', Math.round((fadeOut / fps) * 10) / 10, 0, 5, 0.1, (v) => edit((prev) => setFade(prev, { inFrames: prev.footageEffects?.fade?.inFrames ?? 0, outFrames: Math.round(v * fps) })), ' s')}
        <p style={hintStyle}>Fades the picture only. Fade the sound in the Audio mix.</p>
      </div>
    </div>
  )
}
