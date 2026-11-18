/**
 * Pixabay service for Template Generator
 *
 * Thin frontend wrapper that calls a secure Netlify proxy for Pixabay
 * search. The API key never reaches the browser.
 *
 * Endpoints (via /api/pixabay-search):
 *   - images: query → { hits: [{ id, largeImageURL, previewURL, tags, user, ... }] }
 *   - videos: query → { hits: [{ id, videos, duration, picture_id, tags, user, ... }] }
 *
 * Falls back to a direct Pixabay call using a Vite-exposed public key
 * (PIXABAY_PUBLIC_KEY) ONLY for development; production must go through
 * the Netlify function which holds the real secret.
 */

const NETLIFY_ENDPOINT = '/api/pixabay-search';

/**
 * Search Pixabay for images or videos.
 *
 * @param {Object} params
 * @param {'images'|'videos'} params.type
 * @param {string} params.query
 * @param {number} [params.page=1]
 * @param {number} [params.perPage=15]
 * @param {string} [params.orientation] - 'all' | 'horizontal' | 'vertical'
 * @param {string} [params.minDuration] - videos only
 * @param {string} [params.maxDuration] - videos only
 * @returns {Promise<{ ok: boolean, hits: Array, total?: number, error?: string }>}
 */
export async function searchPixabay({
  type = 'images',
  query = '',
  page = 1,
  perPage = 15,
  orientation,
  minDuration,
  maxDuration,
} = {}) {
  try {
    const res = await fetch(NETLIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, query, page, perPage, orientation, minDuration, maxDuration }),
    });
    if (!res.ok) {
      return { ok: false, hits: [], error: `Pixabay proxy returned ${res.status}` };
    }
    const data = await res.json();
    if (!data.ok) {
      return { ok: false, hits: [], error: data.error || 'Pixabay proxy error' };
    }
    return { ok: true, hits: data.hits || [], total: data.total || 0 };
  } catch (e) {
    return { ok: false, hits: [], error: `Network error: ${e.message}` };
  }
}

/**
 * Normalize a Pixabay image hit to the standard SmartVideo asset shape.
 */
export function normalizePixabayImage(hit) {
  return {
    id: `pixabay-img-${hit.id}`,
    type: 'image',
    source: 'pixabay',
    provider: 'pixabay',
    name: hit.tags || `Pixabay image ${hit.id}`,
    url: hit.largeImageURL || hit.webformatURL || hit.previewURL,
    thumbnail: hit.previewURL || hit.webformatURL,
    width: hit.imageWidth,
    height: hit.imageHeight,
    metadata: {
      tags: hit.tags,
      user: hit.user,
      pixabayId: hit.id,
    },
  };
}

/**
 * Normalize a Pixabay video hit to the standard SmartVideo asset shape.
 * Picks the best available video file (medium size preferred, falls back to small/tiny).
 */
export function normalizePixabayVideo(hit) {
  const videos = hit.videos || {};
  const pick = (size) => videos[size]?.url || null;
  const url = pick('medium') || pick('small') || pick('tiny') || pick('large');
  return {
    id: `pixabay-vid-${hit.id}`,
    type: 'video',
    source: 'pixabay',
    provider: 'pixabay',
    name: (Array.isArray(hit.tags) ? hit.tags[0] : hit.tags?.split(',')[0]) || `Pixabay video ${hit.id}`,
    url,
    thumbnail: hit.picture_id ? `https://i.vimeocdn.com/video/${hit.picture_id}_640x360.jpg` : null,
    duration: hit.duration,
    width: hit.videos?.medium?.width,
    height: hit.videos?.medium?.height,
    metadata: {
      tags: hit.tags,
      user: hit.user,
      pixabayId: hit.id,
    },
  };
}

/**
 * Build a list of suggested Pixabay search queries from Template Generator context.
 * Returns hardcoded domain suggestions based on the niche; the OpenAI service
 * can replace this with AI-generated suggestions when available.
 */
export function suggestPixabayQueries({ niche = '', script = '' } = {}) {
  const lower = (niche || '').toLowerCase();
  const s = (script || '').toLowerCase();
  const suggestions = new Set();

  // Domain-based suggestions
  const domainMap = {
    roofing: ['roof replacement', 'roofer working', 'damaged shingles', 'home exterior', 'storm damage', 'contractor inspection'],
    'real estate': ['modern home interior', 'real estate agent', 'house exterior', 'open house', 'kitchen design', 'luxury home'],
    restaurant: ['restaurant interior', 'chef cooking', 'food plating', 'dining experience', 'menu', 'restaurant exterior'],
    fitness: ['gym workout', 'personal trainer', 'fitness class', 'yoga', 'running', 'weightlifting'],
    dental: ['dental office', 'dentist', 'smile', 'dental care', 'teeth cleaning', 'dental equipment'],
    legal: ['law office', 'attorney', 'courtroom', 'legal consultation', 'lawyer', 'justice'],
    automotive: ['car repair', 'mechanic', 'auto shop', 'car dealership', 'vehicle service', 'car detailing'],
    salon: ['hair salon', 'hairstylist', 'beauty salon', 'hair color', 'salon interior', 'barber'],
    spa: ['spa interior', 'massage', 'facial treatment', 'wellness', 'spa day', 'relaxation'],
    realty: ['luxury home', 'real estate agent', 'modern kitchen', 'open house', 'house tour', 'property'],
    marketing: ['business meeting', 'office workspace', 'team collaboration', 'digital marketing', 'social media', 'analytics'],
    tech: ['technology', 'software development', 'startup office', 'coding', 'data', 'innovation'],
  };

  for (const [key, queries] of Object.entries(domainMap)) {
    if (lower.includes(key)) {
      queries.forEach(q => suggestions.add(q));
    }
  }

  // Script-based keyword extraction (very simple: longest 2-word phrases)
  if (s) {
    const words = s.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) || [];
    words.slice(0, 3).forEach(w => suggestions.add(w));
  }

  // Fallback generic
  if (suggestions.size === 0) {
    ['business', 'professional', 'modern', 'people', 'lifestyle'].forEach(q => suggestions.add(q));
  }

  return Array.from(suggestions).slice(0, 8);
}

export default {
  searchPixabay,
  normalizePixabayImage,
  normalizePixabayVideo,
  suggestPixabayQueries,
};
