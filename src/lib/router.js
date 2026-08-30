const ROUTE_MAP = {
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
  'Smart Video Scheduler': 'smart-video-scheduler',
  'SmartVideo AI Studio': 'smart-video-studio',
  'Settings': 'timeline',
  'Personalizer': 'timeline',
  'Contacts': 'contacts',
  'Media Lib': 'timeline',
  'Social': 'timeline',
  'Landing': 'timeline',
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
  character: () => import('../components/CharacterStudio.js').then(m => m.CharacterStudio()),
  influencer: () => import('../components/InfluencerStudio.js').then(m => m.InfluencerStudio()),
  commercial: () => import('../components/CommercialStudio.js').then(m => m.CommercialStudio()),
  explore: () => import('../components/ExplorePage.js').then(m => m.ExplorePage()),
  avatar: () => import('../components/AvatarStudio.js').then(m => m.AvatarStudio()),
  'smart-video-scheduler': () => import('../components/SmartVideoScheduler.js').then(m => m.SmartVideoScheduler()),
  brightbean: () => import('../components/SmartVideoScheduler.js').then(m => m.SmartVideoScheduler()),
  audio: () => import('../components/AudioStudio.js').then(m => m.AudioStudio()),
  training: () => import('../components/TrainingStudio.js').then(m => m.TrainingStudio()),
  videotools: () => import('../components/VideoToolsStudio.js').then(m => m.VideoToolsStudio()),
  chat: () => import('../components/ChatStudio.js').then(m => m.ChatStudio()),
  lipsync: () => import('../components/LipSyncStudio.js').then(m => m.LipSyncStudio()),
  leadfinder: () => import('../components/LeadFinderStudio.js').then(m => m.LeadFinderStudio()),

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
  viral: () => import('../components/SmartVideoViral.js').then(m => m.SmartVideoViral()),
  'timeline-iframe-warning': () => Promise.resolve(document.createElement('div')),
  brand: () => { console.log('[DEBUG] Loading BrandStudioIframe'); return import('../components/BrandStudioIframe.js').then(m => m.BrandStudioIframe()); },
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
    console.warn('[Router] Navigation already in progress, skipping...');
    return;
  }

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

// Expose navigate globally for debugging
if (typeof window !== 'undefined') {
  window.__debugNavigate = navigate;
  window.__debugGetCurrentPage = getCurrentPage;
}

export function getCurrentPage() {
  return currentPage;
}
