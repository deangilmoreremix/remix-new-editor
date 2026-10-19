import {
  IMAGE_EDIT_OPERATIONS,
  getAssetRecipe,
  getOperation,
  getSourceAssetRecipe,
  resolveEditorAssetKind,
} from './imageEditRegistry.js';
import { PersonalizationImageEditorService } from './imageEditorService.js';
import {
  analyzePersonalizationImages,
  validatePersonalizationImageEdit,
} from './visionService.js';

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function categoryForAsset(asset, analysis) {
  if (analysis?.confidence >= 75 && analysis.category) return analysis.category;
  return asset?.sourceCategory || asset?.category || 'general';
}

export function selectVideoReadySteps({ category, role, visionAnalysis } = {}) {
  const recipe = getAssetRecipe(category, role);
  const kind = resolveEditorAssetKind(category, role);

  const visionSteps = (visionAnalysis?.recommendedOperations || [])
    .filter((id) => Object.prototype.hasOwnProperty.call(IMAGE_EDIT_OPERATIONS, id))
    .filter((id) => {
      const operation = IMAGE_EDIT_OPERATIONS[id];
      return (
        id !== 'custom' &&
        id !== 'video_ready' &&
        !operation.destructiveCreative &&
        (!operation.applicableTo || operation.applicableTo.includes(kind))
      );
    })
    .slice(0, 3);

  const recipeSteps = recipe?.makeVideoReadySteps?.length
    ? recipe.makeVideoReadySteps
    : ['video_ready'];

  return unique([...visionSteps, ...recipeSteps]).slice(0, 4);
}

function imageResultToUrl(result, outputFormat = 'png') {
  if (result?.b64_json) return `data:image/${outputFormat};base64,${result.b64_json}`;
  if (result?.url) return result.url;
  throw new Error('Image edit returned no usable image.');
}

export async function makePersonalizationAssetVideoReady(
  asset,
  {
    businessContext = {},
    targetVideoFormat = '',
    editorService,
    onStep,
    requireVisionQa = true,
  } = {},
) {
  if (!asset?.url) throw new Error('Asset URL is required.');

  const originalImageUrl = asset.originalUrl || asset.url;
  let analysis = asset.visionAnalysis || null;

  if (!analysis) {
    onStep?.({ phase: 'vision', step: 0, total: 1, label: 'SmartVideo AI Vision analysis' });
    const analyses = await analyzePersonalizationImages({
      images: [{
        id: asset.id || 'asset',
        imageUrl: asset.url,
        categoryHint: asset.sourceCategory || asset.category,
        roleHint: asset.role,
      }],
      businessContext,
      targetVideoFormat,
    });
    analysis = analyses[0] || null;
  }

  const category = categoryForAsset(asset, analysis);
  const role = asset.role;
  const recipe = getAssetRecipe(category, role);
  const sourceRecipe = getSourceAssetRecipe(category, role);
  const steps = selectVideoReadySteps({ category, role, visionAnalysis: analysis });
  const preserve = unique([
    ...(sourceRecipe?.preserve || []),
    ...(recipe?.preserve || []),
    ...(analysis?.preserve || []),
  ]);

  const service = editorService || new PersonalizationImageEditorService({
    aspectRatio: targetVideoFormat || '16:9',
  });

  let currentUrl = asset.url;
  let finalPrompt = '';
  let finalOperation = 'video_ready';
  let transparent = Boolean(recipe?.transparencyRecommended || analysis?.transparencyRecommended);

  for (let index = 0; index < steps.length; index += 1) {
    const operationId = steps[index];
    const operation = getOperation(operationId);
    if (!operation) continue;
    finalOperation = operationId;
    transparent = transparent || Boolean(operation.transparency);

    onStep?.({
      phase: 'edit',
      step: index + 1,
      total: steps.length,
      label: operation.label,
      operationId,
    });

    finalPrompt = [
      'Automatic SmartVideo AI Make Video Ready workflow.',
      analysis?.issues?.length
        ? `Address these diagnosed issues when relevant: ${analysis.issues.join(', ')}.`
        : '',
      preserve.length ? `Vision protection: ${preserve.join(', ')}.` : '',
      'Do not make creative changes that are not required by the asset recipe.',
    ].filter(Boolean).join(' ');

    const result = await service.edit({
      imageUrl: currentUrl,
      operationId,
      customPrompt: finalPrompt,
      category,
      role,
      visionAnalysis: analysis,
      businessContext: {
        ...businessContext,
        targetRole: recipe?.outputRole,
        preserve,
      },
      quality: operation.precision || recipe?.precisionRecommended || analysis?.precisionRecommended
        ? 'high'
        : 'medium',
      outputFormat: 'png',
      background: transparent ? 'transparent' : 'auto',
      inputFidelity: operation.precision || recipe?.precisionRecommended || analysis?.precisionRecommended
        ? 'high'
        : undefined,
    });

    currentUrl = imageResultToUrl(result, 'png');
  }

  let validation = null;
  if (requireVisionQa) {
    onStep?.({
      phase: 'qa',
      step: steps.length,
      total: steps.length,
      label: 'SmartVideo AI Vision QA',
    });

    validation = await validatePersonalizationImageEdit({
      originalImageUrl,
      editedImageUrl: currentUrl,
      preserve,
      intendedOperation: 'Make Video Ready',
      businessContext,
    });

    if (!validation.passed) {
      const error = new Error(
        `Vision QA needs review: ${validation.issues?.join(' • ') || validation.summary || 'preservation issue detected'}`,
      );
      error.code = 'VISION_QA_REVIEW_REQUIRED';
      error.validation = validation;
      error.editedImageUrl = currentUrl;
      throw error;
    }
  }

  return {
    ...asset,
    url: currentUrl,
    originalUrl: asset.originalUrl || asset.url,
    edited: currentUrl !== (asset.originalUrl || asset.url),
    videoReady: true,
    hasTransparency: transparent,
    visionAnalysis: analysis,
    visionValidation: validation,
    editMetadata: {
      ...(asset.editMetadata || {}),
      operation: 'video_ready',
      lastOperation: finalOperation,
      prompt: finalPrompt,
      outputFormat: 'png',
      inputFidelity: recipe?.precisionRecommended || analysis?.precisionRecommended ? 'high' : undefined,
    },
    updatedAt: new Date().toISOString(),
  };
}
