import { containRect, coverRect, refineMask, type Mask } from './maskMath'
import type { CutoutSettings } from './cutoutSettings'
import type { FrameSource } from './frameSource'

/**
 * Painting a cut-out frame. Split in two on purpose: `prepare*` are async (they seek video), and `paintCutout`
 * is synchronous, so a late asynchronous step can never leave half of an older frame on screen.
 */
export interface Scratch {
  frame: HTMLCanvasElement
  background: HTMLCanvasElement
  mask: HTMLCanvasElement
  fg: HTMLCanvasElement
  /** Where the source frame sits inside `frame` (the mask must be stretched over exactly this rect). */
  rect: { x: number; y: number; w: number; h: number }
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function createScratch(): Scratch {
  return { frame: canvas(1, 1), background: canvas(1, 1), mask: canvas(1, 1), fg: canvas(1, 1), rect: { x: 0, y: 0, w: 1, h: 1 } }
}

function size(c: HTMLCanvasElement, w: number, h: number) {
  if (c.width !== w) c.width = w
  if (c.height !== h) c.height = h
}

/**
 * Draws the source frame. A presenter is shown WHOLE (`contain`) so a tall clip in a wide video does not lose their
 * head; before the masks exist the footage is shown exactly as the normal video path does (`cover`).
 */
export async function prepareFrame(scratch: Scratch, source: FrameSource, timeSec: number, w: number, h: number, fit: 'cover' | 'contain'): Promise<void> {
  size(scratch.frame, w, h)
  const ctx = scratch.frame.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  const r = (fit === 'contain' ? containRect : coverRect)(source.width, source.height, w, h)
  scratch.rect = r
  await source.draw(ctx, timeSec, r.x, r.y, r.w, r.h)
}

export interface BackgroundAssets {
  image?: HTMLImageElement | null
  video?: FrameSource | null
}

/** Cheap, filter-free blur: shrink the picture and stretch it back (works the same in every browser and in export). */
async function drawBlurred(ctx: CanvasRenderingContext2D, source: FrameSource, timeSec: number, w: number, h: number, amount: number) {
  const factor = Math.min(24, Math.max(2, Math.round(amount / 4)))
  const tw = Math.max(2, Math.round(w / factor))
  const th = Math.max(2, Math.round(h / factor))
  const tiny = canvas(tw, th)
  const tctx = tiny.getContext('2d')!
  tctx.imageSmoothingEnabled = true
  const r = coverRect(source.width, source.height, tw, th)
  await source.draw(tctx, timeSec, r.x, r.y, r.w, r.h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(tiny, 0, 0, w, h)
}

export async function prepareBackground(scratch: Scratch, cutout: CutoutSettings, source: FrameSource, assets: BackgroundAssets, timeSec: number, w: number, h: number): Promise<void> {
  size(scratch.background, w, h)
  const ctx = scratch.background.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  const bg = cutout.background
  if (bg.kind === 'color') {
    ctx.fillStyle = bg.color
    ctx.fillRect(0, 0, w, h)
  } else if (bg.kind === 'image' && assets.image) {
    const r = coverRect(assets.image.naturalWidth, assets.image.naturalHeight, w, h)
    ctx.drawImage(assets.image, r.x, r.y, r.w, r.h)
  } else if (bg.kind === 'video' && assets.video) {
    const v = assets.video
    const t = v.duration > 0 ? timeSec % v.duration : 0
    const r = coverRect(v.width, v.height, w, h)
    await v.draw(ctx, t, r.x, r.y, r.w, r.h)
  } else if (bg.kind === 'blur') {
    await drawBlurred(ctx, source, timeSec, w, h, bg.amount)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(0, 0, w, h)
  }
  // kind 'none': leave it transparent so the composition's own background shows.
}

/** Fills `scratch.mask` with the mask's alpha, at the mask's own (small) size. */
function writeMask(scratch: Scratch, mask: Mask) {
  size(scratch.mask, mask.w, mask.h)
  const ctx = scratch.mask.getContext('2d')!
  const image = ctx.createImageData(mask.w, mask.h)
  for (let i = 0; i < mask.data.length; i++) {
    const o = i * 4
    image.data[o] = 255
    image.data[o + 1] = 255
    image.data[o + 2] = 255
    image.data[o + 3] = mask.data[i]
  }
  ctx.putImageData(image, 0, 0)
}

export interface PaintInput {
  target: HTMLCanvasElement
  scratch: Scratch
  width: number
  height: number
  cutout: CutoutSettings
  /** Null while the masks are still being measured: the original footage is shown unchanged. */
  mask: Mask | null
}

/** Synchronous: composites background, then the presenter, onto the visible canvas. */
export function paintCutout({ target, scratch, width, height, cutout, mask }: PaintInput): void {
  size(target, width, height)
  const ctx = target.getContext('2d')!
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (!mask) {
    ctx.drawImage(scratch.frame, 0, 0, width, height)
    return
  }
  ctx.drawImage(scratch.background, 0, 0, width, height)

  // Presenter: the frame, cut by the (edge-refined) mask. The mask covers the whole source frame, so it is
  // stretched over exactly the rect the frame was drawn into.
  size(scratch.fg, width, height)
  const fg = scratch.fg.getContext('2d')!
  fg.setTransform(1, 0, 0, 1, 0, 0)
  fg.globalCompositeOperation = 'source-over'
  fg.clearRect(0, 0, width, height)
  fg.drawImage(scratch.frame, 0, 0, width, height)
  writeMask(scratch, refineMask(mask, cutout.edge))
  fg.globalCompositeOperation = 'destination-in'
  fg.imageSmoothingEnabled = true
  fg.imageSmoothingQuality = 'high'
  const r = scratch.rect
  fg.drawImage(scratch.mask, r.x, r.y, r.w, r.h)
  fg.globalCompositeOperation = 'source-over'

  const p = cutout.presenter
  ctx.save()
  ctx.translate(p.x * width, p.y * height)
  ctx.rotate((p.rotation * Math.PI) / 180)
  ctx.scale(p.scale, p.scale)
  ctx.drawImage(scratch.fg, -width / 2, -height / 2, width, height)
  ctx.restore()
}
