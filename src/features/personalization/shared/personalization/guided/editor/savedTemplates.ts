/**
 * "My templates": the customer's own overlay looks, kept in this browser only (localStorage). Free and offline.
 *
 * A template stores HOW the overlay looks (position, size, timing, colour, font, image style, brand colours),
 * never WHAT it says: text, pictures and design ids stay with the project, so a template made for one client
 * can be applied to another without copying their words or photos across.
 *
 * Storage can be missing, full or blocked (private window); every access is guarded and the feature simply
 * reports "unavailable" rather than throwing.
 */
import type { PersonalizationPreviewSettings, PreviewAspectRatio, PreviewBrandColors, PreviewLayer } from '../../preview/types'

export const SAVED_TEMPLATES_KEY = 'personalization.savedTemplates.v1'
export const MAX_SAVED_TEMPLATES = 20
export const MAX_TEMPLATE_NAME = 40

/** Layer fields a template carries. Anything else (text, imageUrl, designId, slots) is deliberately left out. */
const STYLE_FIELDS = [
  'visible', 'x', 'y', 'scale', 'animation', 'animationDelay', 'startFrame', 'endFrame', 'opacity', 'rotation', 'color', 'fontFamily', 'imageStyle',
] as const satisfies readonly (keyof PreviewLayer)[]

/** Optional style fields: absent in a template = reset on the target. */
const RESETTABLE_FIELDS = ['color', 'rotation', 'endFrame', 'fontFamily', 'imageStyle'] as const satisfies readonly (keyof PreviewLayer)[]

export type TemplateLayerStyle = Partial<Pick<PreviewLayer, (typeof STYLE_FIELDS)[number]>> & { id: string; kind: PreviewLayer['kind'] }

export interface SavedTemplate {
  id: string
  name: string
  createdAt: string
  aspectRatio: PreviewAspectRatio
  brandColors: PreviewBrandColors
  showEndCard: boolean
  layers: TemplateLayerStyle[]
}

export interface TemplateStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function defaultStorage(): TemplateStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch { return null }
}

export function normalizeTemplateName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_TEMPLATE_NAME)
}

function isTemplate(value: unknown): value is SavedTemplate {
  const t = value as SavedTemplate
  return !!t && typeof t === 'object' && typeof t.id === 'string' && typeof t.name === 'string'
    && typeof t.aspectRatio === 'string' && typeof t.createdAt === 'string' && Array.isArray(t.layers) && !!t.brandColors && typeof t.brandColors === 'object'
}

function isLayerStyle(value: unknown): value is TemplateLayerStyle {
  const l = value as TemplateLayerStyle
  return !!l && typeof l === 'object' && typeof l.id === 'string' && typeof l.kind === 'string'
}

export function loadTemplates(storage: TemplateStorage | null = defaultStorage()): SavedTemplate[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(SAVED_TEMPLATES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter(isTemplate).map((t) => ({ ...t, layers: t.layers.filter(isLayerStyle) })).slice(0, MAX_SAVED_TEMPLATES)
      : []
  } catch { return [] }
}

function persist(list: SavedTemplate[], storage: TemplateStorage | null): boolean {
  if (!storage) return false
  try { storage.setItem(SAVED_TEMPLATES_KEY, JSON.stringify(list)); return true } catch { return false }
}

/** Captures the look of the current overlay. Pure. */
export function captureTemplate(settings: PersonalizationPreviewSettings, name: string, now: Date = new Date(), id?: string): SavedTemplate {
  const layers: TemplateLayerStyle[] = settings.layers
    // A design layer is a whole component tied to a project's slots; it is not a reusable "look".
    .filter((l) => l.kind !== 'design')
    .map((l) => {
      const out: TemplateLayerStyle = { id: l.id, kind: l.kind }
      for (const f of STYLE_FIELDS) if (l[f] !== undefined) (out as Record<string, unknown>)[f] = l[f]
      return out
    })
  return {
    id: id ?? `t-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: normalizeTemplateName(name) || 'My template',
    createdAt: now.toISOString(),
    aspectRatio: settings.aspectRatio,
    brandColors: { ...settings.brandColors },
    showEndCard: settings.showEndCard,
    layers,
  }
}

export type SaveResult = { ok: true; templates: SavedTemplate[] } | { ok: false; reason: 'unavailable' | 'name-empty' }

/** Saves (newest first). A name that already exists is replaced; past the cap the oldest is dropped. */
export function saveTemplate(template: SavedTemplate, storage: TemplateStorage | null = defaultStorage()): SaveResult {
  if (!normalizeTemplateName(template.name)) return { ok: false, reason: 'name-empty' }
  const rest = loadTemplates(storage).filter((t) => t.id !== template.id && t.name.toLowerCase() !== template.name.toLowerCase())
  const next = [template, ...rest].slice(0, MAX_SAVED_TEMPLATES)
  return persist(next, storage) ? { ok: true, templates: next } : { ok: false, reason: 'unavailable' }
}

export type DeleteResult = { ok: true; templates: SavedTemplate[] } | { ok: false; templates: SavedTemplate[] }

/** Removes a template. When the removal cannot be saved the list is returned unchanged (`ok: false`), so the UI never shows a deletion that comes back on reload. */
export function deleteTemplate(id: string, storage: TemplateStorage | null = defaultStorage()): DeleteResult {
  const current = loadTemplates(storage)
  const next = current.filter((t) => t.id !== id)
  return persist(next, storage) ? { ok: true, templates: next } : { ok: false, templates: current }
}

export interface TemplateApplication {
  brandColors: PreviewBrandColors
  showEndCard: boolean
  layerPatches: { layerId: string; patch: Partial<PreviewLayer> }[]
  /** Template layers the project does not have (skipped, not created). */
  skipped: number
}

/**
 * What applying a template changes. Layers are matched by id and kind; locked layers are not touched. Positions
 * are fractions of the frame, so a template made for another aspect ratio is applied but flagged by the caller.
 */
export function planTemplateApplication(template: SavedTemplate, settings: PersonalizationPreviewSettings): TemplateApplication {
  const layerPatches: TemplateApplication['layerPatches'] = []
  let skipped = 0
  for (const saved of template.layers) {
    const target = settings.layers.find((l) => l.id === saved.id && l.kind === saved.kind)
    if (!target) { skipped++; continue }
    if (target.locked) continue
    const { id: _id, kind: _kind, ...patch } = saved
    void _id; void _kind
    // A field the saved look does not set means "inherit / none": reset it explicitly, otherwise the merge would
    // leave this project's own colour, rotation, end time or image style in place.
    const resets: Partial<PreviewLayer> = {}
    for (const f of RESETTABLE_FIELDS) if (!(f in patch)) (resets as Record<string, unknown>)[f] = undefined
    layerPatches.push({ layerId: target.id, patch: { ...resets, ...patch, placementSource: 'manual' } })
  }
  return { brandColors: { ...template.brandColors }, showEndCard: template.showEndCard, layerPatches, skipped }
}
