// src/lib/platforms.js
// Platform metadata with platform-specific copy constraints for campaign assets.
// Copy limits, tones and image hints mirror Open-Pomelli's platforms.ts. The ids and
// labels are the fork's own (the UI and saved assets reference them), and the
// aspect/width/height always agree.

export const PLATFORMS = [
  {
    id: 'instagram-feed',
    label: 'Instagram Feed',
    aspect: '1:1',
    width: 1080,
    height: 1080,
    copy: { headlineMaxWords: 8, bodyMaxWords: 25, ctaMaxWords: 3, tone: 'casual, scroll-stopping, lower-case', imageHint: 'Bold focal subject, mobile-thumb readable, generous safe area for text, social-feed scroll-stopping.' },
  },
  {
    id: 'instagram-story',
    label: 'Instagram Story',
    aspect: '9:16',
    width: 1080,
    height: 1920,
    copy: { headlineMaxWords: 6, bodyMaxWords: 0, ctaMaxWords: 3, tone: 'punchy, single-line hook', imageHint: 'Vertical composition, primary subject upper-third, bottom 20% reserved for app UI, vivid lighting.' },
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    aspect: '1:1',
    width: 1080,
    height: 1080,
    copy: { headlineMaxWords: 10, bodyMaxWords: 35, ctaMaxWords: 3, tone: 'professional, declarative, no hashtags in copy', imageHint: 'Editorial, polished, subtle gradient or clean photography, professional palette emphasis.' },
  },
  {
    id: 'facebook',
    label: 'Facebook Ad',
    aspect: '1:1',
    width: 1080,
    height: 1080,
    copy: { headlineMaxWords: 7, bodyMaxWords: 25, ctaMaxWords: 3, tone: 'benefit-led, conversational, direct', imageHint: 'Single clear value prop visual, high-contrast subject, minimal text-in-image (Meta ad guideline).' },
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    aspect: '16:9',
    width: 1200,
    height: 675,
    copy: { headlineMaxWords: 6, bodyMaxWords: 30, ctaMaxWords: 3, tone: 'sharp, opinionated, one-liner energy', imageHint: 'Wide cinematic crop, single focal element, readable on mobile timeline at small size.' },
  },
  {
    id: 'web-banner',
    label: 'Web Banner',
    aspect: '16:9',
    width: 1200,
    height: 675,
    copy: { headlineMaxWords: 6, bodyMaxWords: 20, ctaMaxWords: 3, tone: 'confident, brand-led, marketing-site voice', imageHint: 'Cinematic hero composition, breathing room for overlaid headline, palette-led background.' },
  },
  {
    id: 'email',
    label: 'Email Header',
    aspect: '16:9',
    width: 1200,
    height: 675,
    copy: { headlineMaxWords: 7, bodyMaxWords: 20, ctaMaxWords: 3, tone: 'warm, direct, like a subject line', imageHint: 'Clean horizontal banner, subject framed left or right with negative space for headline overlay.' },
  },
  {
    id: 'youtube',
    label: 'YouTube Thumbnail',
    aspect: '16:9',
    width: 1280,
    height: 720,
    copy: { headlineMaxWords: 5, bodyMaxWords: 0, ctaMaxWords: 0, tone: 'ultra-bold curiosity hook, all-caps energy', imageHint: 'High-contrast face or single object, oversized bold text overlay (3-5 words), saturated palette, click-worthy.' },
  },
];

export function getPlatform(id) {
  return PLATFORMS.find((p) => p.id === id);
}
