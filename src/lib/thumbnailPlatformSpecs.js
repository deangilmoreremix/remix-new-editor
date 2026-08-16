/**
 * Thumbnail Platform Specs
 *
 * Platform-aware defaults for aspect ratios, sizes, text overlay support,
 * and recommended generation settings. Used by the template registry and
 * the thumbnail modal to adapt output per target platform.
 */

/**
 * @typedef {Object} PlatformSpec
 * @property {string} key - Platform identifier (e.g. 'youtube', 'tiktok')
 * @property {string} label - Human-readable platform name
 * @property {string} aspectRatio - Default aspect ratio for this platform
 * @property {string} size - Default image size (WxH) for generation
 * @property {boolean} textOverlay - Whether text overlay is commonly used
 * @property {'low'|'medium'|'high'|'auto'} quality - Recommended quality tier
 * @property {string[]} supportedAspectRatios - All aspect ratios valid for this platform
 */

export const PLATFORM_SPECS = {
  youtube: {
    key: 'youtube',
    label: 'YouTube',
    aspectRatio: '16:9',
    size: '1792x1024',
    textOverlay: true,
    quality: 'high',
    supportedAspectRatios: ['16:9', '4:3', '1:1'],
  },
  'youtube-shorts': {
    key: 'youtube-shorts',
    label: 'YouTube Shorts',
    aspectRatio: '9:16',
    size: '1024x1792',
    textOverlay: true,
    quality: 'high',
    supportedAspectRatios: ['9:16', '1:1'],
  },
  'instagram-post': {
    key: 'instagram-post',
    label: 'Instagram Post',
    aspectRatio: '1:1',
    size: '1024x1024',
    textOverlay: false,
    quality: 'high',
    supportedAspectRatios: ['1:1', '4:5', '9:16'],
  },
  'instagram-reel': {
    key: 'instagram-reel',
    label: 'Instagram Reel',
    aspectRatio: '9:16',
    size: '1024x1792',
    textOverlay: false,
    quality: 'high',
    supportedAspectRatios: ['9:16', '1:1', '4:5'],
  },
  'instagram-story': {
    key: 'instagram-story',
    label: 'Instagram Story',
    aspectRatio: '9:16',
    size: '1024x1792',
    textOverlay: true,
    quality: 'high',
    supportedAspectRatios: ['9:16', '1:1', '4:5'],
  },
  tiktok: {
    key: 'tiktok',
    label: 'TikTok',
    aspectRatio: '9:16',
    size: '1024x1792',
    textOverlay: true,
    quality: 'high',
    supportedAspectRatios: ['9:16', '1:1'],
  },
  'tiktok-square': {
    key: 'tiktok-square',
    label: 'TikTok Square',
    aspectRatio: '1:1',
    size: '1024x1024',
    textOverlay: true,
    quality: 'high',
    supportedAspectRatios: ['1:1', '9:16'],
  },
  twitter: {
    key: 'twitter',
    label: 'X (Twitter)',
    aspectRatio: '16:9',
    size: '1792x1024',
    textOverlay: true,
    quality: 'medium',
    supportedAspectRatios: ['16:9', '1:1'],
  },
  linkedin: {
    key: 'linkedin',
    label: 'LinkedIn',
    aspectRatio: '16:9',
    size: '1792x1024',
    textOverlay: true,
    quality: 'high',
    supportedAspectRatios: ['16:9', '1:1', '4:5'],
  },
  pinterest: {
    key: 'pinterest',
    label: 'Pinterest',
    aspectRatio: '2:3',
    size: '1024x1536',
    textOverlay: false,
    quality: 'high',
    supportedAspectRatios: ['2:3', '1:1', '9:16'],
  },
  facebook: {
    key: 'facebook',
    label: 'Facebook',
    aspectRatio: '16:9',
    size: '1792x1024',
    textOverlay: true,
    quality: 'high',
    supportedAspectRatios: ['16:9', '1:1', '4:5', '9:16'],
  },
  threads: {
    key: 'threads',
    label: 'Threads',
    aspectRatio: '4:5',
    size: '1024x1280',
    textOverlay: true,
    quality: 'high',
    supportedAspectRatios: ['4:5', '1:1', '9:16'],
  },
  snapchat: {
    key: 'snapchat',
    label: 'Snapchat',
    aspectRatio: '9:16',
    size: '1024x1792',
    textOverlay: true,
    quality: 'high',
    supportedAspectRatios: ['9:16', '1:1'],
  },
  web: {
    key: 'web',
    label: 'Web / OG',
    aspectRatio: '16:9',
    size: '1792x1024',
    textOverlay: true,
    quality: 'high',
    supportedAspectRatios: ['16:9', '1:1', '4:3'],
  },
  'open-graph': {
    key: 'open-graph',
    label: 'Open Graph',
    aspectRatio: '1:1',
    size: '1024x1024',
    textOverlay: true,
    quality: 'high',
    supportedAspectRatios: ['1:1', '16:9'],
  },
  'twitter-post': {
    key: 'twitter-post',
    label: 'X Post Image',
    aspectRatio: '16:9',
    size: '1792x1024',
    textOverlay: true,
    quality: 'medium',
    supportedAspectRatios: ['16:9', '1:1', '2:1'],
  },
  'email-header': {
    key: 'email-header',
    label: 'Email Header',
    aspectRatio: '16:9',
    size: '1792x1024',
    textOverlay: true,
    quality: 'high',
    supportedAspectRatios: ['16:9', '3:1'],
  },
  'print-poster': {
    key: 'print-poster',
    label: 'Print Poster',
    aspectRatio: '2:3',
    size: '1024x1536',
    textOverlay: true,
    quality: 'high',
    supportedAspectRatios: ['2:3', '1:1', '3:4'],
  },
};

/**
 * Get a platform spec by key.
 * @param {string} key
 * @returns {PlatformSpec|undefined}
 */
export function getPlatformSpec(key) {
  return PLATFORM_SPECS[key] || null;
}

/**
 * Get all registered platform keys.
 * @returns {string[]}
 */
export function getSupportedPlatformKeys() {
  return Object.keys(PLATFORM_SPECS);
}

/**
 * Resolve the best aspect ratio for a platform, falling back to '16:9'.
 * @param {string} platformKey
 * @param {string} [fallback='16:9']
 * @returns {string}
 */
export function resolvePlatformAspectRatio(platformKey, fallback = '16:9') {
  const spec = getPlatformSpec(platformKey);
  return spec?.aspectRatio || fallback;
}

/**
 * Resolve recommended size for a platform.
 * @param {string} platformKey
 * @param {string} [fallback='1792x1024']
 * @returns {string}
 */
export function resolvePlatformSize(platformKey, fallback = '1792x1024') {
  const spec = getPlatformSpec(platformKey);
  return spec?.size || fallback;
}

/**
 * Whether the platform typically requires text overlay.
 * @param {string} platformKey
 * @returns {boolean}
 */
export function platformRequiresTextOverlay(platformKey) {
  const spec = getPlatformSpec(platformKey);
  return spec?.textOverlay || false;
}

/**
 * Reference-type specific preservation rules for use in prompt builders.
 */
export const REFERENCE_TYPE_RULES = {
  PERSON: 'Preserve facial identity, exact proportions, skin tone, hairstyle, age, and all distinguishing features. The reference face must remain recognizable.',
  PRODUCT: 'Preserve exact product shape, proportions, colors, packaging, and branding. The reference product must remain instantly identifiable.',
  LOGO: 'Preserve the logo exactly as provided. Do not alter shapes, colors, text, or proportions.',
  SCENE: 'Preserve the reference scene composition, lighting, and key elements. Maintain the same visual context.',
};

/**
 * Get platform-specific prompt text for injection into a generation prompt.
 * @param {string} platformKey
 * @param {string} [aspectRatio]
 * @returns {string}
 */
export function getPlatformInjectionText(platformKey, aspectRatio) {
  const spec = getPlatformSpec(platformKey);
  if (!spec) return '';
  const parts = [`Platform: ${spec.label} (${spec.key}). Recommended output size: ${spec.size}.`];
  if (aspectRatio) {
    parts.push(`Aspect ratio: ${aspectRatio}.`);
  }
  if (spec.textOverlay) {
    parts.push('Text overlay is commonly used on this platform — leave clean space for overlaid headlines if appropriate.');
  }
  return parts.join(' ');
}

export default PLATFORM_SPECS;
