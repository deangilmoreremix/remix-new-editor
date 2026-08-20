// Smart Video AI Monetization curriculum: 15 tracks for AI video/content monetization.

export const CURRICULUM_TRACKS = [
  { id: 'freelance', title: 'Smart Video AI Freelance Video', lessons: 8, level: 'Beginner', description: 'Monetize Smart Video AI-generated short-form videos for local businesses.' },
  { id: 'social-agency', title: 'Smart Video AI Social Media Agency', lessons: 10, level: 'Intermediate', description: 'Run ads, reels, and campaigns using Smart Video AI workflows.' },
  { id: 'youtube-automation', title: 'Smart Video AI YouTube Automation', lessons: 9, level: 'Intermediate', description: 'Build Smart Video AI-powered channels with narration and stock footage.' },
  { id: 'product-commercials', title: 'Smart Video AI Product Commercials', lessons: 7, level: 'Beginner', description: 'Create Smart Video AI product ads for Amazon, Shopify, and DTC brands.' },
  { id: 'real-estate', title: 'Smart Video AI Real Estate Videos', lessons: 6, level: 'Beginner', description: 'Create Smart Video AI virtual tours, listing shorts, and neighborhood promos.' },
  { id: 'ecommerce', title: 'Smart Video AI Ecommerce Creatives', lessons: 8, level: 'Beginner', description: 'Upscale products with Smart Video AI model shots and lifestyle assets.' },
  { id: 'courses', title: 'Smart Video AI Course Creation Videos', lessons: 7, level: 'Intermediate', description: 'Create Smart Video AI tutorials, lessons, and previews for online courses.' },
  { id: 'saas', title: 'Smart Video AI SaaS Demo Videos', lessons: 6, level: 'Advanced', description: 'Create Smart Video AI walkthroughs, explainers, and onboarding videos.' },
  { id: 'influencer', title: 'Smart Video AI Influencer Content', lessons: 8, level: 'Beginner', description: 'Create Smart Video AI consistent themed content for personal brand growth.' },
  { id: 'local-business', title: 'Smart Video AI Local Business Videos', lessons: 5, level: 'Beginner', description: 'Create Smart Video AI menus, promos, and event videos for restaurants and gyms.' },
  { id: 'wedding', title: 'Smart Video AI Wedding Highlights', lessons: 6, level: 'Intermediate', description: 'Create Smart Video AI-assisted highlight reels and invitation videos.' },
  { id: 'podcast', title: 'Smart Video AI Podcast Promotion', lessons: 5, level: 'Beginner', description: 'Create Smart Video AI clips, intros, and audiograms for podcast growth.' },
  { id: 'nft', title: 'Smart Video AI NFT/Web3 Media', lessons: 4, level: 'Advanced', description: 'Create Smart Video AI generative art, reveal animations, and lore videos.' },
  { id: 'music', title: 'Smart Video AI Music Video Production', lessons: 7, level: 'Intermediate', description: 'Create Smart Video AI lyric videos, visualizers, and concept clips.' },
  { id: 'corporate', title: 'Smart Video AI Corporate Training Videos', lessons: 6, level: 'Advanced', description: 'Create Smart Video AI safety, onboarding, and compliance video packages.' }
];

export function getTrackById(id) {
  return CURRICULUM_TRACKS.find(t => t.id === id) || null;
}

export function searchTracks({ query = '', level = '' } = {}) {
  const q = query.toLowerCase().trim();
  return CURRICULUM_TRACKS.filter(t => {
    if (level && t.level !== level) return false;
    if (!q) return true;
    return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });
}
