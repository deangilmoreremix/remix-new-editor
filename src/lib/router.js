import { buildUrl } from './routeUrl.js';

const ROUTE_MAP = {
  'Explore': 'explore',
  'Image': 'image',
  'Video': 'video',
  'Storyboard': 'storyboard',
  'Studio': 'muapi-studio',
  'SmartVid Studio': 'muapi-studio',
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
  'Zack D Studio': 'zackd',
  'SmartWarmupAI': 'smartwarmupai',
  'AI VFX': 'ai-vfx',
  'Brand Studio': 'brand',
  'Brand DNA': 'brand-dna',
  'Campaign': 'campaign',
  'Asset Edit': 'asset-edit',
  'Photo Studio': 'photo-studio',
  'Brand Photo Studio': 'brand-photo-studio',
  'Animate': 'animate',
  'Media Hub': 'media-hub',
  'SmartVidDownloader': 'media-hub',
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
  'video-pages': 'library',   // Video Pages is a modal now (Library > My Video Pages, or any studio's inline Video Pages button)
};

const pageLoaders = {
  image: () => import('../components/ImageStudio.js').then(m => m.ImageStudio()),
  video: () => import('../components/VideoStudio.js').then(m => m.VideoStudio()),
  cinema: () => import('../components/CinemaStudio.js').then(m => m.CinemaStudio()),
  'cinema-template': () => import('../components/CinemaTemplateStudio.js').then(m => m.CinemaTemplateStudio()),
  apps: () => import('../components/AppsHub.js').then(m => m.AppsHub()),
  explore: () => import('../components/ExplorePage.js').then(m => m.ExplorePage()),
  templates: () => import('../components/TemplatesPage.js').then(m => m.TemplatesPage()),
  effects: () => import('../components/EffectsStudio.js').then(m => m.EffectsStudio()),
  edit: () => import('../components/EditStudio.js').then(m => m.EditStudio()),
  upscale: () => import('../components/UpscaleStudio.js').then(m => m.UpscaleStudio()),
  library: () => import('../components/LibraryPage.js').then(m => m.LibraryPage()),
  character: () => import('../components/CharacterStudio.js').then(m => m.CharacterStudio()),
  influencer: () => import('../components/InfluencerStudio.js').then(m => m.InfluencerStudio()),
  commercial: () => import('../components/CommercialStudio.js').then(m => m.CommercialStudio()),
  avatar: () => import('../components/AvatarStudio.js').then(m => m.AvatarStudio()),
  'smart-video-scheduler': () => import('../components/SmartVideoScheduler.js').then(m => m.SmartVideoScheduler()),
  brightbean: () => import('../components/SmartVideoScheduler.js').then(m => m.SmartVideoScheduler()),
  'smart-video-studio': () => import('../components/studios/SmartVideoStudio/SmartVideoStudio.tsx').then(m => m.SmartVideoStudioPage()),
  audio: () => import('../components/AudioStudio.js').then(m => m.AudioStudio()),
  videotools: () => import('../components/VideoToolsStudio.js').then(m => m.VideoToolsStudio()),
  lipsync: () => import('../components/LipSyncStudio.js').then(m => m.LipSyncStudio()),
  leadfinder: () => import('../components/LeadFinderStudio.js').then(m => m.LeadFinderStudio()),
  outreach: () => import('../components/OutreachStudio.js').then(m => m.OutreachStudio()),
  recorder: () => import('../components/RecorderStudioPage.js').then(m => m.RecorderStudioPage()),
  'find-my-brand': () => import('../components/FindMyBrandPage.js').then(m => m.FindMyBrandPage()),
  // Motion Director (ported from OpenHiggsBolt): the chat and its Motion Workbench editor.
  'motion-director': () => import('../components/MotionDirectorPage.js').then(m => m.MotionDirectorPage()),
  'motion-director/workbench': () => import('../components/MotionDirectorPage.js').then(m => m.MotionDirectorPage()),
  personalizer: () => import('../components/Personalizer.js').then(m => m.Personalizer()),
  // Video landing pages are a modal (components/modals/MyVideoPagesModal.js); public pages live at /p/<slug>, mounted from main.js.
  'content-library': () => import('../components/ContentLibraryPage.js').then(m => m.ContentLibraryPage()),
  'website-builder': () => import('../components/OpenThornStudio.js').then(m => m.OpenThornStudio()),

  storyboard: () => import('../components/StoryboardStudio.js').then(m => m.StoryboardStudio()),
  'muapi-studio': () => import('../components/MuapiStudioPage.js').then(m => m.MuapiStudioPage()),
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
  zackd: () => import('../components/studios/ZackDStudio/ZackDStudio.js').then(m => m.ZackDStudio()),
  'zackd-studio': () => import('../components/studios/ZackDStudio/ZackDStudio.js').then(m => m.ZackDStudio()),
  director: () => import('../components/DirectorPage.js').then(m => m.DirectorPage()),
  workbench: () => import('../components/studios/WorkbenchStudio/WorkbenchStudio.js').then(m => m.WorkbenchStudio()),
  // SmartWarmupAI studio: email warmup, outreach, inbox, CRM and automations (apps/warmbly-web, rebranded at build time).
  smartwarmupai: () => import('../components/studios/SmartWarmupAIStudio/SmartWarmupAIStudio.js').then(m => m.SmartWarmupAIStudio()),
  // Deep links into the studio: #/smartwarmupai/<view> and #/smartwarmupai/help[/<docs path>].
  ...Object.fromEntries(['dashboard', 'campaigns', 'inbox', 'contacts', 'pipeline', 'mailboxes', 'deliverability', 'automations', 'integrations', 'settings', 'help']
    .map(v => [`smartwarmupai/${v}`, () => import('../components/studios/SmartWarmupAIStudio/SmartWarmupAIStudio.js').then(m => m.SmartWarmupAIStudio())])),
  // CineGen Studio was replaced by the Workbench; keep old links working.
  cinegen: () => {
    try { window.history.replaceState(null, '', `/workbench${window.location.search}`); } catch { /* ignore */ }
    return import('../components/studios/WorkbenchStudio/WorkbenchStudio.js').then(m => m.WorkbenchStudio());
  },
  // The Timeline Editor is CineGen's workspace (vendored in src/cinegen, our colours + features). The unmodified clone can still be shown
  // in an iframe via components/CineGenFramePage.js (VITE_CINEGEN_URL); #/timeline-classic now redirects here.
  timeline: () => import('../cinegen/mount.tsx').then(m => m.CineGenEditorPage()),
  // Old links/bookmarks to the previous editor open the new one (the classic page is no longer reachable from the app).
  'timeline-classic': () => import('../cinegen/mount.tsx').then(m => m.CineGenEditorPage()),
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
  animate: () => import('../components/AnimatePage.js').then(m => m.AnimatePage()),
  'media-hub': () => import('../components/MediaHubPage.js').then(m => m.MediaHubPage()),
  // SmartVidDownloader (the vendored VidBee app): same page under its product name.
  smartviddownloader: () => import('../components/MediaHubPage.js').then(m => m.MediaHubPage()),
  // Academy: the page parses its own #/academy/track/<track>[/lesson|template/<id>] hash.
  academy: () => import('../components/academy/AcademyPage.jsx').then(m => m.AcademyPage()),
  guide: () => import('../components/GuidePage.js').then(m => m.GuidePage()),
};

// Sub-paths like 'academy/track/<t>/lesson/<id>' are handled by the Academy page itself.
export const academyKey = (page) => {
  if (typeof page !== 'string') return page;
  if (page.startsWith('academy/')) return 'academy';
  // #/smartwarmupai/help/<docs path> and other studio deep links are parsed by the studio itself.
  if (page.startsWith('smartwarmupai/')) return 'smartwarmupai';
  if (page.startsWith('guide/')) return 'guide';
  return page;
};

/** True when navigate(page) opens a real page rather than the placeholder. */
export const isKnownPage = (page) => typeof page === 'string' && (page.startsWith('template/') || Boolean(pageLoaders[academyKey(RETIRED_ROUTES[page] || page)]));

let currentPage = null;
let currentPageEl = null;
let contentArea = null;
let onNavigateCallback = null;
let isNavigating = false;
let currentSearch = '';

/** True when `page` (with the current query string) is already the page on screen. */
export function isCurrentRoute(page) {
  return currentPage === (RETIRED_ROUTES[page] || page) && currentSearch === (window.location.search || '');
}

export function getQueryParam(name) {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || '';
}

export function initRouter(container, callback) {
  contentArea = container;
  onNavigateCallback = callback;
}

/**
 * Opens a page. `opts.history` controls the address bar: 'push' (default) adds an entry,
 * 'replace' swaps the current one (first load), 'none' leaves it alone (Back/Forward and
 * hand-edited URLs, where the browser already moved the URL).
 */
export async function navigate(page, params = {}, opts = {}) {
  if (!contentArea) return;

  // Prevent concurrent navigation to avoid infinite loops
  if (isNavigating) {
    return;
  }

  if (RETIRED_ROUTES[page]) page = RETIRED_ROUTES[page];

  isNavigating = true;
  currentPage = page;
  // Lets the hover-help layer (components/studio/tooltipLayer.js) tint its cards with this studio's accent; no per-studio wiring needed.
  contentArea.dataset.studioTheme = page;

  // Update URL with params so components can read them via URLSearchParams
  const newUrl = buildUrl(page, params);
  const mode = opts.history || 'push';
  if (mode === 'push') window.history.pushState({}, '', newUrl);
  else if (mode === 'replace') window.history.replaceState({}, '', newUrl);
  currentSearch = window.location.search || '';

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
    } else if (pageLoaders[academyKey(page)]) {
      element = await pageLoaders[academyKey(page)]();
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
