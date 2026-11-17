import { NextRequest, NextResponse } from '../../../../shims/next-server';
import { auth } from '../../../../shims/clerk-server';
import { getOpenAiKeyForUser } from '../../../../src/lib/openaiKeyServer';
import {
  OPENAI_BASE,
  UPSTREAM_TIMEOUT_MS,
  errorJson,
  gptImageSize,
  loadImage,
  readUpstream,
  toUrls,
  upstreamError,
  edits,
  extraFields,
  type ExtraImageOptions,
  type ImagePart,
} from '../../../../src/lib/openaiImageApi';
import { parseImageOptions } from '../../../../src/lib/openaiImageOptions';

/**
 * Thumbnail generation for the Social Publish modal (opened from every studio).
 *
 * This route used to forward to `generate-thumbnail` / `refine-thumbnail`
 * edge functions that were never added to the repo, so every request failed.
 * It now calls the OpenAI Images API directly with the signed-in user's key:
 *
 *   - `generate` with no reference images  -> images/generations
 *   - `generate` with reference images     -> images/edits (references as image[])
 *   - `refine`                             -> images/edits on the chosen thumbnail
 *
 * The response shape (`urls`, `request_id`, `revised_prompt`) is what
 * `src/shared/api/thumbnailService.ts` already reads.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REFERENCES = 4;

// Images 2.6 ships as two models: sunburst (base) and flare (smaller, faster).
const GPT_IMAGE_MODELS = new Set(['gpt-image-2.6-sunburst', 'gpt-image-2.6-flare', 'gpt-image-2', 'gpt-image-1', 'gpt-image-1.5', 'gpt-image-1-mini']);
const DEFAULT_MODEL = 'gpt-image-2';

type Action = 'generate' | 'refine';

/** GPT Image 2 has no xhigh/max: map them to the best level it supports when falling back from Images 2.6. */
function fallbackQuality(q: string): string {
  return q === 'xhigh' || q === 'max' ? 'high' : q;
}

/** True when OpenAI says the requested model does not exist / is not available to this key. */
async function isModelUnavailable(res: NextResponse): Promise<boolean> {
  if (res.status === 404) return true;
  try {
    const body = (await res.clone().json()) as { error?: string };
    return /model/i.test(body.error || '') && /(not exist|not found|not available|access|invalid|unsupported)/i.test(body.error || '');
  } catch {
    return false;
  }
}

function dalle3Size(aspectRatio: string): string {
  switch (aspectRatio) {
    case '16:9':
    case '3:2':
    case '4:3':
      return '1792x1024';
    case '9:16':
    case '4:5':
    case '2:3':
    case '3:4':
      return '1024x1792';
    default:
      return '1024x1024';
  }
}

function clampCount(n: unknown): number {
  const value = Number(n);
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Math.round(value), 1), 4);
}

/** Draft/standard/high map to the classic levels; xhigh, max and auto pass through for gpt-image models. */
function normalizeQuality(q: unknown): string {
  return q === 'low' || q === 'high' || q === 'xhigh' || q === 'max' || q === 'auto' ? q : 'medium';
}

function buildPrompt(body: Record<string, any>, aspectRatio: string): string {
  const parts: string[] = [];
  const base = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (base) parts.push(base);
  parts.push(`Composition: a ${aspectRatio} social media thumbnail.`);
  // ThumbnailStep already folds headline/subheadline into the prompt; only add
  // them here when a caller sends them without doing that.
  if (typeof body.headline === 'string' && body.headline.trim() && !base.includes(body.headline.trim())) {
    parts.push(`Render the headline text "${body.headline.trim()}" in large, legible type.`);
  }
  if (typeof body.subheadline === 'string' && body.subheadline.trim() && !base.includes(body.subheadline.trim())) {
    parts.push(`Smaller supporting text: "${body.subheadline.trim()}".`);
  }
  return parts.join(' ').slice(0, 30_000);
}

async function generations(key: string, model: string, prompt: string, aspectRatio: string, n: number, quality: string, extra?: ExtraImageOptions) {
  if (model === 'dall-e-3') {
    // dall-e-3 only returns one image per request.
    const calls = Array.from({ length: n }, () =>
      fetch(`${OPENAI_BASE}/images/generations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: prompt.slice(0, 4000),
          n: 1,
          size: dalle3Size(aspectRatio),
          quality: ['high', 'xhigh', 'max'].includes(quality) ? 'hd' : 'standard',
          response_format: 'b64_json',
        }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }),
    );
    const responses = await Promise.all(calls);
    const urls: string[] = [];
    let revised: string | undefined;
    for (const res of responses) {
      const payload = await readUpstream(res);
      if (!res.ok) return { error: upstreamError(res, payload) };
      const out = toUrls(payload);
      urls.push(...out.urls);
      revised = revised || out.revised;
    }
    return { urls, revised };
  }

  const res = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, n, size: extra?.size || gptImageSize(aspectRatio), quality, ...extraFields(model, extra) }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const payload = await readUpstream(res);
  if (!res.ok) return { error: upstreamError(res, payload) };
  return toUrls(payload);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return errorJson('UNAUTHENTICATED', 401);


  const key = await getOpenAiKeyForUser();
  if (!key) {
    return errorJson('Add your OpenAI API key in Settings to generate thumbnails.', 400);
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return errorJson('Invalid JSON body', 400);
  }

  const action: Action = body.action === 'refine' ? 'refine' : 'generate';
  const aspectRatio = typeof body.aspect_ratio === 'string' ? body.aspect_ratio : '16:9';
  const n = clampCount(body.n);
  const parsed = parseImageOptions(body);
  if (parsed.error) return errorJson(parsed.error, 400);
  const extra: ExtraImageOptions = {
    size: parsed.options.size,
    complexity: parsed.options.complexity,
    background: parsed.options.background,
    outputFormat: parsed.options.outputFormat,
    outputCompression: parsed.options.outputCompression,
  };
  let quality = normalizeQuality(body.quality);
  const requestedModel = typeof body.model === 'string' ? body.model : DEFAULT_MODEL;

  const prompt = action === 'refine'
    ? (typeof body.prompt === 'string' ? body.prompt.trim() : '')
    : buildPrompt(body, aspectRatio);
  if (!prompt) return errorJson('A prompt is required', 400);

  // Images that shape the result: the thumbnail being refined, or the
  // reference images (studio output, uploads) for a fresh generation.
  const sources: string[] = [];
  if (action === 'refine') {
    if (typeof body.image_url !== 'string' || !body.image_url) {
      return errorJson('image_url is required to refine a thumbnail', 400);
    }
    sources.push(body.image_url);
  } else {
    if (typeof body.image_url === 'string' && body.image_url) sources.push(body.image_url);
    if (Array.isArray(body.reference_urls)) {
      for (const ref of body.reference_urls) if (typeof ref === 'string' && ref) sources.push(ref);
    }
  }
  const uniqueSources = Array.from(new Set(sources)).slice(0, MAX_REFERENCES);
  // Optional mask for inpainting (refine only): a PNG data URL, transparent where the edit applies.
  const maskSource = action === 'refine' && typeof body.mask_url === 'string' && body.mask_url ? body.mask_url : '';
  if (maskSource && !maskSource.startsWith('data:image/png')) return errorJson('The edit mask must be a PNG image', 400);

  // Optional Images 2.6 markup layer (refine only): a transparent PNG drawn over the picture being edited.
  const markupSource = action === 'refine' && typeof body.markup_url === 'string' && body.markup_url ? body.markup_url : '';
  if (markupSource) {
    if (!markupSource.startsWith('data:image/png')) return errorJson('The markup layer must be a PNG image', 400);
    if (maskSource) return errorJson('Use either a painted area or a drawing, not both.', 400);
    if (!/^gpt-image-2\.6-/.test(typeof body.model === 'string' ? body.model : '')) {
      return errorJson('Drawing edits need an Images 2.6 model.', 400);
    }
  }

  // Image editing needs a gpt-image model; dall-e-3 can only generate from text.
  let model = requestedModel === 'dall-e-3' || GPT_IMAGE_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;
  if (uniqueSources.length > 0 && model === 'dall-e-3') model = DEFAULT_MODEL;

  let fellBackFrom: string | undefined;
  try {
    let result: { urls?: string[]; revised?: string; error?: NextResponse };
    if (uniqueSources.length > 0) {
      let images: ImagePart[];
      try {
        images = await Promise.all(uniqueSources.map((src, i) => loadImage(src, i)));
      } catch (err: any) {
        return errorJson(err?.message || 'Could not read a reference image', 400);
      }
      let mask: ImagePart | undefined;
      if (maskSource) {
        try {
          mask = await loadImage(maskSource, 99);
        } catch (err: any) {
          return errorJson(err?.message || 'Could not read the edit mask', 400);
        }
      }
      let markup: ImagePart | undefined;
      if (markupSource) {
        try {
          markup = await loadImage(markupSource, 98);
        } catch (err: any) {
          return errorJson(err?.message || 'Could not read the markup layer', 400);
        }
      }
      result = await edits(key, model, prompt, aspectRatio, n, quality, images, mask, extra, markup);
      if (result.error && markup && model !== DEFAULT_MODEL && (await isModelUnavailable(result.error))) {
        // GPT Image 2 has no markup layer, so a silent fallback would ignore the drawing.
        return errorJson('Your OpenAI key cannot use Images 2.6 yet, and drawing edits need it. Use "Paint an area" or "Describe" instead.', 400);
      }
      if (result.error && model !== DEFAULT_MODEL && (await isModelUnavailable(result.error))) {
        fellBackFrom = model;
        model = DEFAULT_MODEL;
        quality = fallbackQuality(quality);
        result = await edits(key, model, prompt, aspectRatio, n, quality, images, mask, extra);
      }
    } else {
      result = await generations(key, model, prompt, aspectRatio, n, quality, extra);
      if (result.error && model !== DEFAULT_MODEL && (await isModelUnavailable(result.error))) {
        fellBackFrom = model;
        model = DEFAULT_MODEL;
        quality = fallbackQuality(quality);
        result = await generations(key, model, prompt, aspectRatio, n, quality, extra);
      }
    }

    if (result.error) return result.error;
    if (!result.urls || result.urls.length === 0) {
      return errorJson('The image service returned no thumbnails. Try again.', 502);
    }

    return NextResponse.json({
      urls: result.urls,
      request_id: `thumb_${Date.now().toString(36)}`,
      revised_prompt: result.revised,
      model,
      ...(fellBackFrom ? { fallback_from: fellBackFrom } : {}),
    });
  } catch (err: any) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return errorJson(timedOut ? 'Thumbnail generation timed out. Try again.' : (err?.message || 'Internal server error'), timedOut ? 504 : 500);
  }
}
