/**
 * Browser-side helpers for the designer: loading pictures (kept export-safe), text measuring, the project size for an
 * aspect ratio, the planned background values from the concept panel and the "cut out subject" call.
 */
import type { CanvasAdjustments } from '../thumbnailPrompt';
import { fontString, type DesignBackground, type Measure, type TextLayer } from './model';
import type { DrawableImage } from './render';
import { editSmartVideoGoImage } from '@ohb/shared/personalization/image-editor/imageEditApi';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const CANVAS_SIZES: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1280, height: 720 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
};

export function canvasSizeFor(aspectRatio?: string): { width: number; height: number } {
  if (aspectRatio && CANVAS_SIZES[aspectRatio]) return CANVAS_SIZES[aspectRatio];
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(aspectRatio || '');
  if (m && Number(m[1]) > 0 && Number(m[2]) > 0) {
    const ratio = Number(m[1]) / Number(m[2]);
    return ratio >= 1 ? { width: 1280, height: Math.round(1280 / ratio) } : { width: Math.round(1080 * ratio), height: 1080 };
  }
  return CANVAS_SIZES['16:9'];
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

function decode(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The picture could not be loaded.'));
    img.src = src;
  });
}

/**
 * Loads a picture that is safe to export. data:/blob: URLs load directly; other URLs are loaded with CORS, then through
 * fetch as a fallback. A picture that only loads without CORS would taint the canvas, so it is refused.
 */
export async function loadImage(src: string): Promise<HTMLImageElement> {
  if (src.startsWith('data:') || src.startsWith('blob:')) return decode(src, false);
  try {
    return await decode(src, true);
  } catch {
    try {
      const blob = await (await fetch(src)).blob();
      if (!blob.type.startsWith('image/')) throw new Error('not an image');
      return await decode(URL.createObjectURL(blob), false);
    } catch {
      throw new Error('This picture is hosted somewhere that does not allow editing it. Download it and upload it as a photo instead.');
    }
  }
}

export const naturalSize = (img: DrawableImage) => ({ w: (img.naturalWidth ?? (img.width as number)) || 1, h: (img.naturalHeight ?? (img.height as number)) || 1 });

let measureCtx: CanvasRenderingContext2D | null | undefined;
/** A text measure backed by an off-screen canvas; falls back to a rough per-character width when canvas is unavailable. */
export function makeMeasure(): Measure {
  return (text, font) => {
    if (measureCtx === undefined) {
      try { measureCtx = document.createElement('canvas').getContext('2d'); } catch { measureCtx = null; }
    }
    if (measureCtx) {
      measureCtx.font = font;
      return measureCtx.measureText(text).width;
    }
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16);
    return text.length * size * 0.55;
  };
}

export const measureText = (l: TextLayer, measure: Measure) => measure(l.text, fontString(l));

/** The blur / contrast / saturation planned in the concept panel, as the designer's background numbers. */
export function plannedLook(adj: CanvasAdjustments): Pick<DesignBackground, 'blur' | 'contrast' | 'saturation'> {
  return { blur: adj.backgroundBlurPx, contrast: Math.round(adj.contrast * 100), saturation: Math.round(adj.saturation * 100) };
}

/** The flat colour or gradient planned in the concept panel (never replaces a picture on its own). */
export function plannedBackdrop(adj: CanvasAdjustments | null | undefined): Partial<DesignBackground> | null {
  if (!adj) return null;
  if (adj.gradient) return { mode: 'gradient', from: adj.gradient.from, to: adj.gradient.to, angle: adj.gradient.angle };
  if (adj.backgroundColor) return { mode: 'solid', color: adj.backgroundColor };
  return null;
}

export function imageToPngBlob(img: DrawableImage): Promise<Blob> {
  const { w, h } = naturalSize(img);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Drawing is not supported in this browser.'));
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The picture could not be prepared.'))), 'image/png'));
}

/** Asks the image-edit route to remove the background (transparent PNG back) and returns it as a data URL. */
export async function cutOutSubject(img: DrawableImage): Promise<string> {
  const results = await editSmartVideoGoImage({
    operation: 'remove_background',
    prompt: 'Remove the entire background and isolate the primary subject with clean natural edges. Preserve the subject, identity, product, logo, text, geometry, colors and proportions.',
    image: await imageToPngBlob(img),
    model: 'gpt-image-2.6-flare',
    quality: 'medium',
    size: 'auto',
    outputFormat: 'png',
    background: 'transparent',
    inputFidelity: 'high',
  });
  const first = results[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first?.url) {
    const blob = await (await fetch(first.url)).blob();
    return fileToDataUrl(blob);
  }
  throw new Error('The cut-out did not come back. Try again.');
}
