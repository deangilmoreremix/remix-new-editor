/**
 * Re-makes one thumbnail for each network's shape.
 *
 * `fitToShape` is free: it runs in the browser (crop around a focus point, or fit the whole picture
 * over a blurred or solid backdrop) and never calls a paid service. `expandWithAi` is optional: it asks
 * the image-edit route (OpenAI) to recompose or extend the scene. Publishing never requires either.
 */
import { THUMBNAIL_ASPECT_SIZES, type ThumbnailAspect } from './socialPayloads';

export type FitMode = 'fill' | 'blur' | 'solid'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function parseSize(size: string): { w: number; h: number } {
  const m = /^(\d+)x(\d+)$/.exec(size);
  if (!m) throw new Error(`Bad size ${size}`);
  return { w: Number(m[1]), h: Number(m[2]) };
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5);

/** The part of the source that fills the whole target (crop), centred on the focus point. */
export function coverSource(srcW: number, srcH: number, dstW: number, dstH: number, fx = 0.5, fy = 0.5): Rect {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const w = dstW / scale;
  const h = dstH / scale;
  const x = Math.min(srcW - w, Math.max(0, clamp01(fx) * srcW - w / 2));
  const y = Math.min(srcH - h, Math.max(0, clamp01(fy) * srcH - h / 2));
  return { x, y, w, h };
}

/** Where the whole source sits inside the target with nothing cropped. */
export function containDest(srcW: number, srcH: number, dstW: number, dstH: number): Rect {
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The thumbnail picture could not be read.'));
    img.src = url;
  });
}

export interface FitOptions {
  mode?: FitMode
  /** Focus point as 0..1 of the picture (default centre). Used by fill. */
  focusX?: number
  focusY?: number
  /** Backdrop colour for solid mode. */
  color?: string
}

/** Free, in-browser: returns a JPEG data URL at the shape's exact size. */
export async function fitToShape(imageUrl: string, aspect: ThumbnailAspect, options: FitOptions = {}): Promise<string> {
  const { w, h } = parseSize(THUMBNAIL_ASPECT_SIZES[aspect]);
  const img = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Drawing is not supported in this browser.');
  const mode = options.mode ?? 'fill';
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  if (mode === 'fill') {
    const c = coverSource(sw, sh, w, h, options.focusX, options.focusY);
    ctx.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, w, h);
  } else {
    if (mode === 'solid') {
      ctx.fillStyle = options.color || '#000000';
      ctx.fillRect(0, 0, w, h);
    } else {
      const c = coverSource(sw, sh, w, h);
      ctx.filter = 'blur(28px)';
      // Draw a little oversize so the blur does not fade at the edges.
      ctx.drawImage(img, c.x, c.y, c.w, c.h, -40, -40, w + 80, h + 80);
      ctx.filter = 'none';
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, w, h);
    }
    const d = containDest(sw, sh, w, h);
    ctx.drawImage(img, d.x, d.y, d.w, d.h);
  }
  return canvas.toDataURL('image/jpeg', 0.92);
}

export type AiShapeMode = 'reframe' | 'outpaint'

/** Optional: OpenAI recomposes or extends the scene for the shape. Uses the user's OpenAI key. */
export async function expandWithAi(imageUrl: string, aspect: ThumbnailAspect, mode: AiShapeMode = 'reframe'): Promise<string> {
  const { editSmartVideoGoImage } = await import('@ohb/shared/personalization/image-editor/imageEditApi');
  const blob = await (await fetch(imageUrl)).blob();
  const results = await editSmartVideoGoImage({
    operation: mode,
    prompt: `Make this a ${aspect} social media thumbnail. Keep the headline text and the main subject fully visible and unchanged; extend the scene naturally instead of cropping.`,
    image: blob,
    model: 'gpt-image-2.6-flare',
    quality: 'medium',
    size: THUMBNAIL_ASPECT_SIZES[aspect] as `${number}x${number}`,
    outputFormat: 'jpeg',
    outputCompression: 90,
    background: 'opaque',
    inputFidelity: 'high',
  });
  const first = results[0];
  if (first?.b64_json) return `data:image/jpeg;base64,${first.b64_json}`;
  if (first?.url) return first.url;
  throw new Error('The AI version did not come back. Try again, or use the free fit instead.');
}
