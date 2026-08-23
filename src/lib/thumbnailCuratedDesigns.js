/**
 * Curated Thumbnail Designs (asset-backed)
 *
 * 20 hand-picked, existing thumbnail designs we already have on disk, reused
 * as first-class "designs" inside the Thumbnail Studio instead of generating
 * 30 new AI designs from scratch.
 *
 * Each entry:
 *   - `source: 'asset'`            → the design logic + image already exist on disk
 *   - `previewUrl` / `assetPath`   → the EXISTING thumbnail image (used for the
 *                                     Explore Ideas row and as a STYLE reference)
 *   - `referenceType: 'style'`     → when restyling a user upload, the existing
 *                                     image is applied as a *style* reference
 *                                     (look only), not as a subject to copy
 *   - `promptRecipe`               → the CREATION LOGIC used to generate the
 *                                     user's uploaded image into this design
 *
 * The `promptRecipe` text was authored per-design (see git history / sub-agents)
 * and is fed to buildThumbnailPrompt() so generation/restyle inherits the design.
 */

import { buildRecipe } from './thumbnailTemplateRegistry.js';

const ASSET = '/thumbnails';

/** @typedef {ReturnType<typeof buildRecipe>} PromptRecipe */

/**
 * @typedef {Object} CuratedThumbnailDesign
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {'asset'} source
 * @property {'template'|'effect'} designKind
 * @property {string} previewUrl
 * @property {string} assetPath
 * @property {'style'} referenceType
 * @property {PromptRecipe} promptRecipe
 * @property {string[]} supportedAspectRatios
 * @property {string[]} [supportedPlatforms]
 */

/** @type {Record<string, CuratedThumbnailDesign>} */
export const CURATED_THUMBNAIL_DESIGNS = {
  // ─── Templates (design logic derived from templateSpecs visualStyle/cinematography) ──
  'magazine-cover': {
    id: 'magazine-cover', name: 'Magazine Cover', category: 'Editorial',
    source: 'asset', designKind: 'template',
    previewUrl: `${ASSET}/templates/magazine-cover.webp`,
    assetPath: `${ASSET}/templates/magazine-cover.webp`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Editorial, high-fashion, sophisticated Vogue-style magazine aesthetics with refined typography and luxe production values.',
      composition: "Classic magazine cover layout: subject centered or three-quarter framed as the cover model, masthead title baked across the top, optional cover lines reserved along edges, generous negative space framing the figure.",
      subjectRules: "Place the user's uploaded person as the cover subject in a poised, editorial portrait pose; preserve their facial identity, enhance skin and styling to high-fashion standard, keep them as the clear focal point.",
      referenceRules: "Use the existing magazine-cover thumbnail ONLY as a style reference: copy its editorial lighting, fashion-grade color grading, masthead typography treatment, and luxe print finish; do NOT copy its specific model or headline words.",
      textMode: 'render-in-image',
      finishingRules: 'Keep a glossy, premium editorial finish; protect the masthead area from clutter; no stray logos or watermarks; ensure the subject reads cleanly at small sizes.',
    },
    supportedAspectRatios: ['2:3', '1:1', '9:16'],
    supportedPlatforms: ['instagram-post', 'pinterest', 'web'],
  },
  'cyberpunk-style': {
    id: 'cyberpunk-style', name: 'Cyberpunk Style', category: 'Creative',
    source: 'asset', designKind: 'template',
    previewUrl: `${ASSET}/templates/cyberpunk-style.webp`,
    assetPath: `${ASSET}/templates/cyberpunk-style.webp`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Neon-lit, futuristic, high-tech Blade Runner aesthetic with saturated cyan and magenta glow and wet-street reflections.',
      composition: 'Dramatic off-center subject framing with strong diagonal perspective, heavy foreground neon bokeh, deep atmospheric background, and an open area at top or bottom for a headline overlay.',
      subjectRules: "Keep the user's uploaded subject recognizable; wrap them in futuristic attire, augmented details, and rim-lit neon edges; enhance their features with high-contrast cyberpunk grading.",
      referenceRules: "Use the existing cyberpunk thumbnail ONLY as a style reference: copy its neon palette, contrast curve, volumetric haze, and gritty tech-city mood; do NOT copy its original subject or scene content.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Maintain crisp silhouette readability against glow; avoid blown-out highlights; no embedded logos or watermarks; reserve clean headline space.',
    },
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'tiktok', 'instagram-reel'],
  },
  '1970s-style': {
    id: '1970s-style', name: '1970s Style', category: 'Retro',
    source: 'asset', designKind: 'template',
    previewUrl: `${ASSET}/templates/1970s-style.webp`,
    assetPath: `${ASSET}/templates/1970s-style.webp`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Groovy, psychedelic 1970s retro aesthetic with warm sun-bleached tones, soft grain, and earthy color palette.',
      composition: 'Vintage centered or softly off-center framing with warm vignette, analog film grain, and a calm band of negative space for a title overlay.',
      subjectRules: "Preserve the user's uploaded subject but re-grade them into warm 70s tones, soft focus, and retro wardrobe/lighting; keep their face clearly identifiable.",
      referenceRules: "Use the existing 1970s thumbnail ONLY as a style reference: copy its warm color grading, psychedelic softness, film grain, and retro mood; do NOT copy its subject or composition exactly.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep a cohesive warm retro grade with gentle grain; protect subject clarity at small size; no modern logos or watermarks; reserve headline space.',
    },
    supportedAspectRatios: ['16:9', '4:3', '2:3'],
    supportedPlatforms: ['youtube', 'web', 'twitter', 'facebook'],
  },
  'reaction-thumbnail': {
    id: 'reaction-thumbnail', name: 'Reaction Thumbnail', category: 'Creator/Person',
    source: 'asset', designKind: 'template',
    previewUrl: `${ASSET}/templates/reaction-thumbnail.webp`,
    assetPath: `${ASSET}/templates/reaction-thumbnail.webp`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Expressive, exaggerated, bold internet-native reaction aesthetic with punchy colors and high energy.',
      composition: 'Tight facial close-up framing with the subject large and central, strong directional contrast, and a bold empty headline zone across the top third.',
      subjectRules: "Amplify the user's uploaded expression into an exaggerated, emotive reaction while keeping their face recognizable; push contrast and saturation for impact.",
      referenceRules: "Use the existing reaction thumbnail ONLY as a style reference: copy its bold contrast, vivid color pop, and punchy internet-native energy; do NOT copy its specific person or reaction.",
      textMode: 'leave-space-for-overlay',
      finishingRules: "Maximize small-screen readability of the face; keep a clean high-contrast headline zone; no watermarks or channel logos; avoid cluttered backgrounds.",
    },
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'tiktok', 'instagram-reel'],
  },
  'tiktok-video': {
    id: 'tiktok-video', name: 'TikTok Video', category: 'Creator/Person',
    source: 'asset', designKind: 'template',
    previewUrl: `${ASSET}/templates/tiktok-video.webp`,
    assetPath: `${ASSET}/templates/tiktok-video.webp`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Trend-aware, cinematic-social, energetic and polished vertical aesthetic tuned for viral 9:16 short-form video.',
      composition: 'Vertical 9:16 hook-first framing with the subject in a dynamic close-up, confident negative space at the top for a title, and a sense of motion via push-in depth.',
      subjectRules: "Keep the user's uploaded subject as the on-camera talent; enhance them with cinematic-social lighting and polish, preserving identity while adding energetic vibe.",
      referenceRules: "Use the existing TikTok thumbnail ONLY as a style reference: copy its vertical cinematic-social grading, punchy dynamic lighting, and polished trend-aware mood; do NOT copy its subject or specific clip.",
      textMode: 'leave-space-for-overlay',
      finishingRules: "Keep the 9:16 vertical format intact; ensure subject pops on mobile; reserve clean top headline space; no watermarks or platform UI faked in.",
    },
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    supportedPlatforms: ['youtube-shorts', 'tiktok', 'instagram-reel', 'instagram-story'],
  },
  'real_estate_cinematic': {
    id: 'real_estate_cinematic', name: 'Real Estate Cinematic', category: 'Product/Environment',
    source: 'asset', designKind: 'template',
    previewUrl: `${ASSET}/templates/real_estate_cinematic.webp.png`,
    assetPath: `${ASSET}/templates/real_estate_cinematic.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Cinematic luxury real-estate photography with warm architectural lighting, depth-of-field bokeh, and a premium filmic color grade.',
      composition: 'Center the property or interior as a hero with a wide cinematic aspect, low camera angle for grandeur, and a clean upper-third zone reserved for a headline.',
      subjectRules: "Treat the user's uploaded photo as the hero real-estate subject: preserve its architecture and key features, enhance lighting to warm golden hour tones, and keep the property clearly identifiable.",
      referenceRules: "Use the design's existing thumbnail only as a STYLE reference—copy its warm cinematic grade, soft bokeh, vignette, and premium mood—never reuse its building, rooms, or people.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep the image crisp and readable at small size, no watermarks or logos, subtle film grain, rich but natural contrast, no burnt-in text.',
    },
    supportedAspectRatios: ['16:9', '1:1', '4:5'],
    supportedPlatforms: ['youtube', 'instagram-post', 'facebook', 'web', 'pinterest'],
  },
  'vogue_motion_film': {
    id: 'vogue_motion_film', name: 'Vogue Motion Film', category: 'Editorial',
    source: 'asset', designKind: 'template',
    previewUrl: `${ASSET}/templates/vogue_motion_film.webp.png`,
    assetPath: `${ASSET}/templates/vogue_motion_film.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'High-fashion Vogue-style motion film glamour with elegant soft studio lighting, refined grain, and an editorial cinematic feel.',
      composition: 'Frame the subject with elegant negative space, a refined off-center or three-quarter pose, and a calm upper or lower zone reserved for a headline.',
      subjectRules: "Treat the user's uploaded image as the fashion/editorial subject: elevate it with soft directional light, graceful posture, and a refined luxurious atmosphere while keeping the subject's identity intact.",
      referenceRules: "Use the design's existing thumbnail only as a STYLE reference—copy its Vogue editorial glamour, soft elegant light, refined grain, and muted sophisticated palette—never reuse its model or scene.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep the image crisp and readable at small size, no watermarks or logos, tasteful film grain, elegant muted contrast, no burnt-in text.',
    },
    supportedAspectRatios: ['2:3', '1:1', '9:16'],
    supportedPlatforms: ['instagram-post', 'pinterest', 'web'],
  },
  'luxury_address_showcase': {
    id: 'luxury_address_showcase', name: 'Luxury Address Showcase', category: 'Product/Environment',
    source: 'asset', designKind: 'template',
    previewUrl: `${ASSET}/templates/luxury_address_showcase.webp.png`,
    assetPath: `${ASSET}/templates/luxury_address_showcase.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Opulent luxury address showcase with a gold-and-black premium palette, gleaming metallic accents, and a polished high-contrast editorial look.',
      composition: 'Present the property or subject as a centered premium hero on a deep black backdrop with gold accent lighting, reserving a top band for a headline overlay.',
      subjectRules: "Treat the user's uploaded photo as the luxury subject: surround it with gold rim lighting and a black luxe environment, enhancing its premium feel while keeping it clearly recognizable.",
      referenceRules: "Use the design's existing thumbnail only as a STYLE reference—copy its gold/black opulent palette, metallic sheen, and polished high-contrast mood—never reuse its property or text.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep the image crisp and readable at small size, no watermarks or logos, rich black tones with controlled gold highlights, no burnt-in text.',
    },
    supportedAspectRatios: ['16:9', '1:1', '4:5'],
    supportedPlatforms: ['youtube', 'instagram-post', 'facebook', 'web'],
  },
  'emotional_turning_point': {
    id: 'emotional_turning_point', name: 'Emotional Turning Point', category: 'Information/Education',
    source: 'asset', designKind: 'template',
    previewUrl: `${ASSET}/templates/emotional_turning_point.webp.png`,
    assetPath: `${ASSET}/templates/emotional_turning_point.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Emotional cinematic storytelling thumbnail with dramatic light, intimate mood, and a heartfelt narrative atmosphere.',
      composition: 'Capture the subject in a close, intimate framing with directional emotional light and a darkened frame edge, leaving a quiet zone for a headline overlay.',
      subjectRules: "Treat the user's uploaded photo as the emotional narrative moment: emphasize expression, gesture, or atmosphere with soft dramatic light while keeping the subject authentic.",
      referenceRules: "Use the design's existing thumbnail only as a STYLE reference—copy its dramatic cinematic lighting, intimate mood, and heartfelt color grade—never reuse its scene or people.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep the image crisp and readable at small size, no watermarks or logos, gentle film grain, emotional contrast, no burnt-in text.',
    },
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'tiktok', 'facebook'],
  },
  'ai_commercial': {
    id: 'ai_commercial', name: 'AI Commercial', category: 'Marketing/Social',
    source: 'asset', designKind: 'template',
    previewUrl: `${ASSET}/templates/ai_commercial.webp.png`,
    assetPath: `${ASSET}/templates/ai_commercial.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Sleek modern AI/SaaS commercial look with clean tech aesthetic, bright neutral lighting, and a minimal premium product feel.',
      composition: 'Show the subject with clean negative space, balanced centered or rule-of-thirds framing, and a calm area reserved for a headline overlay.',
      subjectRules: "Treat the user's uploaded image as the modern product or subject: present it with crisp clean lighting, subtle reflections, and a minimal tech backdrop while keeping it clearly identifiable.",
      referenceRules: "Use the design's existing thumbnail only as a STYLE reference—copy its clean tech aesthetic, bright neutral lighting, and minimal modern composition—never reuse its product or graphics.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep the image crisp and readable at small size, no watermarks or logos, clean high-key contrast, no burnt-in text.',
    },
    supportedAspectRatios: ['16:9', '1:1', '4:5'],
    supportedPlatforms: ['youtube', 'linkedin', 'twitter', 'facebook', 'web'],
  },

  // ─── Effects (style designs we already have thumbnail art for) ──
  'american-comic-style': {
    id: 'american-comic-style', name: 'American Comic Style', category: 'Creative',
    source: 'asset', designKind: 'effect',
    previewUrl: `${ASSET}/effects/image-effects/american-comic-style.webp.png`,
    assetPath: `${ASSET}/effects/image-effects/american-comic-style.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Bold American comic-book pop-art with thick black outlines, halftone dot shading, and punchy flat colors.',
      composition: 'Centered hero subject on a clean comic background with a simple radial burst or panel framing and strong negative space at the top for a headline.',
      subjectRules: "Take the user's uploaded photo, convert the person/object into a flat-shaded comic character with heavy inked contours and Ben-Day halftone textures while preserving recognizable likeness.",
      referenceRules: "Use the existing thumbnail only as a STYLE reference to copy its ink-line weight, halftone pattern, palette, and pop-art energy—do not copy its subject or text.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep shapes bold and readable at small size, no watermarks or logos, preserve high contrast for thumbnail legibility.',
    },
    supportedAspectRatios: ['16:9', '1:1', '9:16'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'tiktok', 'instagram-reel'],
  },
  'futuristic-american-comics': {
    id: 'futuristic-american-comics', name: 'Futuristic American Comics', category: 'Creative',
    source: 'asset', designKind: 'effect',
    previewUrl: `${ASSET}/effects/image-effects/futuristic-american-comics.webp.png`,
    assetPath: `${ASSET}/effects/image-effects/futuristic-american-comics.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Futuristic sci-fi comic-book style with neon-lit panels, glowing edges, and kinetic action energy.',
      composition: 'Subject placed dynamically with diagonal motion lines and glowing neon comic panel borders, reserving a dark upper area for a headline overlay.',
      subjectRules: "Transform the user's uploaded photo into a sleek sci-fi comic hero with neon rim-light, glossy armor-like shading, and dynamic action posing while keeping the likeness.",
      referenceRules: "Use the existing thumbnail strictly as a STYLE reference for its neon comic palette, glowing panel framing, and futuristic energy—never reuse its subject or text.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep neon elements contained and readable at small size, no watermarks or logos, ensure strong silhouette contrast.',
    },
    supportedAspectRatios: ['16:9', '1:1', '9:16'],
    supportedPlatforms: ['youtube', 'youtube-shorts', 'tiktok', 'instagram-reel'],
  },
  'acrylic-ornaments': {
    id: 'acrylic-ornaments', name: 'Acrylic Ornaments', category: 'Creative',
    source: 'asset', designKind: 'effect',
    previewUrl: `${ASSET}/effects/image-effects/acrylic-ornaments.webp.png`,
    assetPath: `${ASSET}/effects/image-effects/acrylic-ornaments.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: '3D acrylic ornament craft aesthetic with glossy, translucent, candy-colored figurine surfaces and soft specular highlights.',
      composition: 'Subject rendered as a single glossy acrylic standee ornament centered on a soft pastel backdrop, with room at the top for a headline.',
      subjectRules: "Sculpt the user's uploaded photo into a smooth, rounded 3D translucent acrylic charm with depth, internal light glow, and a thick glossy clear-coat edge while keeping recognizable features.",
      referenceRules: "Use the existing thumbnail only as a STYLE reference for its glossy translucent material, rounded ornament shaping, and pastel craft palette—do not copy its subject or text.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep the form simple and readable at small size, no watermarks or logos, emphasize clean specular highlights and soft shadows.',
    },
    supportedAspectRatios: ['1:1', '9:16', '4:5'],
    supportedPlatforms: ['instagram-post', 'instagram-story', 'tiktok', 'pinterest'],
  },
  'felt-3d-polaroid': {
    id: 'felt-3d-polaroid', name: 'Felt 3D Polaroid', category: 'Creative',
    source: 'asset', designKind: 'effect',
    previewUrl: `${ASSET}/effects/image-effects/felt-3d-polaroid.webp.png`,
    assetPath: `${ASSET}/effects/image-effects/felt-3d-polaroid.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Tactile felt-and-craft 3D diorama set inside a white Polaroid frame with soft, fuzzy, handmade texture.',
      composition: 'Subject arranged as a small 3D felt diorama centered within the inner Polaroid window, with the thick white border left clean and the top inner area open for a headline.',
      subjectRules: "Rebuild the user's uploaded photo as a soft felt/craft 3D scene with stitched edges, fuzzy fabric shading, and gentle raised relief while preserving the subject's identity.",
      referenceRules: "Use the existing thumbnail only as a STYLE reference for its felt texture, soft craft lighting, and Polaroid framing—do not copy its subject or text.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep the diorama simple and legible at small size, no watermarks or logos, preserve the clean white Polaroid border.',
    },
    supportedAspectRatios: ['1:1', '9:16', '4:5'],
    supportedPlatforms: ['instagram-post', 'instagram-story', 'tiktok', 'pinterest'],
  },
  'glass-ball': {
    id: 'glass-ball', name: 'Glass Ball', category: 'Creative',
    source: 'asset', designKind: 'effect',
    previewUrl: `${ASSET}/effects/image-effects/glass-ball.webp.png`,
    assetPath: `${ASSET}/effects/image-effects/glass-ball.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Crystal-glass sphere aesthetic where the subject is reflected and refracted inside a glowing transparent ball with realistic highlights.',
      composition: 'Subject captured small and curved within a centered glass sphere resting on a soft reflective surface, with surrounding space reserved at the top for a headline overlay.',
      subjectRules: "Place the user's uploaded photo inside a glass ball: invert, curve, and miniaturize the scene with spherical refraction, interior depth, and a tiny inverted world while keeping the subject recognizable.",
      referenceRules: "Use the existing thumbnail only as a STYLE reference for its refractive glass material, highlight placement, and sphere lighting—do not copy its subject or text.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep the sphere crisp and the subject readable at small size, no watermarks or logos, emphasize realistic specular glints and soft shadow.',
    },
    supportedAspectRatios: ['1:1', '16:9', '9:16'],
    supportedPlatforms: ['instagram-post', 'pinterest', 'tiktok'],
  },
  'lofi-pixel-character': {
    id: 'lofi-pixel-character', name: 'Lo-fi Pixel Character', category: 'Creative',
    source: 'asset', designKind: 'effect',
    previewUrl: `${ASSET}/effects/image-effects/lofi-pixel-character.webp.png`,
    assetPath: `${ASSET}/effects/image-effects/lofi-pixel-character.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Soft retro 16-bit pixel art with a muted lo-fi game palette and a cozy, calm mood.',
      composition: 'Center the subject as a small character bust or portrait on a simple flat or gently gradient background, framed with generous negative space at the top for a headline.',
      subjectRules: "Reinterpret the user's uploaded person or object as a chunky pixel-art sprite: reduce detail to readable blocks, snap to a pixel grid, and keep features recognizable at thumbnail size.",
      referenceRules: "Use the existing Lo-fi Pixel Character thumbnail only as a STYLE reference: copy its pixel density, retro palette, and cozy lighting, not its specific character or scene.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep pixels crisp and non-blurry, limited retro palette, no watermarks or logos, readable silhouette at small size.',
    },
    supportedAspectRatios: ['1:1', '16:9', '9:16'],
    supportedPlatforms: ['youtube', 'instagram-post', 'tiktok', 'pinterest'],
  },
  'landscape-mini-world': {
    id: 'landscape-mini-world', name: 'Landscape Mini World', category: 'Creative',
    source: 'asset', designKind: 'effect',
    previewUrl: `${ASSET}/effects/image-effects/landscape-mini-world.webp.png`,
    assetPath: `${ASSET}/effects/image-effects/landscape-mini-world.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Miniature diorama photography with tilt-shift blur, making real scenes look like tiny toy worlds inside a container or sphere.',
      composition: 'Place the subject as a small world-in-a-bubble or contained diorama, centered with the foreground sharp and edges softly blurred, leaving open space at the top for a headline.',
      subjectRules: "Shrink and embed the user's uploaded subject into a miniature landscape diorama: treat it as a tiny scene element within a spherical or glass container with a small-scale feel.",
      referenceRules: "Use the existing Landscape Mini World thumbnail only as a STYLE reference: copy its tilt-shift depth, toy-like miniature scale, and contained-diorama framing, not its specific terrain.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Apply convincing tilt-shift blur, keep a believable tiny scale, soft dreamy light, no text/watermarks, clear focal subject.',
    },
    supportedAspectRatios: ['1:1', '9:16', '16:9'],
    supportedPlatforms: ['instagram-post', 'pinterest', 'tiktok'],
  },
  'angel-figurine': {
    id: 'angel-figurine', name: 'Angel Figurine', category: 'Creative',
    source: 'asset', designKind: 'effect',
    previewUrl: `${ASSET}/effects/image-effects/angel-figurine.webp.png`,
    assetPath: `${ASSET}/effects/image-effects/angel-figurine.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Ethereal porcelain 3D angel figurine look with smooth sculpted surfaces, soft glow, and a delicate heavenly aesthetic.',
      composition: 'Present the subject as a centered sculpted figurine on a soft luminous pedestal or floating halo, with calm negative space above for a headline.',
      subjectRules: "Convert the user's uploaded subject into a smooth porcelain sculpture: add wing-like or halo accents, soften contours, and render as a pristine 3D collectible figurine.",
      referenceRules: "Use the existing Angel Figurine thumbnail only as a STYLE reference: copy its porcelain material, soft ethereal glow, and sculpted figurine treatment, not its specific pose.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep porcelain matte sheen, gentle rim light, pure background, no text/watermarks, elegant and serene at small size.',
    },
    supportedAspectRatios: ['1:1', '9:16', '4:5'],
    supportedPlatforms: ['instagram-post', 'pinterest', 'tiktok'],
  },
  'advanced-photography': {
    id: 'advanced-photography', name: 'Advanced Photography', category: 'Product/Environment',
    source: 'asset', designKind: 'effect',
    previewUrl: `${ASSET}/effects/image-effects/advanced-photography.webp.png`,
    assetPath: `${ASSET}/effects/image-effects/advanced-photography.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Crisp photoreal studio photography with high detail, controlled lighting, and a premium commercial look.',
      composition: 'Frame the subject with clean studio composition, shallow depth of field, and balanced negative space at the top for a headline.',
      subjectRules: "Photograph the user's uploaded subject realistically with true textures, sharp focus, and natural but polished studio lighting; preserve authentic detail.",
      referenceRules: "Use the existing Advanced Photography thumbnail only as a STYLE reference: copy its studio lighting, crispness, and high-end commercial finish, not its specific subject.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Maximum sharpness and detail, clean background, accurate color, no text/watermarks, professional and realistic.',
    },
    supportedAspectRatios: ['1:1', '16:9', '4:5'],
    supportedPlatforms: ['instagram-post', 'pinterest', 'web'],
  },
  'exotic-charm': {
    id: 'exotic-charm', name: 'Exotic Charm', category: 'Creative',
    source: 'asset', designKind: 'effect',
    previewUrl: `${ASSET}/effects/image-effects/exotic-charm.webp.png`,
    assetPath: `${ASSET}/effects/image-effects/exotic-charm.webp.png`,
    referenceType: 'style',
    promptRecipe: {
      baseStyle: 'Exotic, stylized illustrative look with ornate decorative detail, rich patterns, and a charming storybook charm.',
      composition: 'Surround the subject with ornamental framing and decorative motifs, centered with breathing room at the top for a headline.',
      subjectRules: "Reimagine the user's uploaded subject as a stylized illustrated character or object with bold outlines, embellished patterns, and playful exotic flair.",
      referenceRules: "Use the existing Exotic Charm thumbnail only as a STYLE reference: copy its ornate illustrative detailing, decorative palette, and charming stylization, not its specific figure.",
      textMode: 'leave-space-for-overlay',
      finishingRules: 'Keep bold readable outlines, rich but balanced ornamentation, no text/watermarks, charming and clear at thumbnail size.',
    },
    supportedAspectRatios: ['1:1', '9:16', '4:5'],
    supportedPlatforms: ['instagram-post', 'pinterest', 'tiktok'],
  },
};

export const CURATED_THUMBNAIL_DESIGN_LIST = Object.values(CURATED_THUMBNAIL_DESIGNS);

/**
 * Merge curated asset designs into an existing template map (e.g. the
 * generated THUMBNAIL_TEMPLATES registry) so Explore Ideas shows both.
 * @param {Record<string, any>} [base] base registry to merge into
 * @returns {Record<string, any>}
 */
export function mergeCuratedDesigns(base = {}) {
  return { ...base, ...CURATED_THUMBNAIL_DESIGNS };
}

export default CURATED_THUMBNAIL_DESIGNS;
