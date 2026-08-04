// studioRoutes.js
// Single source of truth for the "all studios" side menu / drawer.
// Drives both the global Sidebar (src/components/Sidebar.js) and the in-studio
// drawer (src/lib/studioChrome.js). Every SPA route is listed so the menu shows
// ALL routes, with icons/labels reused from the global sidebar where available.

// Icons reused from the global Sidebar (src/components/Sidebar.js) so the drawer
// and the persistent sidebar stay visually consistent.
const ICONS = {
  apps: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  image: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  video: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
  cinema: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>',
  character: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  influencer: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6v12a3 3 0 103 3V6a3 3 0 10-3 3z"/></svg>',
  storyboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="6" height="8" rx="1"/><rect x="9" y="3" width="6" height="8" rx="1"/><rect x="16" y="3" width="6" height="8" rx="1"/><rect x="2" y="13" width="6" height="8" rx="1"/><rect x="9" y="13" width="6" height="8" rx="1"/><rect x="16" y="13" width="6" height="8" rx="1"/></svg>',
  effects: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  upscale: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
  audio: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  avatar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M12 11v2"/><path d="M8 14c1 1 4 1 8 0"/></svg>',
  training: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  videotools: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3V9z"/></svg>',
  render: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/><line x1="19" y1="3" x2="19" y2="21"/></svg>',
  'video-agent': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/><path d="M8 15h8"/><path d="M12 2v2"/></svg>',
  director: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6l4-4h4l4 4"/><path d="M2 6h20v14a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>',
  timeline: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="2" y1="15" x2="22" y2="15"/><circle cx="6" cy="6" r="1.5" fill="currentColor"/><circle cx="6" cy="12" r="1.5" fill="currentColor"/><circle cx="6" cy="18" r="1.5" fill="currentColor"/></svg>',
  chat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  commercial: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
  templates: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
  explore: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  library: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
  'content-library': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
  community: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  assist: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l1.09 3.26L16 6l-2.91.74L12 10l-1.09-3.26L8 6l2.91-.74L12 2z"/><path d="M5 15l.54 1.63L7 17.17l-1.46.37L5 19.17l-.54-1.63L3 17.17l1.46-.37L5 15z"/><path d="M19 11l.54 1.63L21 13.17l-1.46.37L19 15.17l-.54-1.63L17 13.17l1.46-.37L19 11z"/></svg>',
  'ai-vfx': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.39 6.95H22l-6.19 4.5L18.18 22 12 17.5 5.82 22l2.37-8.55L2 8.95h7.61L12 2z"/><circle cx="12" cy="12" r="3"/></svg>',
  lipsync: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>',
};

const FALLBACK_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>';

// All SPA route -> { label, category }. Icons resolved from ICONS above.
// 'category' groups the drawer (mirrors the global sidebar grouping intent).
export const STUDIO_ROUTES = {
  apps: { label: 'Apps', category: 'Home' },
  explore: { label: 'Explore', category: 'Home' },
  image: { label: 'Image Studio', category: 'Create' },
  video: { label: 'Video Studio', category: 'Create' },
  cinema: { label: 'Cinema Studio', category: 'Create' },
  storyboard: { label: 'Storyboard Studio', category: 'Create' },
  effects: { label: 'Effects Studio', category: 'Create' },
  edit: { label: 'Edit Studio', category: 'Create' },
  upscale: { label: 'Upscale Suite', category: 'Create' },
  character: { label: 'Character Studio', category: 'Create' },
  commercial: { label: 'Commercial Studio', category: 'Create' },
  audio: { label: 'Audio Studio', category: 'Create' },
  avatar: { label: 'Avatar Studio', category: 'Create' },
  training: { label: 'Training Studio', category: 'Create' },
  videotools: { label: 'Video Tools', category: 'Create' },
  chat: { label: 'Chat Studio', category: 'Create' },
  lipsync: { label: 'Lip Sync', category: 'Create' },
  influencer: { label: 'AI Influencer', category: 'Create' },
  templates: { label: 'Templates', category: 'Home' },
  community: { label: 'Community', category: 'Home' },
  assist: { label: 'Assist', category: 'Tools' },
  impeccable: { label: 'Impeccable', category: 'Tools' },
  'impeccable-craft': { label: 'Impeccable · Craft', category: 'Tools' },
  'impeccable-init': { label: 'Impeccable · Init', category: 'Tools' },
  'impeccable-document': { label: 'Impeccable · Document', category: 'Tools' },
  'impeccable-extract': { label: 'Impeccable · Extract', category: 'Tools' },
  'impeccable-shape': { label: 'Impeccable · Shape', category: 'Tools' },
  'impeccable-critique': { label: 'Impeccable · Critique', category: 'Tools' },
  'impeccable-audit': { label: 'Impeccable · Audit', category: 'Tools' },
  'impeccable-polish': { label: 'Impeccable · Polish', category: 'Tools' },
  'impeccable-bolder': { label: 'Impeccable · Bolder', category: 'Tools' },
  'impeccable-quieter': { label: 'Impeccable · Quieter', category: 'Tools' },
  'impeccable-distill': { label: 'Impeccable · Distill', category: 'Tools' },
  'impeccable-harden': { label: 'Impeccable · Harden', category: 'Tools' },
  'impeccable-onboard': { label: 'Impeccable · Onboard', category: 'Tools' },
  'impeccable-animate': { label: 'Impeccable · Animate', category: 'Tools' },
  'impeccable-colorize': { label: 'Impeccable · Colorize', category: 'Tools' },
  'impeccable-typeset': { label: 'Impeccable · Typeset', category: 'Tools' },
  'impeccable-layout': { label: 'Impeccable · Layout', category: 'Tools' },
  'impeccable-delight': { label: 'Impeccable · Delight', category: 'Tools' },
  'impeccable-clarify': { label: 'Impeccable · Clarify', category: 'Tools' },
  'impeccable-adapt': { label: 'Impeccable · Adapt', category: 'Tools' },
  'impeccable-optimize': { label: 'Impeccable · Optimize', category: 'Tools' },
  'impeccable-live': { label: 'Impeccable · Live', category: 'Tools' },
  'impeccable-overdrive': { label: 'Impeccable · Overdrive', category: 'Tools' },
  'text-to-image': { label: 'Text to Image', category: 'Generate' },
  'image-to-image': { label: 'Image to Image', category: 'Generate' },
  'text-to-video': { label: 'Text to Video', category: 'Generate' },
  'image-to-video': { label: 'Image to Video', category: 'Generate' },
  'video-to-video': { label: 'Video to Video', category: 'Generate' },
  'video-watermark': { label: 'Watermark Remover', category: 'Generate' },
  'character-page': { label: 'Character', category: 'Pages' },
  'cinema-page': { label: 'Cinema Studio', category: 'Pages' },
  'effects-page': { label: 'Vibe Motion', category: 'Pages' },
  'storyboard-page': { label: 'Storyboard', category: 'Pages' },
  'influencer-page': { label: 'AI Influencer', category: 'Pages' },
  'commercial-page': { label: 'Commercial', category: 'Pages' },
  'upscale-page': { label: 'Upscale', category: 'Pages' },
  'video-agent': { label: 'Video Agent', category: 'Tools' },
  director: { label: 'Director', category: 'Tools' },
  'ai-vfx': { label: 'AI VFX', category: 'Tools' },
  render: { label: 'Video Render', category: 'Tools' },
  timeline: { label: 'Timeline', category: 'Tools' },
  library: { label: 'Library', category: 'Home' },
  'content-library': { label: 'Content Library', category: 'Home' },
};

// Ordered category groups for the drawer.
export const STUDIO_CATEGORIES = ['Home', 'Create', 'Generate', 'Pages', 'Tools'];

export function getStudioIcon(route) {
  return ICONS[route] || FALLBACK_ICON;
}

export function getStudioLabel(route) {
  return (STUDIO_ROUTES[route] && STUDIO_ROUTES[route].label) || route;
}

// Returns routes grouped by category, preserving STUDIO_CATEGORIES order.
export function getGroupedStudioRoutes() {
  const groups = {};
  STUDIO_CATEGORIES.forEach((c) => { groups[c] = []; });
  Object.entries(STUDIO_ROUTES).forEach(([route, meta]) => {
    const cat = meta.category || 'Tools';
    (groups[cat] = groups[cat] || []).push({ route, label: meta.label, icon: getStudioIcon(route) });
  });
  return STUDIO_CATEGORIES
    .filter((c) => groups[c] && groups[c].length)
    .map((c) => ({ category: c, items: groups[c] }));
}

export default STUDIO_ROUTES;
