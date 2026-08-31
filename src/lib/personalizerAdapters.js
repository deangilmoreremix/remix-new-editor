/**
 * Studio adapter functions for the universal personalizer handoff.
 *
 * Each adapter reads the current state of its studio and returns a
 * serializable `PersonalizableAsset`. Adapters must NOT mutate studio
 * state, store DOM nodes, or serialize large binaries.
 *
 * Usage:
 *   const asset = getVideoStudioAsset({
 *     textarea,
 *     selectedModel,
 *     selectedAr,
 *     selectedDuration,
 *     uploadedImageUrl,
 *     uploadedVideoUrl,
 *     resultVideo,
 *     generationHistory,
 *   });
 */

/**
 * Build a PersonalizableField.
 *
 * @param {Object} opts
 * @param {string} opts.id
 * @param {string} opts.label
 * @param {string} opts.type
 * @param {unknown} opts.value
 * @param {string} [opts.path]
 * @param {boolean} [opts.supportsPersonalization=true]
 * @param {boolean} [opts.readonly]
 * @returns {import('../lib/personalizerHandoff.js').PersonalizableField}
 */
function field({ id, label, type, value, path, supportsPersonalization = true, readonly }) {
  return {
    id: String(id),
    label: String(label),
    type,
    value,
    path: path || undefined,
    supportsPersonalization,
    readonly: readonly || false,
  };
}

/**
 * VideoStudio adapter.
 *
 * Reads from the studio's DOM and state. Only references lightweight
 * selectors and strings; never returns DOM nodes or functions.
 *
 * @param {Object} opts
 * @param {HTMLTextAreaElement} opts.textarea
 * @param {string} [opts.selectedModel]
 * @param {string} [opts.selectedAr]
 * @param {number} [opts.selectedDuration]
 * @param {string} [opts.uploadedImageUrl]
 * @param {string} [opts.uploadedVideoUrl]
 * @param {HTMLVideoElement} [opts.resultVideo]
 * @param {Array<{ url: string }>} [opts.generationHistory]
 * @returns {import('../lib/personalizerHandoff.js').PersonalizableAsset}
 */
export function getVideoStudioAsset({
  textarea,
  selectedModel,
  selectedAr,
  selectedDuration,
  uploadedImageUrl,
  uploadedVideoUrl,
  resultVideo,
  generationHistory = [],
}) {
  const prompt = textarea?.value?.trim() || '';

  // Prefer the currently visible video src; fall back to most recent history.
  let previewUrl = null;
  if (resultVideo?.src && resultVideo.src.startsWith('http')) {
    previewUrl = resultVideo.src;
  } else if (generationHistory.length > 0 && generationHistory[0].url) {
    previewUrl = generationHistory[0].url;
  }

  const fields = [
    field({ id: 'prompt', label: 'Prompt', type: 'text', value: prompt, supportsPersonalization: true }),
    field({ id: 'model', label: 'Model', type: 'text', value: selectedModel || '', supportsPersonalization: false }),
    field({ id: 'aspectRatio', label: 'Aspect Ratio', type: 'text', value: selectedAr || '', supportsPersonalization: false }),
    field({ id: 'duration', label: 'Duration', type: 'number', value: selectedDuration ?? null, supportsPersonalization: false }),
    field({ id: 'uploadedImageUrl', label: 'Start Frame', type: 'url', value: uploadedImageUrl || '', supportsPersonalization: false, readonly: true }),
    field({ id: 'uploadedVideoUrl', label: 'Reference Video', type: 'url', value: uploadedVideoUrl || '', supportsPersonalization: false, readonly: true }),
    field({ id: 'previewUrl', label: 'Preview URL', type: 'url', value: previewUrl || '', supportsPersonalization: false, readonly: true }),
  ];

  return {
    id: 'video-current',
    type: 'video',
    title: prompt.slice(0, 80) || 'Untitled Video',
    previewUrl: previewUrl || undefined,
    fields,
    metadata: {
      studio: 'VideoStudio',
      imageMode: !!uploadedImageUrl,
      v2vMode: !!uploadedVideoUrl,
    },
  };
}

/**
 * ImageStudio adapter.
 *
 * @param {Object} opts
 * @param {HTMLTextAreaElement} opts.textarea
 * @param {string} [opts.selectedModel]
 * @param {string} [opts.selectedAr]
 * @param {string} [opts.negativePrompt]
 * @param {string[]} [opts.uploadedImageUrls]
 * @param {HTMLImageElement} [opts.resultImg]
 * @param {Array<{ url: string }>} [opts.generationHistory]
 * @returns {import('../lib/personalizerHandoff.js').PersonalizableAsset}
 */
export function getImageStudioAsset({
  textarea,
  selectedModel,
  selectedAr,
  negativePrompt,
  uploadedImageUrls = [],
  resultImg,
  generationHistory = [],
}) {
  const prompt = textarea?.value?.trim() || '';

  let previewUrl = null;
  if (resultImg?.src && resultImg.src.startsWith('http')) {
    previewUrl = resultImg.src;
  } else if (generationHistory.length > 0 && generationHistory[0].url) {
    previewUrl = generationHistory[0].url;
  } else if (uploadedImageUrls.length > 0) {
    previewUrl = uploadedImageUrls[0];
  }

  const fields = [
    field({ id: 'prompt', label: 'Prompt', type: 'text', value: prompt, supportsPersonalization: true }),
    field({ id: 'model', label: 'Model', type: 'text', value: selectedModel || '', supportsPersonalization: false }),
    field({ id: 'aspectRatio', label: 'Aspect Ratio', type: 'text', value: selectedAr || '', supportsPersonalization: false }),
    field({ id: 'negativePrompt', label: 'Negative Prompt', type: 'text', value: negativePrompt || '', supportsPersonalization: true }),
    field({ id: 'uploadedImageUrls', label: 'Source Images', type: 'url', value: uploadedImageUrls, supportsPersonalization: false, readonly: true }),
    field({ id: 'previewUrl', label: 'Preview URL', type: 'url', value: previewUrl || '', supportsPersonalization: false, readonly: true }),
  ];

  return {
    id: 'image-current',
    type: 'image',
    title: prompt.slice(0, 80) || 'Untitled Image',
    previewUrl: previewUrl || undefined,
    fields,
    metadata: {
      studio: 'ImageStudio',
      imageMode: uploadedImageUrls.length > 0,
    },
  };
}

/**
 * TemplateStudio adapter.
 *
 * @param {Object} opts
 * @param {HTMLTextAreaElement} opts.outputTextarea
 * @param {Object} opts.template
 * @param {string} [opts.selectedModel]
 * @param {string} [opts.lastGeneratedUrl]
 * @param {string} [opts.customThumbnailUrl]
 * @returns {import('../lib/personalizerHandoff.js').PersonalizableAsset}
 */
export function getTemplateStudioAsset({
  outputTextarea,
  template,
  selectedModel,
  lastGeneratedUrl,
  customThumbnailUrl,
}) {
  const prompt = outputTextarea?.value?.trim() || '';
  const name = template?.name || 'Untitled Template';
  const description = template?.description || '';

  const fields = [
    field({ id: 'prompt', label: 'Prompt', type: 'text', value: prompt, supportsPersonalization: true }),
    field({ id: 'templateId', label: 'Template ID', type: 'text', value: template?.id || '', supportsPersonalization: false, readonly: true }),
    field({ id: 'templateName', label: 'Template Name', type: 'text', value: name, supportsPersonalization: false, readonly: true }),
    field({ id: 'description', label: 'Description', type: 'text', value: description, supportsPersonalization: false, readonly: true }),
    field({ id: 'model', label: 'Model', type: 'text', value: selectedModel || template?.model || '', supportsPersonalization: false }),
    field({ id: 'outputType', label: 'Output Type', type: 'text', value: template?.outputType || 'video', supportsPersonalization: false, readonly: true }),
    field({ id: 'previewUrl', label: 'Preview URL', type: 'url', value: lastGeneratedUrl || '', supportsPersonalization: false, readonly: true }),
  ];

  return {
    id: `template-${template?.id || 'current'}`,
    type: 'template',
    title: name,
    previewUrl: customThumbnailUrl || lastGeneratedUrl || undefined,
    fields,
    metadata: {
      studio: 'TemplateStudio',
      modelType: template?.modelType || undefined,
      niche: template?.niche || undefined,
    },
  };
}
