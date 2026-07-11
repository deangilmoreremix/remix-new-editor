// Module-level set of already-assigned thumbnail image paths.
// getTemplateThumbnailCandidates drains this across successive template renders
// so that sequential cards in a browse session don't repeat a thumbnail until
// every candidate chain (own niche → cross-niche → category → placeholder)
// has been exhausted. Call resetThumbnailAssignments() on route leave to start
// a fresh session.
let _thumbnailAssignments = new Set();

export function resetThumbnailAssignments() {
  _thumbnailAssignments = new Set();
}

// Every per-template thumbnail file discovered on disk for each niche, keyed
// by stable template-id equals file-name. These serve two roles:
//  1. Direct candidate for templates whose id matches (step 1 of candidate list).
//  2. Fallback/rotation pool for other templates in the same niche.
const NICHE_THUMBNAILS = {
  // Restaurant & Cafe (7 files on disk)
  'Restaurant & Cafe': '/thumbnails/templates/restaurant_cafe_cinematic.webp.png',
  'Restaurant & Cafe Alt': '/thumbnails/templates/patio_dining_showcase.webp.png',
  'Restaurant & Cafe Alt 2': '/thumbnails/templates/at_your_table_video.webp.png',
  'Restaurant & Cafe Alt 3': '/thumbnails/templates/midnight_table_film.webp.png',
  'Restaurant & Cafe Alt 4': '/thumbnails/templates/after_the_pour_documentary.webp.png',
  'Restaurant & Cafe Alt 5': '/thumbnails/templates/last_call_promo.webp.png',
  'Restaurant & Cafe Alt 6': '/thumbnails/templates/flame_and_craft_story.webp.png',
  'Restaurant & Cafe Alt 7': '/thumbnails/templates/opening_night_trailer.webp.png',
  'Restaurant & Cafe Alt 8': '/thumbnails/templates/signature_plate_showcase.webp.png',
  // Med Spa & Beauty (3 files on disk)
  'Med Spa & Beauty': '/thumbnails/templates/med_spa_explainer.webp.png',
  'Med Spa & Beauty Alt': '/thumbnails/templates/med_spa_treatment_reel.webp.png',
  'Med Spa & Beauty Alt 2': '/thumbnails/templates/becoming_radiant_story.webp.png',
  'Med Spa & Beauty Alt 3': '/thumbnails/templates/treatment_room_video.webp.png',
  'Med Spa & Beauty Alt 4': '/thumbnails/templates/velvet_glow_film.webp.png',
  // Salon & Barbershop (2 files on disk)
  'Salon & Barbershop': '/thumbnails/templates/salon_story_film.webp.png',
  'Salon & Barbershop Alt': '/thumbnails/templates/salon_transformation_story.webp.png',
  'Salon & Barbershop Alt 2': '/thumbnails/templates/final_cut_film.webp.png',
  'Salon & Barbershop Alt 3': '/thumbnails/templates/mirror_change_reveal.webp.png',
  // Gym & Fitness (3 files on disk)
  'Gym & Fitness': '/thumbnails/templates/fitness_transformation.webp.png',
  'Gym & Fitness Alt': '/thumbnails/templates/home_gym_showcase.webp.png',
  'Gym & Fitness Alt 2': '/thumbnails/templates/outdoor_bootcamp_promo.webp.png',
  'Gym & Fitness Alt 3': '/thumbnails/templates/iron_frame_film.webp.png',
  'Gym & Fitness Alt 4': '/thumbnails/templates/built_in_motion_promo.webp.png',
  'Gym & Fitness Alt 5': '/thumbnails/templates/coach_cut_portrait.webp.png',
  // Real Estate (2 files on disk)
  'Real Estate': '/thumbnails/templates/real_estate_cinematic.webp.png',
  'Real Estate Alt': '/thumbnails/templates/curb_appeal_showcase.webp.png',
  'Real Estate Alt 2': '/thumbnails/templates/open_house_trailer.webp.png',
  'Real Estate Alt 3': '/thumbnails/templates/luxury_address_showcase.webp.png',
  'Real Estate Alt 4': '/thumbnails/templates/open_door_film.webp.png',
  // Dental Office (4 files on disk)
  'Dental Office': '/thumbnails/templates/dental_chair_showcase.webp.png',
  'Dental Office Alt': '/thumbnails/templates/dental_patient_story.webp.png',
  'Dental Office Alt 2': '/thumbnails/templates/smile_frame_film.webp.png',
  'Dental Office Alt 3': '/thumbnails/templates/better_smile_story.webp.png',
  'Dental Office Alt 4': '/thumbnails/templates/white_light_promo.webp.png',
  'Dental Office Alt 5': '/thumbnails/templates/family_visit_explainer.webp.png',
  // Chiropractic & Wellness (3 files on disk)
  'Chiropractic & Wellness': '/thumbnails/templates/wellness_chiropractic_trailer.webp.png',
  'Chiropractic & Wellness Alt': '/thumbnails/templates/chiropractic_clinic_film.webp.png',
  'Chiropractic & Wellness Alt 2': '/thumbnails/templates/return_to_balance_film.webp.png',
  'Chiropractic & Wellness Alt 3': '/thumbnails/templates/alignment_explainer.webp.png',
  'Chiropractic & Wellness Alt 4': '/thumbnails/templates/relief_story_documentary.webp.png',
  // Legal & Attorney (3 files on disk)
  'Luxury & Premium': '/thumbnails/templates/luxury_brand.webp.png',
  'Luxury & Premium Alt': '/thumbnails/templates/luxury_brand_style.webp.png',
  'Luxury & Premium Alt 2': '/thumbnails/templates/house_of_light_film.webp.png',
  'Luxury & Premium Alt 3': '/thumbnails/templates/product_story_showcase.webp.png',
  'Luxury & Premium Alt 4': '/thumbnails/templates/luxury_hotel_showcase.webp.png',
  'Luxury & Premium Alt 5': '/thumbnails/templates/luxury_listing_trailer.webp.png',
  'Luxury & Premium Alt 6': '/thumbnails/templates/luxury_model_trailer.webp.png',
  'Luxury & Premium Alt 7': '/thumbnails/templates/yacht_lifestyle_trailer.webp.png',
  'Luxury & Premium Alt 8': '/thumbnails/templates/luxury_watch_reel.webp.png',
  'Luxury & Premium Alt 9': '/thumbnails/templates/timeless_luxury_reel.webp.png',
  'Legal & Attorney': '/thumbnails/templates/authority_case_film.webp.png',
  'Legal & Attorney Alt': '/thumbnails/templates/corporate_event_film.webp.png',
  'Legal & Attorney Alt 2': '/thumbnails/templates/settlement_promo.webp.png',
  'Legal & Attorney Alt 3': '/thumbnails/templates/counsel_on_camera_portrait.webp.png',
  'Legal & Attorney Alt 4': '/thumbnails/templates/practice_area_explainer.webp.png',
  'Legal & Attorney Alt 5': '/thumbnails/templates/settlement_story.webp.png',
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

// Cycle through these for each template so cards in the same niche look visually distinct.
// The cross-session dedup in getTemplateThumbnailCandidates ensures successive
// templates don't repeat a thumbnail until this full list is exhausted for the
// niche; only then does the resolver fall back to a cross-niche pool.
const NICHE_ROTATION = {
  'Restaurant & Cafe': [
    'Restaurant & Cafe',
    'Restaurant & Cafe Alt',
    'Restaurant & Cafe Alt 2',
    'Restaurant & Cafe Alt 3',
    'Restaurant & Cafe Alt 4',
    'Restaurant & Cafe Alt 5',
    'Restaurant & Cafe Alt 6',
    'Restaurant & Cafe Alt 7',
    'Restaurant & Cafe Alt 8',
  ],
  'Med Spa & Beauty': [
    'Med Spa & Beauty',
    'Med Spa & Beauty Alt',
    'Med Spa & Beauty Alt 2',
    'Med Spa & Beauty Alt 3',
    'Med Spa & Beauty Alt 4',
  ],
  'Salon & Barbershop': [
    'Salon & Barbershop',
    'Salon & Barbershop Alt',
    'Salon & Barbershop Alt 2',
    'Salon & Barbershop Alt 3',
  ],
  'Gym & Fitness': [
    'Gym & Fitness',
    'Gym & Fitness Alt',
    'Gym & Fitness Alt 2',
    'Gym & Fitness Alt 3',
    'Gym & Fitness Alt 4',
    'Gym & Fitness Alt 5',
  ],
  'Real Estate': [
    'Real Estate',
    'Real Estate Alt',
    'Real Estate Alt 2',
    'Real Estate Alt 3',
    'Real Estate Alt 4',
  ],
  'Dental Office': [
    'Dental Office',
    'Dental Office Alt',
    'Dental Office Alt 2',
    'Dental Office Alt 3',
    'Dental Office Alt 4',
    'Dental Office Alt 5',
  ],
  'Chiropractic & Wellness': [
    'Chiropractic & Wellness',
    'Chiropractic & Wellness Alt',
    'Chiropractic & Wellness Alt 2',
    'Chiropractic & Wellness Alt 3',
    'Chiropractic & Wellness Alt 4',
  ],
  'Legal & Attorney': [
    'Legal & Attorney',
    'Legal & Attorney Alt',
    'Legal & Attorney Alt 2',
    'Legal & Attorney Alt 3',
    'Legal & Attorney Alt 4',
    'Legal & Attorney Alt 5',
  ],
  'Automotive & Car': [
    'Automotive & Car',
    'Automotive & Car Alt',
    'Automotive & Car Alt 2',
    'Automotive & Car Alt 3',
    'Automotive & Car Alt 4',
    'Automotive & Car Alt 5',
  ],
  'Fashion & Style': [
    'Fashion & Style',
    'Fashion & Style Alt',
    'Fashion & Style Alt 2',
    'Fashion & Style Alt 3',
    'Fashion & Style Alt 4',
    'Fashion & Style Alt 5',
  ],
  'Events & Celebrations': [
    'Events & Celebrations',
    'Events & Celebrations Alt',
    'Events & Celebrations Alt 2',
    'Events & Celebrations Alt 3',
    'Events & Celebrations Alt 4',
  ],
  'Luxury & Premium': [
    'Luxury & Premium',
    'Luxury & Premium Alt',
    'Luxury & Premium Alt 2',
    'Luxury & Premium Alt 3',
    'Luxury & Premium Alt 4',
    'Luxury & Premium Alt 5',
    'Luxury & Premium Alt 6',
    'Luxury & Premium Alt 7',
    'Luxury & Premium Alt 8',
    'Luxury & Premium Alt 9',
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

  // 1) Per-template .webp — unique to this template, never deduped
  if (id) candidates.push(`/thumbnails/templates/${id}.webp`);

  // 2) Per-template .webp.png
  if (id) candidates.push(`/thumbnails/templates/${id}.webp.png`);

  // 3) Niche/industry thumbnail rotation — find the FIRST unused rotation entry
  // for this niche and claim only that one; the rest of the niche's own pool
  // becomes the fallback chain for future dedup misses.
  const normalizedNiche = normalizeNiche(niche);
  let claimedNichePath = null;

  if (normalizedNiche && NICHE_ROTATION[normalizedNiche]) {
    const rotation = NICHE_ROTATION[normalizedNiche];
    let offset = 0;
    if (id) {
      let hash = 0;
      for (let i = 0; i < id.length; i++) { hash = ((hash << 5) - hash) + id.charCodeAt(i); hash |= 0; }
      offset = Math.abs(hash) % rotation.length;
    }

    // Walk the rotation in hash-priority order, grab the first entry that:
    //   a) hasn't been engaged in this session, OR
    //   b) is the first entry in sequence (gives each template a "primary" image even
    //      if its rotation slot coincides with another template — preserves visual variety
    //      because the effective per-template offset is based on its own id hash).
    const rawRotationKeys = [];
    for (let i = 0; i < rotation.length; i++) rawRotationKeys.push(rotation[(offset + i) % rotation.length]);

    let bestUnused = null;
    for (const key of rawRotationKeys) {
      const p = NICHE_THUMBNAILS[key];
      if (!p || !_thumbnailAssignments.has(p)) { bestUnused = p; break; }
    }
    // Greedy-fill: if every own-niche path is already used, rewind to the primary
    // rotation key as the "least recently assigned" for this template
    if (!bestUnused) {
      bestUnused = NICHE_THUMBNAILS[rawRotationKeys[0]];
    }
    claimedNichePath = bestUnused;
    candidates.push(bestUnused);
    _thumbnailAssignments.add(bestUnused);
  } else if (normalizedNiche && NICHE_THUMBNAILS[normalizedNiche]) {
    const path = NICHE_THUMBNAILS[normalizedNiche];
    candidates.push(path);
    _thumbnailAssignments.add(path);
    claimedNichePath = path;
  }

  // 3b) Cross-niche fallback — every other niche image NOT yet assigned in this
  // session, sorted deterministically for stable ordering. Kicks in only after the
  // niche's own pool is exhausted (or for niche-less templates).
  const allNichePaths = Object.values(NICHE_THUMBNAILS);
  const crossUnused = allNichePaths
    .filter(p => p !== claimedNichePath && !_thumbnailAssignments.has(p))
    .sort(); // deterministic cross-niche order
  for (const path of crossUnused) {
    if (candidates.length < 9 && !candidates.includes(path)) {
      candidates.push(path);
      _thumbnailAssignments.add(path);
    }
  }

  // 4) Category thumbnail
  if (category) {
    const catPath = CATEGORY_THUMBNAILS[category];
    if (catPath && !candidates.includes(catPath)) candidates.push(catPath);
    if (catPath) _thumbnailAssignments.add(catPath);
  }

  // 5) Generic placeholder
  const placeholder = PAGE_THUMBNAILS.placeholder || '/thumbnails/pages/placeholder.webp';
  if (!candidates.includes(placeholder)) candidates.push(placeholder);

  return candidates;
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
