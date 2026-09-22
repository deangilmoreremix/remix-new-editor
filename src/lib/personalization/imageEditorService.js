import { ThumbnailService } from '../thumbnailService.js';
import {
  getAssetRecipe,
  getOperation,
  resolveEditorAssetKind,
} from './imageEditRegistry.js';

function stripDataUrl(value) {
  if (typeof value !== 'string') return '';
  const match = value.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  return match ? match[1] : '';
}

function buildReferenceArgs(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return {};
  const b64 = stripDataUrl(imageUrl);
  return b64 ? { referenceImageB64: b64 } : { referenceImageUrl: imageUrl };
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
      const result = await this.thumbnailService.inpaint({
        prompt,
        imageB64,
        maskB64,
        aspectRatio: this.aspectRatio,
        model,
        size,
        ...controls,
        referenceImageB64: referenceImages.map(stripDataUrl).filter(Boolean),
        apiKey: this.apiKey,
      });
      return normalizeRefineResult(result, controls.outputFormat || 'png');
    }

    const referenceArgs = buildReferenceArgs(imageUrl);
    const extraReferences = referenceImages
      .map((url) => stripDataUrl(url) || url)
      .filter(Boolean);

    if (referenceArgs.referenceImageB64) {
      referenceArgs.referenceImageB64 = [
        referenceArgs.referenceImageB64,
        ...extraReferences.map((value) => stripDataUrl(value) || value),
      ];
    } else if (referenceArgs.referenceImageUrl) {
      referenceArgs.referenceImageUrl = [
        referenceArgs.referenceImageUrl,
        ...extraReferences,
      ];
    }

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

    const refArgs = previousResponseId ? {} : buildReferenceArgs(imageUrl);
    if (!previousResponseId && referenceImages.length) {
      if (refArgs.referenceImageB64) {
        refArgs.referenceImageB64 = [
          refArgs.referenceImageB64,
          ...referenceImages.map(stripDataUrl).filter(Boolean),
        ];
      } else {
        refArgs.referenceImageUrl = [
          ...(refArgs.referenceImageUrl ? [refArgs.referenceImageUrl] : []),
          ...referenceImages.filter((x) => typeof x === 'string' && x),
        ];
      }
    }

    return this.thumbnailService.refineLastImage({
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
    const refArgs = previousResponseId ? {} : buildReferenceArgs(imageUrl);

    if (!previousResponseId && referenceImages.length) {
      if (refArgs.referenceImageB64) {
        refArgs.referenceImageB64 = [
          refArgs.referenceImageB64,
          ...referenceImages.map(stripDataUrl).filter(Boolean),
        ];
      } else {
        refArgs.referenceImageUrl = [
          ...(refArgs.referenceImageUrl ? [refArgs.referenceImageUrl] : []),
          ...referenceImages.filter((x) => typeof x === 'string' && x),
        ];
      }
    }

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
      }).catch((error) => {
        callbacks.onError?.(error);
        finish(reject, error);
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
