// src/lib/platforms.js
// Platform metadata with platform-specific copy constraints for campaign assets.

export const PLATFORMS = [
  {
    id: 'instagram-feed',
    label: 'Instagram — Feed (1:1)',
    aspect: '1:1',
    width: 1080,
    height: 1080,
    // Copy caps, tone and image hint are Open-Pomelli's own values (src/lib/platforms.ts).
    copy: { headlineMaxWords: 8, bodyMaxWords: 25, ctaMaxWords: 3, tone: 'casual, scroll-stopping, lower-case', imageHint: 'Bold focal subject, mobile-thumb readable, generous safe area for text, social-feed scroll-stopping.' },
  },
  {
    id: 'instagram-story',
    label: 'Instagram — Story (9:16)',
    aspect: '9:16',
    width: 1080,
    height: 1920,
    // Copy caps, tone and image hint are Open-Pomelli's own values (src/lib/platforms.ts).
    copy: { headlineMaxWords: 6, bodyMaxWords: 0, ctaMaxWords: 3, tone: 'punchy, single-line hook', imageHint: 'Vertical composition, primary subject upper-third, bottom 20% reserved for app UI, vivid lighting.' },
  },
  {
    id: 'linkedin',
    label: 'LinkedIn — Feed (1:1)',
    aspect: '1:1',
    width: 1200,
    height: 1200,
    // Copy caps, tone and image hint are Open-Pomelli's own values (src/lib/platforms.ts).
    copy: { headlineMaxWords: 10, bodyMaxWords: 35, ctaMaxWords: 3, tone: 'professional, declarative, no hashtags in copy', imageHint: 'Editorial, polished, subtle gradient or clean photography, professional palette emphasis.' },
  },
  {
    id: 'facebook',
    label: 'Facebook — Feed Ad (1:1)',
    aspect: '1:1',
    width: 1200,
    height: 1200,
    // Copy caps, tone and image hint are Open-Pomelli's own values (src/lib/platforms.ts).
    copy: { headlineMaxWords: 7, bodyMaxWords: 25, ctaMaxWords: 3, tone: 'benefit-led, conversational, direct', imageHint: 'Single clear value prop visual, high-contrast subject, minimal text-in-image (Meta ad guideline).' },
  },
  {
    id: 'twitter',
    label: 'X / Twitter — Post (16:9)',
    aspect: '16:9',
    width: 1200,
    height: 675,
    // Copy caps, tone and image hint are Open-Pomelli's own values (src/lib/platforms.ts).
    copy: { headlineMaxWords: 6, bodyMaxWords: 30, ctaMaxWords: 3, tone: 'sharp, opinionated, one-liner energy', imageHint: 'Wide cinematic crop, single focal element, readable on mobile timeline at small size.' },
  },
  {
    id: 'web-banner',
    label: 'Web — Hero Banner (16:9)',
    aspect: '16:9',
    width: 1920,
    height: 1080,
    // Copy caps, tone and image hint are Open-Pomelli's own values (src/lib/platforms.ts).
    copy: { headlineMaxWords: 6, bodyMaxWords: 20, ctaMaxWords: 3, tone: 'confident, brand-led, marketing-site voice', imageHint: 'Cinematic hero composition, breathing room for overlaid headline, palette-led background.' },
  },
  {
    id: 'email',
    label: 'Email — Header (16:9)',
    aspect: '16:9',
    width: 1200,
    height: 675,
    // Copy caps, tone and image hint are Open-Pomelli's own values (src/lib/platforms.ts).
    copy: { headlineMaxWords: 7, bodyMaxWords: 20, ctaMaxWords: 3, tone: 'warm, direct, like a subject line', imageHint: 'Clean horizontal banner, subject framed left or right with negative space for headline overlay.' },
  },
  {
    id: 'youtube',
    label: 'YouTube — Thumbnail (16:9)',
    aspect: '16:9',
    width: 1280,
    height: 720,
    // Copy caps, tone and image hint are Open-Pomelli's own values (src/lib/platforms.ts).
    copy: { headlineMaxWords: 5, bodyMaxWords: 0, ctaMaxWords: 0, tone: 'ultra-bold curiosity hook, all-caps energy', imageHint: 'High-contrast face or single object, oversized bold text overlay (3-5 words), saturated palette, click-worthy.' },
  },
];

// The model names platforms loosely ("instagram", "banner", "youtube_thumb", or our own ids).
const FAMILY = (id) => id.split('-')[0]; // instagram-feed / instagram-story -> instagram
const ALIASES = { banner: 'web-banner', web_banner: 'web-banner', 'youtube-thumb': 'youtube', youtube_thumb: 'youtube', 'email-banner': 'email', x: 'twitter' };

/** True when a concept's `recommended_platforms` names this platform (by id, by family, or by a known alias). */
export function isRecommendedPlatform(platform, recommended) {
  const norm = (v) => String(v || '').trim().toLowerCase().replace(/_/g, '-');
  const wanted = new Set((recommended || []).map((r) => ALIASES[norm(r)] || ALIASES[String(r).trim().toLowerCase()] || norm(r)));
  return wanted.has(platform.id) || wanted.has(FAMILY(platform.id));
}
