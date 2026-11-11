/**
 * Niche Classifier
 * ------------------------------------------------------------------
 * Classifies prompt-feed records into business-relevant niches using
 * keyword matching on title, prompt text, and tags.
 *
 * Uses word-boundary regex to avoid substring false positives
 * (e.g. "car" inside "skincare", "ar" inside "glowing").
 */

import type { PromptRecord } from '@ohb/types/go-ai-viral/prompt';

export interface NicheResult {
  /** Niches matched by keyword/context. */
  businessNiches: string[];
  /** Single strongest niche used for deterministic grouping. */
  primaryNiche: string;
  /** Optional sub-niches within the primary niche. */
  subNiches: string[];
}

/** Keyword table for the 12 business niches. Exported so the shared demo
 *  taxonomy (src/shared/personalization/guided/demoCategories.ts) can reuse the
 *  exact same matching rules instead of duplicating them. */
export const NICHE_KEYWORDS: Record<string, string[]> = {
  'ecommerce': [
    'shopify', 'unboxing', 'checkout', 'ecommerce', 'e-commerce',
    'inventory', 'discount', 'dropshipping', 'amazon',
    'product demo', 'product video', 'store ad',
    'chanel', 'gucci', 'louis vuitton', 'watch', 'jewelry',
    'bag', 'purse', 'accessory', 'sunglasses', 'leather',
    'gold', 'diamond', 'product placement', 'sponsored',
  ],
  'real-estate': [
    'real estate', 'realtor', 'broker', 'mortgage', 'apartment',
    'condo', 'bedroom', 'living room', 'open house', 'backyard',
    'patio', 'villa', 'mansion', 'property listing', 'home staging',
    'interior design', 'real estate',
  ],
  'restaurants-food': [
    'restaurant', 'chef', 'recipe', 'dining', 'kitchen', 'meal',
    'dish', 'bake', 'bakery', 'cafe', 'coffee', 'pizza', 'burger',
    'sushi', 'ramen', 'cuisine', 'gourmet', 'delicious', 'flavor',
    'ingredient', 'plate', 'serving', 'takeout', 'dine-in',
  ],
  'beauty': [
    'beauty', 'makeup', 'skincare', 'serum', 'lipstick', 'cosmetic',
    'glow', 'skin', 'facial', 'cream', 'moisturizer', 'foundation',
    'eyeliner', 'mascara', 'blush', 'contour', 'mask', 'spa', 'salon',
    'hair', 'nail', 'perfume', 'fragrance', 'beauty influencer',
    'beauty tutorial', 'glam', 'aesthetic', 'self-care',
  ],
  'wellness-fitness': [
    'wellness', 'fitness', 'workout', 'gym', 'yoga', 'meditation',
    'health', 'exercise', 'training', 'cardio', 'strength', 'nutrition',
    'diet', 'supplement', 'protein', 'personal trainer', 'cycling',
    'pilates', 'stretch', 'mindfulness', 'mental health',
    'calm', 'relax', 'stress', 'sleep',
  ],
  'education': [
    'education', 'learn', 'course', 'tutorial', 'lesson', 'teach',
    'student', 'class', 'school', 'university', 'academy', 'training',
    'workshop', 'lecture', 'study', 'exam', 'homework', 'curriculum',
    'skill', 'knowledge', 'explain', 'how to', 'guide', 'walkthrough',
    'tips', 'tricks', 'beginner', 'advanced', 'teacher',
  ],
  'technology': [
    'technology', 'software', 'app', 'device', 'gadget',
    'laptop', 'phone', 'smartphone', 'camera', 'drone', 'robot',
    'artificial intelligence', 'machine learning', 'developer',
    'programming', 'startup', 'saas', 'platform',
    'digital', 'cyber', 'data', 'cloud', 'iot', 'vr', 'ar', '3d',
    'animation', 'render', 'synthetic', 'generation', 'ai video',
    'prompt', 'text to video', 'image to video',
  ],
  'finance': [
    'finance', 'money', 'investment', 'stock', 'crypto', 'trading',
    'bank', 'loan', 'mortgage', 'budget', 'saving', 'income', 'profit',
    'revenue', 'entrepreneur', 'funding',
    'portfolio', 'asset', 'wealth', 'tax', 'accounting', 'invoice',
    'payment', 'fintech', 'trader', 'market',
  ],
  'entertainment-media': [
    'entertainment', 'movie', 'film', 'cinema', 'television',
    'show', 'series', 'actor', 'actress', 'celebrity', 'viral', 'meme',
    'comedy', 'funny', 'humor', 'music', 'song', 'dance', 'game',
    'gaming', 'stream', 'twitch', 'youtube', 'instagram', 'tiktok',
    'reels', 'shorts', 'podcast', 'animation', 'cartoon', 'anime',
    'documentary', 'trailer', 'premiere',
  ],
  'automotive': [
    'car', 'vehicle', 'automotive', 'truck', 'suv', 'electric vehicle',
    'motorcycle', 'bike', 'drive', 'driving', 'road', 'highway',
    'garage', 'engine', 'motor', 'wheel', 'tire', 'fuel', 'charging',
    'tesla', 'hyundai', 'toyota', 'bmw', 'mercedes', 'audi', 'ford',
    'racing', 'speed', 'luxury car', 'test drive',
  ],
  'travel-hospitality': [
    'travel', 'hotel', 'resort', 'vacation', 'trip', 'flight', 'airport',
    'beach', 'island', 'destination', 'tourist', 'passport',
    'luggage', 'booking', 'airbnb', 'hostel', 'camping', 'adventure',
    'backpack', 'sightseeing', 'landmark', 'cruise',
    'journey', 'getaway', 'travel vlog', 'MiniDV', 'camcorder',
  ],
  'sports-outdoors': [
    'sport', 'athlete', 'team', 'match', 'tournament',
    'basketball', 'football', 'soccer', 'tennis', 'golf', 'baseball',
    'hockey', 'boxing', 'mma', 'ufc', 'olympic', 'fitness', 'gym',
    'outdoor', 'hiking', 'camping', 'climbing', 'surfing', 'skiing',
    'snowboard', 'cycling', 'running', 'marathon', 'extreme', 'action',
    'stunt', 'parkour', 'skateboard', 'bmx',
  ],
};

/** Sub-niche keyword table, grouped by primary niche. Exported for the same
 *  reason as `NICHE_KEYWORDS`. */
export const SUB_NICHE_KEYWORDS: Record<string, Record<string, string[]>> = {
  'ecommerce': {
    fashion: ['chanel', 'gucci', 'louis vuitton', 'bag', 'purse', 'accessory', 'sunglasses', 'leather', 'fashion', 'style'],
    luxury: ['luxury', 'premium', 'gold', 'diamond', 'high-end', 'designer'],
    'tech-products': ['gadget', 'device', 'electronics', 'tech', 'smartphone', 'laptop'],
    'home-goods': ['furniture', 'home', 'kitchen', 'decor', 'interior'],
  },
  'real-estate': {
    residential: ['home', 'house', 'apartment', 'condo', 'bedroom', 'living room', 'backyard'],
    commercial: ['commercial', 'office', 'retail', 'business property'],
    staging: ['staging', 'interior design', 'furniture', 'decor'],
    rentals: ['rent', 'rental', 'airbnb', 'lease', 'tenant'],
  },
  'restaurants-food': {
    'fine-dining': ['fine dining', 'gourmet', 'cuisine', 'restaurant', 'chef', 'elegant'],
    casual: ['casual', 'cafe', 'coffee', 'fast', 'quick', 'takeout'],
    recipes: ['recipe', 'cook', 'bake', 'kitchen', 'ingredient', 'dish'],
    coffee: ['coffee', 'cafe', 'latte', 'espresso', 'brew'],
  },
  'beauty': {
    skincare: ['skincare', 'serum', 'cream', 'moisturizer', 'facial', 'mask', 'glow'],
    makeup: ['makeup', 'lipstick', 'eyeliner', 'mascara', 'blush', 'contour', 'foundation'],
    hair: ['hair', 'salon', 'styling', 'haircut', 'color'],
    fragrance: ['perfume', 'fragrance', 'scent', 'cologne'],
  },
  'wellness-fitness': {
    yoga: ['yoga', 'pilates', 'stretch', 'meditation', 'mindfulness'],
    gym: ['gym', 'workout', 'fitness', 'training', 'exercise', 'cardio', 'strength'],
    nutrition: ['nutrition', 'diet', 'supplement', 'protein', 'health'],
    'mental-health': ['mental health', 'stress', 'calm', 'relax', 'sleep', 'wellness'],
  },
  'education': {
    courses: ['course', 'class', 'school', 'university', 'academy', 'curriculum'],
    tutorials: ['tutorial', 'guide', 'walkthrough', 'how to', 'tips', 'tricks'],
    workshops: ['workshop', 'lecture', 'training', 'session'],
    'skill-building': ['skill', 'knowledge', 'learn', 'study', 'beginner', 'advanced'],
  },
  'technology': {
    ai: ['ai', 'artificial intelligence', 'machine learning', 'neural', 'deep learning'],
    gadgets: ['gadget', 'device', 'hardware', 'laptop', 'phone', 'camera', 'drone'],
    software: ['software', 'app', 'platform', 'saas', 'programming', 'code', 'developer'],
    gaming: ['game', 'gaming', 'gamer', 'twitch', 'stream'],
  },
  'finance': {
    investing: ['investment', 'stock', 'portfolio', 'asset', 'trading', 'trader'],
    crypto: ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'web3'],
    business: ['business', 'entrepreneur', 'startup', 'revenue', 'profit', 'funding'],
    'personal-finance': ['budget', 'saving', 'income', 'tax', 'loan', 'mortgage', 'bank'],
  },
  'entertainment-media': {
    movies: ['movie', 'film', 'cinema', 'trailer', 'premiere'],
    music: ['music', 'song', 'audio', 'podcast'],
    gaming: ['game', 'gaming', 'gamer', 'twitch', 'stream'],
    viral: ['viral', 'meme', 'trending', 'social media', 'instagram', 'tiktok'],
  },
  'automotive': {
    cars: ['car', 'vehicle', 'sedan', 'suv', 'truck'],
    motorcycles: ['motorcycle', 'bike', 'motorbike'],
    ev: ['electric vehicle', 'ev', 'tesla', 'charging', 'battery'],
    racing: ['racing', 'speed', 'sport', 'track', 'performance'],
  },
  'travel-hospitality': {
    hotels: ['hotel', 'resort', 'hostel', 'airbnb', 'booking', 'accommodation'],
    adventures: ['adventure', 'backpack', 'camping', 'hiking', 'outdoor', 'explore'],
    'travel-vlogs': ['travel vlog', 'vlog', 'MiniDV', 'camcorder', 'youtube'],
    destinations: ['destination', 'landmark', 'beach', 'island', 'city', 'tourist'],
  },
  'sports-outdoors': {
    'team-sports': ['basketball', 'football', 'soccer', 'baseball', 'hockey', 'team'],
    individual: ['tennis', 'golf', 'boxing', 'mma', 'ufc', 'cycling', 'running'],
    outdoor: ['hiking', 'camping', 'climbing', 'surfing', 'skiing', 'snowboard'],
    extreme: ['extreme', 'action', 'stunt', 'parkour', 'skateboard', 'bmx', 'racing'],
  },
};

/** Build a word-boundary regex for a keyword phrase. */
function nicheRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i')
}

/** Pre-compile regexes once per niche for performance. */
const NICHE_REGEXES: Record<string, RegExp[]> = Object.fromEntries(
  Object.entries(NICHE_KEYWORDS).map(([niche, keywords]) => [
    niche,
    keywords.map(nicheRegex),
  ])
);

/** Sub-niche regex map derived from main niche keywords. */
const SUB_NICHE_REGEXES: Record<string, Record<string, RegExp[]>> = Object.fromEntries(
  Object.entries(SUB_NICHE_KEYWORDS).map(([niche, subMap]) => [
    niche,
    Object.fromEntries(
      Object.entries(subMap).map(([subNiche, keywords]) => [
        subNiche,
        keywords.map(nicheRegex),
      ])
    ),
  ])
);

/**
 * Classify a prompt record into business niches.
 *
 * Falls back to:
 * 1. Any record.categories that map to a known niche
 * 2. 'general-business' when nothing matches
 */
export function classifyPrompt(record: PromptRecord): NicheResult {
  const text = [
    record.title,
    record.prompt,
    ...(record.tags || []),
    ...(record.categories || []),
  ].join(' ');

  const matches = new Map<string, number>();

  for (const [niche, regexes] of Object.entries(NICHE_REGEXES)) {
    let score = 0;
    for (const regex of regexes) {
      const m = text.match(regex);
      if (m) {
        score += m[0].length;
      }
    }
    if (score > 0) {
      matches.set(niche, score);
    }
  }

  const businessNiches = Array.from(matches.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([niche]) => niche);

  const primaryNiche = businessNiches[0] || 'general-business';

  // Determine sub-niches based on primary niche
  const subNiches = determineSubNiches(primaryNiche, text);

  return { businessNiches, primaryNiche, subNiches };
}

/**
 * Determine sub-niches for a given primary niche based on keyword matches.
 */
function determineSubNiches(primaryNiche: string, text: string): string[] {
  const subNicheMap = SUB_NICHE_REGEXES[primaryNiche];
  if (!subNicheMap) return [];

  const matches: string[] = [];
  for (const [subNiche, regexes] of Object.entries(subNicheMap)) {
    let score = 0;
    for (const regex of regexes) {
      const m = text.match(regex);
      if (m) {
        score += m[0].length;
      }
    }
    if (score > 0) {
      matches.push(subNiche);
    }
  }

  return matches;
}

/**
 * Pre-classify a batch of records.
 *
 * Returns a map of record.id -> NicheResult for fast lookup.
 */
export function classifyBatch(records: PromptRecord[]): Map<string, NicheResult> {
  const results = new Map<string, NicheResult>();
  for (const record of records) {
    results.set(record.id, classifyPrompt(record));
  }
  return results;
}
