// src/lib/platforms.js
// Platform metadata with platform-specific copy constraints for campaign assets.

export const PLATFORMS = [
  {
    id: 'instagram-feed',
    label: 'Instagram Feed',
    aspect: '1:1',
    width: 1080,
    height: 1080,
    copy: { headlineMaxWords: 8, bodyMaxWords: 30, ctaMaxWords: 3, tone: 'visual, energetic', imageHint: 'bold color block, lifestyle shot' },
  },
  {
    id: 'instagram-story',
    label: 'Instagram Story',
    aspect: '9:16',
    width: 1080,
    height: 1920,
    copy: { headlineMaxWords: 6, bodyMaxWords: 20, ctaMaxWords: 3, tone: 'snappy, immersive', imageHint: 'vertical cinematic, full-bleed' },
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    aspect: '1:1',
    width: 1200,
    height: 627,
    copy: { headlineMaxWords: 10, bodyMaxWords: 50, ctaMaxWords: 4, tone: 'professional, authoritative', imageHint: 'clean corporate, thought-leadership' },
  },
  {
    id: 'facebook',
    label: 'Facebook Ad',
    aspect: '1:1',
    width: 1200,
    height: 628,
    copy: { headlineMaxWords: 8, bodyMaxWords: 40, ctaMaxWords: 3, tone: 'friendly, benefit-driven', imageHint: 'warm, social proof, people' },
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    aspect: '16:9',
    width: 1200,
    height: 675,
    copy: { headlineMaxWords: 6, bodyMaxWords: 20, ctaMaxWords: 2, tone: 'concise, provocative', imageHint: 'bold typography, minimal' },
  },
  {
    id: 'web-banner',
    label: 'Web Banner',
    aspect: '16:9',
    width: 1200,
    height: 628,
    copy: { headlineMaxWords: 8, bodyMaxWords: 30, ctaMaxWords: 3, tone: 'clean, conversion-focused', imageHint: 'hero shot, brand-aligned' },
  },
  {
    id: 'email',
    label: 'Email Header',
    aspect: '16:9',
    width: 600,
    height: 300,
    copy: { headlineMaxWords: 6, bodyMaxWords: 20, ctaMaxWords: 3, tone: 'clear, actionable', imageHint: 'simple header, brand accent' },
  },
  {
    id: 'youtube',
    label: 'YouTube Thumbnail',
    aspect: '16:9',
    width: 1280,
    height: 720,
    copy: { headlineMaxWords: 5, bodyMaxWords: 0, ctaMaxWords: 2, tone: 'bold, clickable', imageHint: 'high-contrast, expressive face' },
  },
];
