/**
 * Logo tracing: turns a raster logo (PNG/JPG found on a site, often small and soft) into a crisp SVG, entirely in
 * the browser. Uses imagetracerjs (Unlicense, ~47 KB), imported lazily so it never lands in the main bundle.
 * Free: nothing leaves the device.
 *
 * A trace is an approximation: gradients and fine detail are flattened to a few colours. It is offered as an
 * extra logo, never a replacement, so the original is always still there.
 */
export interface TraceOptions {
  /** Longest side the image is traced at. Larger = more detail, slower. */
  maxSide?: number
  /** Number of colours to quantise to (2..16). */
  colors?: number
}

export const DEFAULT_TRACE_MAX_SIDE = 400
export const DEFAULT_TRACE_COLORS = 8
/** A trace bigger than this is not a "logo" any more (a photo); refuse rather than hand back megabytes of paths. */
export const MAX_SVG_BYTES = 400_000

export interface TraceResult { svg: string; dataUrl: string; width: number; height: number; bytes: number }

/** Size to trace at: the image scaled so its longest side is `maxSide` (never enlarged). */
export function traceSize(width: number, height: number, maxSide: number = DEFAULT_TRACE_MAX_SIDE): { width: number; height: number } {
  const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height))
  const k = Math.min(1, maxSide / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}

/**
 * The traced SVG becomes a logo image, so it is rendered with `<img>` (scripts never run there) — but it can also
 * be saved or opened on its own, so anything executable is refused outright instead of trusted.
 */
export function isSafeSvg(svg: string): boolean {
  if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(svg)) return false
  return !/<\s*(script|foreignObject|iframe|object|embed)\b/i.test(svg) && !/\son[a-z]+\s*=/i.test(svg) && !/javascript:/i.test(svg)
}

export function svgToDataUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:image/svg+xml;base64,${btoa(binary)}`
}

type Tracer = { imagedataToSVG: (data: ImageData, options?: Record<string, unknown>) => string }

export type TraceFailure = 'unsupported' | 'unsafe' | 'too-complex' | 'failed'
export class LogoTraceError extends Error {
  constructor(readonly reason: TraceFailure, message: string) { super(message); this.name = 'LogoTraceError' }
}

/** Decodes the image into pixels. Injectable so the maths can be tested without a canvas. */
export type PixelReader = (blob: Blob, size: (w: number, h: number) => { width: number; height: number }) => Promise<ImageData>

async function readPixelsInBrowser(blob: Blob, size: (w: number, h: number) => { width: number; height: number }): Promise<ImageData> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') throw new LogoTraceError('unsupported', 'This browser cannot read the image.')
  const bitmap = await createImageBitmap(blob)
  try {
    const { width, height } = size(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new LogoTraceError('unsupported', 'This browser cannot read the image.')
    ctx.drawImage(bitmap, 0, 0, width, height)
    return ctx.getImageData(0, 0, width, height)
  } finally { bitmap.close?.() }
}

export async function traceLogo(
  blob: Blob,
  options: TraceOptions & { tracer?: Tracer; readPixels?: PixelReader } = {},
): Promise<TraceResult> {
  const maxSide = options.maxSide ?? DEFAULT_TRACE_MAX_SIDE
  const colors = Math.min(16, Math.max(2, Math.round(options.colors ?? DEFAULT_TRACE_COLORS)))
  let imageData: ImageData
  try {
    imageData = await (options.readPixels ?? readPixelsInBrowser)(blob, (w, h) => traceSize(w, h, maxSide))
  } catch (e) {
    if (e instanceof LogoTraceError) throw e
    throw new LogoTraceError('failed', 'The image could not be read.')
  }
  let tracer = options.tracer
  if (!tracer) {
    const mod = (await import('imagetracerjs')) as unknown as { default?: Tracer } & Tracer
    tracer = mod.default ?? mod
  }
  let svg: string
  try {
    svg = tracer.imagedataToSVG(imageData, {
      numberofcolors: colors, colorsampling: 2, pathomit: 8, ltres: 1, qtres: 1, blurradius: 0, strokewidth: 0, scale: 1, viewbox: true, desc: false,
    })
  } catch {
    throw new LogoTraceError('failed', 'The logo could not be traced.')
  }
  if (!isSafeSvg(svg)) throw new LogoTraceError('unsafe', 'The traced result was not a plain SVG, so it was discarded.')
  const bytes = new TextEncoder().encode(svg).length
  if (bytes > MAX_SVG_BYTES) throw new LogoTraceError('too-complex', 'This image is too detailed to trace as a logo.')
  return { svg, dataUrl: svgToDataUrl(svg), width: imageData.width, height: imageData.height, bytes }
}
