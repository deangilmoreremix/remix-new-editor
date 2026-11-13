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


/**
 * CinemaStudio adapter.
 */
export function getCinemaStudioAsset({
  textarea,
  settings = {},
  customThumbnailUrl,
  previewUrl,
}) {
  const prompt = textarea?.value?.trim() || settings.prompt || '';
  const referenceUrls = Array.isArray(settings.referenceUrls)
    ? settings.referenceUrls.filter((entry) => entry?.url)
    : [];

  const fields = [
    field({ id: 'prompt', label: 'Prompt', type: 'text', value: prompt, supportsPersonalization: true }),
    field({ id: 'model', label: 'Model', type: 'text', value: settings.model || '', supportsPersonalization: false }),
    field({ id: 'aspectRatio', label: 'Aspect Ratio', type: 'text', value: settings.aspect_ratio || '16:9', supportsPersonalization: false }),
    field({ id: 'firstFrameUrl', label: 'First Frame', type: 'url', value: settings.referenceUrl || '', supportsPersonalization: false, readonly: true }),
    field({ id: 'lastFrameUrl', label: 'Last Frame', type: 'url', value: settings.endFrameUrl || '', supportsPersonalization: false, readonly: true }),
    field({ id: 'referenceImages', label: 'Reference Images', type: 'url', value: referenceUrls.filter((entry) => entry.type === 'image').map((entry) => entry.url), supportsPersonalization: false, readonly: true }),
    field({ id: 'referenceVideos', label: 'Reference Videos', type: 'url', value: referenceUrls.filter((entry) => entry.type === 'video').map((entry) => entry.url), supportsPersonalization: false, readonly: true }),
    field({ id: 'referenceAudios', label: 'Reference Audios', type: 'url', value: referenceUrls.filter((entry) => entry.type === 'audio').map((entry) => entry.url), supportsPersonalization: false, readonly: true }),
  ];

  return {
    id: 'cinema-current',
    type: 'video',
    title: prompt.slice(0, 80) || 'Untitled Cinema Shot',
    previewUrl: previewUrl || customThumbnailUrl || settings.referenceUrl || undefined,
    fields,
    metadata: {
      studio: 'CinemaStudio',
      camera: settings.camera || undefined,
      lens: settings.lens || undefined,
      movement: settings.movement || undefined,
      look: settings.look || undefined,
    },
  };
}


/**
 * Timeline / Projects adapter: a retargeting follow-up brief as a
 * PersonalizableAsset. Carries only strings and ids (never media blobs); the
 * original timeline's media stay referenced by the follow-up PROJECT that was
 * created from it.
 *
 * @param {Object} opts
 * @param {string} opts.originalProjectId
 * @param {string} [opts.originalProjectName]
 * @param {string} [opts.followupProjectId]   the new, linked project
 * @param {string} [opts.interest]
 * @param {string} [opts.interestType]
 * @param {string} [opts.ctaPurpose]
 * @param {string} [opts.suggestedMessage]
 * @param {string} [opts.originalVideoUrl]
 * @param {string} [opts.thumbnailUrl]
 */
export function getTimelineFollowupAsset({
  originalProjectId, originalProjectName, followupProjectId, interest, interestType,
  ctaPurpose, suggestedMessage, originalVideoUrl, thumbnailUrl,
} = {}) {
  const fields = [
    field({ id: 'topic', label: 'Topic of interest', type: 'text', value: interest || '', supportsPersonalization: true }),
    interestType === 'product' && field({ id: 'product', label: 'Product', type: 'text', value: interest || '', supportsPersonalization: true }),
    interestType === 'service' && field({ id: 'service', label: 'Service', type: 'text', value: interest || '', supportsPersonalization: true }),
    field({ id: 'cta_purpose', label: 'Call-to-action purpose', type: 'text', value: ctaPurpose || '', supportsPersonalization: true }),
    field({ id: 'message', label: 'Suggested message', type: 'text', value: suggestedMessage || '', supportsPersonalization: true }),
    originalVideoUrl && field({ id: 'original_video', label: 'Original video', type: 'url', value: originalVideoUrl, supportsPersonalization: false, readonly: true }),
  ].filter(Boolean);
  return {
    id: followupProjectId || originalProjectId,
    type: 'timeline',
    title: originalProjectName ? `${originalProjectName}: ${interest || 'follow-up'}` : 'Follow-up video',
    thumbnailUrl: thumbnailUrl || undefined,
    fields,
    metadata: { originalProjectId, followupProjectId: followupProjectId || null, interest: interest || null, interestType: interestType || null, createdFrom: 'retarget' },
  };
}
