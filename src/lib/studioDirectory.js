// src/lib/studioDirectory.js
//
// Every studio SmartVideo has, in one list (38): its route id, name, one-line description, group and image.
// The Apps page and the onboarding picker are both built from it, so they always show the same studios.
//   - The side menu (NAV_GROUPS) stays the source of truth for the 31 studios and pages that are in it
//     (the Apps hub itself is the page that lists them, so it is not one of the 38).
//   - EXTRA_STUDIOS adds the 7 studios that exist in the app but are not in the side menu.
// Images: the guide screenshot (public/guides/<slug>/overview.webp, src/lib/guideImages.js), falling back to the
// studio's existing thumbnail (src/lib/thumbnails.js). Video Pages and Website Builder have no guide screenshot.
import { NAV_GROUPS, STUDIO_ROUTES, getStudioIcon } from './studioRoutes.js';
import { getStudioThumbnail, getHeroThumbnail } from './thumbnails.js';
import { getGuideOverview } from './guideImages.js';

export const STUDIO_GROUPS = Object.freeze(['Discover', 'Image', 'Video', 'Agents', 'My Work']);

// Studios that are not in the side menu today (their group follows STUDIO_ROUTES' category).
export const EXTRA_STUDIOS = Object.freeze([
  { id: 'influencer', group: 'Image' },
  { id: 'motion-director', group: 'Agents' },
  { id: 'leadfinder', group: 'Agents' },
  { id: 'outreach', group: 'Agents' },
  { id: 'recorder', group: 'Agents' },
  { id: 'find-my-brand', group: 'Agents' },
  { id: 'render', group: 'Agents' },
]);

// route id -> guide folder (public/guides/<slug>). Video Pages and Website Builder have none.
export const SLUG_BY_ROUTE = Object.freeze({
  explore: 'explore', templates: 'templates', academy: 'smart-video-academy',
  image: 'image-studio', edit: 'edit-studio', upscale: 'upscale-suite', character: 'character-studio',
  commercial: 'product-shot-studio', brand: 'brand-studio', influencer: 'ai-influencer',
  video: 'video-studio', cinema: 'cinema-studio', 'cinema-template': 'cinema-templates', storyboard: 'storyboard-studio',
  effects: 'effects-studio', 'ai-vfx': 'ai-vfx-studio', animate: 'animate-studio', lipsync: 'lip-sync-studio',
  videotools: 'video-tools', avatar: 'avatar-studio', audio: 'audio-studio',
  'video-agent': 'video-agent', zackd: 'zack-d-studio', director: 'director', timeline: 'timeline-editor',
  workbench: 'workbench', viral: 'smart-video-viral', personalizer: 'personalizer',
  'motion-director': 'motion-director', leadfinder: 'lead-finder', outreach: 'video-outreach', recorder: 'recorder',
  'find-my-brand': 'find-my-brand', render: 'video-render', library: 'library', 'content-library': 'content-library',
});

const DESCRIPTIONS = Object.freeze({
  explore: 'Inspiration: trending templates, prompts and categories',
  templates: 'Ready-made starts for ads, posts and thumbnails',
  academy: 'Lessons and templates that teach the craft',
  image: 'Generate images with 20+ AI models',
  edit: 'Remove objects, backgrounds, reframe and more',
  upscale: 'AI upscale and enhance images',
  character: 'Consistent character generation',
  commercial: 'Studio-quality product photos from one image',
  brand: 'Brand-consistent content generation',
  influencer: 'Design a consistent AI influencer and their content',
  video: 'Create AI videos from text and images',
  cinema: 'Cinematic shots with camera controls',
  'cinema-template': 'Ready-made cinematic templates: add your media and generate',
  storyboard: 'Multi-frame generation for sequences',
  effects: 'Apply 200+ motion and visual effects',
  'ai-vfx': 'Camera moves, VFX and AI effects from one image',
  animate: 'Animate images and create motion graphics',
  lipsync: 'Animate portraits or sync lips to audio with AI',
  videotools: 'Upscale, edit, translate and enhance videos',
  avatar: 'AI avatars and lip sync video generation',
  audio: 'Generate music, speech and sound effects',
  'video-agent': 'AI-powered video production assistant',
  zackd: 'Directed, multi-beat AI videos from a template and a short brief',
  director: 'AI editor that cuts and directs your footage',
  timeline: 'Multi-track timeline for editing and rendering',
  workbench: 'Node-based workspace to chain generations together',
  viral: 'AI-powered viral video generation',
  personalizer: 'Personalize templates and assets with your data',
  'video-pages': 'Turn any video into a branded landing page with a CTA and lead form',
  'website-builder': 'Generate and publish a site from a prompt',
  'motion-director': 'Chat with an AI motion designer and refine scenes in the Motion Workbench',
  leadfinder: 'Find local businesses that need video',
  outreach: 'Record once, greet every contact by name and track who watched',
  recorder: 'Record your screen and camera, then share or edit the video',
  'find-my-brand': 'Read a business website and find its logo, photos and branding',
  render: 'Render, caption, dub and finish your videos with AI',
  library: 'Everything you have generated, in one place',
  'content-library': 'Browse and reuse your saved content',
});

function entry(id, group) {
  const slug = SLUG_BY_ROUTE[id] || null;
  const fallback = getStudioThumbnail(id) || getHeroThumbnail(id) || null;
  return {
    id,
    slug,
    group,
    name: STUDIO_ROUTES[id]?.label || id,
    description: DESCRIPTIONS[id] || '',
    image: getGuideOverview(slug) || fallback, // the guide screenshot, else the existing thumbnail
    fallback,                                    // used if the screenshot fails to load
    icon: getStudioIcon(id),
    href: `#/${id}`,
  };
}

function build() {
  const out = [];
  NAV_GROUPS.forEach((g, i) => {
    const group = i === 0 ? 'Discover' : g.title;
    g.items.forEach((it) => { if (it.id !== 'apps') out.push(entry(it.id, group)); });
  });
  EXTRA_STUDIOS.forEach((x) => out.push(entry(x.id, x.group)));
  // Keep the groups in display order, items in the order they were added (side menu first, then the extras).
  return STUDIO_GROUPS.flatMap((title) => out.filter((s) => s.group === title));
}

/** The 38 studios, grouped in display order (Discover, Image, Video, Agents, My Work). */
export const STUDIO_DIRECTORY = Object.freeze(build());

export const getStudio = (id) => STUDIO_DIRECTORY.find((s) => s.id === id) || null;

/** [{ title, items }] in display order. */
export const directoryByGroup = () => STUDIO_GROUPS.map((title) => ({ title, items: STUDIO_DIRECTORY.filter((s) => s.group === title) }));
