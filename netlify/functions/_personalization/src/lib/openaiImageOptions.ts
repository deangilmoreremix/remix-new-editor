/**
 * Validation for the OpenAI image controls the thumbnail designer exposes
 * (quality, complexity, custom size, background, output format/compression).
 * Used by the thumbnail route; mirrors the rules in the personalization edit route.
 */
export const IMAGE_QUALITIES = ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export const IMAGE_COMPLEXITIES = ['low', 'medium', 'high'] as const
export const IMAGE_FORMATS = ['png', 'jpeg', 'webp'] as const
export const IMAGE_BACKGROUNDS = ['transparent', 'opaque', 'auto'] as const

/** Images 2.6 models (Flare = fast concepts, Sunburst = detail and careful edits). */
export const IMAGES_26_MODELS = ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'] as const
export const isImages26 = (model: string) => (IMAGES_26_MODELS as readonly string[]).includes(model)

/** Custom sizes: multiples of 16, edges up to 3840, ratio 1:3 to 3:1, 0.65 to 8.3 megapixels. */
export function isAllowedImageSize(size: string): boolean {
  if (size === 'auto') return true
  const m = /^(\d{2,5})x(\d{2,5})$/.exec(size)
  if (!m) return false
  const w = Number(m[1])
  const h = Number(m[2])
  if (w % 16 !== 0 || h % 16 !== 0 || w > 3840 || h > 3840) return false
  const ratio = w / h
  if (ratio < 1 / 3 || ratio > 3) return false
  const pixels = w * h
  return pixels >= 655_360 && pixels <= 8_294_400
}

export interface ImageOptions {
  quality?: (typeof IMAGE_QUALITIES)[number]
  complexity?: (typeof IMAGE_COMPLEXITIES)[number]
  size?: string
  background?: (typeof IMAGE_BACKGROUNDS)[number]
  outputFormat?: (typeof IMAGE_FORMATS)[number]
  outputCompression?: number
}

/** Read and validate the optional controls from a request body; returns an error message for a bad value. */
export function parseImageOptions(body: Record<string, any>): { options: ImageOptions; error?: string } {
  const options: ImageOptions = {}
  const has = (k: string) => body[k] !== undefined && body[k] !== null && body[k] !== ''
  if (has('quality')) {
    if (!(IMAGE_QUALITIES as readonly string[]).includes(body.quality)) return { options, error: 'Unsupported quality value.' }
    options.quality = body.quality
  }
  if (has('complexity')) {
    if (!(IMAGE_COMPLEXITIES as readonly string[]).includes(body.complexity)) return { options, error: 'Complexity must be low, medium or high.' }
    options.complexity = body.complexity
  }
  if (has('size')) {
    if (typeof body.size !== 'string' || !isAllowedImageSize(body.size)) return { options, error: 'Unsupported image size.' }
    options.size = body.size
  }
  if (has('background')) {
    if (!(IMAGE_BACKGROUNDS as readonly string[]).includes(body.background)) return { options, error: 'Unsupported background mode.' }
    options.background = body.background
  }
  if (has('output_format')) {
    if (!(IMAGE_FORMATS as readonly string[]).includes(body.output_format)) return { options, error: 'Unsupported output format.' }
    options.outputFormat = body.output_format
  }
  if (has('output_compression')) {
    const c = Number(body.output_compression)
    if (!Number.isFinite(c) || c < 0 || c > 100) return { options, error: 'Output compression must be between 0 and 100.' }
    if ((options.outputFormat ?? 'png') === 'png') return { options, error: 'Output compression is only supported for JPEG or WebP.' }
    options.outputCompression = Math.round(c)
  }
  if (options.background === 'transparent' && options.outputFormat === 'jpeg') return { options, error: 'Transparent output requires PNG or WebP.' }
  return { options }
}
