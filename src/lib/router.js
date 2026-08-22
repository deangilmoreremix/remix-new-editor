import { isDevBypass } from './apiKeyManager.js';
import { ensureClerkLoaded, isClerkReady } from './clerkInit.js';

// Studio / gated pages that require an active pro plan.
const STUDIO_PAGES = new Set([
  'image','video','cinema','storyboard','edit','upscale','character',
  'commercial','templates','training','videotools','chat','audio','avatar',
  'lipsync','render','influencer','video-agent','director','timeline',
  'effects','apps','explore','library','assist','community',
  'text-to-image','image-to-image','text-to-video','image-to-video',
  'video-to-video','video-watermark','storyboard-page','character-page',
  'effects-page','cinema-page','influencer-page','commercial-page',
  'upscale-page','ai-vfx','viral',
]);

// Ensure the shared Clerk instance is created + loaded before any studio
// page auth check runs. This guarantees `window.Clerk` is an *instance* (not
// the bare class), so `clerk.user` is available for the entitlement gate.
export async function waitForClerk(timeoutMs = 10000) {
  try {
    const clerk = await ensureClerkLoaded();
    if (clerk && clerk.loaded) return clerk;
  } catch {
    // load failed — fall through to timeout-based fallback
  }

  // Fallback: poll window.Clerk (set async by ClerkProvider) if the singleton
  // couldn't load (e.g. SSR, missing key).
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const c = typeof window !== 'undefined' && window.Clerk;
    if (c && c.loaded && typeof c.user !== 'undefined') return c;
    await new Promise((r) => setTimeout(r, 200));
  }

  // Last resort: return whatever window.Clerk is (may be class or instance)
  return (typeof window !== 'undefined' && window.Clerk) || null;
}

// Synchronous check — used when we can't afford to await (e.g. button handlers).
export function isClerkLoaded() {
  return isClerkReady() ||
    (typeof window !== 'undefined' && !!window.Clerk && window.Clerk.loaded);
}

async function ensureStudioAccess(page, urlParams = {}) {
  if (!STUDIO_PAGES.has(page)) return true;

  if (urlParams.template && (page === 'templates' || page.startsWith('template/'))) return true;

  // Local/dev auth bypass (VITE_DEV_BYPASS_AUTH or ?dev): skip the Clerk
  // gate entirely so studios are usable without a real Clerk session.
  if (isDevBypass) return true;

  const clerk = await waitForClerk();
  const user = clerk?.user;

  if (!user) {
    window.location.href = '/signin';
    return false;
  }

  // Templates hub is open to any authenticated user (free tier / template club)
  if (page === 'templates' || page.startsWith('template/')) {
    return true;
  }

  // All other studios require the pro plan
  const plan = user.publicMetadata?.plan;
  if (plan !== 'pro') {
    window.location.href = '/pricing';
    return false;
  }

  return true;
}

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
  'Stock Media': 'pexels-media',
  'Smart Video Viral': 'viral',
};

export function getRouteForItem(item) {
  return ROUTE_MAP[item] || item.toLowerCase().replace(/\s+/g, '-');
}

const pageLoaders = {
  image: () => import('../components/ImageStudio.js').then(m => m.ImageStudio()),
  video: () => import('../components/VideoStudio.js').then(m => m.VideoStudio()),
  cinema: () => import('../components/CinemaStudio.js').then(m => m.CinemaStudio()),
  'cinema-template': () => import('../components/CinemaTemplateStudio.js').then(m => m.CinemaTemplateStudio()),
  apps: () => import('../components/AppsHub.js').then(m => m.AppsHub()),
  academy: () => import('../components/academy/AcademyPage.jsx').then(m => m.AcademyPage()),
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
  'pexels-media': () => import('../components/PexelsMediaPage.js').then(m => m.PexelsMediaPage()),

  assist: () => import('../components/AssistPage.js').then(m => m.AssistPage()),
  community: () => import('../components/CommunityPage.js').then(m => m.CommunityPage()),
  storyboard: () => import('../components/StoryboardStudio.js').then(m => m.StoryboardStudio()),
  'text-to-image': () => import('../components/TextToImagePage.js').then(m => m.TextToImagePage()),
  'image-to-image': () => import('../components/ImageToImagePage.js').then(m => m.ImageToImagePage()),
  'text-to-video': () => import('../components/TextToVideoPage.js').then(m => m.TextToVideoPage()),
  'image-to-video': () => import('../components/ImageToVideoPage.js').then(m => m.ImageToVideoPage()),
  'video-to-video': () => import('../components/VideoToVideoPage.js').then(m => m.VideoToVideoPage()),
   'video-watermark': () => import('../components/VideoWatermarkPage.js').then(m => m.VideoWatermarkPage()),
   'studios/product-photo-studio': () => import('../components/studios/ProductPhotoStudio.jsx').then(m => m.ProductPhotoStudio()),
   'studios/fashion-studio': () => import('../components/studios/FashionStudio.jsx').then(m => m.FashionStudio()),
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
  viral: () => import('../components/SmartVideoViral.js').then(m => m.SmartVideoViral()),
  spaces: () => Promise.resolve(document.createElement('div')),
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

function getExistingParams() {
  if (typeof window === 'undefined') return {};
  const search = window.location.search;
  if (!search || search.length <= 1) return {};
  const params = new URLSearchParams(search.slice(1));
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

export function getQueryParam(name) {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// Remove template-scoped query parameters from params when navigating to a
// non-template page. This prevents stale `?template=...` values from leaking
// into unrelated studios and causing unwanted redirects.
export function cleanTemplateParams(params = {}, page) {
  if (!page.startsWith('template/') && page !== 'templates') {
    delete params.template;
    delete params['academy-template'];
    delete params.templateId;
  }
  return params;
}

export async function navigate(page, params = {}) {
  if (!contentArea) return;

  if (isNavigating) {
    console.warn('[Router] Navigation already in progress, skipping...');
    return;
  }

  isNavigating = true;
  currentPage = page;

  const mergedParams = { ...getExistingParams(), ...params };

  mergedParams = cleanTemplateParams(mergedParams, page);

  // Gate studio / gated pages behind the pro plan
  let granted = true;
  try {
    granted = await ensureStudioAccess(page, mergedParams);
  } catch (err) {
    console.error(`[Router] Access check failed for ${page}:`, err);
    granted = false;
  }
  if (!granted) {
    isNavigating = false;
    return;
  }

  const searchParams = new URLSearchParams(mergedParams).toString();
  let hashPath = `/${page}`;
  if (page === 'academy') {
    const m = window.location.hash.match(/^#\/academy(\/.*)?$/);
    if (m && m[1]) hashPath = `/academy${m[1]}`;
  }
  const newUrl = searchParams ? `/?${searchParams}#${hashPath}` : `#${hashPath}`;
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

    // Template pages are also gated — check them before loading
    if (page.startsWith('template/')) {
      const templateOk = await ensureStudioAccess('templates', mergedParams);
      if (!templateOk) return;
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
    if (element instanceof Node) {
      contentArea.appendChild(element);
    } else {
      console.error('[Router] Expected DOM Node for page', page, 'but got:', element);
      const errEl = document.createElement('div');
      errEl.className = 'w-full h-full flex items-center justify-center text-red-400 text-sm';
      errEl.textContent = `Failed to load ${page}: invalid module export`;
      contentArea.appendChild(errEl);
    }
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
