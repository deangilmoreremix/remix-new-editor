/**
 * sourceNormalizer.js
 *
 * Source Normalizer for the Personalization system.
 *
 * Ported from
 * OpenHiggsBolt/src/shared/personalization/sourceNormalizer.ts.
 *
 * The OpenHiggsBolt source imports a number of strongly-typed domain
 * types (`VideoDemo`, `PromptRecord`, `SeedancePrompt`) that the
 * integration worktree does not currently expose. This port treats
 * the input as `unknown` and inspects the shape at runtime via
 * duck-typing — which is exactly what `normalizePersonalizationSource`
 * already does in the source. The narrow normalizers
 * (`normalizeLandingDemo`, `normalizeGoAiViralPrompt`,
 * `normalizeGoAiViralVideo`) are kept and accept `any` so callers
 * can pass either the typed records or a plain object that matches
 * the shape.
 *
 * Pure functions — no state.
 */

/**
 * @param {any} demo
 * @returns {import('./types.js').PersonalizationSource}
 */
export function normalizeLandingDemo(demo) {
  return {
    sourceType: 'landing-demo',
    id: String(demo.id),
    title: demo.title,
    mediaType: 'video',
    sourceMedia: demo.videoSrc || null,
    poster: demo.posterSrc || null,
    shortPrompt: demo.prompt,
    fullPrompt: demo.prompt,
    originalPrompt: demo.prompt,
    model: demo.model,
    modelName: demo.modelName,
    aspectRatio: demo.aspectRatio,
    duration: demo.duration,
    durationLabel: demo.durationLabel,
    category: demo.category,
    sourceUrl: demo.sourceUrl,
    sourceMetadata: {
      studioTab: demo.studioTab,
      sourceRepo: demo.sourceRepo,
      tags: demo.tags,
    },
  };
}

/**
 * @param {any} record
 * @returns {import('./types.js').PersonalizationSource}
 */
export function normalizeGoAiViralPrompt(record) {
  const primaryMedia =
    record.media?.find?.((m) => m.role === 'result') || record.media?.[0];
  return {
    sourceType: 'go-ai-viral-prompt',
    id: String(record.id),
    title: record.title,
    mediaType: record.mediaType,
    sourceMedia: primaryMedia?.previewUrl || null,
    poster: primaryMedia?.posterUrl || primaryMedia?.previewUrl || null,
    shortPrompt: record.prompt,
    fullPrompt: record.prompt,
    originalPrompt: record.prompt,
    model: record.recommendedModel || undefined,
    modelName: record.recommendedModel || undefined,
    aspectRatio: record.recommended?.aspectRatio || undefined,
    duration: record.recommended?.durationSeconds || undefined,
    durationLabel: record.recommended?.durationSeconds
      ? `${record.recommended.durationSeconds}s`
      : undefined,
    category: record.categories?.[0],
    sourceUrl: record.source?.url,
    sourceMetadata: {
      sourceModels: record.sourceModels,
      language: record.language,
      curation: record.curation,
      provenance: record.provenance,
      engagement: record.source?.engagement,
      author: record.source?.author,
    },
  };
}

/**
 * @param {any} record
 * @returns {import('./types.js').PersonalizationSource}
 */
export function normalizeGoAiViralVideo(record) {
  return {
    sourceType: 'go-ai-viral-video',
    id: record.slug,
    title: record.prompt?.slice(0, 80) || record.slug,
    mediaType: 'video',
    sourceMedia: record.outputUrl,
    poster: record.thumbnail || null,
    shortPrompt: record.prompt,
    fullPrompt: record.fullPrompt || record.prompt,
    originalPrompt: record.fullPrompt || record.prompt,
    model: record.recommendedModel || undefined,
    modelName: record.recommendedModel || undefined,
    category: record.categories?.[0],
    sourceUrl: record.detailHref || undefined,
    sourceMetadata: {
      tags: record.tags,
      language: record.language,
      author: record.author,
      publishedAt: record.publishedAt,
      engagement: record.engagement,
      sourceLanguage: record.sourceLanguage,
    },
  };
}

/**
 * @param {string} id
 * @param {string} title
 * @param {string} imageUrl
 * @param {string} prompt
 * @param {Partial<import('./types.js').PersonalizationSource>} [extra]
 * @returns {import('./types.js').PersonalizationSource}
 */
export function normalizeImageDemo(id, title, imageUrl, prompt, extra) {
  return {
    sourceType: 'image-demo',
    id,
    title,
    mediaType: 'image',
    sourceMedia: imageUrl,
    poster: imageUrl,
    shortPrompt: prompt,
    fullPrompt: prompt,
    originalPrompt: prompt,
    ...(extra || {}),
    sourceMetadata: extra?.sourceMetadata || {},
  };
}

/**
 * Auto-detect the source format and return a normalized
 * `PersonalizationSource`. Returns null when the input is unrecognized.
 *
 * @param {unknown} source
 * @returns {import('./types.js').PersonalizationSource | null}
 */
export function normalizePersonalizationSource(source) {
  if (!source || typeof source !== 'object') return null;

  const s = /** @type {Record<string, unknown>} */ (source);

  // Landing demo
  if ('videoSrc' in s && 'posterSrc' in s && 'slug' in s) {
    return normalizeLandingDemo(s);
  }

  // GO AI Viral prompt record
  if ('mediaType' in s && 'curation' in s && 'provenance' in s) {
    return normalizeGoAiViralPrompt(s);
  }

  // GO AI Viral video prompt
  if ('slug' in s && 'fullPrompt' in s && 'outputUrl' in s) {
    return normalizeGoAiViralVideo(s);
  }

  // Already normalized
  if ('sourceType' in s && 'originalPrompt' in s) {
    return /** @type {import('./types.js').PersonalizationSource} */ (s);
  }

  return null;
}

/**
 * Compute personalization eligibility (which modes/outputs are
 * available) for a normalized source.
 *
 * @param {import('./types.js').PersonalizationSource} source
 * @returns {import('./types.js').PersonalizationEligibility}
 */
export function getEligibility(source) {
  if (source?.mediaType === 'video') {
    return {
      enabled: true,
      outputs: ['prompt', 'video', 'everything'],
      videoModes: ['face_only', 'full_body', 'recreate', 'complete'],
      imageModes: [],
      recommendedMode: 'full_body',
    };
  }

  if (source?.mediaType === 'image') {
    return {
      enabled: true,
      outputs: ['prompt', 'image', 'everything'],
      videoModes: [],
      imageModes: ['keep_design', 'replace_face', 'replace_person', 'recreate', 'complete'],
      recommendedMode: 'recreate',
    };
  }

  return {
    enabled: true,
    outputs: ['prompt'],
    videoModes: [],
    imageModes: [],
    recommendedMode: undefined,
  };
}
