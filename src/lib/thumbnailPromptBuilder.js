import { getPlatformInjectionText, REFERENCE_TYPE_RULES } from './thumbnailPlatformSpecs.js';
import { getPresetForTemplate, applyPresetToBrief } from './thumbnailPresets.js';

/**
 * Build a comprehensive thumbnail generation prompt from a template,
 * user-supplied values, and context metadata.
 *
 * @param {Object} opts
 * @param {import('./thumbnailTemplateRegistry.js').ThumbnailTemplate} [opts.template]
 * @param {Record<string, unknown>} [opts.userValues]
 * @param {string} [opts.brief]
 * @param {string} [opts.customPrompt]
 * @param {import('./thumbnailPresets.js').ThumbnailPreset} [opts.preset]
 * @param {string} [opts.platform]
 * @param {string} [opts.aspectRatio]
 * @param {{ colors?: string[]; fonts?: string[]; logo?: string; mood?: string }} [opts.brandKit]
 * @param {Array<{ type: 'PERSON'|'PRODUCT'|'LOGO'|'SCENE'; description?: string }>} [opts.referenceImages]
 * @param {'render-in-image'|'leave-space-for-overlay'} [opts.textMode]
 * @returns {string}
 */
export function buildThumbnailPrompt({
  template,
  userValues,
  brief,
  customPrompt,
  preset,
  platform,
  aspectRatio,
  brandKit,
  referenceImages,
  textMode,
}) {
  const parts = [];
  const recipe = template?.promptRecipe;

  if (recipe?.baseStyle) {
    parts.push(`Base style: ${recipe.baseStyle}`);
  }

  if (recipe?.composition) {
    parts.push(`Composition: ${recipe.composition}`);
  }

  if (recipe?.subjectRules) {
    parts.push(`Subject: ${recipe.subjectRules}`);
  }

  if (platform) {
    const injection = getPlatformInjectionText(platform, aspectRatio);
    if (injection) parts.push(injection);
  }

  if (brandKit) {
    const brandParts = ['Brand kit:'];
    if (brandKit.colors?.length) brandParts.push(`colors ${brandKit.colors.join(', ')}`);
    if (brandKit.fonts?.length) brandParts.push(`fonts ${brandKit.fonts.join(', ')}`);
    if (brandKit.logo) brandParts.push(`logo "${brandKit.logo}"`);
    if (brandKit.mood) brandParts.push(`mood ${brandKit.mood}`);
    parts.push(brandParts.join(' '));
  }

  if (referenceImages && referenceImages.length > 0 && recipe?.referenceRules) {
    const refParts = ['Reference rules:'];
    refParts.push(recipe.referenceRules);
    for (const ref of referenceImages) {
      const rule = REFERENCE_TYPE_RULES[ref.type];
      if (rule) refParts.push(`[${ref.type} reference] ${rule}`);
    }
    if (refParts.length > 1) parts.push(refParts.join(' '));
  } else if (recipe?.referenceRules) {
    parts.push(`Reference rules: ${recipe.referenceRules}`);
  }

  if (recipe?.textRules) {
    const effectiveTextMode = textMode || template?.textMode;
    if (effectiveTextMode) {
      parts.push(`Text mode (${effectiveTextMode}): ${recipe.textRules}`);
    } else {
      parts.push(`Text: ${recipe.textRules}`);
    }
  }

  if (recipe?.finishingRules) {
    parts.push(`Finish: ${recipe.finishingRules}`);
  }

  if (userValues && Object.keys(userValues).length > 0) {
    const entries = Object.entries(userValues).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');
    if (entries.length > 0) {
      const mapped = entries.map(([k, v]) => `${k}: "${v}"`);
      parts.push(`Fields:\n${mapped.join('\n')}`);
    }
  }

  if (customPrompt) {
    parts.push(`Additional instructions: ${customPrompt}`);
  }

  if (brief) {
    parts.push(`Brief: ${brief}`);
  }

  if (preset?.briefModifier) {
    parts.push(`Style direction: ${preset.briefModifier}`);
  }

  const prompt = parts.join('\n\n');
  return prompt.trim() || 'Social media thumbnail, eye-catching, high quality';
}

/**
 * Build a brief object and prompt from social copy.
 * Uses the enhanced buildThumbnailPrompt internally when a template is provided.
 *
 * @param {string} caption
 * @param {string[]} platforms
 * @param {Object} [opts]
 * @param {import('./thumbnailTemplateRegistry.js').ThumbnailTemplate} [opts.template]
 * @param {Record<string, unknown>} [opts.userValues]
 * @param {string} [opts.customPrompt]
 * @param {import('./thumbnailPresets.js').ThumbnailPreset} [opts.preset]
 * @returns {{ headline: string; hashtags: string[]; brief: string; prompt: string }}
 */
export function buildBriefFromSocialCopy(caption, platforms, opts = {}) {
  const { template, userValues, customPrompt, preset } = opts;
  const sentences = caption.split(/[.!?\n]/).filter(s => s.trim());
  const headline = sentences[0]?.trim().slice(0, 80) || caption.slice(0, 80);
  const hashtags = (caption.match(/#[\w]+/g) || []).map(t => t.slice(1));
  const platformNames = platforms.length > 0 ? platforms.join(', ') : 'multi-platform';
  const briefText = `${headline} — ${hashtags.length > 0 ? hashtags.join(', ') : 'social media content'} — ${platformNames}`;

  const presetForTemplate = preset || (template ? getPresetForTemplate(template) : undefined);

  return {
    headline,
    hashtags,
    brief: applyPresetToBrief(presetForTemplate, briefText),
    prompt: buildThumbnailPrompt({
      template,
      userValues,
      brief: briefText,
      customPrompt,
      preset: presetForTemplate,
      platform: platforms[0] || undefined,
    }),
  };
}
