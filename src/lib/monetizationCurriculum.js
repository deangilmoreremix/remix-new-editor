// Monetization curriculum: 15 tracks for AI video/content monetization.

export const CURRICULUM_TRACKS = [
  { id: 'freelance', title: 'Freelance AI Video', lessons: 8, level: 'Beginner', description: 'Offer AI-generated short-form video to local businesses.' },
  { id: 'social-agency', title: 'Social Media Agency', lessons: 10, level: 'Intermediate', description: 'Run ads, reels, and campaigns with AI workflows.' },
  { id: 'youtube-automation', title: 'YouTube Automation', lessons: 9, level: 'Intermediate', description: 'Build AI-powered channels with narration and stock footage.' },
  { id: 'product-commercials', title: 'Product Commercials', lessons: 7, level: 'Beginner', description: 'Create product ads for Amazon, Shopify, and DTC brands.' },
  { id: 'real-estate', title: 'Real Estate AI Video', lessons: 6, level: 'Beginner', description: 'Virtual tours, listing shorts, and neighborhood promos.' },
  { id: 'ecommerce', title: 'Ecommerce Creatives', lessons: 8, level: 'Beginner', description: 'Upscale products, model shots, and lifestyle assets.' },
  { id: 'courses', title: 'Course Creation', lessons: 7, level: 'Intermediate', description: 'Tutorials, lessons, and previews for online courses.' },
  { id: 'saas', title: 'SaaS Demo Videos', lessons: 6, level: 'Advanced', description: 'Walkthroughs, explainers, and onboarding videos.' },
  { id: 'influencer', title: 'Influencer Content', lessons: 8, level: 'Beginner', description: 'Consistent themed content for personal brand growth.' },
  { id: 'local-business', title: 'Local Business Packages', lessons: 5, level: 'Beginner', description: 'Menus, promos, and event videos for restaurants and gyms.' },
  { id: 'wedding', title: 'Wedding Highlights', lessons: 6, level: 'Intermediate', description: 'AI-assisted highlight reels and invitation videos.' },
  { id: 'podcast', title: 'Podcast Promotion', lessons: 5, level: 'Beginner', description: 'Clips, intros, and audiograms for podcast growth.' },
  { id: 'nft', title: 'NFT / Web3 Media', lessons: 4, level: 'Advanced', description: 'Generative art, reveal animations, and lore videos.' },
  { id: 'music', title: 'Music Video Production', lessons: 7, level: 'Intermediate', description: 'Lyric videos, visualizers, and concept clips.' },
  { id: 'corporate', title: 'Corporate Training', lessons: 6, level: 'Advanced', description: 'Safety, onboarding, and compliance video packages.' }
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
