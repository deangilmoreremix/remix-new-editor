const ROUTE_MAP = {
  'Explore': 'explore',
  'Image': 'image',
  'Video': 'video',
  'Storyboard': 'storyboard',
  'Edit': 'edit',
  'Character': 'character',
  'Commercial': 'commercial',
  'Upscale': 'upscale',


  'Smart Video Viral': 'viral',
  'Apps': 'apps',

  'Avatar': 'avatar',
  'Audio': 'audio',
  'Smart Video Scheduler': 'smart-video-scheduler',

  'Personalizer': 'personalizer',
  'Contacts': 'contacts',
  'Social': 'social',
  'Landing': 'landing',
  'Video Tools': 'videotools',
  'Lip Sync': 'lipsync',
  'Video Agent': 'video-agent',
  'Video Agent Studio': 'video-agent-studio',
  'AI VFX': 'ai-vfx',
  'Brand Studio': 'brand',
  'Brand DNA': 'brand-dna',
  'Campaign': 'campaign',
  'Asset Edit': 'asset-edit',
  'Photo Studio': 'photo-studio',
  'Brand Photo Studio': 'brand-photo-studio',
  'Animate': 'animate',
};

export function getRouteForItem(item) {
  return ROUTE_MAP[item] || item.toLowerCase().replace(/\s+/g, '-');
}

export function cleanTemplateParams(params, page) {
  if (!params || typeof params !== 'object') return {};
  const isTemplatePage = page === 'templates' || (typeof page === 'string' && page.startsWith('template/'));
  if (isTemplatePage) return { ...params };
  const cleaned = { ...params };
  delete cleaned.template;
  delete cleaned['academy-template'];
  delete cleaned.academyTemplate;
  delete cleaned.templateId;
  return cleaned;
}

// Studios retired from the product. Old links and bookmarks land on the
// closest live surface instead of a dead page.
export const RETIRED_ROUTES = {
  training: 'apps',
  chat: 'apps',
  assist: 'apps',
  community: 'explore',
  'pexels-media': 'library',
};

const pageLoaders = {
  image: () => import('../components/ImageStudio.js').then(m => m.ImageStudio()),
  video: () => import('../components/VideoStudio.js').then(m => m.VideoStudio()),
  cinema: () => import('../components/CinemaStudio.js').then(m => m.CinemaStudio()),
  'cinema-template': () => import('../components/CinemaTemplateStudio.js').then(m => m.CinemaTemplateStudio()),
  apps: () => import('../components/AppsHub.js').then(m => m.AppsHub()),
  templates: () => import('../components/TemplatesPage.js').then(m => m.TemplatesPage()),
  effects: () => import('../components/EffectsStudio.js').then(m => m.EffectsStudio()),
  edit: () => import('../components/EditStudio.js').then(m => m.EditStudio()),
  upscale: () => import('../components/UpscaleStudio.js').then(m => m.UpscaleStudio()),
  library: () => import('../components/LibraryPage.js').then(m => m.LibraryPage()),
  character: () => import('../components/CharacterStudio.js').then(m => m.CharacterStudio()),
  influencer: () => import('../components/InfluencerStudio.js').then(m => m.InfluencerStudio()),
  commercial: () => import('../components/CommercialStudio.js').then(m => m.CommercialStudio()),
  explore: () => import('../components/ExplorePage.js').then(m => m.ExplorePage()),
  avatar: () => import('../components/AvatarStudio.js').then(m => m.AvatarStudio()),
  'smart-video-scheduler': () => import('../components/SmartVideoScheduler.js').then(m => m.SmartVideoScheduler()),
  brightbean: () => import('../components/SmartVideoScheduler.js').then(m => m.SmartVideoScheduler()),
  'smart-video-studio': () => import('../components/studios/SmartVideoStudio/SmartVideoStudio.tsx').then(m => m.default || m.SmartVideoStudio),
  audio: () => import('../components/AudioStudio.js').then(m => m.AudioStudio()),
  videotools: () => import('../components/VideoToolsStudio.js').then(m => m.VideoToolsStudio()),
  lipsync: () => import('../components/LipSyncStudio.js').then(m => m.LipSyncStudio()),
  leadfinder: () => import('../components/LeadFinderStudio.js').then(m => m.LeadFinderStudio()),
  'find-my-brand': () => import('../components/FindMyBrandPage.js').then(m => m.FindMyBrandPage()),
  // Motion Director (ported from OpenHiggsBolt): the chat and its Motion Workbench editor.
  'motion-director': () => import('../components/MotionDirectorPage.js').then(m => m.MotionDirectorPage()),
  'motion-director/workbench': () => import('../components/MotionDirectorPage.js').then(m => m.MotionDirectorPage()),
  personalizer: () => import('../components/Personalizer.js').then(m => m.Personalizer()),
  'content-library': () => import('../components/ContentLibraryPage.js').then(m => m.ContentLibraryPage()),
  'website-builder': () => import('../components/OpenThornStudio.js').then(m => m.OpenThornStudio()),

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
  // Video Agent = port of Remotion's prompt-to-motion-graphics (apps/motion-agent).
  'video-agent': () => import('../components/studios/VideoAgentStudio/VideoAgentStudio.js').then(m => m.VideoAgentStudio()),
  'video-agent-studio': () => import('../components/studios/VideoAgentStudio/VideoAgentStudio.js').then(m => m.VideoAgentStudio()),
  director: () => import('../components/DirectorPage.js').then(m => m.DirectorPage()),
  workbench: () => import('../components/studios/WorkbenchStudio/WorkbenchStudio.js').then(m => m.WorkbenchStudio()),
  // CineGen Studio was replaced by the Workbench; keep old links working.
  cinegen: () => {
    try { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/workbench`); } catch { /* ignore */ }
    return import('../components/studios/WorkbenchStudio/WorkbenchStudio.js').then(m => m.WorkbenchStudio());
  },
  timeline: () => import('../components/TimelineEditorPage.jsx').then(m => m.TimelineEditorPage()),
  'ai-vfx': () => import('../components/AIVFXPage.js').then(m => m.AIVFXPage()),
  viral: () => import('../components/SmartVideoViral.js').then(m => m.SmartVideoViral()),
  'timeline-iframe-warning': () => Promise.resolve(document.createElement('div')),
  brand: () => import('../components/BrandStudio.js').then(m => m.BrandStudio()),
  'brand-dna': () => import('../components/BrandDnaEditor.js').then(m => m.BrandDnaEditor()),
  campaign: () => import('../components/CampaignWizard.js').then(m => m.CampaignWizard()),
  'campaign-page': () => import('../components/CampaignPage.js').then(m => m.CampaignPage()),
  'asset-edit': () => import('../components/AssetCanvasEditor.js').then(m => m.AssetCanvasEditor()),
  'photo-studio': () => import('../components/PhotoStudioPage.js').then(m => m.PhotoStudioPage()),
  'brand-photo-studio': () => import('../components/PhotoStudioPage.js').then(m => m.PhotoStudioPage()),
  animate: () => import('../components/AnimatePage.js').then(m => m.AnimatePage())
};

let currentPage = null;
let currentPageEl = null;
let contentArea = null;
let onNavigateCallback = null;
let isNavigating = false;

export function getQueryParam(name) {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || '';
}

export function initRouter(container, callback) {
  contentArea = container;
  onNavigateCallback = callback;
}

export async function navigate(page, params = {}) {
  if (!contentArea) return;

  // Prevent concurrent navigation to avoid infinite loops
  if (isNavigating) {
    return;
  }

  if (RETIRED_ROUTES[page]) page = RETIRED_ROUTES[page];

  isNavigating = true;
  currentPage = page;

  // Update URL with params so components can read them via URLSearchParams
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

// Expose navigate globally for debugging
if (typeof window !== 'undefined') {
  window.__debugNavigate = navigate;
  window.__debugGetCurrentPage = getCurrentPage;
}

export function getCurrentPage() {
  return currentPage;
}
