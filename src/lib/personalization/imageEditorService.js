import { ThumbnailService } from '../thumbnailService.js';
import { personalizationApiError } from './apiErrors.js';
import {
  getAssetRecipe,
  getOperation,
  resolveEditorAssetKind,
} from './imageEditRegistry.js';

async function getPersonalizerSession() {
  try {
    const { supabase } = await import('../supabase.js');
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
}

export async function preparePersonalizationImageDataUrl(sourceUrl) {
  if (typeof sourceUrl !== 'string' || !sourceUrl) throw new Error('Image source is required.');
  if (sourceUrl.startsWith('data:image/')) return sourceUrl;

  const session = await getPersonalizerSession();
  if (!session?.access_token) throw new Error('Sign in to prepare this image for editing.');

  const response = await fetch('/api/personalizer/download-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ sourceUrl }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw personalizationApiError(response, payload, 'Image preparation failed.');
  if (!payload?.image?.dataUrl) throw new Error('Image preparation returned no image data.');
  return payload.image.dataUrl;
}

function stripDataUrl(value) {
  if (typeof value !== 'string') return '';
  const match = value.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  return match ? match[1] : '';
}

export function partitionImageReferences(primaryImageUrl, referenceImages = [], limit = 6) {
  const max = Math.max(1, Math.min(6, Number(limit) || 6));
  const ordered = [primaryImageUrl, ...(Array.isArray(referenceImages) ? referenceImages : [])]
    .filter((value) => typeof value === 'string' && value.trim());

  const unique = [];
  const seen = new Set();
  for (const value of ordered) {
    const trimmed = value.trim();
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
    if (unique.length >= max) break;
  }

  const b64 = [];
  const urls = [];
  for (const value of unique) {
    const encoded = stripDataUrl(value);
    if (encoded) b64.push(encoded);
    else urls.push(value);
  }

  return {
    ...(b64.length ? { referenceImageB64: b64.length === 1 ? b64[0] : b64 } : {}),
    ...(urls.length ? { referenceImageUrl: urls.length === 1 ? urls[0] : urls } : {}),
  };
}

function resultImageDataUrl(result, fallbackFormat = 'png') {
  if (result?.imageDataUrl) return result.imageDataUrl;
  if (result?.b64_json) return `data:image/${fallbackFormat};base64,${result.b64_json}`;
  if (result?.dataUrl) return result.dataUrl;
  if (result?.url) return result.url;
  return '';
}

function normalizeRefineResult(result, fallbackFormat = 'png') {
  if (!result) return null;
  return {
    ...result,
    imageDataUrl: resultImageDataUrl(result, fallbackFormat),
    responseId: result.responseId || result.response_id || null,
    revisedPrompt: result.revisedPrompt || result.revised_prompt || null,
    imageGenerationCallId: result.imageGenerationCallId || result.image_generation_call_id || null,
  };
}

function compactList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String)));
}

function contextLines(context = {}) {
  const lines = [];
  if (context.businessName) lines.push(`Business: ${context.businessName}`);
  if (context.industry) lines.push(`Industry: ${context.industry}`);
  if (context.productService) lines.push(`Product/service: ${context.productService}`);
  if (context.brandDescription) lines.push(`Brand: ${context.brandDescription}`);
  if (context.targetRole) lines.push(`Target video role: ${context.targetRole}`);
  if (Array.isArray(context.preserve) && context.preserve.length) {
    lines.push(`PRESERVE: ${compactList(context.preserve).join(', ')}`);
  }
  return lines;
}

export function buildPersonalizationEditPrompt({
  operationId = 'custom',
  customPrompt = '',
  category,
  role,
  visionAnalysis,
  businessContext = {},
} = {}) {
  const operation = getOperation(operationId);
  if (!operation) throw new Error(`Unknown personalization image operation: ${operationId}`);

  const recipe = getAssetRecipe(category, role);
  const preserve = compactList([
    ...(recipe?.preserve || []),
    ...(visionAnalysis?.preserve || []),
    ...(businessContext.preserve || []),
  ]);

  const targetRole = businessContext.targetRole || visionAnalysis?.targetRole || recipe?.outputRole || '';
  const lines = [
    operation.prompt,
    customPrompt ? `USER REQUEST: ${customPrompt}` : '',
    ...contextLines({ ...businessContext, targetRole, preserve }),
    'Keep everything not explicitly requested to change as close to the source as possible.',
  ].filter(Boolean);

  return lines.join('\n');
}

export function resolvePersonalizationEditControls({
  operationId = 'custom',
  category,
  role,
  visionAnalysis,
  quality,
  outputFormat,
  outputCompression,
  background,
  inputFidelity,
} = {}) {
  const operation = getOperation(operationId);
  if (!operation) throw new Error(`Unknown personalization image operation: ${operationId}`);
  const recipe = getAssetRecipe(category, role);

  const precision = Boolean(
    operation.precision ||
    recipe?.precisionRecommended ||
    visionAnalysis?.precisionRecommended
  );
  const transparent = Boolean(
    operation.transparency ||
    recipe?.transparencyRecommended ||
    visionAnalysis?.transparencyRecommended
  );

  return {
    quality: quality || (precision ? 'high' : 'medium'),
    outputFormat: outputFormat || (transparent ? 'png' : 'webp'),
    outputCompression: typeof outputCompression === 'number' ? outputCompression : 90,
    background: background || (transparent ? 'transparent' : 'auto'),
    inputFidelity: inputFidelity || (precision ? 'high' : undefined),
    imageDetail: precision ? 'high' : 'auto',
  };
}

export class PersonalizationImageEditorService {
  constructor({ aspectRatio = '16:9', userId = '', apiKey = '' } = {}) {
    this.aspectRatio = aspectRatio;
    this.userId = userId;
    this.apiKey = apiKey;
    this.thumbnailService = new ThumbnailService({
      templateId: 'personalization-asset',
      templateName: 'Personalization Asset',
      aspectRatio,
      userId,
      altText: 'SmartVideo AI personalization asset',
    });
  }

  async edit({
    imageUrl,
    operationId,
    customPrompt,
    category,
    role,
    visionAnalysis,
    businessContext,
    maskB64,
    model,
    size,
    quality,
    outputFormat,
    outputCompression,
    background,
    inputFidelity,
    referenceImages = [],
  }) {
    if (!imageUrl) throw new Error('imageUrl is required');

    const prompt = buildPersonalizationEditPrompt({
      operationId,
      customPrompt,
      category,
      role,
      visionAnalysis,
      businessContext,
    });
    const controls = resolvePersonalizationEditControls({
      operationId,
      category,
      role,
      visionAnalysis,
      quality,
      outputFormat,
      outputCompression,
      background,
      inputFidelity,
    });

    if (maskB64) {
      const imageB64 = stripDataUrl(imageUrl);
      if (!imageB64) throw new Error('Masked edits require a base64/data URL source image');

      const preparedRefs = [];
      for (const reference of referenceImages.slice(0, 5)) {
        if (typeof reference !== 'string' || !reference.trim()) continue;
        const dataUrl = reference.startsWith('data:image/')
          ? reference
          : await preparePersonalizationImageDataUrl(reference);
        const encoded = stripDataUrl(dataUrl);
        if (encoded) preparedRefs.push(encoded);
      }

      const result = await this.thumbnailService.inpaint({
        prompt,
        imageB64,
        maskB64,
        aspectRatio: this.aspectRatio,
        model,
        size,
        ...controls,
        ...(preparedRefs.length ? { referenceImageB64: preparedRefs } : {}),
        apiKey: this.apiKey,
      });
      return normalizeRefineResult(result, controls.outputFormat || 'png');
    }

    const referenceArgs = partitionImageReferences(imageUrl, referenceImages, 6);

    const result = await this.thumbnailService.refineLastImage({
      prompt,
      previousResponseId: '',
      imageAction: 'edit',
      model,
      size,
      ...controls,
      ...referenceArgs,
      apiKey: this.apiKey,
    });
    return normalizeRefineResult(result, controls.outputFormat || 'png');
  }

  async smartEdit({
    imageUrl,
    prompt,
    previousResponseId = '',
    businessContext = {},
    category,
    role,
    visionAnalysis,
    model,
    size,
    quality,
    outputFormat,
    outputCompression,
    background,
    inputFidelity,
    referenceImages = [],
  }) {
    if (!prompt || !String(prompt).trim()) throw new Error('prompt is required');

    const recipe = getAssetRecipe(category, role);
    const preserve = compactList([
      ...(recipe?.preserve || []),
      ...(visionAnalysis?.preserve || []),
      ...(businessContext.preserve || []),
    ]);
    const enrichedPrompt = [
      String(prompt).trim(),
      ...contextLines({
        ...businessContext,
        targetRole: businessContext.targetRole || visionAnalysis?.targetRole || recipe?.outputRole,
        preserve,
      }),
    ].filter(Boolean).join('\n');

    const controls = resolvePersonalizationEditControls({
      operationId: 'custom',
      category,
      role,
      visionAnalysis,
      quality,
      outputFormat,
      outputCompression,
      background,
      inputFidelity,
    });

    const refArgs = previousResponseId
      ? {}
      : partitionImageReferences(imageUrl, referenceImages, 6);

    const result = await this.thumbnailService.refineLastImage({
      prompt: enrichedPrompt,
      previousResponseId,
      imageAction: 'edit',
      model,
      size,
      ...controls,
      ...refArgs,
      apiKey: this.apiKey,
    });
    return normalizeRefineResult(result, controls.outputFormat || 'png');
  }

  async smartEditStream(options, callbacks = {}) {
    const {
      imageUrl,
      prompt,
      previousResponseId = '',
      businessContext = {},
      category,
      role,
      visionAnalysis,
      referenceImages = [],
      ...controlsInput
    } = options || {};

    if (!prompt || !String(prompt).trim()) throw new Error('prompt is required');

    const recipe = getAssetRecipe(category, role);
    const preserve = compactList([
      ...(recipe?.preserve || []),
      ...(visionAnalysis?.preserve || []),
      ...(businessContext.preserve || []),
    ]);
    const enrichedPrompt = [
      String(prompt).trim(),
      ...contextLines({
        ...businessContext,
        targetRole: businessContext.targetRole || visionAnalysis?.targetRole || recipe?.outputRole,
        preserve,
      }),
    ].filter(Boolean).join('\n');

    const controls = resolvePersonalizationEditControls({
      operationId: 'custom',
      category,
      role,
      visionAnalysis,
      ...controlsInput,
    });
    const refArgs = previousResponseId
      ? {}
      : partitionImageReferences(imageUrl, referenceImages, 6);

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        fn(value);
      };

      this.thumbnailService.refineLastImageStream({
        prompt: enrichedPrompt,
        previousResponseId,
        imageAction: 'edit',
        ...controlsInput,
        ...controls,
        ...refArgs,
        partialImages: controlsInput.partialImages ?? 2,
        apiKey: this.apiKey,
      }, {
        onPartial: (b64) => {
          callbacks.onPartial?.(`data:image/png;base64,${b64}`);
        },
        onDone: (result) => {
          const normalized = normalizeRefineResult(result, controls.outputFormat || 'png');
          callbacks.onDone?.(normalized);
          finish(resolve, normalized);
        },
        onError: (error) => {
          callbacks.onError?.(error);
          finish(reject, error instanceof Error ? error : new Error(String(error)));
        },
      }).then(() => {
        if (!settled) {
          const error = new Error('Smart Edit stream ended without a final image.');
          callbacks.onError?.(error);
          finish(reject, error);
        }
      }).catch((error) => {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        callbacks.onError?.(normalizedError);
        finish(reject, normalizedError);
      });
    });
  }
}

export function getPersonalizationAssetEditorSummary({ category, role } = {}) {
  const kind = resolveEditorAssetKind(category, role);
  const recipe = getAssetRecipe(category, role);
  return {
    kind,
    recipe,
    preserve: [...(recipe?.preserve || [])],
    recommendedOperations: [...(recipe?.recommended || [])],
  };
}
