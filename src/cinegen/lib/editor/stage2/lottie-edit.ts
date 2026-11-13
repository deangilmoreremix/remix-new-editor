// [remix] Stage 2: Lottie colour / text customisation for Lottie stickers (pure JSON, no renderer).
// Adapted from FreeCut (https://github.com/freecut/freecut, MIT licence), commit 5ceeeb388eef5423640b7db157706274bf1b8165, files
// src/infrastructure/lottie/lottie-color.ts, lottie-text.ts and lottie-json.ts (solid fill / stroke colours static or animated, colour slots,
// text layers and text slots, deterministic document-order keys `c0`, `c1`, ... / layer index / `s:<slot id>`). Gradient colours and the
// dotLottie archive / theme / WASM parts are not used. Removed: the render-spec resolver. Added at the end: `applyLottieEdits`, a non-mutating
// wrapper used by the preview (lottie-web) and the Remotion export (@remotion/lottie) so both render the same patched animation.
/* eslint-disable */

/** A single editable color discovered in a Lottie animation. */
export interface LottieColorLayer {
  /** Stable ordinal key (document-order index of the color) addressing the override. */
  key: string
  /** Current color as `#rrggbb`. */
  color: string
  /** Human-readable label (shape/layer name, or a positional fallback). */
  label: string
  /**
   * Whether `label` is an author-given name (a color slot, or a shape with its
   * own `nm`) rather than a generated fallback like `Fill`/`Stroke`. Named
   * colors are the template's intended customization points; the UI surfaces
   * them first and tucks the rest away.
   */
  named: boolean
}

type Rgb = [number, number, number]

/** A color the traversal can read and rewrite in place. */
interface ColorSlot {
  read: () => Rgb
  write: (rgb: Rgb) => void
  label: string
  /** True when `label` is the shape's own `nm` (not a generated fallback). */
  named: boolean
}

interface AnimatedValue {
  a?: unknown
  k?: unknown
  /** Slot reference — when set, the value is themed via the top-level `slots` table. */
  sid?: unknown
}
interface LottieShapeItem {
  ty?: unknown
  nm?: unknown
  c?: AnimatedValue // solid fill/stroke color
  it?: unknown // group children
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

function channelToHex(c: number): string {
  return Math.round(clamp01(c) * 255)
    .toString(16)
    .padStart(2, '0')
}

/** Normalized `[r, g, b]` floats (0..1) → `#rrggbb`. */
export function lottieRgbToHex(k: readonly number[]): string {
  return `#${channelToHex(k[0] ?? 0)}${channelToHex(k[1] ?? 0)}${channelToHex(k[2] ?? 0)}`
}

/** `#rrggbb` → normalized `[r, g, b]` floats (0..1), or null if malformed. */
export function hexToLottieRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = Number.parseInt(match[1] ?? '', 16)
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255]
}

function isRgbArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.length >= 3 && typeof v[0] === 'number'
}

function trimmedName(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

// After Effects / Lottie editors auto-name every fill/stroke "Fill", "Fill 1",
// "Stroke 2", etc. Those defaults are noise, not author intent, so they don't
// count as a "named" (customization-point) color.
const GENERATED_COLOR_NAME = /^(fill|stroke)(\s+\d+)?$/i

/** True when `name` is a real author name rather than an editor-generated default. */
function isAuthorColorName(name: string): boolean {
  return name.length > 0 && !GENERATED_COLOR_NAME.test(name)
}

/**
 * The color slot of one fill/stroke shape item, or none for non-color/gradient
 * shapes. Solid fills/strokes contribute one slot (static or animated).
 */
function slotsForShapeItem(item: LottieShapeItem, label: string, named: boolean): ColorSlot[] {
  // Solid fill / stroke.
  if (item.ty === 'fl' || item.ty === 'st') {
    const c = item.c
    if (!c || typeof c !== 'object') return []
    // Slot-bound color: exposed/patched via the top-level `slots` table instead.
    if (typeof c.sid === 'string') return []
    if (c.a === 1) {
      // Animated color: read the first keyframe, write every keyframe's value.
      const keyframes = c.k
      if (!Array.isArray(keyframes) || !isRgbArray((keyframes[0] as { s?: unknown })?.s)) return []
      return [
        {
          label,
          named,
          read: () => {
            const s = (keyframes[0] as { s: number[] }).s
            return [s[0]!, s[1]!, s[2]!]
          },
          write: (rgb) => {
            for (const kf of keyframes as Array<{ s?: unknown; e?: unknown }>) {
              if (isRgbArray(kf.s)) [kf.s[0], kf.s[1], kf.s[2]] = rgb
              if (isRgbArray(kf.e)) [kf.e[0], kf.e[1], kf.e[2]] = rgb
            }
          },
        },
      ]
    }
    if (!isRgbArray(c.k)) return []
    const k = c.k
    return [
      {
        label,
        named,
        read: () => [k[0]!, k[1]!, k[2]!],
        write: (rgb) => {
          ;[k[0], k[1], k[2]] = rgb
        },
      },
    ]
  }

  return []
}

/**
 * Visit every editable color in the animation in a deterministic depth-first
 * order, assigning each a stable ordinal `key` (`c0`, `c1`, …). Shared by
 * extraction and patching so keys line up between the two passes.
 */
function walkColorSlots(
  data: Record<string, unknown> | null,
  visit: (slot: ColorSlot, key: string) => void,
): void {
  const layers = data?.layers
  if (!Array.isArray(layers)) return

  let ordinal = 0
  const walkShapes = (shapes: unknown, layerName: string) => {
    if (!Array.isArray(shapes)) return
    for (const raw of shapes) {
      const item = raw as LottieShapeItem
      if (item?.ty === 'gr' && Array.isArray(item.it)) {
        walkShapes(item.it, layerName)
        continue
      }
      const kind = item?.ty === 'st' ? 'Stroke' : 'Fill'
      const shapeName = trimmedName(item?.nm)
      const label = shapeName || (layerName ? `${layerName} ${kind}` : kind)
      for (const slot of slotsForShapeItem(item, label, isAuthorColorName(shapeName))) {
        visit(slot, `c${ordinal}`)
        ordinal += 1
      }
    }
  }

  for (const raw of layers) {
    const layer = raw as { shapes?: unknown; nm?: unknown }
    if (!Array.isArray(layer?.shapes)) continue
    walkShapes(layer.shapes, trimmedName(layer.nm))
  }
}

// --- Lottie slots (the canonical theming mechanism) --------------------------
// A themeable Lottie defines colors once in a top-level `slots` table and points
// shape colors at them via `sid`. Those colors have no inline `c.k`, so the
// tree-walk above skips them; we surface and patch them here instead, keyed
// `s:<slotId>`. On write we also bake the value into every referencing fill/
// stroke so the change renders regardless of whether the renderer resolves slots.

interface SlotDef {
  p?: AnimatedValue
  nm?: unknown
}

/** Read a slot property's color, whether static (`p.k`) or animated (`p.k[0].s`). */
function slotColorValue(p: AnimatedValue | undefined): Rgb | null {
  if (!p || typeof p !== 'object') return null
  if (p.a === 1) {
    const first = Array.isArray(p.k) ? (p.k[0] as { s?: unknown } | undefined) : undefined
    return isRgbArray(first?.s) ? [first!.s[0]!, first!.s[1]!, first!.s[2]!] : null
  }
  return isRgbArray(p.k) ? [p.k[0]!, p.k[1]!, p.k[2]!] : null
}

function slotColorLayers(data: Record<string, unknown>): LottieColorLayer[] {
  const slots = data.slots
  if (!slots || typeof slots !== 'object') return []
  const result: LottieColorLayer[] = []
  for (const [id, def] of Object.entries(slots as Record<string, SlotDef>)) {
    const rgb = slotColorValue(def?.p)
    if (!rgb) continue
    // A slot is an explicit author theming point — always treated as named.
    result.push({
      key: `s:${id}`,
      color: lottieRgbToHex(rgb),
      label: trimmedName(def?.nm) || id,
      named: true,
    })
  }
  return result
}

/** Visit every fill/stroke shape item in document order (for slot baking). */
function forEachShapeItem(
  data: Record<string, unknown>,
  fn: (item: LottieShapeItem) => void,
): void {
  const layers = data.layers
  if (!Array.isArray(layers)) return
  const walk = (shapes: unknown) => {
    if (!Array.isArray(shapes)) return
    for (const raw of shapes) {
      const item = raw as LottieShapeItem
      if (item?.ty === 'gr' && Array.isArray(item.it)) walk(item.it)
      else fn(item)
    }
  }
  for (const raw of layers) {
    const layer = raw as { shapes?: unknown }
    if (Array.isArray(layer?.shapes)) walk(layer.shapes)
  }
}

/** Patch a color slot's value and bake it into every fill/stroke that references it. */
function applyColorSlot(data: Record<string, unknown>, slotId: string, rgb: Rgb): boolean {
  let changed = false
  const slots = data.slots as Record<string, SlotDef> | undefined
  const p = slots?.[slotId]?.p
  if (p && typeof p === 'object') {
    if (p.a === 1 && Array.isArray(p.k)) {
      for (const kf of p.k as Array<{ s?: unknown }>) {
        if (isRgbArray(kf.s)) {
          ;[kf.s[0], kf.s[1], kf.s[2]] = rgb
          changed = true
        }
      }
    } else if (isRgbArray(p.k)) {
      ;[p.k[0], p.k[1], p.k[2]] = rgb
      changed = true
    } else {
      p.a = 0
      p.k = [rgb[0], rgb[1], rgb[2], 1]
      changed = true
    }
  }
  // Bake into referencing fills/strokes so non-slot-aware renderers show it too.
  forEachShapeItem(data, (item) => {
    if (item.ty !== 'fl' && item.ty !== 'st') return
    const c = item.c
    if (!c || typeof c !== 'object' || c.sid !== slotId) return
    if (isRgbArray(c.k)) [c.k[0], c.k[1], c.k[2]] = rgb
    else c.k = [rgb[0], rgb[1], rgb[2], 1]
    changed = true
  })
  return changed
}

/**
 * List the editable colors of a Lottie animation object. Author-defined color
 * slots come first (keyed `s:<id>`), then every inline shape color in document
 * order (keyed `c<n>`). Returns an empty array for non-shape or unparseable input.
 */
export function extractLottieColorLayers(json: unknown): LottieColorLayer[] {
  const data = parseJson(json)
  if (!data) return []
  const result: LottieColorLayer[] = slotColorLayers(data)
  walkColorSlots(data, (slot, key) => {
    result.push({ key, color: lottieRgbToHex(slot.read()), label: slot.label, named: slot.named })
  })
  return result
}

/**
 * Apply per-color overrides to a Lottie animation object and return the patched
 * JSON string. Overrides are keyed by the color's stable ordinal key (see
 * {@link extractLottieColorLayers}) with `#rrggbb` hex values; unknown or
 * malformed values are ignored. Returns null when the input can't be parsed or
 * nothing changes.
 */
export function applyLottieColorOverrides(
  json: unknown,
  overrides: Record<string, string>,
): string | null {
  const data = parseJson(json)
  if (!data) return null
  if (Object.keys(overrides).length === 0) return null

  let changed = false
  // Slot overrides (keyed `s:<id>`): patch the slot value + bake references.
  for (const [key, hex] of Object.entries(overrides)) {
    if (!key.startsWith('s:')) continue
    const rgb = hexToLottieRgb(hex)
    if (rgb && applyColorSlot(data, key.slice(2), rgb)) changed = true
  }
  // Inline shape overrides (keyed `c<n>`).
  walkColorSlots(data, (slot, key) => {
    const hex = overrides[key]
    if (hex === undefined) return
    const rgb = hexToLottieRgb(hex)
    if (!rgb) return
    slot.write(rgb)
    changed = true
  })

  return changed ? JSON.stringify(data) : null
}


/** A single editable text layer discovered in a Lottie animation. */
export interface LottieTextLayer {
  /** Stable key (the layer's index) used to address the override. */
  key: string
  /** Current text content. */
  text: string
  /** Human-readable label (the layer name, or a positional fallback). */
  label: string
}

interface TextDocument {
  t?: unknown
}
interface LottieTextData {
  d?: { k?: Array<{ s?: TextDocument }>; sid?: unknown }
}
interface LottieLayer {
  ty?: unknown
  nm?: unknown
  t?: LottieTextData
}
interface TextSlotDef {
  p?: { a?: unknown; k?: unknown; p?: { t?: unknown } }
  nm?: unknown
}

function firstTextString(layer: LottieLayer): string | null {
  const keyframes = layer.t?.d?.k
  if (!Array.isArray(keyframes)) return null
  for (const kf of keyframes) {
    if (typeof kf?.s?.t === 'string') return kf.s.t
  }
  return null
}

// --- Lottie text slots -------------------------------------------------------
// A themeable Lottie keeps editable copy in a top-level `slots` table; text
// layers point at it via `t.d.sid`. The editable string lives at
// `slots[id].p.k[0].s.t` (plus an older `slots[id].p.p.t` fallback), and each
// bound layer carries its own `t.d.k[*].s.t` fallback. We surface these as
// entries keyed `s:<id>` and, on write, patch the slot document AND every bound
// layer so the change renders whether or not the renderer resolves slots.

function slotTextDocument(k: unknown): TextDocument | undefined {
  if (!Array.isArray(k)) return undefined
  return (k[0] as { s?: TextDocument } | undefined)?.s
}

function boundTextLayers(data: Record<string, unknown>, slotId: string): LottieLayer[] {
  const layers = data.layers
  if (!Array.isArray(layers)) return []
  return (layers as LottieLayer[]).filter((l) => l?.ty === 5 && l.t?.d?.sid === slotId)
}

function readSlotText(data: Record<string, unknown>, slotId: string): string | undefined {
  const p = (data.slots as Record<string, TextSlotDef> | undefined)?.[slotId]?.p
  const slotText = slotTextDocument(p?.k)?.t
  if (typeof slotText === 'string') return slotText
  if (typeof p?.p?.t === 'string') return p.p.t
  for (const layer of boundTextLayers(data, slotId)) {
    const layerText = slotTextDocument(layer.t?.d?.k)?.t
    if (typeof layerText === 'string') return layerText
  }
  return undefined
}

function writeSlotText(data: Record<string, unknown>, slotId: string, text: string): boolean {
  let changed = false
  const p = (data.slots as Record<string, TextSlotDef> | undefined)?.[slotId]?.p
  const slotDoc = slotTextDocument(p?.k)
  if (slotDoc) {
    slotDoc.t = text
    changed = true
  }
  if (p?.p && typeof p.p === 'object') {
    p.p.t = text
    changed = true
  }
  for (const layer of boundTextLayers(data, slotId)) {
    const layerDoc = slotTextDocument(layer.t?.d?.k)
    if (layerDoc) {
      layerDoc.t = text
      changed = true
    }
  }
  return changed
}

/** Editable text slots (only slots whose value resolves to a string). */
function slotTextLayers(data: Record<string, unknown>): LottieTextLayer[] {
  const slots = data.slots
  if (!slots || typeof slots !== 'object') return []
  const result: LottieTextLayer[] = []
  for (const [id, def] of Object.entries(slots as Record<string, TextSlotDef>)) {
    const text = readSlotText(data, id)
    if (typeof text !== 'string') continue
    const name = typeof def?.nm === 'string' && def.nm.trim() ? def.nm.trim() : ''
    result.push({ key: `s:${id}`, text, label: name || id })
  }
  return result
}

/**
 * List the editable text of a Lottie animation object. Author-defined text
 * slots come first (keyed `s:<id>`), then every unbound text layer in document
 * order (keyed by index). Slot-bound layers are omitted here — they're edited
 * through their slot. Returns an empty array for non-text or unparseable input.
 */
export function extractLottieTextLayers(json: unknown): LottieTextLayer[] {
  const data = parseJson(json)
  const layers = data?.layers
  if (!data || !Array.isArray(layers)) return []

  const result: LottieTextLayer[] = slotTextLayers(data)
  layers.forEach((raw, index) => {
    const layer = raw as LottieLayer
    if (layer?.ty !== 5) return
    if (typeof layer.t?.d?.sid === 'string') return // slot-bound; shown as a slot
    const text = firstTextString(layer)
    if (text === null) return
    const name = typeof layer.nm === 'string' && layer.nm.trim() ? layer.nm.trim() : ''
    result.push({ key: String(index), text, label: name || `Text ${index + 1}` })
  })
  return result
}

/**
 * Apply per-layer text overrides to a raw Lottie animation and return the
 * patched JSON string. Overrides are keyed by layer index (see
 * {@link extractLottieTextLayers}); unknown keys are ignored. Returns null when
 * the input can't be parsed or has no layers to patch.
 */
export function applyLottieTextOverrides(
  json: unknown,
  overrides: Record<string, string>,
): string | null {
  const data = parseJson(json)
  const layers = data?.layers
  if (!data || !Array.isArray(layers)) return null
  if (Object.keys(overrides).length === 0) return null

  let changed = false
  // Slot overrides (keyed `s:<id>`): patch the slot document + bound layers.
  for (const [key, value] of Object.entries(overrides)) {
    if (!key.startsWith('s:')) continue
    if (writeSlotText(data, key.slice(2), value)) changed = true
  }
  layers.forEach((raw, index) => {
    const override = overrides[String(index)]
    if (override === undefined) return
    const layer = raw as LottieLayer
    if (layer?.ty !== 5) return
    if (typeof layer.t?.d?.sid === 'string') return // handled via its slot
    const keyframes = layer.t?.d?.k
    if (!Array.isArray(keyframes)) return
    for (const kf of keyframes) {
      if (kf?.s && typeof kf.s.t === 'string') {
        kf.s.t = override
        changed = true
      }
    }
  })

  return changed ? JSON.stringify(data) : null
}


export function parseLottieJsonObject(json: unknown): Record<string, unknown> | null {
  if (typeof json === 'string') {
    try {
      return JSON.parse(json) as Record<string, unknown>
    } catch {
      return null
    }
  }
  return json && typeof json === 'object' ? (json as Record<string, unknown>) : null
}

const parseJson = parseLottieJsonObject;

export interface LottieEdits {
  /** colour key (`c0`, `s:<slot>`) -> `#rrggbb` */
  colors?: Record<string, string>;
  /** text layer key (layer index, `s:<slot>`) -> replacement text */
  texts?: Record<string, string>;
}

export const hasLottieEdits = (e: LottieEdits | undefined | null): boolean => !!e && (Object.keys(e.colors ?? {}).length > 0 || Object.keys(e.texts ?? {}).length > 0);

/** Patched copy of an animation (the input is never mutated). Returns the input itself when there is nothing to change. */
export function applyLottieEdits<T = unknown>(animation: T, edits: LottieEdits | undefined | null): T {
  if (!animation || !hasLottieEdits(edits)) return animation;
  const copy = JSON.parse(JSON.stringify(animation)) as T;
  if (Object.keys(edits!.texts ?? {}).length) applyLottieTextOverrides(copy, edits!.texts!);
  if (Object.keys(edits!.colors ?? {}).length) applyLottieColorOverrides(copy, edits!.colors!);
  return copy;
}
