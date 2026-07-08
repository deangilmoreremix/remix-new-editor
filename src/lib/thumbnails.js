// Map each niche display name to an existing industry thumbnail file
// These are reused across templates within the same niche since individual
// per-template thumbnails were not generated for the niche catalog.
const NICHE_THUMBNAILS = {
  'Restaurant & Cafe': '/thumbnails/templates/restaurant_cafe_cinematic.webp.png',
  'Med Spa & Beauty': '/thumbnails/templates/med_spa_explainer.webp.png',
  'Med Spa & Beauty Alt': '/thumbnails/templates/med_spa_treatment_reel.webp.png',
  'Salon & Barbershop': '/thumbnails/templates/salon_story_film.webp.png',
  'Salon & Barbershop Alt': '/thumbnails/templates/salon_transformation_story.webp.png',
  'Gym & Fitness': '/thumbnails/templates/fitness_transformation.webp.png',
  'Real Estate': '/thumbnails/templates/real_estate_cinematic.webp.png',
  'Dental Office': '/thumbnails/templates/dental_chair_showcase.webp.png',
  'Dental Office Alt': '/thumbnails/templates/dental_patient_story.webp.png',
  'Chiropractic & Wellness': '/thumbnails/templates/wellness_chiropractic_trailer.webp.png',
  'Chiropractic & Wellness Alt': '/thumbnails/templates/chiropractic_clinic_film.webp.png',
  'Legal & Attorney': '/thumbnails/templates/authority_case_film.webp.png',
  'Legal & Attorney Alt': '/thumbnails/templates/team_of_experts_promo.webp.png',
  'Automotive & Car': '/thumbnails/templates/automotive_cinematic.webp.png',
  'Fashion & Style': '/thumbnails/templates/editorial_fashion_film.webp.png',
  'Fashion & Style Alt': '/thumbnails/templates/fashion_lifestyle.webp.png',
  'Events & Celebrations': '/thumbnails/templates/event_recap_film.webp.png',
  'Events & Celebrations Alt': '/thumbnails/templates/corporate_event_film.webp.png',
  'Luxury & Premium': '/thumbnails/templates/luxury_brand.webp.png',
  'Luxury & Premium Alt': '/thumbnails/templates/luxury_brand_style.webp.png',
};

// Some template sources use lowercase/hyphenated niche keys (e.g. templateMatrix.js).
// Normalize them to the display names above so fallback lookups work.
const NICHE_ALIASES = {
  restaurant: 'Restaurant & Cafe',
  'med-spa': 'Med Spa & Beauty',
  salon: 'Salon & Barbershop',
  fitness: 'Gym & Fitness',
  'real-estate': 'Real Estate',
  dental: 'Dental Office',
  chiropractic: 'Chiropractic & Wellness',
  legal: 'Legal & Attorney',
  automotive: 'Automotive & Car',
  fashion: 'Fashion & Style',
  events: 'Events & Celebrations',
  luxury: 'Luxury & Premium',
  'general-business': null,
};

function normalizeNiche(niche) {
  if (!niche) return null;
  if (NICHE_THUMBNAILS[niche]) return niche;
  if (NICHE_ALIASES[niche] !== undefined) return NICHE_ALIASES[niche];
  return null;
}

// Cycle through these for each template so cards in the same niche look visually distinct
const NICHE_ROTATION = {
  'Restaurant & Cafe': [
    'Restaurant & Cafe',
  ],
  'Med Spa & Beauty': [
    'Med Spa & Beauty',
    'Med Spa & Beauty Alt',
  ],
  'Salon & Barbershop': [
    'Salon & Barbershop',
    'Salon & Barbershop Alt',
  ],
  'Gym & Fitness': [
    'Gym & Fitness',
  ],
  'Real Estate': [
    'Real Estate',
  ],
  'Dental Office': [
    'Dental Office',
    'Dental Office Alt',
  ],
  'Chiropractic & Wellness': [
    'Chiropractic & Wellness',
    'Chiropractic & Wellness Alt',
  ],
  'Legal & Attorney': [
    'Legal & Attorney',
    'Legal & Attorney Alt',
  ],
  'Automotive & Car': [
    'Automotive & Car',
  ],
  'Fashion & Style': [
    'Fashion & Style',
    'Fashion & Style Alt',
  ],
  'Events & Celebrations': [
    'Events & Celebrations',
    'Events & Celebrations Alt',
  ],
  'Luxury & Premium': [
    'Luxury & Premium',
    'Luxury & Premium Alt',
  ],
};

const STUDIO_THUMBNAILS = {
  image: '/thumbnails/studios/image.webp',
  video: '/thumbnails/studios/video.webp',
  cinema: '/thumbnails/studios/cinema.webp',
  storyboard: '/thumbnails/studios/storyboard.webp',
  effects: '/thumbnails/studios/effects.webp',
  edit: '/thumbnails/studios/edit.webp',
  upscale: '/thumbnails/studios/upscale.webp',
  character: '/thumbnails/studios/character.webp',
  commercial: '/thumbnails/studios/commercial.webp',
  audio: '/thumbnails/studios/audio.webp',
  avatar: '/thumbnails/studios/avatar.webp',
  training: '/thumbnails/studios/training.webp',
  videotools: '/thumbnails/studios/videotools.webp',
  lipsync: '/thumbnails/studios/lipsync.webp',
  render: '/thumbnails/studios/render.webp',
  chat: '/thumbnails/studios/chat.webp',
};

const HERO_THUMBNAILS = {
  image: '/thumbnails/heroes/image.webp',
  video: '/thumbnails/heroes/video.webp',
  videoagent: '/thumbnails/heroes/videoagent.webp',
  cinema: '/thumbnails/heroes/cinema.webp',
  storyboard: '/thumbnails/heroes/storyboard.webp',
  effects: '/thumbnails/heroes/effects.webp',
  edit: '/thumbnails/heroes/edit.webp',
  upscale: '/thumbnails/heroes/upscale.webp',
  character: '/thumbnails/heroes/character.webp',
  commercial: '/thumbnails/heroes/commercial.webp',
  influencer: '/thumbnails/heroes/influencer.webp',
  audio: '/thumbnails/heroes/audio.webp',
  avatar: '/thumbnails/heroes/avatar.webp',
  training: '/thumbnails/heroes/training.webp',
  videotools: '/thumbnails/heroes/videotools.webp',
  lipsync: '/thumbnails/heroes/lipsync.webp',
  render: '/thumbnails/heroes/render.webp',
  chat: '/thumbnails/heroes/chat.webp',
  templates: '/thumbnails/heroes/templates.webp',
};

const TOOL_THUMBNAILS = {
  'ai-object-eraser': '/thumbnails/tools/remove-object.webp',
  'ai-background-remover': '/thumbnails/tools/remove-bg.webp',
  'ai-image-extension': '/thumbnails/tools/extend.webp',
  'seedream-5.0-edit': '/thumbnails/tools/ai-edit.webp',
  'ideogram-v3-reframe': '/thumbnails/tools/reframe.webp',
  'ai-dress-change': '/thumbnails/tools/dress-change.webp',
  'ai-skin-enhancer': '/thumbnails/tools/skin-enhance.webp',
  'ai-color-photo': '/thumbnails/tools/colorize.webp',
  'add-image-watermark': '/thumbnails/tools/watermark.webp',
  'ai-image-upscaler': '/thumbnails/tools/upscale.webp',
  'ai-image-face-swap': '/thumbnails/tools/face-swap.webp',
  'ai-product-shot': '/thumbnails/tools/product-shot.webp',
  'ai-ghibli-style': '/thumbnails/tools/ghibli-style.webp',
};

const CATEGORY_THUMBNAILS = {
  'Social Media': '/thumbnails/categories/social.webp',
  'Style Transfer': '/thumbnails/categories/style.webp',
  'Entertainment': '/thumbnails/categories/entertainment.webp',
  'Commercial': '/thumbnails/categories/commercial.webp',
  'VFX & Action': '/thumbnails/categories/vfx.webp',
  'Portrait & Creator': '/thumbnails/categories/portrait.webp',
  'Decade & Era': '/thumbnails/categories/decade.webp',
  'Camera & Cinematic': '/thumbnails/categories/camera.webp',
};

const PAGE_THUMBNAILS = {
  community: '/thumbnails/pages/community.webp',
  library: '/thumbnails/pages/library.webp',
  assist: '/thumbnails/pages/assist.webp',
  placeholder: '/thumbnails/pages/placeholder.webp',
};

export function getStudioThumbnail(studioId) {
  return STUDIO_THUMBNAILS[studioId] || null;
}

export function getHeroThumbnail(studioId) {
  return HERO_THUMBNAILS[studioId] || null;
}

export function getToolThumbnail(toolId) {
  return TOOL_THUMBNAILS[toolId] || null;
}

export function getCategoryThumbnail(categoryName) {
  return CATEGORY_THUMBNAILS[categoryName] || null;
}

export function getPageThumbnail(pageId) {
  return PAGE_THUMBNAILS[pageId] || null;
}

export function getTemplateThumbnail(templateId) {
  // First try .webp, then fall back to .webp.png (some generated images are PNG format)
  return `/thumbnails/templates/${templateId}.webp`;
}

// Get a list of all candidate paths to try for a template, in priority order.
// Used by createThumbnailImg so niche templates can fall back to industry
// thumbnails when their individual file is missing.
export function getTemplateThumbnailCandidates(template) {
  const candidates = [];
  const id = typeof template === 'string' ? template : template?.id;
  const niche = typeof template === 'object' ? template?.niche : null;
  const category = typeof template === 'object' ? template?.category : null;

  // 1) Per-template .webp (standard templates)
  if (id) candidates.push(`/thumbnails/templates/${id}.webp`);

  // 2) Per-template .webp.png (niche templates that were generated)
  if (id) candidates.push(`/thumbnails/templates/${id}.webp.png`);

  // 3) Niche/industry thumbnail rotation (reuses existing industry files)
  const normalizedNiche = normalizeNiche(niche);
  if (normalizedNiche && NICHE_ROTATION[normalizedNiche]) {
    const rotation = NICHE_ROTATION[normalizedNiche];
    // Deterministic rotation based on the template id so each card looks distinct
    let offset = 0;
    if (id) {
      let hash = 0;
      for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash) + id.charCodeAt(i);
        hash |= 0;
      }
      offset = Math.abs(hash) % rotation.length;
    }
    // Push every rotation option in the best order first
    for (let i = 0; i < rotation.length; i++) {
      const key = rotation[(offset + i) % rotation.length];
      const path = NICHE_THUMBNAILS[key];
      if (path && !candidates.includes(path)) candidates.push(path);
    }
  } else if (normalizedNiche && NICHE_THUMBNAILS[normalizedNiche]) {
    candidates.push(NICHE_THUMBNAILS[normalizedNiche]);
  }

  // 4) Category thumbnail (works for standard templates too)
  if (category) {
    const catPath = CATEGORY_THUMBNAILS[category];
    if (catPath && !candidates.includes(catPath)) candidates.push(catPath);
  }

  // 5) User-custom thumbnail (fetched from Supabase, cached in sessionStorage)
  const custom = loadCustomThumbnailFromCache(id);
  if (custom && !candidates.includes(custom)) candidates.unshift(custom);

  // 6) Generic placeholder
  const placeholder = PAGE_THUMBNAILS.placeholder || '/thumbnails/pages/placeholder.webp';
  if (!candidates.includes(placeholder)) candidates.push(placeholder);

  return candidates;
}

const CUSTOM_THUMB_CACHE_KEY = (templateId) => `thumb:custom:${templateId}`;

export function loadCustomThumbnailFromCache(templateId) {
  try {
    const raw = sessionStorage.getItem(CUSTOM_THUMB_CACHE_KEY(templateId));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (entry && entry.fetchedAt && Date.now() - entry.fetchedAt > 7 * 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(CUSTOM_THUMB_CACHE_KEY(templateId));
      return null;
    }
    return entry?.path || null;
  } catch {
    return null;
  }
}

export function saveCustomThumbnailToCache(templateId, path) {
  try {
    sessionStorage.setItem(CUSTOM_THUMB_CACHE_KEY(templateId), JSON.stringify({ path, fetchedAt: Date.now() }));
  } catch {
    // storage may be unavailable in some contexts
  }
}

export function clearCustomThumbnailCache(templateId) {
  try {
    sessionStorage.removeItem(CUSTOM_THUMB_CACHE_KEY(templateId));
  } catch {
    // noop
  }
}

export function getTemplateThumbnailWithFallback(templateId) {
  // For cinematic templates that may have .webp.png extension
  const webpPath = `/thumbnails/templates/${templateId}.webp`;
  const pngPath = `/thumbnails/templates/${templateId}.webp.png`;
  return { webpPath, pngPath };
}

export function createThumbnailImg(src, alt, className = '', fallbackTemplate = null) {
  const img = document.createElement('img');
  img.alt = alt;
  img.loading = 'lazy';
  img.className = className;

  // If a template was provided, use the full candidate chain so missing
  // per-template thumbnails can fall back to industry/category files.
  let candidates;
  if (fallbackTemplate) {
    candidates = getTemplateThumbnailCandidates(fallbackTemplate);
  } else {
    candidates = [src];
    // Preserve the legacy .webp -> .webp.png fallback for static paths
    if (src && src.endsWith('.webp')) candidates.push(src + '.png');
  }

  let index = 0;
  img.src = candidates[0];

  img.onerror = () => {
    index++;
    if (index < candidates.length) {
      img.src = candidates[index];
      return;
    }
    // All candidates failed — hide the image and mark the parent
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent) parent.classList.add('thumb-fallback');
  };
  img.onload = () => {
    const skeleton = img.parentElement?.querySelector('.thumb-skeleton');
    if (skeleton) skeleton.remove();
  };
  return img;
}

export function createHeroSection(studioId, className = '') {
  const src = getHeroThumbnail(studioId);
  if (!src) return null;
  const wrapper = document.createElement('div');
  wrapper.className = `hero-banner relative w-full overflow-hidden rounded-2xl ${className}`;
  wrapper.innerHTML = '<div class="thumb-skeleton absolute inset-0"></div>';
  const img = createThumbnailImg(src, `${studioId} studio`, 'w-full h-full object-cover');
  wrapper.appendChild(img);
  const overlay = document.createElement('div');
  overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent';
  wrapper.appendChild(overlay);
  return wrapper;
}
