/**
 * Step 4 add-on rules: which designs may join the video on top of the layout,
 * and when a newly added one starts. Pure — no React, no provider state.
 *
 * A layout is the base; designs are add-ons. These helpers are shared by the
 * Simple Mode Step 4 panel, the on-video editor and Advanced Editing, so the
 * rules are identical everywhere.
 */

import { addDesignTemplate } from './presets'
import type { ApplyLayoutContext } from './presets'
import { getRemotionDesignTemplate, isRemotionDesignTemplateSupported } from '../templates/registry'
import type { RemotionDesignMediaRole, RemotionDesignTemplate } from '../templates/types'
import type { PersonalizationPreviewSettings, PreviewLayer } from './types'

export type DesignAvailability = Partial<Record<RemotionDesignMediaRole, boolean>>

export interface AddDesignCheck {
  ok: boolean
  /** Customer-facing reason when `ok` is false. */
  reason?: string
}

/** Categories that cover or replace the whole frame: only one of each may be added. */
const EXCLUSIVE_CATEGORIES: ReadonlyArray<RemotionDesignTemplate['category']> = ['full-scene', 'transition']

/** The design layers currently on the video, in stacking order. */
export function listAddedDesigns(settings: PersonalizationPreviewSettings): PreviewLayer[] {
  return (Array.isArray(settings.layers) ? settings.layers : []).filter(
    (layer) => layer && layer.kind === 'design' && Boolean(layer.designId),
  )
}

/** Which brand pictures exist, read from the same context the layers are built from. */
export function availabilityFromContext(ctx?: ApplyLayoutContext): DesignAvailability {
  return {
    logo: Boolean(ctx?.logoUrl),
    product: Boolean(ctx?.productUrl),
    service: Boolean(ctx?.serviceUrl),
  }
}

/** Whether `design` can be added on top of the current video, and why not when it cannot. */
export function canAddDesign(
  settings: PersonalizationPreviewSettings,
  design: RemotionDesignTemplate,
  available: DesignAvailability = {},
): AddDesignCheck {
  const supported = isRemotionDesignTemplateSupported(design.id, settings.aspectRatio)
  if (!supported.supported) return { ok: false, reason: supported.reason }

  const added = listAddedDesigns(settings)
  if (added.some((layer) => layer.designId === design.id)) {
    return { ok: false, reason: `${design.name} is already on your video.` }
  }

  const required = new Set<RemotionDesignMediaRole>([
    ...(design.requiredMedia ?? []),
    ...(design.media ?? []).filter((binding) => binding.required).map((binding) => binding.role),
  ])
  for (const role of required) {
    if (!available[role]) {
      const noun = role === 'logo' ? 'a logo' : role === 'product' ? 'a product photo' : 'a service photo'
      return { ok: false, reason: `Needs ${noun}.` }
    }
  }

  if (EXCLUSIVE_CATEGORIES.includes(design.category)) {
    const clash = added.find((layer) => {
      const other = layer.designId ? getRemotionDesignTemplate(layer.designId) : undefined
      return other?.category === design.category
    })
    if (clash) {
      const label = design.category === 'full-scene' ? 'full scene' : 'transition'
      return { ok: false, reason: `Only one ${label} at a time — remove the one on your video first.` }
    }
  }
  return { ok: true }
}

/**
 * First frame a newly added design may start on. Designs that play as an intro
 * (they set `placement.endFrame`: full scenes, transitions) follow the previous
 * intro instead of all starting at frame 0; whole-clip overlays start at 0.
 */
export function nextStartFrame(settings: PersonalizationPreviewSettings, design: RemotionDesignTemplate): number {
  if (typeof design.placement?.endFrame !== 'number') return 0
  let start = 0
  for (const layer of listAddedDesigns(settings)) {
    if (typeof layer.endFrame === 'number') start = Math.max(start, layer.endFrame + 1)
  }
  // Leave at least one second of the clip for the design to show.
  const latest = Math.max(0, settings.durationInFrames - Math.max(1, settings.fps || 30))
  return Math.min(start, latest)
}

export interface AddDesignResult {
  settings: PersonalizationPreviewSettings
  /** Set when the design was refused; `settings` is then the unchanged input. */
  error?: string
}

/** Adds a design on top of the layout when the rules allow it, staggering its start. Never mutates `prev`. */
export function addDesignWithRules(
  prev: PersonalizationPreviewSettings,
  designId: string,
  ctx?: ApplyLayoutContext,
): AddDesignResult {
  const design = getRemotionDesignTemplate(designId)
  if (!design) return { settings: prev, error: 'That design is not available.' }
  const check = canAddDesign(prev, design, availabilityFromContext(ctx))
  if (!check.ok) return { settings: prev, error: check.reason }

  const start = nextStartFrame(prev, design)
  const next = addDesignTemplate(prev, designId, ctx)
  if (start === 0 || next === prev) return { settings: next }
  const layers = next.layers.map((layer, index) => {
    if (index !== next.layers.length - 1) return layer
    const length = typeof layer.endFrame === 'number' ? layer.endFrame - layer.startFrame : undefined
    return {
      ...layer,
      startFrame: start,
      ...(length !== undefined ? { endFrame: Math.min(start + length, next.durationInFrames) } : {}),
    }
  })
  return { settings: { ...next, layers } }
}

/** Moves one added design earlier (-1) or later (+1) in the stack, past other design layers only. */
export function moveDesignLayer(
  prev: PersonalizationPreviewSettings,
  layerId: string,
  direction: -1 | 1,
): PersonalizationPreviewSettings {
  const layers = [...(prev.layers ?? [])]
  const from = layers.findIndex((layer) => layer.id === layerId && layer.kind === 'design')
  if (from < 0) return prev
  let to = from + direction
  while (to >= 0 && to < layers.length && layers[to].kind !== 'design') to += direction
  if (to < 0 || to >= layers.length) return prev
  ;[layers[from], layers[to]] = [layers[to], layers[from]]
  return { ...prev, layers }
}
