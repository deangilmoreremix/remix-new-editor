/**
 * Thumbnail designer model: a flat project of layers over a background.
 * Everything here is pure (no DOM, no canvas) so it can be unit tested; rendering lives in render.ts.
 *
 * Coordinates are canvas pixels with the origin at the top-left. A layer's (x, y, w, h) is its
 * unrotated box; rotation is in degrees around the box centre. `layers` is ordered bottom to top.
 */

export type LayerKind = 'image' | 'text' | 'shape'
export type ImageRole = 'subject' | 'logo' | 'photo' | 'screenshot'
export type ShapeType = 'arrow' | 'circle' | 'rect' | 'badge' | 'divider'
export type TextAlign = 'left' | 'center' | 'right'

interface LayerBase {
  id: string
  name: string
  kind: LayerKind
  x: number
  y: number
  w: number
  h: number
  rotation: number
  opacity: number
  locked: boolean
  hidden: boolean
}

export interface ImageLayer extends LayerBase {
  kind: 'image'
  src: string
  role: ImageRole
  fit: 'contain' | 'cover'
  /** Natural size, used to keep the aspect ratio when resizing. */
  naturalW: number
  naturalH: number
  /** Optional outline or glow around the (cut-out) subject. */
  outline: 'none' | 'white' | 'glow'
}

export interface TextShadow {
  color: string
  blur: number
  offsetX: number
  offsetY: number
}

export interface TextLayer extends LayerBase {
  kind: 'text'
  text: string
  fontFamily: string
  fontWeight: number
  fontSize: number
  color: string
  align: TextAlign
  letterSpacing: number
  lineHeight: number
  strokeColor: string
  strokeWidth: number
  shadow: TextShadow | null
  /** A filled box behind the text. */
  box: { color: string; padding: number; radius: number } | null
  /** Words drawn in another colour (matched case-insensitively, punctuation ignored). */
  highlight: { words: string[]; color: string }
}

export interface ShapeLayer extends LayerBase {
  kind: 'shape'
  shape: ShapeType
  fill: string
  stroke: string
  strokeWidth: number
  /** Badge label (e.g. "NEW", "BEFORE"). */
  label: string
}

export type Layer = ImageLayer | TextLayer | ShapeLayer

export interface DesignBackground {
  mode: 'image' | 'solid' | 'gradient'
  /** The generated / uploaded picture used when mode is "image". */
  imageSrc?: string
  color: string
  from: string
  to: string
  /** Gradient angle in degrees (0 = left to right, 90 = top to bottom). */
  angle: number
  blur: number
  /** 100 = unchanged. */
  brightness: number
  contrast: number
  saturation: number
}

export interface DesignProject {
  version: 1
  width: number
  height: number
  background: DesignBackground
  layers: Layer[]
  /** Saved background pictures (edited versions of the background) to switch between. */
  variants?: string[]
}

export const MAX_VARIANTS = 12

export const DEFAULT_FONTS = ['Inter, system-ui, sans-serif', 'Impact, Haettenschweiler, sans-serif', 'Georgia, serif', 'Arial Black, Arial, sans-serif', 'Courier New, monospace'] as const

let counter = 0
export function newId(prefix = 'layer'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}

export function defaultBackground(): DesignBackground {
  return { mode: 'solid', color: '#0f172a', from: '#1e3a8a', to: '#7c3aed', angle: 45, blur: 0, brightness: 100, contrast: 100, saturation: 100 }
}

export function createProject(width: number, height: number, background?: Partial<DesignBackground>): DesignProject {
  return { version: 1, width, height, background: { ...defaultBackground(), ...background }, layers: [] }
}

const SHAPES: string[] = ['arrow', 'circle', 'rect', 'badge', 'divider']
const isNum = (n: unknown) => typeof n === 'number' && Number.isFinite(n)
const isStr = (s: unknown) => typeof s === 'string'

/** True when a stored layer has every field its kind needs, so the renderer cannot throw on it. */
function isRenderableLayer(value: unknown): boolean {
  const l = value as Record<string, any> | null
  if (!l || typeof l !== 'object' || !isStr(l.id) || !isStr(l.name) || !['image', 'text', 'shape'].includes(l.kind) || ![l.x, l.y, l.w, l.h, l.rotation, l.opacity].every(isNum) ||
    typeof l.locked !== 'boolean' || typeof l.hidden !== 'boolean') return false
  if (l.kind === 'image') return isStr(l.src) && isNum(l.naturalW) && isNum(l.naturalH)
  if (l.kind === 'shape') return SHAPES.includes(l.shape) && isStr(l.fill) && isStr(l.stroke) && isNum(l.strokeWidth)
  const hl = l.highlight
  return isStr(l.text) && isStr(l.fontFamily) && isStr(l.color) && [l.fontSize, l.fontWeight, l.letterSpacing, l.lineHeight, l.strokeWidth].every(isNum) &&
    isStr(l.strokeColor) && isStr(l.align) &&
    !!hl && Array.isArray(hl.words) && hl.words.every(isStr) && isStr(hl.color) &&
    (l.shadow == null || (typeof l.shadow === 'object' && isNum(l.shadow.blur) && isNum(l.shadow.offsetX) && isNum(l.shadow.offsetY) && isStr(l.shadow.color))) &&
    (l.box == null || (typeof l.box === 'object' && isStr(l.box.color) && isNum(l.box.padding) && isNum(l.box.radius)))
}

/** Accepts only a structurally valid saved project (it comes from storage or a draft). */
export function sanitizeProject(value: unknown): DesignProject | null {
  const v = value as Partial<DesignProject> | null
  if (!v || v.version !== 1 || !Number.isFinite(v.width) || !Number.isFinite(v.height) || !v.background || !Array.isArray(v.layers)) return null
  if ((v.width as number) < 16 || (v.height as number) < 16 || (v.width as number) > 8192 || (v.height as number) > 8192) return null
  const layers = v.layers.filter(isRenderableLayer) as Layer[]
  const variants = Array.isArray(v.variants)
    ? Array.from(new Set(v.variants.filter((u): u is string => typeof u === 'string' && /^(data:image\/|https?:\/\/)/.test(u)))).slice(0, MAX_VARIANTS)
    : []
  return { version: 1, width: v.width as number, height: v.height as number, background: { ...defaultBackground(), ...v.background }, layers, ...(variants.length ? { variants } : {}) }
}

/** Remember the current background picture as a variant (no duplicates, newest last, capped). */
export function saveVariant(p: DesignProject, src: string | undefined = p.background.imageSrc): DesignProject {
  if (!src) return p
  const list = p.variants ?? []
  if (list.includes(src)) return p
  return { ...p, variants: [...list, src].slice(-MAX_VARIANTS) }
}

/** Swap only the background picture: layers and every adjustment stay exactly as they are. */
export function swapBackgroundImage(p: DesignProject, src: string): DesignProject {
  return { ...p, background: { ...p.background, mode: 'image', imageSrc: src } }
}

const base = (kind: LayerKind, name: string, x: number, y: number, w: number, h: number): LayerBase => ({
  id: newId(kind), name, kind, x, y, w, h, rotation: 0, opacity: 1, locked: false, hidden: false,
})

/** A headline or subtitle placed where thumbnails usually carry text. */
export function makeTextLayer(project: DesignProject, preset: 'headline' | 'subtitle' = 'headline', text = ''): TextLayer {
  const w = Math.round(project.width * 0.6)
  const fontSize = Math.round(project.height * (preset === 'headline' ? 0.16 : 0.07))
  const h = Math.round(fontSize * 1.3 * (preset === 'headline' ? 2 : 1))
  return {
    ...base('text', preset === 'headline' ? 'Headline' : 'Subtitle', Math.round(project.width * 0.05), Math.round(project.height * (preset === 'headline' ? 0.55 : 0.82)), w, h),
    kind: 'text',
    text: text || (preset === 'headline' ? 'YOUR HEADLINE' : 'Supporting line'),
    fontFamily: DEFAULT_FONTS[preset === 'headline' ? 1 : 0],
    fontWeight: preset === 'headline' ? 900 : 700,
    fontSize,
    color: '#ffffff',
    align: 'left',
    letterSpacing: 0,
    lineHeight: 1.1,
    strokeColor: '#000000',
    strokeWidth: preset === 'headline' ? Math.max(2, Math.round(fontSize * 0.08)) : 0,
    shadow: preset === 'headline' ? { color: 'rgba(0,0,0,0.6)', blur: Math.round(fontSize * 0.15), offsetX: 0, offsetY: Math.round(fontSize * 0.06) } : null,
    box: null,
    highlight: { words: [], color: '#facc15' },
  }
}

export function makeImageLayer(project: DesignProject, src: string, naturalW: number, naturalH: number, role: ImageRole = 'photo'): ImageLayer {
  const maxW = project.width * (role === 'logo' ? 0.2 : 0.5)
  const maxH = project.height * (role === 'logo' ? 0.2 : 0.9)
  const scale = Math.min(maxW / Math.max(1, naturalW), maxH / Math.max(1, naturalH))
  const w = Math.round(naturalW * scale)
  const h = Math.round(naturalH * scale)
  const x = role === 'logo' ? project.width - w - Math.round(project.width * 0.04) : Math.round((project.width - w) / 2)
  const y = role === 'logo' ? Math.round(project.height * 0.04) : project.height - h
  return { ...base('image', role === 'subject' ? 'Subject' : role === 'logo' ? 'Logo' : role === 'screenshot' ? 'Screenshot' : 'Photo', x, y, w, h), kind: 'image', src, role, fit: 'contain', naturalW, naturalH, outline: 'none' }
}

export function makeShapeLayer(project: DesignProject, shape: ShapeType): ShapeLayer {
  const s = Math.round(project.height * 0.2)
  const dims: Record<ShapeType, [number, number]> = { arrow: [s * 1.4, s], circle: [s, s], rect: [s * 1.6, s], badge: [s * 1.6, s * 0.6], divider: [project.width * 0.4, Math.max(4, Math.round(project.height * 0.01))] }
  const [w, h] = dims[shape].map(Math.round) as [number, number]
  return {
    ...base('shape', shape[0].toUpperCase() + shape.slice(1), Math.round((project.width - w) / 2), Math.round((project.height - h) / 2), w, h),
    kind: 'shape', shape, fill: shape === 'circle' || shape === 'arrow' ? 'rgba(0,0,0,0)' : '#ef4444', stroke: shape === 'circle' || shape === 'arrow' ? '#ef4444' : 'rgba(0,0,0,0)', strokeWidth: Math.max(4, Math.round(project.height * 0.012)), label: shape === 'badge' ? 'NEW' : '',
  }
}

// ---------------------------------------------------------------- project operations

export const addLayer = (p: DesignProject, layer: Layer): DesignProject => ({ ...p, layers: [...p.layers, layer] })
export const removeLayer = (p: DesignProject, id: string): DesignProject => ({ ...p, layers: p.layers.filter((l) => l.id !== id) })

export function updateLayer<T extends Layer>(p: DesignProject, id: string, patch: Partial<T>): DesignProject {
  return { ...p, layers: p.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)) }
}

export function duplicateLayer(p: DesignProject, id: string): { project: DesignProject; id: string | null } {
  const i = p.layers.findIndex((l) => l.id === id)
  if (i < 0) return { project: p, id: null }
  const src = p.layers[i]
  const copy = { ...src, id: newId(src.kind), name: `${src.name} copy`, x: src.x + Math.round(p.width * 0.02), y: src.y + Math.round(p.height * 0.02), locked: false } as Layer
  const layers = [...p.layers.slice(0, i + 1), copy, ...p.layers.slice(i + 1)]
  return { project: { ...p, layers }, id: copy.id }
}

export type MoveDirection = 'front' | 'back' | 'forward' | 'backward'
export function moveLayer(p: DesignProject, id: string, dir: MoveDirection): DesignProject {
  const i = p.layers.findIndex((l) => l.id === id)
  if (i < 0) return p
  const layers = [...p.layers]
  const [item] = layers.splice(i, 1)
  const target = dir === 'front' ? layers.length : dir === 'back' ? 0 : dir === 'forward' ? Math.min(layers.length, i + 1) : Math.max(0, i - 1)
  layers.splice(target, 0, item)
  return { ...p, layers }
}

/** Keep a layer's centre inside the canvas (a layer may overhang, but never be lost off-canvas). */
export function clampLayer(p: DesignProject, layer: Layer): Layer {
  const cx = Math.min(p.width, Math.max(0, layer.x + layer.w / 2))
  const cy = Math.min(p.height, Math.max(0, layer.y + layer.h / 2))
  return { ...layer, x: Math.round(cx - layer.w / 2), y: Math.round(cy - layer.h / 2) } as Layer
}

// ---------------------------------------------------------------- geometry

export const toRad = (deg: number) => (deg * Math.PI) / 180

/** A canvas point in the layer's own (unrotated, centre-origin) coordinates. */
export function toLayerSpace(layer: Layer, px: number, py: number): { x: number; y: number } {
  const cx = layer.x + layer.w / 2
  const cy = layer.y + layer.h / 2
  const a = -toRad(layer.rotation)
  const dx = px - cx
  const dy = py - cy
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) }
}

export function layerContains(layer: Layer, px: number, py: number): boolean {
  const q = toLayerSpace(layer, px, py)
  return Math.abs(q.x) <= layer.w / 2 && Math.abs(q.y) <= layer.h / 2
}

/** Top-most visible, unlocked layer under the point. */
export function hitTest(p: DesignProject, px: number, py: number): Layer | null {
  for (let i = p.layers.length - 1; i >= 0; i--) {
    const l = p.layers[i]
    if (!l.hidden && !l.locked && layerContains(l, px, py)) return l
  }
  return null
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/**
 * Resize by dragging a handle. (dx, dy) is the pointer movement in canvas pixels; it is converted to the
 * layer's own axes, so rotated layers resize correctly. The opposite edge/corner stays fixed.
 */
export function resizeLayer(layer: Layer, handle: Handle, dx: number, dy: number, opts: { keepAspect?: boolean; minSize?: number } = {}): Layer {
  const min = opts.minSize ?? 16
  const a = -toRad(layer.rotation)
  const ldx = dx * Math.cos(a) - dy * Math.sin(a)
  const ldy = dx * Math.sin(a) + dy * Math.cos(a)
  const west = handle.includes('w')
  const east = handle.includes('e')
  const north = handle.includes('n')
  const south = handle.includes('s')
  let w = layer.w + (east ? ldx : 0) - (west ? ldx : 0)
  let h = layer.h + (south ? ldy : 0) - (north ? ldy : 0)
  if (opts.keepAspect && layer.w > 0 && layer.h > 0) {
    const ratio = layer.w / layer.h
    const corner = (west || east) && (north || south)
    if (corner) {
      if (Math.abs(w - layer.w) / layer.w >= Math.abs(h - layer.h) / layer.h) h = w / ratio
      else w = h * ratio
    } else if (west || east) h = w / ratio
    else w = h * ratio
  }
  if (opts.keepAspect && layer.w > 0 && layer.h > 0) {
    // Scale both sides together so the minimum size never distorts the aspect ratio.
    const up = Math.max(1, min / Math.max(w, 1e-6), min / Math.max(h, 1e-6))
    w *= up
    h *= up
  }
  w = Math.max(min, w)
  h = Math.max(min, h)
  // The fixed edge (in layer space) stays put: shift the centre by half the size change on the moving side.
  const shiftX = (east ? 1 : west ? -1 : 0) * ((w - layer.w) / 2)
  const shiftY = (south ? 1 : north ? -1 : 0) * ((h - layer.h) / 2)
  const r = toRad(layer.rotation)
  const cx = layer.x + layer.w / 2 + shiftX * Math.cos(r) - shiftY * Math.sin(r)
  const cy = layer.y + layer.h / 2 + shiftX * Math.sin(r) + shiftY * Math.cos(r)
  return { ...layer, w: Math.round(w), h: Math.round(h), x: Math.round(cx - w / 2), y: Math.round(cy - h / 2) } as Layer
}

/** Rotation angle (degrees) that points the layer's top towards the pointer, optionally snapped. */
export function rotationFromPointer(layer: Layer, px: number, py: number, snap = 0): number {
  const cx = layer.x + layer.w / 2
  const cy = layer.y + layer.h / 2
  let deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90
  if (snap > 0) deg = Math.round(deg / snap) * snap
  deg = ((deg % 360) + 360) % 360
  return deg > 180 ? deg - 360 : deg
}

// ---------------------------------------------------------------- text layout

export type Measure = (text: string, font: string) => number
export const fontString = (l: Pick<TextLayer, 'fontWeight' | 'fontSize' | 'fontFamily'>) => `${l.fontWeight} ${l.fontSize}px ${l.fontFamily}`

/** Wrap text to a width. Explicit line breaks are kept; a single word longer than the width stays whole. */
export function wrapText(text: string, maxWidth: number, font: string, measure: Measure): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) { out.push(''); continue }
    let line = words[0]
    for (let i = 1; i < words.length; i++) {
      const next = `${line} ${words[i]}`
      if (measure(next, font) <= maxWidth) line = next
      else { out.push(line); line = words[i] }
    }
    out.push(line)
  }
  return out
}

export function textLayout(l: TextLayer, measure: Measure): { lines: string[]; lineHeightPx: number; height: number; widest: number } {
  const font = fontString(l)
  const pad = l.box ? l.box.padding : 0
  const lines = wrapText(l.text, Math.max(1, l.w - pad * 2), font, measure)
  const lineHeightPx = l.fontSize * l.lineHeight
  const widest = lines.reduce((m, line) => Math.max(m, measure(line, font)), 0)
  return { lines, lineHeightPx, height: lines.length * lineHeightPx + pad * 2, widest }
}

const normWord = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
export function isHighlighted(l: TextLayer, word: string): boolean {
  const n = normWord(word)
  return !!n && l.highlight.words.some((w) => normWord(w) === n)
}

// ---------------------------------------------------------------- quality checks

export interface DesignWarning {
  id: 'clipped-text' | 'low-contrast' | 'crowded' | 'outside-safe-area' | 'covered-by-badge' | 'cropped-out'
  layerId?: string
  message: string
}

function hexToRgb(color: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
const luminance = ([r, g, b]: [number, number, number]) => {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
/** WCAG contrast ratio between two #hex colours; null when either is not a plain hex colour. */
export function contrastRatio(a: string, b: string): number | null {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  if (!ra || !rb) return null
  const la = luminance(ra)
  const lb = luminance(rb)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Text sits on the solid/gradient background or its own box. For picture backgrounds colour contrast is unknown. */
function backgroundSamples(p: DesignProject, l: TextLayer): string[] {
  if (l.box) return [l.box.color]
  if (p.background.mode === 'solid') return [p.background.color]
  if (p.background.mode === 'gradient') return [p.background.from, p.background.to]
  return []
}

// ---------------------------------------------------------------- platform safe zones

export type PlatformId = 'youtube' | 'reels' | 'portrait' | 'square'

/** A rectangle as fractions of the thumbnail as the viewer sees it (0..1). */
export interface ZoneRect { x: number; y: number; w: number; h: number }

export interface PlatformZones {
  id: PlatformId
  label: string
  /** Width / height of the shape the platform shows. */
  ratio: number
  /** Parts the platform's own interface draws over the picture. */
  covered: Array<ZoneRect & { label: string }>
}

export const PLATFORM_ZONES: Record<PlatformId, PlatformZones> = {
  youtube: { id: 'youtube', label: 'YouTube', ratio: 16 / 9, covered: [{ x: 0.82, y: 0.84, w: 0.18, h: 0.16, label: 'Duration badge' }] },
  reels: {
    id: 'reels', label: 'Reels / TikTok', ratio: 9 / 16,
    covered: [{ x: 0, y: 0.76, w: 1, h: 0.24, label: 'Caption and buttons' }, { x: 0.84, y: 0.42, w: 0.16, h: 0.34, label: 'Like and share buttons' }],
  },
  portrait: { id: 'portrait', label: 'IG/FB 4:5', ratio: 4 / 5, covered: [] },
  square: { id: 'square', label: 'Instagram 1:1', ratio: 1, covered: [] },
}

/** Which platform a canvas shape is made for. */
export function platformsForCanvas(width: number, height: number): PlatformId[] {
  const r = width / height
  if (r > 1.4) return ['youtube']
  if (r < 0.6) return ['reels']
  if (r < 0.9) return ['portrait']
  return ['square']
}

/** The part of the canvas a platform shows when the picture is centre-cropped (cover) to its shape, as canvas pixels. */
export function visibleCrop(p: Pick<DesignProject, 'width' | 'height'>, ratio: number): { x: number; y: number; w: number; h: number } {
  const canvasRatio = p.width / p.height
  if (canvasRatio > ratio) { const w = p.height * ratio; return { x: (p.width - w) / 2, y: 0, w, h: p.height } }
  const h = p.width / ratio
  return { x: 0, y: (p.height - h) / 2, w: p.width, h }
}

/** The area a layer visibly fills (text: its lines, not the whole box), as an unrotated canvas rectangle. */
function contentRect(l: Layer, measure: Measure): { x: number; y: number; w: number; h: number } {
  if (l.kind !== 'text') return { x: l.x, y: l.y, w: l.w, h: l.h }
  const lay = textLayout(l, measure)
  const pad = l.box ? l.box.padding : 0
  const w = l.box ? l.w : Math.min(l.w, lay.widest + pad * 2)
  const h = l.box ? l.h : Math.min(l.h, lay.height)
  const x = l.align === 'center' ? l.x + (l.w - w) / 2 : l.align === 'right' ? l.x + l.w - w : l.x
  return { x, y: l.y, w, h }
}

const overlapArea = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

function platformChecks(p: DesignProject, measure: Measure, platforms: PlatformId[]): DesignWarning[] {
  const out: DesignWarning[] = []
  const important = p.layers.filter((l) => !l.hidden && (l.kind === 'text' ? l.text.trim().length > 0 : l.kind === 'image' && (l.role === 'logo' || l.role === 'subject')))
  for (const id of platforms) {
    const zones = PLATFORM_ZONES[id]
    const crop = visibleCrop(p, zones.ratio)
    for (const l of important) {
      const r = contentRect(l, measure)
      const area = r.w * r.h
      if (area <= 0) continue
      const visible = overlapArea(r, crop)
      // Pictures may bleed past the edge on purpose, but one that is entirely outside the crop is lost.
      if (l.kind === 'image' ? visible <= 0 : visible < area * 0.98) {
        out.push({ id: 'cropped-out', layerId: l.id, message: l.kind === 'image' ? `"${l.name}" is outside the visible area on ${zones.label}, which crops this picture to its own shape.` : `"${l.name}" is cut off on ${zones.label}, which crops this picture to its own shape.` })
        continue
      }
      for (const z of zones.covered) {
        const zr = { x: crop.x + z.x * crop.w, y: crop.y + z.y * crop.h, w: z.w * crop.w, h: z.h * crop.h }
        const hit = overlapArea(r, zr)
        if (hit > 0 && hit >= Math.min(area, zr.w * zr.h) * 0.15) {
          out.push({ id: 'covered-by-badge', layerId: l.id, message: `"${l.name}" sits under the ${z.label.toLowerCase()} on ${zones.label}. Move it away from that corner.` })
          break
        }
      }
    }
  }
  return out
}

export function designChecks(p: DesignProject, measure: Measure, opts: { safeMargin?: number; platforms?: PlatformId[] } = {}): DesignWarning[] {
  const warnings: DesignWarning[] = []
  const margin = opts.safeMargin ?? 0.04
  const texts = p.layers.filter((l): l is TextLayer => l.kind === 'text' && !l.hidden && l.text.trim().length > 0)
  for (const t of texts) {
    const lay = textLayout(t, measure)
    if (lay.height > t.h + 1 || lay.widest > t.w - (t.box ? t.box.padding * 2 : 0) + 1) {
      warnings.push({ id: 'clipped-text', layerId: t.id, message: `"${t.name}" does not fit its box: make the box bigger or the text smaller.` })
    }
    const samples = backgroundSamples(p, t)
    const worst = samples.map((s) => contrastRatio(t.color, s)).filter((v): v is number => v !== null).reduce<number | null>((m, v) => (m === null ? v : Math.min(m, v)), null)
    if (worst !== null && worst < 3 && t.strokeWidth === 0) {
      warnings.push({ id: 'low-contrast', layerId: t.id, message: `"${t.name}" is hard to read against the background (contrast ${worst.toFixed(1)}:1). Pick a lighter or darker colour, or add an outline.` })
    }
  }
  for (const l of p.layers) {
    if (l.hidden) continue
    const mx = p.width * margin
    const my = p.height * margin
    if (l.kind === 'text' && (l.x < mx || l.y < my || l.x + l.w > p.width - mx || l.y + l.h > p.height - my)) {
      warnings.push({ id: 'outside-safe-area', layerId: l.id, message: `"${l.name}" is close to the edge and may be cut off on some screens.` })
    }
  }
  const textArea = texts.reduce((sum, t) => sum + t.w * t.h, 0)
  const overlapping = texts.some((a, i) => texts.slice(i + 1).some((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h))
  if (textArea / (p.width * p.height) > 0.45 || overlapping) {
    warnings.push({ id: 'crowded', message: overlapping ? 'Two text layers overlap.' : 'There is a lot of text; thumbnails read best with a few big words.' })
  }
  if (opts.platforms?.length) warnings.push(...platformChecks(p, measure, opts.platforms))
  return warnings
}
