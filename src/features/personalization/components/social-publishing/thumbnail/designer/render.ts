/**
 * Draws a DesignProject onto a 2D context. The context is passed in (and only a small subset of it is
 * used) so the same code serves the live stage, the exporter and unit tests with a recording context.
 */
import { fontString, isHighlighted, textLayout, toRad, type DesignProject, type ImageLayer, type Layer, type ShapeLayer, type TextLayer } from './model'

export type DrawableImage = CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number }
/** Loaded pictures keyed by their `src` (layer image or background image). */
export type RenderAssets = Record<string, DrawableImage | undefined>

/** An offscreen drawing surface; used to compose an outlined picture before its opacity is applied once. */
export interface Surface { canvas: CanvasImageSource; ctx: CanvasRenderingContext2D }
export type SurfaceFactory = (width: number, height: number) => Surface | null

function defaultSurface(width: number, height: number): Surface | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  return ctx ? { canvas, ctx } : null
}

export interface RenderOptions {
  /** Offscreen surface factory (defaults to a DOM canvas); tests pass a recording one. */
  createSurface?: SurfaceFactory
  /** Safe-area guide and selection outline; never part of an export. */
  guides?: boolean
  selectedId?: string | null
}

const sizeOf = (img: DrawableImage) => ({ w: img.naturalWidth ?? (img.width as number) ?? 0, h: img.naturalHeight ?? (img.height as number) ?? 0 })

function backgroundFilter(p: DesignProject): string {
  const b = p.background
  const parts: string[] = []
  if (b.blur > 0) parts.push(`blur(${b.blur}px)`)
  if (b.brightness !== 100) parts.push(`brightness(${b.brightness}%)`)
  if (b.contrast !== 100) parts.push(`contrast(${b.contrast}%)`)
  if (b.saturation !== 100) parts.push(`saturate(${b.saturation}%)`)
  return parts.join(' ')
}

/** Cover-fit an image into the canvas; the blur edge is bled outwards so the filter does not leave a halo. */
function drawBackground(ctx: CanvasRenderingContext2D, p: DesignProject, assets: RenderAssets) {
  const b = p.background
  ctx.save()
  const filter = backgroundFilter(p)
  if (filter && 'filter' in ctx) (ctx as unknown as { filter: string }).filter = filter
  if (b.mode === 'image' && b.imageSrc && assets[b.imageSrc]) {
    const img = assets[b.imageSrc] as DrawableImage
    const { w, h } = sizeOf(img)
    if (w > 0 && h > 0) {
      // Base placement is exactly the cover fit (EditRegionPanel maps masks through the same maths).
      const scale = Math.max(p.width / w, p.height / h)
      const dw = w * scale
      const dh = h * scale
      const dx = (p.width - dw) / 2
      const dy = (p.height - dh) / 2
      ctx.drawImage(img, dx, dy, dw, dh)
      // Blur would fade the picture's own edges into transparency; stretch its edge pixels outwards instead.
      const bleed = b.blur > 0 ? Math.ceil(b.blur * 2) : 0
      if (bleed > 0) {
        const xs = [{ d0: -bleed, d1: dx, s0: 0, s1: 1 }, { d0: dx + dw, d1: p.width + bleed, s0: w - 1, s1: w }]
        const ys = [{ d0: -bleed, d1: dy, s0: 0, s1: 1 }, { d0: dy + dh, d1: p.height + bleed, s0: h - 1, s1: h }]
        const mid = { d0: dx, d1: dx + dw, s0: 0, s1: w }
        const midY = { d0: dy, d1: dy + dh, s0: 0, s1: h }
        for (const X of [...xs, mid]) {
          for (const Y of [...ys, midY]) {
            if (X === mid && Y === midY) continue
            if (X.d1 - X.d0 <= 0 || Y.d1 - Y.d0 <= 0) continue
            ctx.drawImage(img, X.s0, Y.s0, X.s1 - X.s0, Y.s1 - Y.s0, X.d0, Y.d0, X.d1 - X.d0, Y.d1 - Y.d0)
          }
        }
      }
    }
  } else if (b.mode === 'gradient') {
    const a = toRad(b.angle)
    const cx = p.width / 2
    const cy = p.height / 2
    const half = (Math.abs(Math.cos(a)) * p.width + Math.abs(Math.sin(a)) * p.height) / 2
    const g = ctx.createLinearGradient(cx - Math.cos(a) * half, cy - Math.sin(a) * half, cx + Math.cos(a) * half, cy + Math.sin(a) * half)
    g.addColorStop(0, b.from)
    g.addColorStop(1, b.to)
    ctx.fillStyle = g
    ctx.fillRect(-2, -2, p.width + 4, p.height + 4)
  } else {
    ctx.fillStyle = b.color
    ctx.fillRect(-2, -2, p.width + 4, p.height + 4)
  }
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h)
  ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

function drawImageLayer(ctx: CanvasRenderingContext2D, l: ImageLayer, assets: RenderAssets) {
  const img = assets[l.src]
  if (!img) return
  const { w, h } = sizeOf(img)
  if (w <= 0 || h <= 0) return
  const scale = (l.fit === 'cover' ? Math.max : Math.min)(l.w / w, l.h / h)
  const dw = w * scale
  const dh = h * scale
  const dx = -dw / 2
  const dy = -dh / 2
  if (l.fit === 'cover') {
    ctx.beginPath()
    ctx.rect(-l.w / 2, -l.h / 2, l.w, l.h)
    ctx.clip()
  }
  if (l.outline === 'white') {
    // the shadow of a cut-out is its silhouette: offset copies make a crisp outline
    const t = Math.max(3, Math.round(Math.min(l.w, l.h) * 0.012))
    ctx.shadowColor = '#ffffff'
    ctx.shadowBlur = 0
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4
      ctx.shadowOffsetX = Math.cos(a) * t
      ctx.shadowOffsetY = Math.sin(a) * t
      ctx.drawImage(img, dx, dy, dw, dh)
    }
  } else if (l.outline === 'glow') {
    ctx.shadowColor = 'rgba(255,255,255,0.95)'
    ctx.shadowBlur = Math.max(10, Math.round(Math.min(l.w, l.h) * 0.05))
    ctx.drawImage(img, dx, dy, dw, dh)
  }
  ctx.shadowColor = 'rgba(0,0,0,0)'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.drawImage(img, dx, dy, dw, dh)
}

function drawShapeLayer(ctx: CanvasRenderingContext2D, l: ShapeLayer) {
  const hw = l.w / 2
  const hh = l.h / 2
  ctx.fillStyle = l.fill
  ctx.strokeStyle = l.stroke
  ctx.lineWidth = l.strokeWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  switch (l.shape) {
    case 'circle':
      ctx.beginPath()
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2)
      ctx.fill()
      if (l.strokeWidth > 0) ctx.stroke()
      break
    case 'arrow': {
      const head = Math.min(l.h * 0.5, l.w * 0.4)
      ctx.beginPath()
      ctx.moveTo(-hw, 0)
      ctx.lineTo(hw, 0)
      ctx.moveTo(hw - head, -head)
      ctx.lineTo(hw, 0)
      ctx.lineTo(hw - head, head)
      ctx.stroke()
      break
    }
    case 'divider':
      ctx.fillRect(-hw, -hh, l.w, l.h)
      break
    case 'badge':
    case 'rect':
    default:
      roundRect(ctx, -hw, -hh, l.w, l.h, l.shape === 'badge' ? l.h / 2 : l.h * 0.12)
      ctx.fill()
      if (l.strokeWidth > 0 && l.stroke !== 'rgba(0,0,0,0)') ctx.stroke()
      if (l.shape === 'badge' && l.label) {
        ctx.fillStyle = '#ffffff'
        ctx.font = `800 ${Math.round(l.h * 0.5)}px Inter, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(l.label, 0, 0)
      }
  }
}

function drawTextLayer(ctx: CanvasRenderingContext2D, l: TextLayer) {
  const font = fontString(l)
  ctx.font = font
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${l.letterSpacing}px`
  const measure = (t: string) => ctx.measureText(t).width
  const layout = textLayout(l, (t) => measure(t))
  const pad = l.box ? l.box.padding : 0
  if (l.box) {
    ctx.fillStyle = l.box.color
    roundRect(ctx, -l.w / 2, -l.h / 2, l.w, l.h, l.box.radius)
    ctx.fill()
  }
  const innerW = l.w - pad * 2
  const top = -l.h / 2 + pad + (l.box ? 0 : 0)
  const space = measure(' ')
  layout.lines.forEach((line, i) => {
    const y = top + i * layout.lineHeightPx + (layout.lineHeightPx - l.fontSize) / 2
    const lineW = measure(line)
    const startX = -l.w / 2 + pad + (l.align === 'center' ? (innerW - lineW) / 2 : l.align === 'right' ? innerW - lineW : 0)
    const words = line.split(' ')
    let x = startX
    for (const word of words) {
      const color = isHighlighted(l, word) ? l.highlight.color : l.color
      if (l.strokeWidth > 0) {
        ctx.save()
        if (l.shadow) {
          ctx.shadowColor = l.shadow.color
          ctx.shadowBlur = l.shadow.blur
          ctx.shadowOffsetX = l.shadow.offsetX
          ctx.shadowOffsetY = l.shadow.offsetY
        }
        ctx.lineWidth = l.strokeWidth * 2
        ctx.lineJoin = 'round'
        ctx.strokeStyle = l.strokeColor
        ctx.strokeText(word, x, y)
        ctx.restore()
        ctx.fillStyle = color
        ctx.fillText(word, x, y)
      } else {
        ctx.save()
        if (l.shadow) {
          ctx.shadowColor = l.shadow.color
          ctx.shadowBlur = l.shadow.blur
          ctx.shadowOffsetX = l.shadow.offsetX
          ctx.shadowOffsetY = l.shadow.offsetY
        }
        ctx.fillStyle = color
        ctx.fillText(word, x, y)
        ctx.restore()
      }
      x += measure(word) + space
    }
  })
}

function drawLayer(ctx: CanvasRenderingContext2D, l: Layer, assets: RenderAssets, createSurface: SurfaceFactory) {
  ctx.save()
  ctx.translate(l.x + l.w / 2, l.y + l.h / 2)
  ctx.rotate(toRad(l.rotation))
  ctx.globalAlpha = Math.max(0, Math.min(1, l.opacity))
  if (l.kind === 'image') {
    const alpha = Math.max(0, Math.min(1, l.opacity))
    const margin = Math.ceil(Math.min(l.w, l.h) * 0.1) + 24
    const sw = Math.ceil(l.w + margin * 2)
    const sh = Math.ceil(l.h + margin * 2)
    // An outline is several copies of the picture; apply the opacity once to the finished result instead.
    const surface = l.outline && l.outline !== 'none' && alpha < 1 ? createSurface(sw, sh) : null
    if (surface) {
      surface.ctx.save()
      surface.ctx.translate(sw / 2, sh / 2)
      drawImageLayer(surface.ctx, l, assets)
      surface.ctx.restore()
      ctx.drawImage(surface.canvas, -sw / 2, -sh / 2)
    } else drawImageLayer(ctx, l, assets)
  } else if (l.kind === 'shape') {
    const alpha = Math.max(0, Math.min(1, l.opacity))
    const hasStroke = l.strokeWidth > 0 && l.stroke !== 'rgba(0,0,0,0)'
    const hasFill = l.fill !== 'rgba(0,0,0,0)'
    // A badge label, or a fill plus a stroke, overlap each other; compose at full opacity, then apply the opacity once.
    const overlaps = (l.shape === 'badge' && (!!l.label || hasStroke)) || ((l.shape === 'rect' || l.shape === 'circle') && hasFill && hasStroke)
    const reach = Math.ceil(l.strokeWidth) + 24
    const sw = Math.ceil(l.w + reach * 2)
    const shh = Math.ceil(l.h + reach * 2)
    const surface = alpha < 1 && overlaps ? createSurface(sw, shh) : null
    if (surface) {
      surface.ctx.save()
      surface.ctx.translate(sw / 2, shh / 2)
      drawShapeLayer(surface.ctx, l)
      surface.ctx.restore()
      ctx.drawImage(surface.canvas, -sw / 2, -shh / 2)
    } else drawShapeLayer(ctx, l)
  } else {
    const alpha = Math.max(0, Math.min(1, l.opacity))
    // A box or outline overlaps the text; compose at full opacity, then apply the layer opacity once.
    const sh = l.shadow
    const reach = Math.ceil(l.strokeWidth * 2 + (sh ? sh.blur * 2 + Math.max(Math.abs(sh.offsetX), Math.abs(sh.offsetY)) : 0)) + 24
    const sw = Math.ceil(l.w + reach * 2)
    const shh = Math.ceil(l.h + reach * 2)
    const surface = alpha < 1 && (l.box || l.strokeWidth > 0) ? createSurface(sw, shh) : null
    if (surface) {
      surface.ctx.save()
      surface.ctx.translate(sw / 2, shh / 2)
      drawTextLayer(surface.ctx, l)
      surface.ctx.restore()
      ctx.drawImage(surface.canvas, -sw / 2, -shh / 2)
    } else drawTextLayer(ctx, l)
  }
  ctx.restore()
}

export function renderProject(ctx: CanvasRenderingContext2D, p: DesignProject, assets: RenderAssets, opts: RenderOptions = {}) {
  ctx.clearRect(0, 0, p.width, p.height)
  drawBackground(ctx, p, assets)
  const createSurface = opts.createSurface ?? defaultSurface
  for (const l of p.layers) if (!l.hidden) drawLayer(ctx, l, assets, createSurface)
  if (opts.guides) {
    ctx.save()
    ctx.setLineDash([8, 6])
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(217,255,0,0.8)'
    const m = Math.round(Math.min(p.width, p.height) * 0.04)
    ctx.strokeRect(m, m, p.width - m * 2, p.height - m * 2)
    const sel = opts.selectedId ? p.layers.find((l) => l.id === opts.selectedId) : null
    if (sel && !sel.hidden) {
      ctx.translate(sel.x + sel.w / 2, sel.y + sel.h / 2)
      ctx.rotate(toRad(sel.rotation))
      ctx.setLineDash([])
      ctx.strokeStyle = '#d9ff00'
      ctx.strokeRect(-sel.w / 2, -sel.h / 2, sel.w, sel.h)
    }
    ctx.restore()
  }
}
