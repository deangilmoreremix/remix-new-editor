/**
 * Thumbnail Template Registry
 *
 * Data-driven registry of thumbnail generation templates. Each template
 * describes a visual style, prompt recipe, required fields, and platform
 * defaults so the thumbnail modal can render the correct UI and assemble
 * a high-quality generation prompt.
 *
 * Registry is versioned (currently v1). Templates are plain objects so
 * they can be filtered, searched, and serialized without component logic.
 */

import { validateTemplate, validateFieldValues } from './thumbnailTemplateValidation.js';

/**
 * @typedef {import('./thumbnailTemplateValidation.js').ThumbnailTemplate} ThumbnailTemplate
 * @typedef {import('./thumbnailTemplateValidation.js').TemplateField} TemplateField
 * @typedef {import('./thumbnailTemplateValidation.js').PromptRecipe} PromptRecipe
 * @typedef {import('./thumbnailTemplateValidation.js').GenerationDefaults} GenerationDefaults
 */

const DEFAULT_GENERATION = {
  model: 'gpt-image-2',
  quality: 'high',
  outputFormat: 'webp',
  background: 'auto',
};

/**
 * Build a text-mode template recipe fragment.
 * @param {'render-in-image'|'leave-space-for-overlay'} textMode
 * @returns {string}
 */
function textModeRules(textMode) {
  if (textMode === 'render-in-image') {
    return 'Render the headline text directly inside the image using bold, high-contrast typography. Text must be legible at thumbnail size. No external overlay needed.';
  }
  return 'Leave generous negative space (safe zone) in the upper-center or lower-third for a post-render text overlay. Do not place critical detail in that zone.';
}

/**
 * Assemble a prompt recipe from a template definition.
 * @param {Object} opts
 * @param {string} opts.baseStyle
 * @param {string} opts.composition
 * @param {string} opts.subjectRules
 * @param {string} opts.referenceRules
 * @param {string} opts.textMode
 * @returns {PromptRecipe}
 */
function buildRecipe({ baseStyle, composition, subjectRules, referenceRules, textMode }) {
  return {
    baseStyle,
    composition,
    subjectRules,
    referenceRules,
    textRules: textModeRules(textMode),
    finishingRules: 'High detail, clean edges, no watermarks, no logos, no UI chrome, thumbnail-readable at arm\'s length, 4K editorial finish.',
  };
}

/**
 * Standard fields used across many templates.
 */
const COMMON_FIELDS = {
  headline: {
    key: 'headline',
    label: 'Headline',
    type: 'text',
    required: false,
    placeholder: 'e.g. "5 Secrets to Better Sleep"',
  },
  subheadline: {
    key: 'subheadline',
    label: 'Sub-headline',
    type: 'text',
    required: false,
    placeholder: 'Supporting text',
  },
  subject: {
    key: 'subject',
    label: 'Subject / Topic',
    type: 'text',
    required: true,
    placeholder: 'e.g. "Viral marketing strategy"',
  },
  tone: {
    key: 'tone',
    label: 'Tone',
    type: 'select',
    required: false,
    options: ['bold', 'playful', 'professional', 'urgent', 'minimal', 'dramatic', 'warm'],
  },
  background: {
    key: 'background',
    label: 'Background',
    type: 'select',
    required: false,
    options: ['solid', 'gradient', 'scene', 'texture', 'blurred'],
  },
};

/**
 * Starter template definitions.
 */
export const THUMBNAIL_TEMPLATES = {
  // ─── Marketing / Social ───────────────────────────────────────────────────
  boldHeadline: {
    id: 'bold-headline',
    name: 'Bold Headline',
    category: 'Marketing/Social',
    tags: ['marketing', 'social', 'headline', 'bold', 'text-heavy'],
    description: 'Large dominant headline with punchy colors and minimal clutter.',
    previewUrl: '/thumbnails/templates/billboard-ad.webp',
    previewPrompt: 'Bold headline "LAUNCH DAY" in thick white letters over a deep blue gradient, high contrast, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:5'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'instagram-post', 'tiktok', 'linkedin', 'twitter', 'facebook'],
    textMode: 'render-in-image',
    fields: [
      { ...COMMON_FIELDS.headline, required: true },
      { ...COMMON_FIELDS.tone },
      {
        key: 'colorScheme',
        label: 'Color Scheme',
        type: 'select',
        required: false,
        options: ['red-black', 'blue-white', 'purple-gold', 'green-white', 'orange-black'],
      },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'bold editorial design, high contrast, punchy palette, 4K',
      composition: 'Headline dominates the frame, centered or slightly off-center, plenty of breathing room, strong focal point',
      subjectRules: 'Single headline phrase in massive sans-serif type, all-caps or title-case, crisp edges, no distortion',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high' },
    version: 1,
  },

  breakingNews: {
    id: 'breaking-news',
    name: 'Breaking News',
    category: 'Marketing/Social',
    tags: ['marketing', 'news', 'urgent', 'broadcast', 'announcement'],
    description: 'Urgent broadcast-style banner with red accents and timestamp energy.',
    previewUrl: '/thumbnails/templates/story-highlight-cover.webp',
    previewPrompt: 'Breaking news lower-third banner, urgent red accent, bold white headline, broadcast TV style, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '9:16'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'twitter', 'facebook', 'linkedin'],
    textMode: 'render-in-image',
    fields: [
      { ...COMMON_FIELDS.headline, required: true, placeholder: 'e.g. "MARKET CRASH: What You Need to Know"' },
      {
        key: 'urgency',
        label: 'Urgency Level',
        type: 'select',
        required: false,
        options: ['breaking', 'alert', 'update', 'analysis'],
      },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'broadcast news graphics, urgent red accent bar, clean sans-serif, high contrast, 4K',
      composition: 'Wide 16:9 frame, headline in the lower third, red urgency bar at the top or bottom, timestamp energy',
      subjectRules: 'Headline text is the hero, maximum 6-8 words, all-caps preferred, crisp and authoritative',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  webinarPromo: {
    id: 'webinar-promo',
    name: 'Webinar Promo',
    category: 'Marketing/Social',
    tags: ['marketing', 'webinar', 'event', 'promo', 'professional'],
    description: 'Clean event promo with speaker highlight and date space.',
    previewUrl: '/thumbnails/templates/business_summit_reel.webp.png',
    previewPrompt: 'Professional webinar promo thumbnail, "LIVE WORKSHOP" headline, modern office background, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '4:3', '1:1'],
    supportedPlatforms: ['youtube', 'linkedin', 'twitter', 'facebook', 'web'],
    textMode: 'render-in-image',
    fields: [
      { ...COMMON_FIELDS.headline, required: true, placeholder: 'e.g. "Free SEO Workshop"' },
      { key: 'date', label: 'Event Date', type: 'text', required: false, placeholder: 'e.g. "Aug 25"' },
      { key: 'speaker', label: 'Speaker Name', type: 'text', required: false, placeholder: 'e.g. "Jane Doe"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'clean event promo, professional corporate aesthetic, soft gradient, 4K',
      composition: 'Speaker or abstract presenter silhouette on one side, headline and date on the other, balanced asymmetry',
      subjectRules: 'If a speaker is mentioned, depict a professional silhouette or abstract representation. Keep focus on the headline.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'natural' },
    version: 1,
  },

  productLaunch: {
    id: 'product-launch',
    name: 'Product Launch',
    category: 'Marketing/Social',
    tags: ['marketing', 'product', 'launch', 'ecom', 'tech'],
    description: 'Hero product reveal with dramatic lighting and launch energy.',
    previewUrl: '/thumbnails/templates/product_launch_promo.webp.png',
    previewPrompt: 'Dramatic product launch thumbnail, hero product floating, spotlights, dark studio background, 4K.',
    requiresReference: true,
    referenceRequired: true,
    referenceType: 'product',
    minReferences: 1,
    maxReferences: 3,
    supportedAspectRatios: ['16:9', '1:1', '4:5'],
    supportedPlatforms: ['youtube', 'instagram-post', 'linkedin', 'facebook', 'web'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'productName', label: 'Product Name', type: 'text', required: true, placeholder: 'e.g. "PixelWatch Pro"' },
      { key: 'launchAngle', label: 'Launch Angle', type: 'select', required: false, options: ['hero-floating', 'hero-on-pedestal', 'hero-in-scene', 'hero-split'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'dramatic product photography, studio spotlights, dark background, premium feel, 4K',
      composition: 'Product centered or slightly off-center, dramatic rim lighting, soft fill, negative space for overlay text',
      subjectRules: 'The reference product image is the hero. Maintain its shape, color, and proportions. Add dramatic studio lighting.',
      referenceRules: 'Use the provided product reference image(s) as the primary subject. Maintain exact product shape and proportions. Add dramatic studio lighting and reflections.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid', background: 'opaque' },
    version: 1,
  },

  caseStudyResult: {
    id: 'case-study-result',
    name: 'Case Study Result',
    category: 'Marketing/Social',
    tags: ['marketing', 'case-study', 'b2b', 'data', 'professional'],
    description: 'Data-forward result showcase with metric emphasis.',
    previewUrl: '/thumbnails/templates/case_study.webp.png',
    previewPrompt: 'Case study result thumbnail, big "300%" stat, clean dashboard aesthetic, blue gradient, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '1:1', '4:3'],
    supportedPlatforms: ['youtube', 'linkedin', 'twitter', 'web'],
    textMode: 'render-in-image',
    fields: [
      { key: 'metric', label: 'Key Metric', type: 'text', required: true, placeholder: 'e.g. "300% ROI"' },
      { key: 'metricLabel', label: 'Metric Label', type: 'text', required: false, placeholder: 'e.g. "Revenue Growth"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'clean data visualization aesthetic, professional B2B, blue gradient, 4K',
      composition: 'Large stat number dominates upper third, supporting label below, clean geometric background',
      subjectRules: 'The metric number must be the largest element, crisp and legible, high contrast against background',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'natural' },
    version: 1,
  },

  quoteCard: {
    id: 'quote-card',
    name: 'Quote Card',
    category: 'Marketing/Social',
    tags: ['marketing', 'quote', 'inspirational', 'social', 'minimal'],
    description: 'Minimal quote card with author attribution and breathing room.',
    previewUrl: '/thumbnails/templates/testimonial_film.webp.png',
    previewPrompt: 'Minimal quote card, "The only way out is through" in elegant serif, soft background, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['1:1', '9:16', '4:5'],
    supportedPlatforms: ['instagram-post', 'instagram-story', 'tiktok', 'threads', 'pinterest'],
    textMode: 'render-in-image',
    fields: [
      { key: 'quote', label: 'Quote', type: 'textarea', required: true, placeholder: 'Enter the quote text...' },
      { key: 'author', label: 'Author', type: 'text', required: false, placeholder: 'e.g. "— Maya Angelou"' },
      { key: 'fontStyle', label: 'Font Style', type: 'select', required: false, options: ['serif-elegant', 'sans-modern', 'typewriter', 'handwritten'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'minimal editorial, elegant typography, soft gradient or texture background, 4K',
      composition: 'Quote centered with generous margins, author attribution in smaller type below, balanced whitespace',
      subjectRules: 'The quote text is the sole subject. Use elegant typography. No other imagery unless specified.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'natural' },
    version: 1,
  },

  beforeAfter: {
    id: 'before-after',
    name: 'Before & After',
    category: 'Marketing/Social',
    tags: ['marketing', 'transformation', 'comparison', 'before-after', 'split'],
    description: 'Split-screen before/after with clear transformation highlight.',
    previewUrl: '/thumbnails/templates/invisalign_reveal_reel.webp.png',
    previewPrompt: 'Before and after split screen, left dull right vibrant, center dividing line, 4K.',
    requiresReference: true,
    referenceRequired: true,
    referenceType: 'scene',
    minReferences: 2,
    maxReferences: 2,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'instagram-post', 'tiktok', 'facebook'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'labelBefore', label: 'Before Label', type: 'text', required: false, placeholder: 'e.g. "Before"' },
      { key: 'labelAfter', label: 'After Label', type: 'text', required: false, placeholder: 'e.g. "After"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'split-screen comparison, crisp dividing line, dramatic transformation, 4K',
      composition: 'Exact vertical or horizontal split, left side shows "before" state, right side shows "after" state',
      subjectRules: 'Left reference image depicts the "before" state. Right reference image depicts the "after" state. Ensure clear contrast between sides.',
      referenceRules: 'Provide exactly two reference images: the "before" state and the "after" state. Maintain the same framing and scale across both.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  comparison: {
    id: 'comparison',
    name: 'Comparison',
    category: 'Marketing/Social',
    tags: ['marketing', 'comparison', 'versus', 'choice', 'split'],
    description: 'Versus-style comparison with two competing options.',
    previewUrl: '/thumbnails/templates/flip_reveal_story.webp.png',
    previewPrompt: 'Comparison thumbnail, VS badge, two product halves, bold contrast, 4K.',
    requiresReference: true,
    referenceRequired: false,
    referenceType: 'product',
    minReferences: 0,
    maxReferences: 2,
    supportedAspectRatios: ['16:9', '1:1'],
    supportedPlatforms: ['youtube', 'instagram-post', 'twitter', 'facebook'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'optionA', label: 'Option A', type: 'text', required: false, placeholder: 'e.g. "Product X"' },
      { key: 'optionB', label: 'Option B', type: 'text', required: false, placeholder: 'e.g. "Product Y"' },
      { key: 'winner', label: 'Preferred Side', type: 'select', required: false, options: ['left', 'right', 'neutral'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'versus comparison design, bold split, clean graphic lines, 4K',
      composition: 'Split screen with optional VS badge in the center, each side represents one option',
      subjectRules: 'If reference images are provided, each depicts one option. Maintain equal visual weight on both sides unless "winner" is specified.',
      referenceRules: 'Provide up to two reference images for each option. If only one is provided, duplicate it on the opposite side with a style variation.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  listicle: {
    id: 'listicle',
    name: 'Listicle',
    category: 'Marketing/Social',
    tags: ['marketing', 'listicle', 'numbered', 'tips', 'social'],
    description: 'Numbered listicle thumbnail with count emphasis.',
    previewUrl: '/thumbnails/templates/lookbook_showcase.webp.png',
    previewPrompt: 'Listicle thumbnail, "7 TIPS" huge number, bullet points, vibrant gradient, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'instagram-post', 'tiktok', 'facebook'],
    textMode: 'render-in-image',
    fields: [
      { key: 'count', label: 'Item Count', type: 'number', required: true, placeholder: 'e.g. 7' },
      { key: 'topic', label: 'Topic', type: 'text', required: true, placeholder: 'e.g. "Productivity Hacks"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'bold listicle design, vibrant gradient background, playful but clean, 4K',
      composition: 'Large number dominates the frame, topic text below, list items as subtle graphic elements',
      subjectRules: 'The count number is the hero element. Topic text supports it. Keep it to 2 text elements maximum.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  statNumber: {
    id: 'stat-number',
    name: 'Stat / Number',
    category: 'Marketing/Social',
    tags: ['marketing', 'stat', 'number', 'data', 'impact'],
    description: 'Huge stat or number as the focal point with minimal context.',
    previewUrl: '/thumbnails/templates/results_case_reel.webp.png',
    previewPrompt: 'Huge "97%" stat thumbnail, bold white on dark blue, minimal, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '1:1', '9:16'],
    supportedPlatforms: ['youtube', 'instagram-post', 'linkedin', 'twitter', 'facebook'],
    textMode: 'render-in-image',
    fields: [
      { key: 'stat', label: 'Stat / Number', type: 'text', required: true, placeholder: 'e.g. "97%"' },
      { key: 'context', label: 'Context', type: 'text', required: false, placeholder: 'e.g. "of marketers use AI"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'minimal stat card, bold typography, high contrast, 4K',
      composition: 'Huge stat number fills the frame, context text in smaller type, ample negative space',
      subjectRules: 'The stat number is the only hero element. Make it massive. Context text is secondary.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  // ─── Creator / Person ─────────────────────────────────────────────────────
  creatorReaction: {
    id: 'creator-reaction',
    name: 'Creator Reaction',
    category: 'Creator/Person',
    tags: ['creator', 'reaction', 'person', 'face', 'youtube', 'tiktok'],
    description: 'Expressive creator face with reaction emotion and context framing.',
    previewUrl: '/thumbnails/templates/reaction-thumbnail.webp',
    previewPrompt: 'Creator reaction face, shocked expression, wide eyes, colorful background, 4K.',
    requiresReference: true,
    referenceRequired: true,
    referenceType: 'face',
    minReferences: 1,
    maxReferences: 2,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'tiktok', 'instagram-reel'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'emotion', label: 'Reaction Emotion', type: 'select', required: true, options: ['shocked', 'excited', 'confused', 'laughing', 'angry', 'surprised', 'thoughtful'] },
      { key: 'angle', label: 'Camera Angle', type: 'select', required: false, options: ['front', 'three-quarter', 'over-shoulder', 'extreme-closeup'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'vivid creator thumbnail, expressive portrait, colorful dynamic background, 4K',
      composition: 'Creator face dominates the frame, reaction emotion is the focal point, background supports the mood',
      subjectRules: 'Use the reference face image. Preserve likeness. Exaggerate the selected emotion naturally. Keep eyes sharp and engaging.',
      referenceRules: 'Use the provided face reference image(s). Maintain exact likeness. Exaggerate the chosen emotion while keeping the face recognizable.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  studioHeadshot: {
    id: 'studio-headshot',
    name: 'Studio Headshot',
    category: 'Creator/Person',
    tags: ['creator', 'headshot', 'professional', 'portrait', 'studio'],
    description: 'Polished professional headshot with studio lighting.',
    previewUrl: '/thumbnails/templates/glamour-portrait.webp',
    previewPrompt: 'Professional headshot, studio lighting, clean backdrop, confident expression, 4K.',
    requiresReference: true,
    referenceRequired: true,
    referenceType: 'face',
    minReferences: 1,
    maxReferences: 1,
    supportedAspectRatios: ['1:1', '16:9', '4:5'],
    supportedPlatforms: ['youtube', 'linkedin', 'instagram-post', 'web'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'lighting', label: 'Lighting Style', type: 'select', required: false, options: ['studio-soft', 'studio-dramatic', 'rim-light', 'natural-window'] },
      { key: 'backdrop', label: 'Backdrop', type: 'select', required: false, options: ['white', 'gray', 'dark', 'gradient', 'blurred-office'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'professional portrait photography, clean studio lighting, sharp focus, 4K',
      composition: 'Head and shoulders centered, eyes at upper third line, clean background, professional framing',
      subjectRules: 'Use the reference face. Maintain exact likeness. Professional, confident expression. Sharp focus on eyes.',
      referenceRules: 'Use the provided face reference image. Maintain exact likeness. Professional styling and lighting.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'natural' },
    version: 1,
  },

  miniMe: {
    id: 'mini-me',
    name: 'Mini Me',
    category: 'Creator/Person',
    tags: ['creator', 'mini-me', 'chibi', 'cute', 'avatar', 'cartoon'],
    description: 'Cute chibi-style mini version of the person.',
    previewUrl: '/thumbnails/templates/action-figure.webp',
    previewPrompt: 'Cute chibi mini version of person, big head, tiny body, pastel background, 4K.',
    requiresReference: true,
    referenceRequired: true,
    referenceType: 'face',
    minReferences: 1,
    maxReferences: 1,
    supportedAspectRatios: ['1:1', '9:16', '4:5'],
    supportedPlatforms: ['youtube-shorts', 'tiktok', 'instagram-reel', 'instagram-story'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'style', label: 'Chibi Style', type: 'select', required: false, options: ['kawaii', 'cartoon', 'pixar-style', 'claymation'] },
      { key: 'outfit', label: 'Outfit', type: 'text', required: false, placeholder: 'e.g. "red hoodie, jeans"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'cute chibi character design, big head, small body, pastel palette, 4K',
      composition: 'Character centered, full body visible, cute proportions, friendly pose',
      subjectRules: 'Use the reference face to capture likeness in chibi style. Exaggerate head size (2-3x body). Keep expressions cute and recognizable.',
      referenceRules: 'Use the provided face reference. Translate likeness into chibi proportions. Big head, small body, simplified features.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  bobblehead: {
    id: 'bobblehead',
    name: 'Bobblehead',
    category: 'Creator/Person',
    tags: ['creator', 'bobblehead', 'fun', 'caricature', '3d'],
    description: 'Fun caricature bobblehead with oversized head.',
    previewUrl: '/thumbnails/templates/3d-figurine.webp',
    previewPrompt: 'Bobblehead caricature, oversized head, funny expression, 3D render, 4K.',
    requiresReference: true,
    referenceRequired: true,
    referenceType: 'face',
    minReferences: 1,
    maxReferences: 1,
    supportedAspectRatios: ['1:1', '16:9', '9:16'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'tiktok', 'instagram-reel'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'expression', label: 'Expression', type: 'select', required: false, options: ['goofy', 'serious', 'cheerful', 'surprised', 'cool'] },
      { key: 'base', label: 'Base Style', type: 'select', required: false, options: ['sports', 'business', 'casual', 'fantasy'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: '3D bobblehead caricature, oversized head, smooth stylized rendering, 4K',
      composition: 'Character from waist up, head oversized, body proportional to bobblehead style',
      subjectRules: 'Use the reference face. Exaggerate the head (3-4x body scale). Maintain core likeness. Add a spring/neck detail.',
      referenceRules: 'Use the provided face reference. Create a caricature bobblehead with the person\'s likeness. Exaggerated head, stylized body.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  colorAnalysis: {
    id: 'color-analysis',
    name: 'Color Analysis',
    category: 'Creator/Person',
    tags: ['creator', 'color', 'palette', 'season', 'beauty', 'style'],
    description: 'Seasonal color palette analysis with swatches.',
    previewUrl: '/thumbnails/templates/color_hair_story.webp.png',
    previewPrompt: 'Color analysis palette, seasonal color swatches, elegant fashion context, 4K.',
    requiresReference: true,
    referenceRequired: true,
    referenceType: 'face',
    minReferences: 1,
    maxReferences: 1,
    supportedAspectRatios: ['1:1', '4:5', '9:16'],
    supportedPlatforms: ['instagram-post', 'instagram-story', 'tiktok', 'pinterest'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'season', label: 'Color Season', type: 'select', required: true, options: ['spring', 'summer', 'autumn', 'winter'] },
      { key: 'palette', label: 'Palette Name', type: 'text', required: false, placeholder: 'e.g. "Warm & Bright"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'fashion color analysis, elegant swatches, soft studio background, 4K',
      composition: 'Color swatches arranged on one side, reference face on the other, elegant fashion context',
      subjectRules: 'Use the reference face to determine the color season. Show the face alongside the recommended palette swatches.',
      referenceRules: 'Use the provided face reference. Analyze skin undertone and recommend the matching color season with swatches.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'natural' },
    version: 1,
  },

  hairstyles: {
    id: 'hairstyles',
    name: 'Hairstyles',
    category: 'Creator/Person',
    tags: ['creator', 'hair', 'beauty', 'salon', 'style', 'before-after'],
    description: 'Hair transformation showcase with style options.',
    previewUrl: '/thumbnails/templates/hair_extensions_trailer.webp.png',
    previewPrompt: 'Hair transformation showcase, before and after hair styles, salon aesthetic, 4K.',
    requiresReference: true,
    referenceRequired: true,
    referenceType: 'face',
    minReferences: 1,
    maxReferences: 3,
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    supportedPlatforms: ['instagram-reel', 'tiktok', 'youtube-shorts', 'instagram-post'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'hairStyle', label: 'Hair Style', type: 'select', required: true, options: ['bob', 'pixie', 'long-waves', 'braids', 'buzz-cut', 'updo', 'layered'] },
      { key: 'color', label: 'Hair Color', type: 'text', required: false, placeholder: 'e.g. "caramel blonde"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'beauty salon photography, clean hair showcase, soft lighting, 4K',
      composition: 'Split or grid showing multiple hairstyle options, reference face in each variant',
      subjectRules: 'Use the reference face. Show the same face with different hairstyle options. Maintain likeness across all variants.',
      referenceRules: 'Use the provided face reference. Apply the requested hairstyle(s) to the face. Maintain exact likeness.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'natural' },
    version: 1,
  },

  // ─── Information / Education ──────────────────────────────────────────────
  blueprintPoster: {
    id: 'blueprint-poster',
    name: 'Blueprint Poster',
    category: 'Information/Education',
    tags: ['education', 'blueprint', 'technical', 'diagram', 'how-to'],
    description: 'Technical blueprint or schematic poster aesthetic.',
    previewUrl: '/thumbnails/templates/storyboarded_sequence.webp.png',
    previewPrompt: 'Blueprint poster, technical schematic lines, white on blue, engineering aesthetic, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '4:3', '1:1'],
    supportedPlatforms: ['youtube', 'web', 'linkedin', 'twitter'],
    textMode: 'render-in-image',
    fields: [
      { key: 'topic', label: 'Topic / System', type: 'text', required: true, placeholder: 'e.g. "Solar Panel Wiring"' },
      { key: 'complexity', label: 'Complexity', type: 'select', required: false, options: ['simple', 'detailed', 'full-system'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'technical blueprint, schematic lines, white on deep blue, engineering grid, 4K',
      composition: 'Blueprint grid fills the frame, technical annotations in margins, central diagram',
      subjectRules: 'Render the technical subject as clean schematic lines and labels. Use blueprint-style annotations.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'natural' },
    version: 1,
  },

  researchVisual: {
    id: 'research-visual',
    name: 'Research Visual',
    category: 'Information/Education',
    tags: ['education', 'research', 'academic', 'data', 'science'],
    description: 'Clean research data visualization or abstract concept.',
    previewUrl: '/thumbnails/templates/sci_fi_film_scene.webp.png',
    previewPrompt: 'Research visual thumbnail, abstract data visualization, scientific aesthetic, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '1:1', '4:3'],
    supportedPlatforms: ['youtube', 'linkedin', 'web'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'topic', label: 'Research Topic', type: 'text', required: true, placeholder: 'e.g. "Quantum Computing"' },
      { key: 'dataType', label: 'Visualization Type', type: 'select', required: false, options: ['graph', 'microscope', 'molecule', 'abstract'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'scientific visualization, clean data aesthetic, muted professional palette, 4K',
      composition: 'Abstract data visualization or scientific imagery, negative space for overlay text',
      subjectRules: 'Render the research topic as a clean scientific visualization. Abstract data, molecules, or microscope-style imagery.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'natural' },
    version: 1,
  },

  infographicPoster: {
    id: 'infographic-poster',
    name: 'Infographic Poster',
    category: 'Information/Education',
    tags: ['education', 'infographic', 'data', 'visual', 'poster'],
    description: 'Bold infographic poster with icons and data points.',
    previewUrl: '/thumbnails/templates/documentary_style.webp.png',
    previewPrompt: 'Infographic poster, bold icons, data visualization, clean layout, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '1:1', '2:3'],
    supportedPlatforms: ['youtube', 'instagram-post', 'pinterest', 'web'],
    textMode: 'render-in-image',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. "The Future of AI"' },
      { key: 'dataPoints', label: 'Data Points', type: 'number', required: false, placeholder: 'e.g. 5' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'bold infographic design, clean icons, data visualization, modern flat design, 4K',
      composition: 'Grid or radial layout with icons and data points, title at top, visual hierarchy clear',
      subjectRules: 'Create clean iconography and data visualization. No photographic realism. Modern flat design aesthetic.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  tutorialHowTo: {
    id: 'tutorial-how-to',
    name: 'Tutorial / How-To',
    category: 'Information/Education',
    tags: ['education', 'tutorial', 'how-to', 'step-by-step', 'instructional'],
    description: 'Step-by-step tutorial thumbnail with numbered visual cues.',
    previewUrl: '/thumbnails/templates/detail_shot_reel.webp.png',
    previewPrompt: 'Tutorial thumbnail, step by step visual, numbered steps, clean instructional design, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'tiktok', 'instagram-reel'],
    textMode: 'render-in-image',
    fields: [
      { key: 'stepCount', label: 'Step Count', type: 'number', required: false, placeholder: 'e.g. 3' },
      { key: 'topic', label: 'Topic', type: 'text', required: true, placeholder: 'e.g. "How to Bake Bread"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'clean instructional design, step-by-step visual, numbered badges, 4K',
      composition: 'Numbered steps arranged in a grid or sequence, each with a small illustrative icon or snapshot',
      subjectRules: 'Show clear step progression. Use numbered badges. Keep each step visually distinct and simple.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'natural' },
    version: 1,
  },

  // ─── Editorial ─────────────────────────────────────────────────────────────
  fantasyNewspaper: {
    id: 'fantasy-newspaper',
    name: 'Fantasy Newspaper',
    category: 'Editorial',
    tags: ['editorial', 'fantasy', 'newspaper', 'vintage', 'retro'],
    description: 'Vintage fantasy newspaper front page with ornate typography.',
    previewUrl: '/thumbnails/templates/movie_poster.webp.png',
    previewPrompt: 'Fantasy newspaper front page, ornate typography, parchment texture, ink stains, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '4:3', '2:3'],
    supportedPlatforms: ['youtube', 'web', 'twitter', 'facebook'],
    textMode: 'render-in-image',
    fields: [
      { key: 'headline', label: 'Masthead Headline', type: 'text', required: true, placeholder: 'e.g. "WIZARD WINS ELECTION"' },
      { key: 'era', label: 'Era / Style', type: 'select', required: false, options: ['medieval-fantasy', 'steampunk', 'noir-1920s', 'cyberpunk'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'vintage newspaper front page, ornate serif typography, parchment texture, ink stains, 4K',
      composition: 'Masthead at top, multi-column layout, headline dominates, bylines and dateline in smaller type',
      subjectRules: 'The headline is the masthead. Use ornate period typography. Include fake bylines and datelines for authenticity.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  magazineCover: {
    id: 'magazine-cover',
    name: 'Magazine Cover',
    category: 'Editorial',
    tags: ['editorial', 'magazine', 'cover', 'fashion', 'portrait'],
    description: 'Glamour magazine cover with cover-line hierarchy.',
    previewUrl: '/thumbnails/templates/magazine-cover.webp',
    previewPrompt: 'Magazine cover, glamour portrait, bold cover lines, glossy finish, 4K.',
    requiresReference: true,
    referenceRequired: true,
    referenceType: 'face',
    minReferences: 1,
    maxReferences: 2,
    supportedAspectRatios: ['2:3', '1:1', '9:16'],
    supportedPlatforms: ['instagram-post', 'pinterest', 'web'],
    textMode: 'render-in-image',
    fields: [
      { key: 'coverLine1', label: 'Main Cover Line', type: 'text', required: true, placeholder: 'e.g. "THE FUTURE OF FASHION"' },
      { key: 'coverLine2', label: 'Secondary Line', type: 'text', required: false, placeholder: 'e.g. "Inside: 50 New Trends"' },
      { key: 'masthead', label: 'Magazine Name', type: 'text', required: false, placeholder: 'e.g. "VOGUE"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'glamour magazine cover, glossy finish, bold sans-serif masthead, professional portrait, 4K',
      composition: 'Portrait fills the frame, masthead at top, cover lines positioned around the image edges',
      subjectRules: 'Use the reference face for the cover portrait. Glamour styling, confident expression, professional lighting.',
      referenceRules: 'Use the provided face reference as the cover portrait. Apply glamour styling and professional magazine lighting.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  filmStrip: {
    id: 'film-strip',
    name: 'Film Strip',
    category: 'Editorial',
    tags: ['editorial', 'film', 'cinema', 'retro', 'movie'],
    description: 'Retro film strip border with cinematic scene inside.',
    previewUrl: '/thumbnails/templates/film_intro_sequence.webp.png',
    previewPrompt: 'Film strip border, cinematic scene inside frames, retro movie aesthetic, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'scene',
    minReferences: 0,
    maxReferences: 1,
    supportedAspectRatios: ['16:9', '2.35:1', '21:9'],
    supportedPlatforms: ['youtube', 'web', 'twitter', 'facebook'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'scene', label: 'Scene Description', type: 'textarea', required: true, placeholder: 'Describe the cinematic scene...' },
      { key: 'filmStyle', label: 'Film Style', type: 'select', required: false, options: ['35mm', '70mm', 'polaroid', 'vhs'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'retro film strip aesthetic, cinematic scene inside frames, film grain, 4K',
      composition: 'Film strip borders top and bottom, cinematic scene visible through the frames, sprocket holes',
      subjectRules: 'Render the scene as a cinematic still. If a reference image is provided, place it inside the film frame.',
      referenceRules: 'If provided, place the reference image inside the film frame. Add film grain and color grading matching the film style.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  // ─── Creative ──────────────────────────────────────────────────────────────
  comic: {
    id: 'comic',
    name: 'Comic',
    category: 'Creative',
    tags: ['creative', 'comic', 'superhero', 'pop-art', 'action'],
    description: 'Bold comic book panel with halftone dots and action energy.',
    previewUrl: '/thumbnails/templates/comic-book.webp',
    previewPrompt: 'Comic book panel, bold outlines, halftone dots, action pose, pop art colors, 4K.',
    requiresReference: true,
    referenceRequired: false,
    referenceType: 'face',
    minReferences: 0,
    maxReferences: 1,
    supportedAspectRatios: ['16:9', '1:1', '9:16'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'tiktok', 'instagram-reel'],
    textMode: 'render-in-image',
    fields: [
      { key: 'action', label: 'Action Type', type: 'select', required: false, options: ['punch', 'fly', 'pose', 'explosion', 'speed'] },
      { key: 'bubbleText', label: 'Speech Bubble Text', type: 'text', required: false, placeholder: 'e.g. "POW!"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'bold comic book art, thick black outlines, halftone dots, vibrant pop colors, 4K',
      composition: 'Dynamic action pose, diagonal energy lines, speech bubble if text is provided, panel border',
      subjectRules: 'If a reference face is provided, maintain the likeness in comic style. Bold outlines, flat colors, exaggerated pose.',
      referenceRules: 'If a reference image is provided, maintain the likeness in comic book style. Bold outlines, flat colors.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  animeComic: {
    id: 'anime-comic',
    name: 'Anime Comic',
    category: 'Creative',
    tags: ['creative', 'anime', 'manga', 'japanese', 'action'],
    description: 'Japanese anime-style action panel with speed lines.',
    previewUrl: '/thumbnails/templates/anime-converter.webp',
    previewPrompt: 'Anime comic panel, speed lines, vibrant colors, dynamic pose, 4K.',
    requiresReference: true,
    referenceRequired: false,
    referenceType: 'face',
    minReferences: 0,
    maxReferences: 1,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'tiktok', 'instagram-reel'],
    textMode: 'render-in-image',
    fields: [
      { key: 'animeStyle', label: 'Anime Style', type: 'select', required: false, options: ['shonen', 'seinen', 'chibi', 'retro-90s'] },
      { key: 'sfx', label: 'Sound Effect Text', type: 'text', required: false, placeholder: 'e.g. "ドン"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'Japanese anime style, dynamic action panel, speed lines, vibrant cel colors, 4K',
      composition: 'Character in dynamic pose, speed lines radiating outward, impact frame if action is selected',
      subjectRules: 'If a reference face is provided, translate the likeness into anime style. Large expressive eyes, stylized hair.',
      referenceRules: 'If a reference image is provided, translate the likeness into anime style. Large expressive eyes, stylized hair, cel-shaded colors.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  tarotCard: {
    id: 'tarot-card',
    name: 'Tarot Card',
    category: 'Creative',
    tags: ['creative', 'tarot', 'mystical', 'occult', 'art nouveau'],
    description: 'Mystical tarot card with ornate border and symbolic imagery.',
    previewUrl: '/thumbnails/templates/gta-loading-screen.webp',
    previewPrompt: 'Mystical tarot card, ornate border, symbolic imagery, rich colors, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['2:3', '1:1', '9:16'],
    supportedPlatforms: ['instagram-post', 'pinterest', 'tiktok'],
    textMode: 'render-in-image',
    fields: [
      { key: 'archetype', label: 'Archetype / Theme', type: 'text', required: true, placeholder: 'e.g. "The Alchemist"' },
      { key: 'symbolism', label: 'Key Symbol', type: 'text', required: false, placeholder: 'e.g. "phoenix, alchemy"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'Art Nouveau tarot card, ornate gold border, rich jewel tones, mystical symbolism, 4K',
      composition: 'Central symbolic figure or object, ornate frame border, title in decorative type at bottom',
      subjectRules: 'Render the archetype as a symbolic figure or scene. Use rich jewel tones and mystical lighting.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  eightBitGame: {
    id: '8-bit-game',
    name: '8-Bit Game',
    category: 'Creative',
    tags: ['creative', '8-bit', 'retro', 'gaming', 'pixel-art'],
    description: 'Retro 8-bit pixel art game scene.',
    previewUrl: '/thumbnails/templates/pixel-art.webp',
    previewPrompt: '8-bit pixel art game scene, retro video game aesthetic, limited palette, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '1:1', '4:3'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'tiktok', 'twitch'],
    textMode: 'render-in-image',
    fields: [
      { key: 'gameGenre', label: 'Game Genre', type: 'select', required: false, options: ['platformer', 'rpg', 'shooter', 'puzzle', 'racing'] },
      { key: 'scene', label: 'Scene', type: 'text', required: true, placeholder: 'e.g. "forest level boss fight"' },
    ],
    promptRecipe: buildRecipe({
      baseStyle: '8-bit pixel art, retro game aesthetic, limited 16-color palette, pixel-perfect, 4K',
      composition: 'Classic game scene composition, character or action centered, pixel-perfect edges',
      subjectRules: 'Render in authentic 8-bit pixel art style. Limited color palette. Visible pixel grid. Retro game UI elements if applicable.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid' },
    version: 1,
  },

  // ─── Product / Environment ────────────────────────────────────────────────
  productHero: {
    id: 'product-hero',
    name: 'Product Hero',
    category: 'Product/Environment',
    tags: ['product', 'hero', 'ecom', 'studio', 'clean'],
    description: 'Clean hero product shot on plain or gradient background.',
    previewUrl: '/thumbnails/templates/product-hero.webp',
    previewPrompt: 'Hero product shot, clean white background, studio lighting, sharp product edges, 4K.',
    requiresReference: true,
    referenceRequired: true,
    referenceType: 'product',
    minReferences: 1,
    maxReferences: 3,
    supportedAspectRatios: ['1:1', '16:9', '4:5'],
    supportedPlatforms: ['youtube', 'instagram-post', 'facebook', 'web', 'pinterest'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'lighting', label: 'Lighting', type: 'select', required: false, options: ['studio-soft', 'studio-dramatic', 'natural', 'rim-light'] },
      { key: 'surface', label: 'Surface', type: 'select', required: false, options: ['white', 'gradient', 'marble', 'wood', 'concrete'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'clean product photography, studio lighting, crisp edges, professional e-commerce, 4K',
      composition: 'Product centered, slight angle if appropriate, clean background, subtle contact shadow',
      subjectRules: 'Use the reference product image(s) as the hero. Maintain exact shape, color, and proportions. Add studio lighting and subtle shadow.',
      referenceRules: 'Use the provided product reference image(s). Maintain exact shape, color, and proportions. Add studio lighting and subtle contact shadow.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'natural', background: 'opaque' },
    version: 1,
  },

  productSpotlight: {
    id: 'product-spotlight',
    name: 'Product Spotlight',
    category: 'Product/Environment',
    tags: ['product', 'spotlight', 'dramatic', 'studio', 'premium'],
    description: 'Dramatic spotlight product with mood and premium feel.',
    previewUrl: '/thumbnails/templates/product_story_showcase.webp.png',
    previewPrompt: 'Product spotlight, dramatic single light, moody dark background, premium feel, 4K.',
    requiresReference: true,
    referenceRequired: true,
    referenceType: 'product',
    minReferences: 1,
    maxReferences: 2,
    supportedAspectRatios: ['16:9', '1:1', '4:5'],
    supportedPlatforms: ['youtube', 'instagram-post', 'facebook', 'web'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'mood', label: 'Mood', type: 'select', required: false, options: ['luxury', 'mysterious', 'energetic', 'calm'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'dramatic product spotlight, single key light, moody dark background, premium editorial, 4K',
      composition: 'Product under a dramatic spotlight, dark surrounding, rim light highlighting edges',
      subjectRules: 'Use the reference product. Dramatic single-source lighting. Dark moody background. Rim light on product edges.',
      referenceRules: 'Use the provided product reference image(s). Dramatic single-source lighting, dark moody background, rim light on edges.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid', background: 'opaque' },
    version: 1,
  },

  workspaceMakeover: {
    id: 'workspace-makeover',
    name: 'Workspace Makeover',
    category: 'Product/Environment',
    tags: ['product', 'workspace', 'office', 'lifestyle', 'environment'],
    description: 'Aspirational workspace or environment scene.',
    previewUrl: '/thumbnails/templates/mirror_change_reveal.webp.png',
    previewPrompt: 'Aspirational workspace makeover, clean desk, warm lighting, plants, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'scene',
    minReferences: 0,
    maxReferences: 1,
    supportedAspectRatios: ['16:9', '1:1', '4:3'],
    supportedPlatforms: ['youtube', 'instagram-post', 'pinterest', 'web'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { key: 'roomType', label: 'Room Type', type: 'select', required: false, options: ['home-office', 'cafe', 'studio', 'outdoor', 'retro'] },
      { key: 'vibe', label: 'Vibe', type: 'select', required: false, options: ['minimal', 'cozy', 'industrial', 'bohemian', 'futuristic'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'aspirational interior photography, warm natural light, clean composition, 4K',
      composition: 'Wide shot of the workspace, hero object or area in focus, inviting atmosphere',
      subjectRules: 'If a reference image is provided, incorporate the reference object into the scene naturally. Focus on the workspace aesthetic.',
      referenceRules: 'If a reference image is provided, incorporate it naturally into the workspace scene. Maintain the vibe and lighting.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'natural' },
    version: 1,
  },

  // ─── Template Studio — visual style designs ──────────────────────────────
  ghibliStorybook: {
    id: 'ghibli-storybook',
    name: 'Ghibli Storybook',
    category: 'Template Studio',
    tags: ['style', 'anime', 'ghibli', 'whimsical', 'hand-drawn', 'template-studio'],
    description: 'Soft hand-drawn anime aesthetic with painterly backgrounds and warm nostalgia.',
    previewUrl: '/thumbnails/templates/ghibli-style.webp',
    previewPrompt: 'Studio Ghibli inspired thumbnail, hand-painted cloudy sky, lush green hills, soft watercolor palette, whimsical character, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'instagram-post', 'instagram-reel', 'tiktok', 'linkedin', 'twitter', 'facebook'],
    textMode: 'render-in-image',
    fields: [
      { ...COMMON_FIELDS.subject, required: true, placeholder: 'e.g. "a small town by the sea"' },
      { ...COMMON_FIELDS.tone },
      { key: 'palette', label: 'Palette', type: 'select', required: false, options: ['soft-pastel', 'warm-autumn', 'lush-green', 'golden-hour', 'moonlit'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'Studio Ghibli inspired hand-drawn anime, painterly watercolor backgrounds, soft cel shading, whimsical, nostalgic, 4K',
      composition: 'Establishing wide shot with a small hero subject, vast lush scenery, balanced negative space for a title',
      subjectRules: 'Depict the subject in a gentle, storybook pose. Keep edges soft and hand-painted. No photorealistic texture.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid', background: 'auto' },
    version: 1,
  },

  cyberpunkNeon: {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    category: 'Template Studio',
    tags: ['style', 'cyberpunk', 'neon', 'scifi', 'template-studio'],
    description: 'Rain-slick neon cityscape with holographic signage and a moody magenta-cyan grade.',
    previewUrl: '/thumbnails/templates/cyberpunk-style.webp',
    previewPrompt: 'Cyberpunk thumbnail, neon-lit alley, rain on pavement, holographic signage, magenta-cyan color grade, blade-runner mood, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'instagram-post', 'instagram-reel', 'tiktok', 'linkedin', 'twitter', 'facebook'],
    textMode: 'render-in-image',
    fields: [
      { ...COMMON_FIELDS.subject, required: true, placeholder: 'e.g. "a lone netrunner on a rooftop"' },
      { ...COMMON_FIELDS.tone },
      { key: 'grade', label: 'Color Grade', type: 'select', required: false, options: ['magenta-cyan', 'toxic-green', 'amber-blue', 'violet-pink'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'cyberpunk neon cityscape, rain-slick streets, holographic signage, magenta-cyan color grade, blade-runner mood, 4K',
      composition: 'Dutch-angle medium shot, neon reflections in wet pavement, deep perspective down a glowing alley',
      subjectRules: 'Depict the subject as a silhouette or chrome figure lit by neon. High contrast, glowing edges.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid', background: 'auto' },
    version: 1,
  },

  filmNoir: {
    id: 'film-noir',
    name: 'Film Noir',
    category: 'Template Studio',
    tags: ['style', 'noir', 'black-and-white', 'cinematic', 'template-studio'],
    description: 'Classic high-contrast black-and-white detective mood with hard shadows and smoke.',
    previewUrl: '/thumbnails/templates/film-noir.webp',
    previewPrompt: 'Film noir thumbnail, hard venetian-blind shadows, smoke, fedora silhouette, high-contrast black and white, 1940s mood, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '1:1', '4:3'],
    supportedPlatforms: ['youtube', 'instagram-post', 'linkedin', 'twitter', 'facebook'],
    textMode: 'render-in-image',
    fields: [
      { ...COMMON_FIELDS.subject, required: true, placeholder: 'e.g. "a detective in a dim office"' },
      { ...COMMON_FIELDS.tone },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'classic film noir, high-contrast black and white, hard shadows, smoke, venetian blinds light, 1940s detective mood, 4K',
      composition: 'Low-key lighting, single key light, dramatic shadow across the frame, minimal background',
      subjectRules: 'Render the subject as a noir silhouette or fedora figure. Crisp black-and-white contrast.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'natural', background: 'opaque' },
    version: 1,
  },

  legoBrick: {
    id: 'lego-brick',
    name: 'LEGO Brick',
    category: 'Template Studio',
    tags: ['style', 'lego', 'toy', 'playful', 'template-studio'],
    description: 'Bright blocky 3D toy render with visible studs and a playful plastic aesthetic.',
    previewUrl: '/thumbnails/templates/lego-style.webp',
    previewPrompt: 'LEGO brick-built thumbnail, bright primary colors, visible studs, playful toy render, white studio turntable, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '1:1', '4:5'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'instagram-post', 'instagram-reel', 'tiktok', 'facebook'],
    textMode: 'render-in-image',
    fields: [
      { ...COMMON_FIELDS.subject, required: true, placeholder: 'e.g. "a race car built from bricks"' },
      { key: 'palette', label: 'Palette', type: 'select', required: false, options: ['primary', 'pastel', 'neon', 'earthy'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'LEGO brick-built 3D render, plastic studs, bright primary colors, playful toy aesthetic, 4K',
      composition: 'Isometric hero build centered on a white studio turntable, soft ambient occlusion',
      subjectRules: 'Depict the subject as a blocky LEGO minifigure or model. Exaggerated studs, no realistic texture.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid', background: 'opaque' },
    version: 1,
  },

  pixelArt: {
    id: 'pixel-art',
    name: 'Pixel Art',
    category: 'Template Studio',
    tags: ['style', 'pixel-art', 'retro-gaming', '8-bit', 'template-studio'],
    description: 'Chunky 16-bit sprite aesthetic with a limited palette and visible pixels.',
    previewUrl: '/thumbnails/templates/pixel-art.webp',
    previewPrompt: '16-bit pixel art thumbnail, limited color palette, dithering, retro game sprite, chunky pixels, 4K upscaled.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '1:1', '9:16'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'instagram-post', 'instagram-reel', 'tiktok', 'twitter'],
    textMode: 'render-in-image',
    fields: [
      { ...COMMON_FIELDS.subject, required: true, placeholder: 'e.g. "a hero sprite in a dungeon"' },
      { key: 'palette', label: 'Palette', type: 'select', required: false, options: ['gameboy', 'nes', 'cga', 'custom'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: '16-bit pixel art, limited color palette, dithering, retro game sprite aesthetic, 4K upscaled',
      composition: 'Centered sprite on a flat background, chunky pixels, simple readable silhouette',
      subjectRules: 'Render the subject as a pixel-art sprite with hard edges and visible pixels. No gradients.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'render-in-image',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid', background: 'opaque' },
    version: 1,
  },

  // ─── Effects Studio — cinematic / VFX designs ────────────────────────────
  bulletTime: {
    id: 'bullet-time',
    name: 'Bullet Time',
    category: 'Effects Studio',
    tags: ['effect', 'bullet-time', 'cinematic', 'action', 'effects-studio'],
    description: 'Frozen hero moment with radiating motion lines and a single accent color.',
    previewUrl: '/thumbnails/templates/bullet-time.webp',
    previewPrompt: 'Bullet-time thumbnail, hero frozen mid-action, radiating motion lines, desaturated mid-tones with one accent, cinematic, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'instagram-post', 'instagram-reel', 'tiktok', 'facebook'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { ...COMMON_FIELDS.subject, required: true, placeholder: 'e.g. "a hero leaping through the air"' },
      { key: 'accent', label: 'Accent Color', type: 'select', required: false, options: ['cyan', 'amber', 'magenta', 'white'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'bullet-time cinematic freeze, radiating motion lines, desaturated mid-tones with a single accent, The Matrix meets Hero, 4K',
      composition: 'Hero subject at center, environment fragments suspended around them, radial camera push',
      subjectRules: 'Depict the subject mid-action, frozen, with shards or particles hovering. Dynamic but static.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid', background: 'auto' },
    version: 1,
  },

  carChase: {
    id: 'car-chase',
    name: 'Car Chase',
    category: 'Effects Studio',
    tags: ['effect', 'car-chase', 'action', 'automotive', 'effects-studio'],
    description: 'High-speed automotive action with motion blur, lens flare, and a teal-orange grade.',
    previewUrl: '/thumbnails/templates/car-chase.webp',
    previewPrompt: 'Car chase thumbnail, low tracking shot alongside a speeding hero vehicle, speed lines, dust and sparks, teal-orange grade, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'instagram-post', 'instagram-reel', 'tiktok', 'facebook'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { ...COMMON_FIELDS.subject, required: true, placeholder: 'e.g. "a black sports car at dusk"' },
      { key: 'weather', label: 'Conditions', type: 'select', required: false, options: ['dry', 'rain', 'night', 'desert'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'high-speed car chase, motion-blur roads, lens flare, teal-orange grade, automotive action film, 4K',
      composition: 'Low tracking shot alongside a speeding hero vehicle, speed lines, dust and sparks',
      subjectRules: 'Feature the vehicle as the hero, aggressive perspective, strong sense of velocity.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid', background: 'auto' },
    version: 1,
  },

  explosionFx: {
    id: 'explosion-fx',
    name: 'Explosion FX',
    category: 'Effects Studio',
    tags: ['effect', 'explosion', 'vfx', 'action', 'effects-studio'],
    description: 'Cinematic blockbuster blast with fireball, debris, and volumetric smoke.',
    previewUrl: '/thumbnails/templates/building-explosion.webp',
    previewPrompt: 'Explosion VFX thumbnail, fireball and debris, volumetric smoke, dramatic rim light, building engulfed, blockbuster, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'instagram-post', 'instagram-reel', 'tiktok', 'facebook'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { ...COMMON_FIELDS.subject, required: true, placeholder: 'e.g. "a fortress under siege"' },
      { key: 'scale', label: 'Scale', type: 'select', required: false, options: ['small', 'medium', 'epic', 'world-ending'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'cinematic explosion VFX, fireball and debris, volumetric smoke, dramatic rim light, blockbuster, 4K',
      composition: 'Wide hero frame with the subject engulfed, shockwave toward camera, embers and flying debris',
      subjectRules: 'Depict the subject at the center of the blast as a protected hero silhouette, epic scale.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid', background: 'auto' },
    version: 1,
  },

  matrixRain: {
    id: 'matrix-rain',
    name: 'Matrix Rain',
    category: 'Effects Studio',
    tags: ['effect', 'matrix', 'digital', 'scifi', 'effects-studio'],
    description: 'Falling green katakana code with a glowing figure in a virtual world.',
    previewUrl: '/thumbnails/templates/matrix-shot.webp',
    previewPrompt: 'Matrix digital rain thumbnail, falling green katakana code, dark virtual world, reflective black floor, glowing figure, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'instagram-post', 'instagram-reel', 'tiktok', 'facebook'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { ...COMMON_FIELDS.subject, required: true, placeholder: 'e.g. "an agent standing in the code"' },
      { key: 'hue', label: 'Code Hue', type: 'select', required: false, options: ['green', 'amber', 'blue', 'red'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'Matrix digital rain, falling green katakana code, dark virtual world, reflective black floor, 4K',
      composition: 'Subject standing in a column of cascading code, mirrored floor, god-rays of accent color',
      subjectRules: 'Render the subject as a glowing figure within the code stream. Monochrome accent only.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'vivid', background: 'auto' },
    version: 1,
  },

  dollyZoom: {
    id: 'dolly-zoom',
    name: 'Vertigo Dolly Zoom',
    category: 'Effects Studio',
    tags: ['effect', 'dolly-zoom', 'vertigo', 'cinematic', 'effects-studio'],
    description: 'Hitchcock vertigo effect with a warped, bending background perspective.',
    previewUrl: '/thumbnails/templates/dolly-zoom.webp',
    previewPrompt: 'Vertigo dolly-zoom thumbnail, warped background perspective, anxious tilt, subject held steady, Hitchcock cinematic, 4K.',
    requiresReference: false,
    referenceRequired: false,
    referenceType: 'none',
    minReferences: 0,
    maxReferences: 0,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'instagram-post', 'instagram-reel', 'tiktok', 'facebook'],
    textMode: 'leave-space-for-overlay',
    fields: [
      { ...COMMON_FIELDS.subject, required: true, placeholder: 'e.g. "a person realizing the truth"' },
      { key: 'intensity', label: 'Intensity', type: 'select', required: false, options: ['subtle', 'moderate', 'extreme'] },
    ],
    promptRecipe: buildRecipe({
      baseStyle: 'Vertigo effect dolly zoom, warped background perspective, anxious tilt, Hitchcock cinematic, 4K',
      composition: 'Subject centered while the environment stretches or compresses behind them, unsettling depth',
      subjectRules: 'Keep the subject the same size while the background bends. Psychological tension.',
      referenceRules: 'No reference images needed for this template.',
      textMode: 'leave-space-for-overlay',
    }),
    generationDefaults: { ...DEFAULT_GENERATION, quality: 'high', style: 'natural', background: 'auto' },
    version: 1,
  },
};

/**
 * Get a template by id.
 * @param {string} id
 * @returns {ThumbnailTemplate|undefined}
 */
export function getTemplateById(id) {
  return THUMBNAIL_TEMPLATES[id] || undefined;
}

/**
 * Backward-compatible alias for getTemplateById.
 * @param {string} id
 * @returns {ThumbnailTemplate|undefined}
 */
export function getTemplate(id) {
  return getTemplateById(id);
}

/**
 * Get all templates.
 * @returns {ThumbnailTemplate[]}
 */
export function getAllTemplates() {
  return Object.values(THUMBNAIL_TEMPLATES);
}

/**
 * Get templates filtered by category.
 * @param {string} category
 * @returns {ThumbnailTemplate[]}
 */
export function getTemplatesByCategory(category) {
  return getAllTemplates().filter(t => t.category === category);
}

/**
 * Get templates filtered by platform key.
 * @param {string} platformKey
 * @returns {ThumbnailTemplate[]}
 */
export function getTemplatesByPlatform(platformKey) {
  return getAllTemplates().filter(t => t.supportedPlatforms.includes(platformKey));
}

/**
 * Get templates filtered by aspect ratio.
 * @param {string} aspectRatio
 * @returns {ThumbnailTemplate[]}
 */
export function getTemplatesByAspectRatio(aspectRatio) {
  return getAllTemplates().filter(t => t.supportedAspectRatios.includes(aspectRatio));
}

/**
 * Search templates by query string (matches id, name, category, tags, description).
 * @param {string} query
 * @returns {ThumbnailTemplate[]}
 */
export function searchTemplates(query) {
  const q = query.toLowerCase().trim();
  if (!q) return getAllTemplates();
  return getAllTemplates().filter(t => {
    return (
      t.id.includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q)) ||
      t.description.toLowerCase().includes(q)
    );
  });
}

/**
 * Get distinct categories from all templates.
 * @returns {string[]}
 */
export function getTemplateCategories() {
  const cats = new Set(getAllTemplates().map(t => t.category));
  return [...cats].sort();
}

/**
 * Curated subset of templates surfaced directly on the thumbnail modal's
 * main view, so users can pick a design without opening "Explore Ideas".
 *
 * Prioritizes templates tagged `high-ctr` and `popular`, then fills the
 * remaining slots with the rest of the catalog (preserving the registry
 * order). Returns at most `limit` entries (default 12).
 *
 * The `limit` value is clamped to a non-negative integer; invalid inputs
 * (e.g. negative, `NaN`, `undefined` after floor) resolve to an empty array.
 * @param {number} [limit=12]
 * @returns {import('./thumbnailTemplateValidation.js').ThumbnailTemplate[]}
 */
export function getFeaturedTemplates(limit = 12) {
  const n = Math.max(0, Math.floor(limit));
  const all = getAllTemplates();
  const featured = all.filter(
    (t) => t.tags.includes('high-ctr') || t.tags.includes('popular')
  );
  const seen = new Set(featured.map((t) => t.id));
  const rest = all.filter((t) => !seen.has(t.id));
  return [...featured, ...rest].slice(0, n);
}

/**
 * Cached derived list of template categories.
 * Other modules can import this directly instead of calling getTemplateCategories().
 */
export const TEMPLATE_CATEGORIES = getTemplateCategories();

/**
 * Validate a template against the current schema.
 * @param {ThumbnailTemplate} template
 * @throws {import('./thumbnailTemplateValidation.js').ValidationError}
 */
export function validateRegistryTemplate(template) {
  validateTemplate(template);
}

/**
 * Validate field values against a template.
 * @param {ThumbnailTemplate} template
 * @param {Record<string, unknown>} values
 * @returns {string[]} Array of error messages (empty if valid)
 */
export function validateTemplateFieldValues(template, values) {
  return validateFieldValues(template, values);
}

export default {
  THUMBNAIL_TEMPLATES,
  getTemplateById,
  getTemplate,
  getAllTemplates,
  getTemplatesByCategory,
  getTemplatesByPlatform,
  getTemplatesByAspectRatio,
  searchTemplates,
  getTemplateCategories,
  getFeaturedTemplates,
  validateRegistryTemplate,
  validateTemplateFieldValues,
};
