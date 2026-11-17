/**
 * Picture tools for the thumbnail designer.
 *
 * The FREE tools run in the browser and never call a paid service: cut out a person (MediaPipe, served from
 * this site), auto-enhance and sharpen. The AI tools are optional extras that call the image-edit route with
 * the user's OpenAI key. Nothing in the designer needs the AI tools to finish a thumbnail.
 */
import { editSmartVideoGoImage } from '@ohb/shared/personalization/image-editor/imageEditApi';
import { IMAGE_EDIT_OPERATIONS, type EditorOperationId } from '@ohb/shared/personalization/image-editor/imageEditRegistry';
import type { Mask } from '@ohb/shared/personalization/preview/cutout/maskMath';
import { refineMask } from '@ohb/shared/personalization/preview/cutout/maskMath';
import { imageToPngBlob, fileToDataUrl, naturalSize } from './designerAssets';
import type { DrawableImage } from './render';

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Unsharp-style 3x3 sharpen. Alpha is untouched, so cut-outs keep their edges. */
export function sharpenPixels(src: Pixels, amount = 0.6): Pixels {
  const { width: w, height: h } = src;
  const out = new Uint8ClampedArray(src.data);
  const a = Math.max(0, Math.min(2, amount));
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (src.data[i + 3] === 0) continue;
      for (let c = 0; c < 3; c++) {
        const center = src.data[i + c];
        const neighbours = src.data[i - 4 + c] + src.data[i + 4 + c] + src.data[i - w * 4 + c] + src.data[i + w * 4 + c];
        out[i + c] = center + a * (4 * center - neighbours) * 0.25 * 2;
      }
    }
  }
  return { data: out, width: w, height: h };
}

/** Stretches the tones (1st to 99th percentile of brightness) and lifts colour a little. Alpha is untouched. */
export function autoEnhancePixels(src: Pixels): Pixels {
  const hist = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < src.data.length; i += 4) {
    if (src.data[i + 3] < 8) continue;
    hist[Math.round(luma(src.data[i], src.data[i + 1], src.data[i + 2]))]++;
    count++;
  }
  const out = new Uint8ClampedArray(src.data);
  if (count === 0) return { data: out, width: src.width, height: src.height };
  const at = (fraction: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= count * fraction) return v;
    }
    return 255;
  };
  const lo = at(0.01);
  const hi = Math.max(lo + 1, at(0.99));
  const scale = 255 / (hi - lo);
  for (let i = 0; i < out.length; i += 4) {
    if (src.data[i + 3] === 0) continue;
    const r = (src.data[i] - lo) * scale;
    const g = (src.data[i + 1] - lo) * scale;
    const b = (src.data[i + 2] - lo) * scale;
    const l = luma(r, g, b);
    out[i] = l + (r - l) * 1.12;
    out[i + 1] = l + (g - l) * 1.12;
    out[i + 2] = l + (b - l) * 1.12;
  }
  return { data: out, width: src.width, height: src.height };
}

/** Uses a low-resolution presenter mask (0..255) as the picture's alpha, sampling it smoothly. */
export function applyMaskAlpha(src: Pixels, mask: Mask): Pixels {
  const out = new Uint8ClampedArray(src.data);
  for (let y = 0; y < src.height; y++) {
    const fy = Math.min(mask.h - 1, (y / Math.max(1, src.height - 1)) * (mask.h - 1));
    const y0 = Math.floor(fy);
    const y1 = Math.min(mask.h - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < src.width; x++) {
      const fx = Math.min(mask.w - 1, (x / Math.max(1, src.width - 1)) * (mask.w - 1));
      const x0 = Math.floor(fx);
      const x1 = Math.min(mask.w - 1, x0 + 1);
      const tx = fx - x0;
      const top = mask.data[y0 * mask.w + x0] * (1 - tx) + mask.data[y0 * mask.w + x1] * tx;
      const bottom = mask.data[y1 * mask.w + x0] * (1 - tx) + mask.data[y1 * mask.w + x1] * tx;
      const m = top * (1 - ty) + bottom * ty;
      const i = (y * src.width + x) * 4;
      out[i + 3] = Math.round((out[i + 3] * m) / 255);
    }
  }
  return { data: out, width: src.width, height: src.height };
}

function toCanvas(img: DrawableImage, maxEdge = 2048): HTMLCanvasElement {
  const { w, h } = naturalSize(img);
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Drawing is not supported in this browser.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function readPixels(canvas: HTMLCanvasElement): Pixels {
  const ctx = canvas.getContext('2d')!;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: d.data, width: d.width, height: d.height };
}

function pixelsToPng(p: Pixels): string {
  const canvas = document.createElement('canvas');
  canvas.width = p.width;
  canvas.height = p.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Drawing is not supported in this browser.');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
  return canvas.toDataURL('image/png');
}

export type FreeToolId = 'cutout_person' | 'enhance' | 'sharpen';

export const FREE_TOOLS: { id: FreeToolId; label: string; hint: string }[] = [
  { id: 'cutout_person', label: 'Cut out a person', hint: 'Removes the background around a person, on your device.' },
  { id: 'enhance', label: 'Auto-enhance', hint: 'Evens out brightness and lifts colour.' },
  { id: 'sharpen', label: 'Sharpen', hint: 'Makes edges and text in the picture crisper.' },
];

/** Free, in-browser. Returns a PNG data URL. */
export async function runFreeTool(id: FreeToolId, img: DrawableImage): Promise<string> {
  if (id === 'sharpen') return pixelsToPng(sharpenPixels(readPixels(toCanvas(img, 4096))));
  if (id === 'enhance') return pixelsToPng(autoEnhancePixels(readPixels(toCanvas(img, 4096))));
  const canvas = toCanvas(img, 4096);
  const { createMediaPipeSegmenter } = await import('@ohb/shared/personalization/preview/cutout/segmenter');
  const segmenter = await createMediaPipeSegmenter();
  try {
    const mask = refineMask(segmenter.segment(canvas), { feather: 0.3, shift: 0.1 });
    return pixelsToPng(applyMaskAlpha(readPixels(canvas), mask));
  } finally {
    segmenter.close();
  }
}

/** Optional AI operations from the personalization image editor that suit a thumbnail picture. */
export const AI_TOOL_IDS: EditorOperationId[] = [
  'remove_background',
  'replace_background',
  'generate_background',
  'transparent_cutout',
  'remove_object',
  'remove_people',
  'enhance',
  'relight',
  'sharpen',
  'restore',
  'portrait_enhance',
  'logo_cleanup',
  'logo_transparent',
];

export function aiToolLabel(id: EditorOperationId): string {
  return IMAGE_EDIT_OPERATIONS[id]?.label || id;
}

/** Optional, uses the user's OpenAI key. Returns a data URL. */
export async function runAiTool(id: EditorOperationId, img: DrawableImage, note = ''): Promise<string> {
  const op = IMAGE_EDIT_OPERATIONS[id];
  if (!op) throw new Error('That AI tool is not available.');
  const transparent = !!op.transparency || id === 'remove_background';
  const results = await editSmartVideoGoImage({
    operation: id,
    prompt: [op.prompt, note.trim()].filter(Boolean).join(' '),
    image: await imageToPngBlob(img),
    model: 'gpt-image-2.6-flare',
    quality: 'medium',
    size: 'auto',
    outputFormat: 'png',
    background: transparent ? 'transparent' : 'auto',
    inputFidelity: 'high',
  });
  const first = results[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first?.url) return fileToDataUrl(await (await fetch(first.url)).blob());
  throw new Error('The AI edit did not come back. Try again, or use a free tool.');
}
