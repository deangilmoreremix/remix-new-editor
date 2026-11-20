/**
 * Validation for the OpenAI image controls the thumbnail designer exposes
 * (quality, complexity, custom size, background, output format/compression).
 * Used by the thumbnail route; mirrors the rules in the personalization edit route.
 */
export const IMAGE_QUALITIES = ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export const IMAGE_COMPLEXITIES = ['low', 'medium', 'high'] as const;
export const IMAGE_FORMATS = ['png', 'jpeg', 'webp'] as const;
/** Images 2.6 only: svg (from a prompt, one image) and animated gif. */
export const IMAGE_SPECIAL_FORMATS = ['svg', 'gif'] as const;
export const GIF_FRAME_COUNT = { min: 2, max: 16, default: 9 } as const;
export const GIF_FRAME_DURATION_MS = { min: 20, max: 2000, default: 200 } as const;
export const IMAGE_BACKGROUNDS = ['transparent', 'opaque', 'auto'] as const;
/** Content filter: 'auto' is OpenAI's standard filtering, 'low' is less restrictive. */
export const IMAGE_MODERATION = ['auto', 'low'] as const;

/** Images 2.6 models (Flare = fast concepts, Sunburst = detail and careful edits). */
export const IMAGES_26_MODELS = ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'] as const;
export const isImages26 = (model: string) => (IMAGES_26_MODELS as readonly string[]).includes(model);

/** Custom sizes: multiples of 16, edges up to 3840, ratio 1:3 to 3:1, 0.65 to 8.3 megapixels. */
export function isAllowedImageSize(size: string): boolean {
  if (size === 'auto') return true;
  const m = /^(\d{2,5})x(\d{2,5})$/.exec(size);
  if (!m) return false;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (w % 16 !== 0 || h % 16 !== 0 || w > 3840 || h > 3840) return false;
  const ratio = w / h;
  if (ratio < 1 / 3 || ratio > 3) return false;
  const pixels = w * h;
  return pixels >= 655_360 && pixels <= 8_294_400;
}

export interface ImageOptions {
  quality?: (typeof IMAGE_QUALITIES)[number]
  complexity?: (typeof IMAGE_COMPLEXITIES)[number]
  size?: string
  background?: (typeof IMAGE_BACKGROUNDS)[number]
  outputFormat?: (typeof IMAGE_FORMATS)[number] | (typeof IMAGE_SPECIAL_FORMATS)[number]
  outputCompression?: number
  moderation?: (typeof IMAGE_MODERATION)[number]
  /** gif only: 2 to 16 frames. */
  frameCount?: number
  /** gif only: 20 to 2000 ms per frame, rounded to 10. */
  frameDurationMs?: number
}

/** Read and validate the optional controls from a request body; returns an error message for a bad value. */
export function parseImageOptions(body: Record<string, any>): { options: ImageOptions; error?: string } {
  const options: ImageOptions = {};
  const has = (k: string) => body[k] !== undefined && body[k] !== null && body[k] !== '';
  if (has('quality')) {
    if (!(IMAGE_QUALITIES as readonly string[]).includes(body.quality)) return { options, error: 'Unsupported quality value.' };
    options.quality = body.quality;
  }
  if (has('complexity')) {
    if (!(IMAGE_COMPLEXITIES as readonly string[]).includes(body.complexity)) return { options, error: 'Complexity must be low, medium or high.' };
    options.complexity = body.complexity;
  }
  if (has('size')) {
    const gifSize = body.output_format === 'gif' && typeof body.size === 'string' && /^(\d{2,4})x(\d{2,4})$/.test(body.size) && body.size.split('x').every((n: string) => Number(n) % 16 === 0);
    if (typeof body.size !== 'string' || !(isAllowedImageSize(body.size) || gifSize)) return { options, error: 'Unsupported image size.' };
    options.size = body.size;
  }
  if (has('background')) {
    if (!(IMAGE_BACKGROUNDS as readonly string[]).includes(body.background)) return { options, error: 'Unsupported background mode.' };
    options.background = body.background;
  }
  if (has('output_format')) {
    const known = [...IMAGE_FORMATS, ...IMAGE_SPECIAL_FORMATS] as readonly string[];
    if (!known.includes(body.output_format)) return { options, error: 'Unsupported output format.' };
    options.outputFormat = body.output_format;
  }
  if (has('moderation')) {
    if (!(IMAGE_MODERATION as readonly string[]).includes(body.moderation)) return { options, error: 'Content filter must be auto or low.' };
    options.moderation = body.moderation;
  }
  if (has('output_compression')) {
    const c = Number(body.output_compression);
    if (!Number.isFinite(c) || c < 0 || c > 100) return { options, error: 'Output compression must be between 0 and 100.' };
    if ((options.outputFormat ?? 'png') === 'png') return { options, error: 'Output compression is only supported for JPEG or WebP.' };
    options.outputCompression = Math.round(c);
  }
  const special = options.outputFormat === 'svg' || options.outputFormat === 'gif';
  if (special && has('output_compression')) return { options, error: 'Compression is not available for SVG or GIF.' };
  if (has('frame_count') || has('frame_duration_ms')) {
    if (options.outputFormat !== 'gif') return { options, error: 'Frame count and frame duration only apply to GIF output.' };
    if (has('frame_count')) {
      const f = Number(body.frame_count);
      if (!Number.isInteger(f) || f < GIF_FRAME_COUNT.min || f > GIF_FRAME_COUNT.max) return { options, error: 'GIF frame count must be 2 to 16.' };
      options.frameCount = f;
    }
    if (has('frame_duration_ms')) {
      const d = Number(body.frame_duration_ms);
      if (!Number.isFinite(d) || d < GIF_FRAME_DURATION_MS.min || d > GIF_FRAME_DURATION_MS.max) return { options, error: 'GIF frame duration must be 20 to 2000 ms.' };
      options.frameDurationMs = Math.round(d / 10) * 10;
    }
  }
  if (options.background === 'transparent' && options.outputFormat === 'jpeg') return { options, error: 'Transparent output requires PNG or WebP.' };
  return { options };
}
