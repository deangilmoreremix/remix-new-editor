/**
 * Pure helpers for Stage 1 layer/source transforms. No React, no Remotion: the
 * composition (preview AND export), the settings normalizer and the editor all
 * call these, so a value means the same thing everywhere.
 */
import type { SourceTransform } from './types'

export const MIN_ROTATION = -180
export const MAX_ROTATION = 180
export const MIN_SOURCE_ZOOM = 1
export const MAX_SOURCE_ZOOM = 4
export const MIN_IMAGE_ZOOM = 1
export const MAX_IMAGE_ZOOM = 4

const MAX_CUSTOM_FIELDS = 20
const MAX_CUSTOM_VALUE_LENGTH = 500
const CUSTOM_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Wraps any angle into (-180, 180], one decimal. Non-finite input is 0. */
export function wrapRotation(deg: unknown): number {
  if (!finite(deg)) return 0
  let d = ((deg % 360) + 360) % 360 // 0..360
  if (d > 180) d -= 360
  return Math.round(d * 10) / 10 || 0
}

/** The value to store: 0 is stored as absent so unrotated layers stay byte-identical. */
export function normalizeRotation(raw: unknown): number | undefined {
  const d = wrapRotation(raw)
  return d === 0 ? undefined : d
}

/** CSS transform fragment for a layer's rotation, or '' when unrotated. */
export function rotationCss(rotation: number | undefined): string {
  const d = wrapRotation(rotation)
  return d === 0 ? '' : `rotate(${d}deg)`
}

export function clampImageZoom(raw: unknown): number {
  if (!finite(raw)) return 1
  return Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, Math.round(raw * 100) / 100))
}

/** Clamps a stored source transform; the identity (centred, 1x) is dropped. */
export function normalizeSourceTransform(raw: unknown): SourceTransform | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const clamp01 = (v: unknown) => (finite(v) ? Math.min(1, Math.max(0, Math.round(v * 1000) / 1000)) : 0.5)
  const zoom = finite(r.zoom)
    ? Math.min(MAX_SOURCE_ZOOM, Math.max(MIN_SOURCE_ZOOM, Math.round(r.zoom * 100) / 100))
    : 1
  const out = { x: clamp01(r.x), y: clamp01(r.y), zoom }
  return out.x === 0.5 && out.y === 0.5 && out.zoom === 1 ? undefined : out
}

/**
 * Style for the source <Video>/<Img>: `object-position` pans the cover crop and
 * `scale` zooms about the same focal point. Same function in preview and export.
 */
export function sourceMediaStyle(t: SourceTransform | undefined): {
  objectPosition?: string
  transform?: string
  transformOrigin?: string
} {
  if (!t) return {}
  const pos = `${Math.round(t.x * 100)}% ${Math.round(t.y * 100)}%`
  return {
    objectPosition: pos,
    transform: t.zoom > 1 ? `scale(${t.zoom})` : undefined,
    transformOrigin: t.zoom > 1 ? pos : undefined,
  }
}

/** Keeps well-formed user-defined fields only (safe keys, string values, capped). */
export function normalizeCustomFields(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_CUSTOM_FIELDS) break
    if (!CUSTOM_KEY.test(key) || typeof value !== 'string') continue
    out[key] = value.slice(0, MAX_CUSTOM_VALUE_LENGTH)
  }
  return Object.keys(out).length ? out : undefined
}

export function isValidCustomFieldKey(key: string): boolean {
  return CUSTOM_KEY.test(key)
}

/**
 * Replaces `{{key}}` with the user-defined value. Only keys that exist in
 * `fields` are replaced; every other `{{token}}` is left exactly as written so
 * other token systems are never disturbed. Values are inserted literally
 * (never re-scanned), so a value cannot inject another token.
 */
export function applyCustomFields(text: string, fields: Record<string, string> | undefined): string {
  if (!fields || !text.includes('{{')) return text
  return text.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(fields, key) ? fields[key] : match,
  )
}
