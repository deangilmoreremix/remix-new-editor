import { NextResponse } from '../../shims/next-server';
import { checkDestination, createPinnedFetch } from './networkSafety';

/**
 * Shared helpers for calling the OpenAI Images API with the signed-in user's key:
 * reference-image loading (SSRF-guarded), response parsing and error mapping.
 * Used by the thumbnail and storyboard routes.
 */

export const OPENAI_BASE = 'https://api.openai.com/v1';
export const UPSTREAM_TIMEOUT_MS = 180_000;
export const REFERENCE_TIMEOUT_MS = 15_000;
export const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;

export function errorJson(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** gpt-image models take three sizes; pick the one closest to the requested ratio. */
export function gptImageSize(aspectRatio: string): string {
  switch (aspectRatio) {
    case '16:9':
    case '3:2':
    case '4:3':
      return '1536x1024';
    case '9:16':
    case '4:5':
    case '2:3':
    case '3:4':
      return '1024x1536';
    default:
      return '1024x1024';
  }
}

export type ImagePart = { blob: Blob; filename: string };

function extensionFor(type: string): string {
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('webp')) return 'webp';
  return 'png';
}

/** Decodes a data: URL or downloads a public https image (SSRF-guarded). */
export async function loadImage(source: string, index: number): Promise<ImagePart> {
  if (source.startsWith('data:image/')) {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(source);
    if (!match) throw new Error('Reference image is not a valid data URL');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > MAX_REFERENCE_BYTES) throw new Error('Reference image is too large (20MB max)');
    const type = match[1].toLowerCase();
    return { blob: new Blob([buffer], { type }), filename: `reference-${index}.${extensionFor(type)}` };
  }

  const destination = await checkDestination(source, {});
  if (!destination.ok || destination.protocol !== 'https:') {
    throw new Error('Reference image URL is not allowed');
  }
  const pinnedFetch = createPinnedFetch(destination);
  const res = (await pinnedFetch(destination.url, {
    method: 'GET',
    headers: { Accept: 'image/*' },
    signal: AbortSignal.timeout(REFERENCE_TIMEOUT_MS),
  })) as Response;
  if (!res.ok) throw new Error(`Could not download reference image (${res.status})`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!type.startsWith('image/')) throw new Error('Reference URL did not return an image');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_REFERENCE_BYTES) throw new Error('Reference image is too large (20MB max)');
  return { blob: new Blob([buffer], { type }), filename: `reference-${index}.${extensionFor(type)}` };
}

export type OpenAiImageResponse = {
  data?: { url?: string; b64_json?: string; revised_prompt?: string }[];
  error?: { message?: string; code?: string };
  output_format?: string;
};

export function toUrls(payload: OpenAiImageResponse): { urls: string[]; revised?: string } {
  const format = payload.output_format || 'png';
  const urls: string[] = [];
  let revised: string | undefined;
  for (const item of payload.data || []) {
    if (item.b64_json) urls.push(`data:image/${format};base64,${item.b64_json}`);
    else if (item.url) urls.push(item.url);
    if (!revised && item.revised_prompt) revised = item.revised_prompt;
  }
  return { urls, revised };
}

export async function readUpstream(res: Response): Promise<OpenAiImageResponse> {
  const text = await res.text();
  try {
    return JSON.parse(text) as OpenAiImageResponse;
  } catch {
    return { error: { message: text.slice(0, 300) || `OpenAI error ${res.status}` } };
  }
}

export function upstreamError(res: Response, payload: OpenAiImageResponse) {
  if (payload.error?.code === 'moderation_blocked') {
    return errorJson('Content moderation blocked this request. Please revise the prompt.', 400);
  }
  const message = payload.error?.message || `OpenAI image error (${res.status})`;
  // 401 from OpenAI means the stored key is wrong, not that the user is signed out.
  const status = res.status === 401 ? 400 : res.status;
  return errorJson(res.status === 401 ? 'Your OpenAI API key was rejected. Update it in Settings.' : message, status);
}

/** Extra controls beyond prompt/size/quality (all optional; see src/lib/openaiImageOptions.ts). */
export interface ExtraImageOptions {
  size?: string;
  complexity?: string;
  background?: string;
  outputFormat?: string;
  outputCompression?: number;
}

/** Fields shared by generations (JSON) and edits (multipart). `complexity` exists only on Images 2.6. */
export function extraFields(model: string, extra?: ExtraImageOptions): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!extra) return out;
  if (extra.complexity && /^gpt-image-2\.6-/.test(model)) out.complexity = extra.complexity;
  if (extra.background) out.background = extra.background;
  if (extra.outputFormat) out.output_format = extra.outputFormat;
  if (extra.outputCompression !== undefined) out.output_compression = extra.outputCompression;
  return out;
}

export async function edits(key: string, model: string, prompt: string, aspectRatio: string, n: number, quality: string, images: ImagePart[], mask?: ImagePart, extra?: ExtraImageOptions, markup?: ImagePart) {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('n', String(n));
  form.append('size', extra?.size || gptImageSize(aspectRatio));
  form.append('quality', quality);
  for (const [k, v] of Object.entries(extraFields(model, extra))) form.append(k, String(v));
  for (const image of images) form.append('image[]', image.blob, image.filename);
  // Transparent pixels in the mask mark the region to repaint.
  if (mask) form.append('mask', mask.blob, mask.filename);
  // Images 2.6 markup layer: a transparent PNG of arrows/notes drawn over the first image (cannot be combined with a mask).
  if (markup) form.append('markup', markup.blob, markup.filename);

  const res = await fetch(`${OPENAI_BASE}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const payload = await readUpstream(res);
  if (!res.ok) return { error: upstreamError(res, payload) };
  return toUrls(payload);
}

