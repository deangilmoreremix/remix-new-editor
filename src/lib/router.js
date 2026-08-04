// Maps human-readable menu labels to router route IDs.
// The fallback (`label.toLowerCase().replace(/\s+/g, '-')`) handles labels
// that already match their route ID (e.g. "Apps" → "apps", "Render" → "render",
// "Director" → "director"). Entries here are only needed when a label is
// intentionally different from its route ID, or where a non-slugified ID is
// required (e.g. "Video Tools" → "videotools", not "video-tools").
const ROUTE_MAP = {
  // Legacy top-level header labels (kept for compatibility with the older
  // Header.js and any deep links that may still reference them).
  'Explore': 'explore',
  'Image': 'image',
  'Video': 'video',
  'Storyboard': 'storyboard',
  'Edit': 'edit',
  'Character': 'character',

  'Vibe Motion': 'effects',
  'Cinema Studio': 'cinema',
  'AI Influencer': 'influencer',
  'Apps': 'apps',
  'Templates': 'templates',
  'Assist': 'assist',
  'Community': 'community',
  'Avatar': 'avatar',
  'Audio': 'audio',
  'Settings': 'timeline',
  'Personalizer': 'timeline',
  'Contacts': 'contacts',
  'Media Lib': 'timeline',
  'Social': 'timeline',
  'Landing': 'timeline',

  // New sidebar/landing-header labels. Most already match the route ID via
  // the fallback, but a few need an explicit entry.
  'Cinema': 'cinema',
  'Influencer': 'influencer',
  'Effects': 'effects',
  'Upscale': 'upscale',
  'Training': 'training',
  'Video Tools': 'videotools', // route ID is the unhyphenated "videotools"
  'Render': 'render',
  'Video Agent': 'video-agent',
  'Director': 'director',
  'Timeline': 'timeline',
  'Chat': 'chat',
  'Commercial': 'commercial',
  'Library': 'library',
  'Content Library': 'content-library',
  'AI VFX': 'ai-vfx',
};

export function getRouteForItem(item) {
  return ROUTE_MAP[item] || item.toLowerCase().replace(/\s+/g, '-');
}

const pageLoaders = {
  image: () => import('../components/ImageStudio.js').then(m => m.ImageStudio()),
  video: () => import('../components/VideoStudio.js').then(m => m.VideoStudio()),
  cinema: () => import('../components/CinemaStudio.js').then(m => m.CinemaStudio()),
  apps: () => import('../components/AppsHub.js').then(m => m.AppsHub()),
  templates: () => import('../components/TemplatesPage.js').then(m => m.TemplatesPage()),
  effects: () => import('../components/EffectsStudio.js').then(m => m.EffectsStudio()),
  edit: () => import('../components/EditStudio.js').then(m => m.EditStudio()),
  upscale: () => import('../components/UpscaleStudio.js').then(m => m.UpscaleStudio()),
  library: () => import('../components/LibraryPage.js').then(m => m.LibraryPage()),
  'content-library': () => import('../components/ContentLibraryPage.js').then(m => m.ContentLibraryPage()),
  character: () => import('../components/CharacterStudio.js').then(m => m.CharacterStudio()),
  influencer: () => import('../components/InfluencerStudio.js').then(m => m.InfluencerStudio()),
  commercial: () => import('../components/CommercialStudio.js').then(m => m.CommercialStudio()),
  explore: () => import('../components/ExplorePage.js').then(m => m.ExplorePage()),
  avatar: () => import('../components/AvatarStudio.js').then(m => m.AvatarStudio()),
  audio: () => import('../components/AudioStudio.js').then(m => m.AudioStudio()),
  training: () => import('../components/TrainingStudio.js').then(m => m.TrainingStudio()),
  videotools: () => import('../components/VideoToolsStudio.js').then(m => m.VideoToolsStudio()),
  chat: () => import('../components/ChatStudio.js').then(m => m.ChatStudio()),
  lipsync: () => import('../components/LipSyncStudio.js').then(m => m.LipSyncStudio()),

  assist: () => import('../components/AssistPage.js').then(m => m.AssistPage()),
  community: () => import('../components/CommunityPage.js').then(m => m.CommunityPage()),
  storyboard: () => import('../components/StoryboardStudio.js').then(m => m.StoryboardStudio()),
  'text-to-image': () => import('../components/TextToImagePage.js').then(m => m.TextToImagePage()),
  'image-to-image': () => import('../components/ImageToImagePage.js').then(m => m.ImageToImagePage()),
  'text-to-video': () => import('../components/TextToVideoPage.js').then(m => m.TextToVideoPage()),
  'image-to-video': () => import('../components/ImageToVideoPage.js').then(m => m.ImageToVideoPage()),
  'video-to-video': () => import('../components/VideoToVideoPage.js').then(m => m.VideoToVideoPage()),
  'video-watermark': () => import('../components/VideoWatermarkPage.js').then(m => m.VideoWatermarkPage()),
  'storyboard-page': () => import('../components/StoryboardPage.js').then(m => m.StoryboardPage()),
  'character-page': () => import('../components/CharacterPage.js').then(m => m.CharacterPage()),
  'effects-page': () => import('../components/EffectsPage.js').then(m => m.EffectsPage()),
  'cinema-page': () => import('../components/CinemaPage.js').then(m => m.CinemaPage()),
  'influencer-page': () => import('../components/InfluencerPage.js').then(m => m.InfluencerPage()),
  'commercial-page': () => import('../components/CommercialPage.js').then(m => m.CommercialPage()),
  'upscale-page': () => import('../components/UpscalePage.js').then(m => m.UpscalePage()),
  render: () => import('../components/RenderPage.js').then(m => m.RenderPage()),
  'video-agent': () => import('../components/VideoAgentPage.js').then(m => m.VideoAgentPage()),
  director: () => import('../components/DirectorPage.js').then(m => m.DirectorPage()),
  timeline: () => import('../components/TimelineEditorPage.jsx').then(m => m.TimelineEditorPage()),
  'ai-vfx': () => import('../components/AIVFXPage.js').then(m => m.AIVFXPage()),
  'timeline-iframe-warning': () => Promise.resolve(document.createElement('div'))
};

let currentPage = null;
let currentPageEl = null;
let contentArea = null;
let onNavigateCallback = null;
let isNavigating = false;

export function initRouter(container, callback) {
  contentArea = container;
  onNavigateCallback = callback;
}

export async function navigate(page, params = {}) {
  if (!contentArea) return;

  if (isNavigating) {
    console.warn('[Router] Navigation already in progress, skipping...');
    return;
  }

  isNavigating = true;
  currentPage = page;

  const searchParams = new URLSearchParams(params).toString();
  const newUrl = searchParams ? `/?${searchParams}#/${page}` : `/#/${page}`;
  window.history.pushState({}, '', newUrl);

  currentPageEl?.cleanup?.();
  currentPageEl = null;
  contentArea.innerHTML = '';

  const loading = document.createElement('div');
  loading.className = 'w-full h-full flex items-center justify-center';
  loading.innerHTML = '<div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>';
  contentArea.appendChild(loading);

  try {
    let element;

    if (page.startsWith('template/')) {
      const templateId = page.replace('template/', '');
      const mod = await import('../components/TemplateStudio.js');
      element = mod.TemplateStudio(templateId);
    } else if (pageLoaders[page]) {
      element = await pageLoaders[page]();
    } else {
      const mod = await import('../components/PlaceholderPage.js');
      element = mod.PlaceholderPage(page);
    }

    if (currentPage !== page) {
      isNavigating = false;
      return;
    }

    contentArea.innerHTML = '';
    contentArea.appendChild(element);
    currentPageEl = element;
  } catch (err) {
    console.error(`[Router] Failed to load page: ${page}`, err);
    contentArea.innerHTML = '';
    currentPageEl?.cleanup?.();
    currentPageEl = null;
    const errEl = document.createElement('div');
    errEl.className = 'w-full h-full flex items-center justify-center text-red-400 text-sm';
    errEl.textContent = `Failed to load ${page}: ${err.message}`;
    contentArea.appendChild(errEl);
  } finally {
    isNavigating = false;
  }

  if (onNavigateCallback) onNavigateCallback(page);
}

if (typeof window !== 'undefined') {
  window.__debugNavigate = navigate;
  window.__debugGetCurrentPage = getCurrentPage;
}

export function getCurrentPage() {
  return currentPage;
}
