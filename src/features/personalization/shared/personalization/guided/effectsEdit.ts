/**
 * Pure edits to `settings.footageEffects` and to a layer's effect / exit (Stage 5). Each returns a NEW settings object and
 * normalises the result, so whatever the panels do, what is stored is always valid.
 */
import type { PersonalizationPreviewSettings, PreviewLayer } from '../preview/types'
import {
  IDENTITY_LOOK, DEFAULT_MOTION, lookPresetById, motionPresetById, normalizeFootageEffects,
  type FootageEffects, type FootageFade, type FootageLook, type FootageMotion,
} from '../preview/videoEffects'
import { normalizeLayerEffect, normalizeLayerExit, type LayerEffect, type LayerExit } from '../preview/layerEffects'

const withEffects = (prev: PersonalizationPreviewSettings, next: FootageEffects): PersonalizationPreviewSettings => {
  const n = normalizeFootageEffects(next)
  if (n) return { ...prev, footageEffects: n }
  const { footageEffects: _drop, ...rest } = prev
  void _drop
  return rest as PersonalizationPreviewSettings
}

export function patchLook(prev: PersonalizationPreviewSettings, patch: Partial<FootageLook>): PersonalizationPreviewSettings {
  const cur = prev.footageEffects ?? {}
  return withEffects(prev, { ...cur, look: { ...IDENTITY_LOOK, ...(cur.look ?? {}), ...patch } })
}
export function applyLookPreset(prev: PersonalizationPreviewSettings, id: string): PersonalizationPreviewSettings {
  const p = lookPresetById(id)
  if (!p) return prev
  const cur = prev.footageEffects ?? {}
  return withEffects(prev, { ...cur, look: { enabled: true, ...p.look } })
}
export function patchMotion(prev: PersonalizationPreviewSettings, patch: Partial<FootageMotion>): PersonalizationPreviewSettings {
  const cur = prev.footageEffects ?? {}
  return withEffects(prev, { ...cur, motion: { ...DEFAULT_MOTION, ...(cur.motion ?? {}), ...patch } as FootageMotion })
}
export function applyMotionPreset(prev: PersonalizationPreviewSettings, id: string): PersonalizationPreviewSettings {
  const p = motionPresetById(id)
  if (!p) return prev
  const cur = prev.footageEffects ?? {}
  return withEffects(prev, { ...cur, motion: { enabled: true, ...p.motion } })
}
export function setFade(prev: PersonalizationPreviewSettings, fade: FootageFade | undefined): PersonalizationPreviewSettings {
  const cur = prev.footageEffects ?? {}
  const { fade: _old, ...rest } = cur
  void _old
  return withEffects(prev, fade ? { ...rest, fade } : rest)
}
export function clearFootageEffects(prev: PersonalizationPreviewSettings): PersonalizationPreviewSettings {
  const { footageEffects: _d, ...rest } = prev
  void _d
  return rest as PersonalizationPreviewSettings
}

const mapLayer = (prev: PersonalizationPreviewSettings, id: string, fn: (l: PreviewLayer) => PreviewLayer): PersonalizationPreviewSettings =>
  ({ ...prev, layers: prev.layers.map((l) => (l.id === id ? fn(l) : l)) })

export function setLayerEffect(prev: PersonalizationPreviewSettings, id: string, effect: Partial<LayerEffect> | null): PersonalizationPreviewSettings {
  return mapLayer(prev, id, (l) => {
    const { effect: old, ...rest } = l
    if (effect === null) return rest as PreviewLayer
    const merged = normalizeLayerEffect({ shadow: 0, glow: null, outline: null, ...(old ?? {}), ...effect })
    return merged ? { ...rest, effect: merged } as PreviewLayer : rest as PreviewLayer
  })
}
export function setLayerExit(prev: PersonalizationPreviewSettings, id: string, exit: Partial<LayerExit> | null): PersonalizationPreviewSettings {
  return mapLayer(prev, id, (l) => {
    const { exit: old, ...rest } = l
    if (exit === null) return rest as PreviewLayer
    const merged = normalizeLayerExit({ animation: 'fade', frames: 15, ...(old ?? {}), ...exit })
    return merged ? { ...rest, exit: merged } as PreviewLayer : rest as PreviewLayer
  })
}
