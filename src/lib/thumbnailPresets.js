/**
 * Thumbnail Preset Library
 *
 * Curated presets for common template niches / categories. Each preset locks
 * in a brief modifier + control defaults. Selecting a preset in the modal
 * overrides the auto-composed brief.
 *
 * Preset schema:
 *   key:           string id
 *   name:          string display name
 *   matchNiches:   string[] — template.niche values that auto-select this preset
 *   matchCategories: string[] — template.category values
 *   briefModifier: string — appended to the auto-composed brief
 *   controls:      { quality, style, background, format, compression, aspectRatio }
 */

export const THUMBNAIL_PRESETS = {
  cinematic: {
    key: 'cinematic',
    name: '🎬 Cinematic',
    matchNiches: ['cinema', 'film', 'cinematic'],
    matchCategories: ['cinema', 'cinema-template-studio'],
    briefModifier: 'widescreen cinematic composition, shallow depth of field, anamorphic lens, color graded, 24fps, editorial framing',
    controls: { quality: 'high', style: 'vivid', background: 'opaque', format: 'webp', compression: 80, aspectRatio: '16:9' },
  },
  productCutout: {
    key: 'productCutout',
    name: '📦 Product Cutout',
    matchNiches: ['product', 'ecom', 'retail'],
    matchCategories: [],
    briefModifier: 'isolated product on plain background, centered, crisp silhouette, no halos, label legible, soft contact shadow',
    controls: { quality: 'high', style: 'natural', background: 'opaque', format: 'webp', compression: 85, aspectRatio: '1:1' },
  },
  lifestyle: {
    key: 'lifestyle',
    name: '🌿 Lifestyle',
    matchNiches: ['fitness', 'wellness', 'lifestyle', 'salon', 'medspa', 'restaurant'],
    matchCategories: [],
    briefModifier: 'lifestyle photography, warm natural light, candid moment, real-people feel, gentle color palette, inviting atmosphere',
    controls: { quality: 'high', style: 'natural', background: 'auto', format: 'webp', compression: 80, aspectRatio: '4:3' },
  },
  boldText: {
    key: 'boldText',
    name: '💥 Bold Text',
    matchNiches: [],
    matchCategories: [],
    briefModifier: 'high-contrast composition, single dominant subject, large negative space for headline overlay, punchy colors, thumbnail-readable from arm\'s length',
    controls: { quality: 'high', style: 'vivid', background: 'opaque', format: 'webp', compression: 75, aspectRatio: '16:9' },
  },
  minimal: {
    key: 'minimal',
    name: '⚪ Minimal',
    matchNiches: ['legal', 'finance', 'consulting'],
    matchCategories: [],
    briefModifier: 'minimal composition, generous negative space, restrained palette, single subtle subject, professional restraint',
    controls: { quality: 'high', style: 'natural', background: 'opaque', format: 'webp', compression: 90, aspectRatio: '16:9' },
  },
  vertical: {
    key: 'vertical',
    name: '📱 Vertical',
    matchNiches: ['tiktok', 'reels', 'shorts', 'stories'],
    matchCategories: ['video-studio', 'text-to-video'],
    briefModifier: 'vertical 9:16 framing, top-of-frame subject, lower-third space for caption, mobile-readable',
    controls: { quality: 'high', style: 'vivid', background: 'auto', format: 'webp', compression: 80, aspectRatio: '9:16' },
  },
};

export const DEFAULT_PRESET_KEY = 'cinematic';

/**
 * Pick a preset for a template based on niche/category.
 * Returns the first matching preset or DEFAULT_PRESET_KEY.
 */
export function getPresetForTemplate(template) {
  if (!template) return THUMBNAIL_PRESETS[DEFAULT_PRESET_KEY];
  const niche = (template.niche || '').toLowerCase();
  const category = (template.category || '').toLowerCase();
  for (const preset of Object.values(THUMBNAIL_PRESETS)) {
    if (preset.matchNiches.some((n) => n.toLowerCase() === niche)) return preset;
    if (preset.matchCategories.some((c) => c.toLowerCase() === category)) return preset;
  }
  return THUMBNAIL_PRESETS[DEFAULT_PRESET_KEY];
}

/**
 * Apply a preset's controls to an existing control object.
 * Pure function; returns a new controls object.
 */
export function applyPresetToControls(preset, currentControls = {}) {
  // Preset control keys use `format`/`compression` (see preset schema); the
  // active control state and ThumbnailService use `outputFormat`/`outputCompression`.
  // Normalize so preset selections actually take effect in the modal + service.
  const merged = { ...currentControls, ...(preset?.controls || {}) };
  if ('format' in merged) {
    merged.outputFormat = merged.format;
    delete merged.format;
  }
  if ('compression' in merged) {
    merged.outputCompression = merged.compression;
    delete merged.compression;
  }
  return merged;
}

/**
 * Apply a preset's brief modifier to an existing brief string.
 * Pure function; returns a new brief string.
 */
export function applyPresetToBrief(preset, baseBrief) {
  if (!preset || !preset.briefModifier) return baseBrief;
  return `${baseBrief}\n\nStyle direction: ${preset.briefModifier}`;
}

export const PRESET_LIST = Object.values(THUMBNAIL_PRESETS);
