import { Diamond, Trash2 } from 'lucide-react'
import { C, hintStyle, inputStyle, labelStyle, secondaryButtonStyle } from '../tokens'
import { Tip } from './Tip'
import { layerSpan } from './timeline'
import {
  KEYFRAME_EASINGS, KEYFRAME_PRESETS, MAX_KEYFRAMES, NEUTRAL_KEYFRAME_STATE, clampChannel, removeKeyframe, snapshotKeyframe, upsertKeyframe,
  type KeyframeChannel, type KeyframeEasing, type LayerKeyframe,
} from '../../preview/keyframes'
import type { PreviewLayer } from '../../preview/types'

const CHANNELS: { id: KeyframeChannel; label: string; unit: string; scale: number; step: number }[] = [
  { id: 'dx', label: 'Move across', unit: '%', scale: 100, step: 1 },
  { id: 'dy', label: 'Move down', unit: '%', scale: 100, step: 1 },
  { id: 'scale', label: 'Size', unit: '%', scale: 100, step: 5 },
  { id: 'opacity', label: 'Fade', unit: '%', scale: 100, step: 5 },
  { id: 'rotation', label: 'Tilt', unit: '°', scale: 1, step: 1 },
]

/**
 * Keyframes for one layer: add one at the playhead, edit its values, choose how the layer travels to the next one, or
 * start from a ready-made motion. The values are changes to the layer, so its own position and animation stay as they are.
 */
export function KeyframePanel({
  layer, playFrame, fps, durationInFrames, onChange, onSeek,
}: {
  layer: PreviewLayer
  playFrame: number
  fps: number
  durationInFrames: number
  onChange: (keyframes: LayerKeyframe[] | undefined) => void
  onSeek?: (frame: number) => void
}): React.JSX.Element {
  const list = layer.keyframes ?? []
  const secs = (f: number) => `${(f / Math.max(1, fps)).toFixed(1)} s`
  const setChannel = (frame: number, channel: KeyframeChannel, raw: number, scale: number) => {
    const current = list.find((k) => k.frame === frame)
    if (!current || !Number.isFinite(raw)) return
    onChange(upsertKeyframe(list, { ...current, [channel]: clampChannel(channel, raw / scale) }))
  }
  const setEasing = (frame: number, easing: KeyframeEasing) => {
    const current = list.find((k) => k.frame === frame)
    if (current) onChange(upsertKeyframe(list, { ...current, easing }))
  }
  const atPlayhead = Math.round(playFrame)
  const hasHere = list.some((k) => k.frame === atPlayhead)

  return (
    <div data-testid="keyframe-panel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Tip id="keyframes" side="top">
        <div style={{ ...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Diamond size={11} aria-hidden /> Keyframes</div>
      </Tip>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          data-testid="keyframe-add"
          disabled={hasHere || list.length >= MAX_KEYFRAMES}
          onClick={() => onChange(upsertKeyframe(list, snapshotKeyframe(list, atPlayhead)))}
          style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, padding: '0 10px', borderColor: C.cyan, color: C.cyan, opacity: hasHere ? 0.5 : 1 }}
        >
          Add keyframe at {secs(atPlayhead)}
        </button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted }}>
          <span>Motion</span>
          <select
            data-testid="keyframe-preset"
            aria-label="Start from a motion"
            value=""
            onChange={(e) => {
              const preset = KEYFRAME_PRESETS.find((p) => p.id === e.target.value)
              if (!preset) return
              const { start, end } = layerSpan(layer, durationInFrames)
              onChange(preset.build(start, Math.max(6, end - start)).map((k) => ({ ...k, frame: Math.min(k.frame, durationInFrames - 1) })))
            }}
            style={{ ...inputStyle, minHeight: 28, width: 'auto', fontSize: 11 }}
          >
            <option value="">Start from…</option>
            {KEYFRAME_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        {list.length > 0 && (
          <button type="button" data-testid="keyframe-clear" onClick={() => onChange(undefined)} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, padding: '0 10px' }}>Clear all</button>
        )}
      </div>

      {list.length === 0 ? (
        <p style={{ ...hintStyle, margin: 0 }}>Move the playhead, then add a keyframe. Add a second one later and change a value: the layer glides between them.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((k) => (
            <li key={k.frame} data-testid="keyframe-row" data-frame={k.frame} style={{ border: `1px solid ${k.frame === atPlayhead ? C.cyan : C.border}`, borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button type="button" data-testid="keyframe-seek" onClick={() => onSeek?.(k.frame)} style={{ ...secondaryButtonStyle, minHeight: 24, fontSize: 11, padding: '0 8px' }}>
                  {secs(k.frame)}
                </button>
                <select
                  aria-label={`Easing after the keyframe at ${secs(k.frame)}`}
                  data-testid="keyframe-easing"
                  value={k.easing}
                  onChange={(e) => setEasing(k.frame, e.target.value as KeyframeEasing)}
                  style={{ ...inputStyle, minHeight: 24, width: 'auto', fontSize: 11, marginLeft: 'auto' }}
                >
                  {KEYFRAME_EASINGS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
                <button
                  type="button"
                  aria-label={`Delete the keyframe at ${secs(k.frame)}`}
                  data-testid="keyframe-delete"
                  onClick={() => onChange(removeKeyframe(list, k.frame))}
                  style={{ ...secondaryButtonStyle, minHeight: 24, width: 28, padding: 0, display: 'grid', placeItems: 'center' }}
                >
                  <Trash2 size={12} aria-hidden />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
                {CHANNELS.map((c) => {
                  const value = (k[c.id] ?? NEUTRAL_KEYFRAME_STATE[c.id]) * c.scale
                  return (
                    <label key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 9, color: C.muted2 }}>
                      {c.label}
                      <input
                        type="number"
                        data-testid={`keyframe-${c.id}`}
                        aria-label={`${c.label} (${c.unit}) at ${secs(k.frame)}`}
                        step={c.step}
                        value={Math.round(value * 100) / 100}
                        onChange={(e) => { if (e.target.value.trim() !== '') setChannel(k.frame, c.id, Number(e.target.value), c.scale) }}
                        style={{ ...inputStyle, minHeight: 26, padding: '0 6px', fontSize: 11 }}
                      />
                    </label>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
