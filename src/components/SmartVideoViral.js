import { mountStudioChrome } from '../lib/studioChrome.js';
import { escapeHtml } from '../lib/security.js';
import { showToast } from '../lib/loading.js';
import { createHeroSection } from '../lib/thumbnails.js';
import { navigate } from '../lib/router.js';

const VPF_JSON_URL = 'https://raw.githubusercontent.com/Hanyuyu/visual-prompt-feed/main/data/prompts.json';

function proxyVideoUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('video.twimg.com') && import.meta && import.meta.env && import.meta.env.DEV) {
      return `/proxy/video${u.pathname}${u.search}`;
    }
  } catch (_) { /* not a URL, return as-is */ }
  return url;
}

function injectMotionStyles() {
  const styleId = 'smart-video-viral-motion';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes smart-fade-in-up {
      0% { opacity: 0; transform: translateY(24px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes viral-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes smart-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 120% 0; }
    }
    @keyframes viral-pulse-glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
      50% { box-shadow: 0 0 0 8px rgba(99,102,241,0.15); }
    }
    @keyframes viral-count-up {
      0% { opacity: 0; transform: translateY(8px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes viral-modal-in {
      0% { opacity: 0; transform: scale(0.96) translateY(12px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes viral-backdrop-in {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    @keyframes viral-bottom-sheet-in {
      0% { transform: translateY(100%); }
      100% { transform: translateY(0); }
    }
    .smart-card { opacity: 0; transform: translateY(24px); will-change: transform, opacity; }
    .smart-card.smart-animate { opacity: 1; transform: translateY(0); animation: smart-fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .viral-refresh-spinning .viral-refresh-icon { animation: viral-spin 1s linear infinite; }
    .viral-hero-wrap { transition: max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), padding 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease; overflow: hidden; }
    .viral-hero-wrap.collapsed { max-height: 72px !important; padding-top: 8px !important; padding-bottom: 8px !important; opacity: 0.9; }
    .viral-hero-wrap.collapsed .viral-hero-body { opacity: 0; pointer-events: none; height: 0; overflow: hidden; }
    .viral-hero-body { transition: opacity 0.25s ease, height 0.3s ease; }
    .viral-controls-sticky { position: sticky; top: 0; z-index: 40; transition: box-shadow 0.2s ease, background 0.2s ease; }
    .viral-controls-sticky.scrolled { box-shadow: 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.35); background: rgba(10,10,12,0.85); backdrop-filter: blur(16px) saturate(120%); -webkit-backdrop-filter: blur(16px) saturate(120%); }
    .viral-rail { display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; padding: 8px 4px 16px; cursor: grab; }
    .viral-rail:active { cursor: grabbing; }
    .viral-rail::-webkit-scrollbar { height: 6px; }
    .viral-rail::-webkit-scrollbar-track { background: transparent; }
    .viral-rail::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 999px; }
    .viral-rail-item { scroll-snap-align: start; flex: 0 0 auto; }
    .viral-modal-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 24px; animation: viral-backdrop-in 0.2s ease forwards; }
    .viral-modal-panel { background: #141416; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; width: 100%; max-width: 960px; max-height: 90vh; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,0.6); animation: viral-modal-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .viral-scrollspy { position: fixed; right: 16px; top: 50%; transform: translateY(-50%); z-index: 50; display: flex; flex-direction: column; gap: 10px; }
    .viral-scrollspy-dot { width: 8px; height: 8px; border-radius: 999px; background: rgba(255,255,255,0.25); border: none; padding: 0; cursor: pointer; transition: all 0.2s ease; }
    .viral-scrollspy-dot.active { background: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.2); height: 24px; }
    .viral-bottom-sheet-backdrop { position: fixed; inset: 0; z-index: 90; background: rgba(0,0,0,0.5); opacity: 0; pointer-events: none; transition: opacity 0.25s ease; }
    .viral-bottom-sheet-backdrop.open { opacity: 1; pointer-events: auto; }
    .viral-bottom-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 91; background: #141416; border-top: 1px solid rgba(255,255,255,0.08); border-radius: 20px 20px 0 0; padding: 16px 16px 24px; transform: translateY(100%); transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1); max-height: 70vh; overflow-y: auto; }
    .viral-bottom-sheet.open { transform: translateY(0); }
    .viral-bottom-sheet-handle { width: 36px; height: 4px; border-radius: 999px; background: rgba(255,255,255,0.2); margin: 0 auto 12px; }
    .viral-rail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding: 0 4px; }
    .viral-stat-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #a1a1aa; animation: viral-count-up 0.5s ease forwards; }
    .viral-kbd { display: inline-flex; align-items: center; justify-content: center; padding: 2px 6px; border-radius: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); font-size: 10px; color: #a1a1aa; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; line-height: 1; }
    .smart-card-hover-actions { opacity: 0; transform: translateY(4px); transition: all 0.2s ease; }
    .smart-card:hover .smart-card-hover-actions { opacity: 1; transform: translateY(0); }
    .smart-card-media video { background: black; }
    .smart-card-media.is-playing .smart-play-toggle { opacity: 0; pointer-events: none; }
    @media (max-width: 1023px) { .viral-scrollspy { display: none; } }
  `;
  document.head.appendChild(style);
}

const CATEGORIES = [
  'animation', 'architecture', 'camera-moves', 'character', 'cinematic',
  'food-drink', 'illustration-3d', 'nature', 'photography', 'poster-design',
  'product-ads', 'product-brand', 'travel', 'ugc', 'ui-graphic',
];
const CATEGORY_LABELS = {
  'camera-moves': 'Camera Moves', 'food-drink': 'Food & Drink',
  'illustration-3d': 'Illustration 3D', 'poster-design': 'Poster Design',
  'product-ads': 'Product Ads', 'product-brand': 'Product Brand', 'ui-graphic': 'UI Graphic',
};
const PROVIDER_COLORS = {
  gptimage: 'bg-blue-400/20 text-blue-300', nanobanana: 'bg-amber-400/20 text-amber-300',
  seedance: 'bg-violet-400/20 text-violet-300', kling: 'bg-red-400/20 text-red-300',
  minimax: 'bg-green-400/20 text-green-300', ideogram: 'bg-pink-400/20 text-pink-300',
  flux: 'bg-cyan-400/20 text-cyan-300',
};

function modelBadge(model) {
  if (!model) return '<span class="text-[10px] text-zinc-500">Unknown model</span>';
  const color = PROVIDER_COLORS[model] || 'bg-white/5 text-zinc-400';
  const short = model.length > 12 ? model.slice(0, 12) + '…' : model;
  return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${color}">${escapeHtml(short)}</span>`;
}
function formatDate(ts) {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 90) return `${Math.floor(days / 30)}mo ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}
function getPreviewMedia(item) {
  if (!item.media || item.media.length === 0) return null;
  const imageMedia = item.media.filter(m => m.type === 'image');
  if (imageMedia.length > 0) {
    return imageMedia.find(m => m.role === 'result') || imageMedia[0];
  }
  return item.media.find(m => m.role === 'result') || item.media[0];
}
function getVideoSource(item) {
  if (!item.media || item.media.length === 0) return '';
  const videoMedia = item.media.find(m => {
    const url = m.sourceUrl || '';
    return m.type === 'video' && (url.includes('video.twimg.com') || url.includes('releases/download/videos/') || url);
  });
  if (videoMedia) return videoMedia.sourceUrl;
  const anyMedia = item.media.find(m => m.sourceUrl);
  return anyMedia ? anyMedia.sourceUrl : '';
}
function getPosterForItem(item) {
  if (!item.media || item.media.length === 0) return '';
  const imageMedia = item.media.find(m => m.type === 'image' && m.posterUrl);
  if (imageMedia) return imageMedia.posterUrl;
  const videoMedia = item.media.find(m => m.type === 'video' && m.posterUrl);
  if (videoMedia) return videoMedia.posterUrl;
  const anyPoster = item.media.find(m => m.posterUrl);
  return anyPoster ? anyPoster.posterUrl : '';
}
function getStudioRoute(item) {
  if (item.mediaType === 'video') return 'video';
  if (item.mediaType === 'image') return 'image';
  const cats = item.categories || [];
  if (cats.includes('cinematic')) return 'cinema';
  if (cats.includes('character')) return 'character';
  if (cats.includes('ugc')) return 'video';
  if (cats.includes('product-ads') || cats.includes('product-brand')) return 'commercial';
  if (cats.includes('animation')) return 'video';
  return item.mediaType === 'image' ? 'image' : 'video';
}
function mapModelToStudioModel(recommendedModel) {
  const m = (recommendedModel || '').toLowerCase();
  if (m.includes('seedance')) return 'seedance-v2.0-t2v';
  if (m.includes('nanobanana') || m.includes('nano-banana')) return 'nano-banana-2';
  if (m.includes('gptimage') || m.includes('gpt-image')) return 'nano-banana-2';
  if (m.includes('kling')) return 'kling';
  if (m.includes('minimax')) return 'minimax';
  return recommendedModel || '';
}
function openItemInStudio(item) {
  const route = getStudioRoute(item);
  const params = {
    prompt: item.prompt || '',
    model: mapModelToStudioModel(item.recommendedModel),
    _sourceSlug: item.imglumeId,
    _sourceTitle: item.title,
  };
  const rec = item.recommended || {};
  if (rec.aspectRatio) params.aspect_ratio = rec.aspectRatio;
  if (rec.durationSeconds) params.duration = rec.durationSeconds;
  if (rec.generateAudio) params.generate_audio = rec.generateAudio;
  navigate(route, params);
}
function truncate(text, maxLen) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}
function fallbackPlaceholder() {
  return `<div class="w-full h-full flex items-center justify-center text-zinc-600"><svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8.5 8.5 15 12l-6.5 3.5z"/></svg></div>`;
}
function normalizeSeedanceItem(item) {
  const source = item.source || {};
  const author = source.author || {};
  const engagement = source.engagement || {};
  return {
    imglumeId: item.id || `seedance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: item.title || 'Untitled',
    prompt: item.prompt || '',
    mediaType: item.mediaType || 'video',
    media: (item.media || []).map(m => ({
      type: m.type || 'image',
      role: m.role || 'preview',
      previewUrl: m.previewUrl || '',
      sourceUrl: m.sourceUrl || '',
      posterUrl: m.posterUrl || '',
      width: m.width || null,
      height: m.height || null,
    })),
    source: {
      author: { handle: author.handle || '', name: author.name || '', link: author.link || '' },
      engagement: {
        likes: engagement.likes ?? 0,
        reposts: engagement.reposts ?? 0,
        replies: engagement.replies ?? 0,
      },
      publishedAt: source.publishedAt || '',
    },
    categories: item.categories || [],
    recommendedModel: item.recommendedModel || 'seedance-2.0',
    provenance: item.provenance || {},
    _source: 'seedance',
  };
}
function normalizeVpfItem(item) {
  const source = item.source || {};
  const author = source.author || {};
  const engagement = source.engagement || {};
  const curation = item.curation || {};
  const provenance = item.provenance || {};
  const recommended = item.recommended || {};
  return {
    imglumeId: item.imglumeId || item.id || `vpf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: item.title || 'Untitled',
    prompt: item.prompt || '',
    mediaType: item.mediaType || 'image',
    media: (item.media || []).map(m => ({
      type: m.type || 'image',
      role: m.role || 'preview',
      previewUrl: m.previewUrl || '',
      sourceUrl: m.sourceUrl || '',
      posterUrl: m.posterUrl || '',
      width: m.width || null,
      height: m.height || null,
    })),
    source: {
      author: { handle: author.handle || '', name: author.name || '', link: author.link || '' },
      engagement: {
        likes: engagement.likes ?? 0,
        reposts: engagement.reposts ?? 0,
        replies: engagement.replies ?? 0,
      },
      publishedAt: source.publishedAt || '',
    },
    categories: item.categories || [],
    tags: item.tags || [],
    language: item.language || null,
    recommendedModel: item.recommendedModel || 'seedance',
    sourceModels: item.sourceModels || [],
    recommended: {
      quality: recommended.quality || null,
      aspectRatio: recommended.aspectRatio || null,
      durationSeconds: recommended.durationSeconds ?? null,
      generateAudio: recommended.generateAudio ?? null,
    },
    curation: {
      creator: curation.creator || 'ImgLume',
      url: curation.url || '',
      recordUrl: curation.recordUrl || '',
      license: curation.license || 'CC-BY-4.0',
    },
    provenance: {
      discoveredBy: provenance.discoveredBy || 'ByRadar',
      collection: provenance.collection || 'byradar_discovered',
      importedAt: provenance.importedAt || new Date().toISOString(),
      updatedAt: provenance.updatedAt || new Date().toISOString(),
    },
    _source: 'vpf',
  };
}

export function SmartVideoViral() {
  injectMotionStyles();
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative custom-scrollbar overflow-x-hidden';
  mountStudioChrome(container, { currentRoute: 'viral' });

  let mounted = true;
  function unmount() {
    mounted = false;
    if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
    if (heroCarouselTimer) { clearInterval(heroCarouselTimer); heroCarouselTimer = null; }
    if (scrollHandler) { window.removeEventListener('scroll', scrollHandler, { passive: true }); scrollHandler = null; }
    if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
    if (lazyObserver) { lazyObserver.disconnect(); lazyObserver = null; }
    if (infiniteObserver) { infiniteObserver.disconnect(); infiniteObserver = null; }
    if (modalEl) closeVideoModal(false);
    railSections.forEach(s => s.section.remove());
    railSections = [];
  }

  function withTimeout(fn, ms = 2000) {
    let timedOut = false;
    const id = setTimeout(() => { timedOut = true; }, ms);
    return async (...args) => {
      if (timedOut) return;
      clearTimeout(id);
      await fn(...args);
    };
  }

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  let prompts = [];
  let filtered = [];
  let isLoading = true;
  let error = null;
  let mediaTypeFilter = 'all';
  let categoryFilter = 'all';
  let modelFilter = 'all';
  let searchQuery = '';
  let sortKey = 'fresh';
  let excludeChinese = true;
  const PAGE_SIZE = 30;
  let currentPage = 0;
  let hasMore = true;
  let isLoadingMore = false;
  let heroCollapsed = false;
  let lastScrollY = 0;
  const HERO_COLLAPSE_OFFSET = 120;
  let activeVideoItem = null;
  let modalEl = null;
  let modalPanel = null;
  let scrollSpyEl = null;
  let railSections = [];
  const VPF_DATA_URL = VPF_JSON_URL;
  const SEEDANCE_DATA_URL = '/data/seedance-prompts.json';
  let lastUpdated = null;
  let autoRefreshTimer = null;
  let heroCarouselTimer = null;
  let scrollHandler = null;
  let keyHandler = null;
  let lazyObserver = null;
  let infiniteObserver = null;
  let modalTrigger = null;
  const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

  // =====================
  // 1. HERO SECTION (collapsible)
  // =====================
  const heroWrap = document.createElement('div');
  heroWrap.className = 'viral-hero-wrap w-full max-w-6xl mx-auto mb-2';
  heroWrap.id = 'viral-hero';
  const heroBanner = createHeroSection('viral', 'h-36 md:h-44 mb-4');
  const heroContent = document.createElement('div');
  heroContent.className = 'relative w-full max-w-6xl mx-auto px-4 md:px-0';
  heroContent.innerHTML = `
    <div class="viral-hero-body flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 py-6">
      <div class="flex-1 min-w-0">
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-2">Smart Video Viral</h1>
        <p class="text-zinc-400 text-sm md:text-base font-medium max-w-xl leading-relaxed">Continuously refreshed feed of trending AI prompts from X — copy any prompt into your studio and create.</p>
        <div class="flex flex-wrap items-center gap-3 mt-4">
          <div class="viral-stat-pill"><span class="text-primary font-bold text-sm" id="viral-stat-total">0</span><span>prompts</span></div>
          <div class="viral-stat-pill"><span class="text-purple-400 font-bold text-sm" id="viral-stat-videos">0</span><span>videos</span></div>
          <div class="viral-stat-pill"><span class="text-emerald-400 font-bold text-sm" id="viral-stat-images">0</span><span>images</span></div>
          <div class="viral-stat-pill"><span class="text-amber-400 font-bold text-sm" id="viral-stat-providers">0</span><span>providers</span></div>
        </div>
      </div>
      <div class="hidden lg:flex items-center gap-3 flex-shrink-0">
        <div class="w-64 h-36 rounded-2xl overflow-hidden border border-white/10 bg-black/40 relative">
          <img id="viral-hero-carousel" class="w-full h-full object-cover transition-opacity duration-500" alt="Trending preview" />
          <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
            <p class="text-[10px] text-zinc-300 font-bold truncate" id="viral-hero-carousel-title">Loading…</p>
          </div>
        </div>
      </div>
    </div>
  `;
  if (heroBanner) heroWrap.appendChild(heroBanner);
  heroWrap.appendChild(heroContent);
  container.appendChild(heroWrap);

  // =====================
  // 2. STICKY CONTROLS BAR
  // =====================
  const controlsBar = document.createElement('div');
  controlsBar.id = 'viral-controls';
  controlsBar.className = 'viral-controls-sticky w-full max-w-6xl mx-auto mb-4 px-4 md:px-0';
  controlsBar.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-3 items-stretch py-3">
      <div class="relative flex-1">
        <input id="viral-search" type="text" placeholder="Search prompts, tags, or authors… (press /)"
          class="w-full bg-[#111]/90 border border-zinc-700/80 rounded-xl px-4 py-2.5 pl-10 text-sm text-zinc-200 placeholder-zinc-400 focus:border-primary focus:outline-none transition-all" />
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="7"/><line x1="15" y1="15" x2="19" y2="19"/></svg>
      </div>
      <div class="flex gap-1 bg-white/5 border border-zinc-700/80 rounded-xl p-1" id="viral-media-filter">
        <button data-mt="all" class="media-btn px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-zinc-200 hover:text-white">All</button>
        <button data-mt="image" class="media-btn px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-zinc-200 hover:text-white">Images</button>
        <button data-mt="video" class="media-btn px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-zinc-200 hover:text-white">Videos</button>
      </div>
      <select id="viral-category" class="bg-[#111]/90 border border-zinc-700/80 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:border-primary focus:outline-none appearance-none min-w-[140px]">
        <option value="all">All Categories</option>
      </select>
      <select id="viral-model" class="bg-[#111]/90 border border-zinc-700/80 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:border-primary focus:outline-none appearance-none min-w-[120px]">
        <option value="all">All Models</option>
      </select>
      <select id="viral-sort" class="bg-[#111]/90 border border-zinc-700/80 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:border-primary focus:outline-none min-w-[120px]">
        <option value="fresh">Newest First</option>
        <option value="engagement">Most Popular</option>
        <option value="likes">Most Likes</option>
      </select>
      <button id="viral-lang-toggle" type="button" class="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors whitespace-nowrap">
        <svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M12 4a8 8 0 0 0-8 8c0 2.8 1.4 5.2 3.6 6.6"/><path d="M12 12c2 1 3 3 3 5"/><path d="M12 12V7m0 10v1"/></svg>Exclude Chinese
      </button>
      <button id="viral-mobile-filters" type="button" class="lg:hidden px-3 py-1.5 bg-zinc-800 border border-zinc-700/80 text-zinc-300 rounded-xl text-xs font-bold">
        <svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>Filters
      </button>
    </div>
  `;
  container.appendChild(controlsBar);

  const searchInput = controlsBar.querySelector('#viral-search');
  const mediaFilter = controlsBar.querySelector('#viral-media-filter');
  const categorySelect = controlsBar.querySelector('#viral-category');
  const modelSelect = controlsBar.querySelector('#viral-model');
  const sortSelect = controlsBar.querySelector('#viral-sort');
  const langToggle = controlsBar.querySelector('#viral-lang-toggle');
  let catOptions = '';
  CATEGORIES.forEach(c => {
    catOptions += `<option value="${c}">${escapeHtml(CATEGORY_LABELS[c] || c.charAt(0).toUpperCase() + c.slice(1))}</option>`;
  });
  categorySelect.innerHTML = '<option value="all">All Categories</option>' + catOptions;

  function updateModelOptions() {
    const models = [...new Set(prompts.map(p => p.recommendedModel).filter(Boolean))].sort();
    const current = modelSelect.value;
    modelSelect.innerHTML = '<option value="all">All Models</option>' + models.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    if (models.includes(current)) modelSelect.value = current;
    else modelSelect.value = 'all';
  }

  const debouncedApply = debounce(() => applyFilters(), 280);
  searchInput.addEventListener('input', (e) => { searchQuery = e.target.value; debouncedApply(); });
  mediaFilter.querySelectorAll('.media-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      mediaTypeFilter = btn.getAttribute('data-mt');
      mediaFilter.querySelectorAll('.media-btn').forEach(b => {
        b.classList.remove('bg-primary', 'text-black'); b.classList.add('text-zinc-200', 'hover:text-white');
      });
      btn.classList.add('bg-primary', 'text-black'); btn.classList.remove('text-zinc-200', 'hover:text-white');
      applyFilters();
    });
  });
  mediaFilter.querySelector('[data-mt="all"]').classList.add('bg-primary', 'text-black');
  mediaFilter.querySelector('[data-mt="all"]').classList.remove('text-zinc-200');
  categorySelect.addEventListener('change', () => { categoryFilter = categorySelect.value; applyFilters(); });
  modelSelect.addEventListener('change', () => { modelFilter = modelSelect.value; applyFilters(); });
  sortSelect.addEventListener('change', () => { sortKey = sortSelect.value; applyFilters(); });

  langToggle.addEventListener('click', () => {
    excludeChinese = !excludeChinese;
    if (excludeChinese) {
      langToggle.classList.add('bg-primary/10', 'border-primary/20', 'text-primary');
      langToggle.classList.remove('bg-zinc-800', 'border-zinc-700/80', 'text-zinc-300');
      langToggle.innerHTML = `<svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M12 4a8 8 0 0 0-8 8c0 2.8 1.4 5.2 3.6 6.6"/><path d="M12 12c2 1 3 3 3 5"/><path d="M12 12V7m0 10v1"/></svg>Exclude Chinese`;
    } else {
      langToggle.classList.remove('bg-primary/10', 'border-primary/20', 'text-primary');
      langToggle.classList.add('bg-zinc-800', 'border-zinc-700/80', 'text-zinc-300');
      langToggle.innerHTML = `<svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1.5 12c0-1.5.5-2.9 1.4-4L4 10l-2.5 2z"/><path d="M22.5 12c0 1.5-.5 2.9-1.4 4L19 14l2.5-2z"/></svg>Include Chinese`;
    }
    applyFilters();
  });

  // =====================
  // 2b. HORIZONTAL RAILS
  // =====================
  function buildRailSection(title, items, renderItemFn) {
    const section = document.createElement('section');
    section.className = 'viral-rail-section w-full max-w-6xl mx-auto mb-10';
    section.innerHTML = `
      <div class="viral-rail-header">
        <h2 class="text-sm font-bold text-zinc-300 uppercase tracking-wider">${escapeHtml(title)}</h2>
        <div class="flex gap-2">
          <button class="rail-scroll-left w-7 h-7 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center" aria-label="Scroll left">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button class="rail-scroll-right w-7 h-7 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center" aria-label="Scroll right">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
      <div class="viral-rail" role="list"></div>
    `;
    const rail = section.querySelector('.viral-rail');
    items.forEach(item => { rail.insertAdjacentHTML('beforeend', renderItemFn(item)); });
    const leftBtn = section.querySelector('.rail-scroll-left');
    const rightBtn = section.querySelector('.rail-scroll-right');
    leftBtn.addEventListener('click', () => { rail.scrollBy({ left: -320, behavior: 'smooth' }); });
    rightBtn.addEventListener('click', () => { rail.scrollBy({ left: 320, behavior: 'smooth' }); });
    rail.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        e.preventDefault();
        rail.scrollBy({ left: e.deltaY + e.deltaX, behavior: 'auto' });
      }
    }, { passive: false });
    container.appendChild(section);
    railSections.push({ section, rail, title });
    return section;
  }

  function getTrendingItems() {
    return [...prompts].sort((a, b) => {
      const ea = (a.source?.engagement?.likes ?? 0) + (a.source?.engagement?.reposts ?? 0);
      const eb = (b.source?.engagement?.likes ?? 0) + (b.source?.engagement?.reposts ?? 0);
      return eb - ea;
    }).slice(0, 20);
  }
  function renderTrendingCard(item) {
    const media = getPreviewMedia(item);
    const thumb = media?.previewUrl || '';
    const isVideo = item.mediaType === 'video';
    return `
      <div class="viral-rail-item w-64 flex-shrink-0" role="listitem">
         <div class="smart-card group bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden transition-all cursor-pointer" data-rail-item-id="${item.imglumeId}">
          <div class="relative aspect-[3/2] overflow-hidden bg-black/30">
            ${thumb ? `<img src="${escapeHtml(thumb)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" loading="lazy"/>` : fallbackPlaceholder()}
            ${isVideo ? `<span class="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-400/20 text-purple-300">Video</span>` : ''}
            <div class="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
              <p class="text-[10px] text-zinc-200 font-bold truncate">${escapeHtml(item.title || 'Untitled')}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  function renderCategoryPill(cat) {
    const count = prompts.filter(p => (p.categories || []).includes(cat)).length;
    return `
      <button class="viral-rail-item px-4 py-2 rounded-full bg-white/5 border border-white/10 text-zinc-300 hover:border-primary/40 hover:text-white transition-all text-xs font-bold whitespace-nowrap" data-category-filter="${escapeHtml(cat)}">
        ${escapeHtml(CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1))} <span class="text-zinc-500">${count}</span>
      </button>
    `;
  }
  function renderProviderCard(model) {
    const count = prompts.filter(p => p.recommendedModel === model).length;
    const color = PROVIDER_COLORS[model] || 'bg-white/5 text-zinc-400';
    return `
      <div class="viral-rail-item w-28 flex-shrink-0 text-center">
        <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-3 hover:border-primary/30 transition-all">
          <span class="inline-flex items-center justify-center w-10 h-10 rounded-full ${color} text-xs font-black mx-auto mb-2">${escapeHtml(model.slice(0, 2).toUpperCase())}</span>
          <p class="text-[10px] text-zinc-400 font-bold truncate">${escapeHtml(model)}</p>
          <p class="text-[10px] text-zinc-500">${count} prompts</p>
        </div>
      </div>
    `;
  }

  container.addEventListener('click', (e) => {
    const railItem = e.target.closest('[data-rail-item-id]');
    if (railItem) {
      const id = parseInt(railItem.getAttribute('data-rail-item-id'), 10);
      const item = prompts.find(p => p.imglumeId === id);
      if (item && item.mediaType === 'video') openVideoModal(item);
      const mainCard = document.querySelector(`.smart-card[data-imglume-id="${id}"]`);
      if (mainCard) {
        mainCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        mainCard.classList.add('is-selected');
        setTimeout(() => mainCard.classList.remove('is-selected'), 2000);
      }
    }
    const catBtn = e.target.closest('[data-category-filter]');
    if (catBtn) {
      categoryFilter = catBtn.getAttribute('data-category-filter');
      categorySelect.value = categoryFilter;
      applyFilters();
      const feedSection = document.getElementById('viral-feed-section');
      if (feedSection) feedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // =====================
  // 3. INFO BAR
  // =====================
  const infoBar = document.createElement('div');
  infoBar.className = 'w-full max-w-6xl mx-auto mb-2 flex items-center justify-between text-xs text-zinc-400 px-4 md:px-0';
  infoBar.innerHTML = `
    <span id="viral-count" aria-live="polite">0 prompts loaded</span>
    <div class="flex items-center gap-3 text-xs text-zinc-500">
      <span id="viral-last-updated">—</span>
      <button id="viral-refresh" class="px-2 py-1 bg-zinc-800 border border-zinc-700/80 text-zinc-300 rounded hover:bg-zinc-700 hover:text-white transition-colors" title="Refresh feed from upstream">
        <svg class="viral-refresh-icon w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 9 9 9 9 0 0 1-9 9 9 9 0 0 1-9-9"/><path d="M3 12h9m-9 0V5l5 3.5"/></svg>Refresh
      </button>
      <button id="viral-export" class="px-2 py-1 bg-zinc-800 border border-zinc-700/80 text-zinc-300 rounded hover:bg-zinc-700 hover:text-white transition-colors" title="Export filtered prompts as JSON">
        <svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export
      </button>
    </div>
  `;
  container.appendChild(infoBar);

  // =====================
  // 3b. SCROLL-SPY SIDE NAV (desktop)
  // =====================
  scrollSpyEl = document.createElement('nav');
  scrollSpyEl.className = 'viral-scrollspy';
  scrollSpyEl.setAttribute('aria-label', 'Page sections');
  scrollSpyEl.innerHTML = `
    <button class="viral-scrollspy-dot active" data-target="viral-hero" title="Hero"></button>
    <button class="viral-scrollspy-dot" data-target="viral-feed-section" title="Feed"></button>
  `;
  container.appendChild(scrollSpyEl);

  // =====================
  // 4. MAIN FEED (infinite scroll)
  // =====================
  const feedSection = document.createElement('section');
  feedSection.id = 'viral-feed-section';
  feedSection.className = 'w-full max-w-6xl mx-auto mb-8';
  feedSection.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="viral-grid"></div>
    <div id="viral-sentinel" class="h-8 w-full"></div>
  `;
  const gridEl = feedSection.querySelector('#viral-grid');
  const sentinelEl = feedSection.querySelector('#viral-sentinel');
  container.appendChild(feedSection);

  function updateInfoBar() {
    const countEl = infoBar.querySelector('#viral-count');
    if (countEl) {
      const total = prompts.length;
      const filtered_count = filtered.length;
      const excludedChinese = excludeChinese ? (total - filtered_count) : 0;
      let label = `${filtered_count} ${filtered_count === 1 ? 'prompt' : 'prompts'} loaded`;
      if (excludeChinese && excludedChinese > 0) {
        label += ` (of ${total}, ${excludedChinese} Chinese excluded)`;
      } else if (excludeChinese && total > 0) {
        label += ` of ${total}`;
      }
      countEl.textContent = label;
    }
  }

  function renderError() {
    gridEl.innerHTML = `
      <div class="text-center py-16 text-zinc-400">
        <svg class="w-16 h-16 mx-auto mb-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.25 22h3.5M12 17V7m-5 5l5 5 5-5"/></svg>
        <p class="text-sm mb-2">Failed to load the prompt feed</p>
        <p class="text-xs text-zinc-500">${escapeHtml(error || '')}</p>
        <button id="viral-retry" class="mt-3 px-4 py-2 btn-secondary-modern rounded-xl text-xs font-black hover:shadow-glow transition">Retry</button>
      </div>
    `;
    const retryBtn = gridEl.querySelector('#viral-retry');
    if (retryBtn) retryBtn.onclick = loadData;
  }

  function buildCardHtml(item) {
    const media = getPreviewMedia(item);
    const thumb = media?.previewUrl || '';
    const sourceUrl = media?.sourceUrl || '';
    const poster = media?.posterUrl || '';
    const isVideo = item.mediaType === 'video';
    const author = item.source?.author || {};
    const engagement = item.source?.engagement || {};
    const totalEng = (engagement.likes ?? 0) + (engagement.reposts ?? 0) + (engagement.replies ?? 0);
    const dateStr = formatDate(item.provenance?.updatedAt || item.source?.publishedAt);
    const modelBadgeHtml = modelBadge(item.recommendedModel);
    const catTags = (item.categories || []).slice(0, 3);
    const fullPrompt = item.prompt || '';
    const promptPreview = truncate(fullPrompt, 180);
    const hasLongPrompt = fullPrompt.length > 180;
    const escapedPrompt = escapeHtml(fullPrompt);
    const escapedPreview = escapeHtml(promptPreview);
    const recommended = item.recommended || {};
    const recChips = [
      recommended.aspectRatio ? `aspect:${escapeHtml(recommended.aspectRatio)}` : '',
      recommended.durationSeconds ? `${escapeHtml(String(recommended.durationSeconds))}s` : '',
      recommended.quality ? `quality:${escapeHtml(recommended.quality)}` : '',
    ].filter(Boolean);
    const authorLabel = author.name ? escapeHtml(author.name) : (author.handle ? `@${escapeHtml(author.handle)}` : 'unknown');
    const authorSub = author.name && author.handle ? `@${escapeHtml(author.handle)}` : '';
    let mediaHtml;
    const videoSrc = isVideo ? proxyVideoUrl(getVideoSource(item) || media?.previewUrl || '') : '';
    const posterSrc = isVideo ? (poster || thumb || '') : '';
    if (isVideo) {
      const safeSrc = escapeHtml(videoSrc);
      const safePoster = escapeHtml(posterSrc);
      mediaHtml = `
        <div class="smart-card-media relative aspect-[3/2] overflow-hidden bg-black/30">
          <video class="smart-card-video w-full h-full object-cover" src="${safeSrc}" poster="${safePoster}" preload="metadata" muted loop playsinline disablepictureinpicture></video>
          <button type="button" class="smart-play-toggle absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity" data-video-src="${safeSrc}" data-poster="${safePoster}" title="Play video" aria-label="Play video">
            <span class="smart-play-icon w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
              <svg class="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="10 7 10 17 17 12 10 7"/></svg>
            </span>
          </button>
        </div>
      `;
    } else if (thumb) {
      mediaHtml = `<img data-primary="${escapeHtml(thumb)}" data-fallback="${escapeHtml(sourceUrl)}" class="smart-card-preview w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="${escapeHtml(item.title)}" loading="lazy"/>`;
    } else {
      mediaHtml = fallbackPlaceholder();
    }
    return `
       <div class="smart-card group" data-imglume-id="${item.imglumeId}">
         <div class="smart-card-media relative aspect-[3/2] overflow-hidden bg-black/30">
           ${mediaHtml}
           <div class="absolute top-2 left-2 flex gap-1">
             ${modelBadgeHtml}
             <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${isVideo ? 'bg-purple-400/20 text-purple-300' : 'bg-emerald-400/20 text-emerald-300'}">
               <svg class="w-3 h-3 mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${isVideo ? '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>' : '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'}</svg>
               ${isVideo ? 'Video' : 'Image'}
             </span>
           </div>
         </div>
         <div class="smart-card-content flex-1 flex flex-col">
           <h3 class="text-sm font-bold text-zinc-100 mb-1 line-clamp-1">${escapeHtml(item.title || 'Untitled')}</h3>
           <div class="prompt-section">
             <p class="text-[11px] text-zinc-400 mb-1 line-clamp-2 leading-relaxed">${escapedPreview}</p>
             ${hasLongPrompt ? `<button class="view-full-btn text-[10px] text-cyan-400 hover:text-cyan-300 font-bold transition-colors mb-2" data-id="${item.imglumeId}">View Full Prompt ›</button>` : ''}
             ${hasLongPrompt ? `<div class="prompt-full hidden text-[10px] text-zinc-300 mb-2 leading-relaxed bg-zinc-900 border border-zinc-700/80 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-words">${escapedPrompt}</div>` : `<p class="text-[11px] text-zinc-400 mb-2 line-clamp-2 leading-relaxed">${escapedPrompt}</p>`}
           </div>
           ${recChips.length > 0 ? `
             <div class="flex flex-wrap gap-1 mb-2">
               ${recChips.map(chip => `<span class="text-[9px] px-1.5 py-0.5 bg-blue-400/10 border border-blue-400/20 rounded text-blue-300">${chip}</span>`).join('')}
             </div>
           ` : ''}
           <div class="flex items-center justify-between mb-2">
             <div class="flex items-center gap-1 text-[10px] text-zinc-500">
               <span class="text-primary">${authorLabel}</span>
               ${authorSub && authorSub !== authorLabel ? `<span class="text-zinc-600">(${authorSub})</span>` : ''}
               ${dateStr ? `<span>·</span><span>${escapeHtml(dateStr)}</span>` : ''}
             </div>
             ${totalEng > 0 ? `<span class="text-[10px] text-zinc-500">🔥 ${totalEng}</span>` : ''}
           </div>
           ${catTags.length > 0 ? `
             <div class="flex flex-wrap gap-1 mb-3">
               ${catTags.map(c => `<span class="text-[9px] px-1.5 py-0.5 bg-white/5 border border-zinc-700/80 rounded text-zinc-400">${escapeHtml(CATEGORY_LABELS[c] || c)}</span>`).join('')}
             </div>
           ` : ''}
            <div class="mt-auto flex gap-2">
              <button class="copy-prompt-btn btn-primary-modern" data-id="${item.imglumeId}" title="Copy prompt to clipboard">Copy Prompt</button>
              <button class="create-style-btn btn-secondary-modern text-[10px] font-bold" data-id="${item.imglumeId}" title="Create this style in studio">Create This Style</button>
              <a href="${escapeHtml(item.source?.url || item.curation?.recordUrl || '#')}" target="_blank" rel="noopener noreferrer" class="btn-secondary-modern text-[10px] font-bold" title="View source post on X">Source</a>
            </div>
         </div>
       </div>
     `;
  }

  function setupCardPostRender() {
    const previewImgs = gridEl.querySelectorAll('img.smart-card-preview');
    if (previewImgs.length && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const primary = img.getAttribute('data-primary');
            if (primary && !img.src) img.src = primary;
            observer.unobserve(img);
          }
        });
      });
      previewImgs.forEach(img => observer.observe(img));
    } else {
      previewImgs.forEach(img => {
        const primary = img.getAttribute('data-primary');
        if (primary && !img.src) img.src = primary;
      });
    }
    previewImgs.forEach(img => {
      const isVideoCard = !!img.getAttribute('data-video-src');
      img.addEventListener('error', function handler() {
        if (!img.dataset.triedFallback) {
          const fallback = img.getAttribute('data-fallback');
          if (fallback) { img.dataset.triedFallback = 'true'; img.src = fallback; return; }
        }
        if (isVideoCard) { img.style.display = 'none'; }
        else { const parent = img.parentElement; if (parent) parent.innerHTML = fallbackPlaceholder(); }
      });
    });

    const cardVideos = gridEl.querySelectorAll('.smart-card-video');
    const videoVisibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        const wrapper = video.closest('.smart-card-media');
        if (entry.isIntersecting) {
          video.play().then(() => {
            if (wrapper) wrapper.classList.add('is-playing');
          }).catch(() => {});
        } else {
          video.pause();
          if (wrapper) wrapper.classList.remove('is-playing');
        }
      });
    }, { rootMargin: '200px' });
    cardVideos.forEach(video => {
      video.addEventListener('error', () => {
        const wrapper = video.closest('.smart-card-media');
        if (wrapper) {
          const poster = video.getAttribute('poster');
          wrapper.innerHTML = poster ? `<img src="${escapeHtml(poster)}" class="w-full h-full object-cover" alt=""/>` : fallbackPlaceholder();
        }
      });
      videoVisibilityObserver.observe(video);
    });

    gridEl.querySelectorAll('.smart-play-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const videoSrc = btn.getAttribute('data-video-src');
        if (!videoSrc) { showToast('No video source available', 'error', 2000); return; }
        const card = btn.closest('.smart-card');
        const itemId = card?.getAttribute('data-imglume-id');
        const item = prompts.find(p => p.imglumeId === parseInt(itemId, 10));
        if (item) openVideoModal(item);
      });
    });
    gridEl.querySelectorAll('.copy-prompt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const item = prompts.find(p => p.imglumeId === id);
        if (!item) return;
        navigator.clipboard.writeText(item.prompt || '').then(() => {
          showToast('Prompt copied to clipboard!', 'success', 2000);
        }).catch(() => {
          const textarea = document.createElement('textarea');
          textarea.value = item.prompt || '';
          textarea.style.position = 'fixed'; textarea.style.opacity = '0';
          document.body.appendChild(textarea); textarea.select();
          try { document.execCommand('copy'); } catch { /* ignore */ }
          document.body.removeChild(textarea);
          showToast('Prompt copied to clipboard!', 'success', 2000);
        });
      });
    });
    gridEl.querySelectorAll('.create-style-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const item = prompts.find(p => p.imglumeId === id);
        if (!item) return;
        openItemInStudio(item);
      });
    });
    gridEl.querySelectorAll('.view-full-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const item = prompts.find(p => p.imglumeId === id);
        if (!item) return;
        const card = btn.closest('.smart-card');
        const fullDiv = card?.querySelector('.prompt-full');
        const previewP = card?.querySelector('.prompt-section p');
        if (fullDiv && previewP) {
          const isHidden = fullDiv.classList.contains('hidden');
          if (isHidden) {
            fullDiv.classList.remove('hidden');
            previewP.classList.add('hidden');
            btn.textContent = 'Show Less ▾';
          } else {
            fullDiv.classList.add('hidden');
            previewP.classList.remove('hidden');
            btn.textContent = 'View Full Prompt ▸';
          }
        }
      });
    });
  }

  function loadMore() {
    if (isLoadingMore || !hasMore) return;
    isLoadingMore = true;
    currentPage++;
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = filtered.slice(start, end);
    if (pageItems.length === 0) { hasMore = false; isLoadingMore = false; return; }
    const html = pageItems.map(item => buildCardHtml(item)).join('');
    gridEl.insertAdjacentHTML('beforeend', html);
    requestAnimationFrame(() => {
      const newCards = gridEl.querySelectorAll('.smart-card');
      newCards.forEach((card, i) => {
        if (!card.classList.contains('smart-animate')) {
          card.style.transitionDelay = `${i * 15}ms`;
          requestAnimationFrame(() => card.classList.add('smart-animate'));
        }
      });
      setupCardPostRender();
    });
    hasMore = end < filtered.length;
    isLoadingMore = false;
  }

  function setupInfiniteScroll() {
    if (!sentinelEl) return;
    if (infiniteObserver) { try { infiniteObserver.disconnect(); } catch (_) {} infiniteObserver = null; }
    if ('IntersectionObserver' in window) {
      infiniteObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) loadMore();
      }, { rootMargin: '400px' });
      infiniteObserver.observe(sentinelEl);
    } else {
      const onScroll = () => {
        const rect = sentinelEl.getBoundingClientRect();
        if (rect.top < window.innerHeight + 400 && hasMore && !isLoadingMore) loadMore();
      };
      container.addEventListener('scroll', onScroll);
    }
  }

  // =====================
  // VIDEO MODAL
  // =====================
  function openVideoModal(item) {
    activeVideoItem = item;
    const media = getPreviewMedia(item);
    const videoSrc = proxyVideoUrl(getVideoSource(item) || media?.previewUrl || '');
    const poster = media?.posterUrl || media?.previewUrl || '';
    if (modalEl) closeVideoModal(false);
    modalTrigger = document.activeElement;
    modalEl = document.createElement('div');
    modalEl.className = 'viral-modal-backdrop';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-label', 'Video player');
    modalEl.innerHTML = `
      <div class="viral-modal-panel">
        <div class="flex items-center justify-between p-4 border-b border-white/5">
          <h3 class="text-sm font-bold text-zinc-200 truncate pr-4">${escapeHtml(item.title || 'Video')}</h3>
          <button id="viral-modal-close" class="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center flex-shrink-0" aria-label="Close">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="relative aspect-video bg-black">
          <video src="${escapeHtml(videoSrc)}" controls autoplay muted playsinline preload="auto" disablepictureinpicture class="w-full h-full" poster="${escapeHtml(poster)}">
            <p class="text-zinc-400 text-xs p-4">Video could not be loaded.</p>
          </video>
        </div>
        <div class="p-4 space-y-3">
          <p class="text-xs text-zinc-400 line-clamp-3">${escapeHtml(item.prompt || '')}</p>
          <div class="flex flex-wrap items-center gap-2">
            ${modelBadge(item.recommendedModel)}
            ${(item.categories || []).slice(0, 3).map(c => `<span class="text-[9px] px-1.5 py-0.5 bg-white/5 border border-zinc-700/80 rounded text-zinc-400">${escapeHtml(CATEGORY_LABELS[c] || c)}</span>`).join('')}
            ${item.recommended?.aspectRatio ? `<span class="text-[9px] px-1.5 py-0.5 bg-blue-400/10 border border-blue-400/20 rounded text-blue-300">${escapeHtml(item.recommended.aspectRatio)}</span>` : ''}
            ${item.recommended?.durationSeconds ? `<span class="text-[9px] px-1.5 py-0.5 bg-blue-400/10 border border-blue-400/20 rounded text-blue-300">${escapeHtml(String(item.recommended.durationSeconds))}s</span>` : ''}
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-white/5">
            <span class="text-[10px] text-zinc-500">${escapeHtml(item.source?.author?.name || '')}${item.source?.author?.name && item.source?.author?.handle ? ` (@${escapeHtml(item.source.author.handle)})` : `@${escapeHtml(item.source?.author?.handle || 'unknown')}`}</span>
            <div class="flex gap-2">
              <button class="viral-modal-copy btn-primary-modern" data-id="${item.imglumeId}">Copy Prompt</button>
              <button class="viral-modal-create btn-secondary-modern text-[10px] font-bold" data-id="${item.imglumeId}">Create This Style</button>
              <a href="${escapeHtml(item.source?.url || item.curation?.recordUrl || '#')}" target="_blank" rel="noopener noreferrer" class="btn-secondary-modern text-[10px] font-bold">View on X</a>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
    modalPanel = modalEl.querySelector('.viral-modal-panel');
    const videoEl = modalEl.querySelector('video');
    if (videoEl) {
      videoEl.addEventListener('error', () => {
        const wrapper = modalEl.querySelector('.relative');
        if (wrapper) {
          wrapper.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center p-4">
              <svg class="w-10 h-10 text-zinc-500 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p class="text-zinc-400 text-xs mb-2">Video could not be loaded</p>
              <a href="${escapeHtml(videoSrc)}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 btn-secondary-modern rounded-xl text-[10px] font-black hover:shadow-glow transition-colors">View on X</a>
            </div>
          `;
        }
      });
      videoEl.addEventListener('loadedmetadata', () => {
        videoEl.play().catch(err => console.warn('[SmartVideoViral] Autoplay blocked:', err));
      });
      videoEl.play().catch(err => console.warn('[SmartVideoViral] Autoplay blocked:', err));
    }
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeVideoModal(); });
    modalEl.querySelector('#viral-modal-close').addEventListener('click', () => closeVideoModal());
    modalEl.querySelector('.viral-modal-copy')?.addEventListener('click', () => {
      navigator.clipboard.writeText(item.prompt || '').then(() => showToast('Prompt copied!', 'success', 1500));
    });
    modalEl.querySelector('.viral-modal-create')?.addEventListener('click', () => {
      openItemInStudio(item);
    });
    modalEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeVideoModal(); return; }
      if (e.key === 'Tab') {
        const focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    requestAnimationFrame(() => { modalPanel.style.transform = 'scale(1) translateY(0)'; });
    modalEl.querySelector('button')?.focus();
  }

  function closeVideoModal(animate = true) {
    if (!modalEl) return;
    const restore = modalTrigger;
    if (animate) {
      modalPanel.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
      modalPanel.style.transform = 'scale(0.96) translateY(8px)';
      modalPanel.style.opacity = '0';
      modalEl.style.transition = 'opacity 0.2s ease';
      modalEl.style.opacity = '0';
    }
    const el = modalEl;
    setTimeout(() => { el.remove(); }, animate ? 220 : 0);
    modalEl = null;
    modalPanel = null;
    activeVideoItem = null;
    if (restore && typeof restore.focus === 'function') {
      requestAnimationFrame(() => restore.focus());
    }
  }

  // =====================
  // KEYBOARD SHORTCUTS
  // =====================
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;
      if (e.key === '/') { e.preventDefault(); searchInput.focus(); }
      else if (e.key === 'r' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); refreshBtn.click(); }
      else if (e.key === 'c' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); langToggle.click(); }
      else if (e.key === 'Escape') { if (modalEl) closeVideoModal(); }
      else if (e.key === '?') { showToast('Shortcuts: / search · r refresh · c toggle CN · Esc close modal', 'info', 4000); }
    });
  }
  setupKeyboardShortcuts();

  // =====================
  // HERO CAROUSEL
  // =====================
  function updateHeroCarousel() {
    const img = document.getElementById('viral-hero-carousel');
    const title = document.getElementById('viral-hero-carousel-title');
    if (!img || !title) return;
    const trending = getTrendingItems();
    const idx = Math.floor(Date.now() / 5000) % Math.max(trending.length, 1);
    const item = trending[idx];
    if (!item) return;
    const media = getPreviewMedia(item);
    const thumb = media?.previewUrl || '';
    if (thumb) {
      img.style.opacity = '0';
      setTimeout(() => { img.src = thumb; img.style.opacity = '1'; }, 250);
    }
    title.textContent = item.title || 'Untitled';
  }
  heroCarouselTimer = setInterval(updateHeroCarousel, 5000);
  updateHeroCarousel();

  // =====================
  // HERO COLLAPSE + STICKY CONTROLS SHADOW
  // =====================
  function setupScrollBehavior() {
    const heroEl = document.getElementById('viral-hero');
    if (!heroEl) return;
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset;
      if (y > HERO_COLLAPSE_OFFSET && !heroCollapsed) {
        heroCollapsed = true;
        heroEl.classList.add('collapsed');
      } else if (y <= HERO_COLLAPSE_OFFSET && heroCollapsed) {
        heroCollapsed = false;
        heroEl.classList.remove('collapsed');
      }
      if (y > 10) controlsBar.classList.add('scrolled');
      else controlsBar.classList.remove('scrolled');
      updateScrollSpy();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  setupScrollBehavior();

  // =====================
  // SCROLL-SPY
  // =====================
  function updateScrollSpy() {
    if (!scrollSpyEl) return;
    const sections = ['viral-hero', 'viral-feed-section'];
    const scrollY = window.scrollY || window.pageYOffset;
    let current = sections[0];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.offsetTop - 120 <= scrollY) current = id;
    });
    scrollSpyEl.querySelectorAll('.viral-scrollspy-dot').forEach(dot => {
      dot.classList.toggle('active', dot.getAttribute('data-target') === current);
    });
  }
  scrollSpyEl?.addEventListener('click', (e) => {
    const dot = e.target.closest('.viral-scrollspy-dot');
    if (!dot) return;
    const targetId = dot.getAttribute('data-target');
    const target = document.getElementById(targetId);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // =====================
  // MOBILE BOTTOM SHEET
  // =====================
  let bottomSheetOpen = false;
  const mobileFiltersBtn = controlsBar.querySelector('#viral-mobile-filters');
  if (mobileFiltersBtn) {
    const sheetBackdrop = document.createElement('div');
    sheetBackdrop.className = 'viral-bottom-sheet-backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'viral-bottom-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Filter prompts');
    sheet.innerHTML = `
      <div class="viral-bottom-sheet-handle"></div>
      <div class="space-y-4">
        <div>
          <label class="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1 block">Media Type</label>
          <div class="flex gap-1 bg-white/5 border border-zinc-700/80 rounded-xl p-1" id="sheet-media-filter">
            <button data-mt="all" class="sheet-media-btn flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all text-zinc-200">All</button>
            <button data-mt="image" class="sheet-media-btn flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all text-zinc-200">Images</button>
            <button data-mt="video" class="sheet-media-btn flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all text-zinc-200">Videos</button>
          </div>
        </div>
        <div>
          <label class="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1 block">Category</label>
          <select id="sheet-category" class="w-full bg-[#111]/90 border border-zinc-700/80 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:border-primary focus:outline-none">
            <option value="all">All Categories</option>
          </select>
        </div>
        <div>
          <label class="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1 block">Model</label>
          <select id="sheet-model" class="w-full bg-[#111]/90 border border-zinc-700/80 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:border-primary focus:outline-none">
            <option value="all">All Models</option>
          </select>
        </div>
        <div>
          <label class="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1 block">Sort</label>
          <select id="sheet-sort" class="w-full bg-[#111]/90 border border-zinc-700/80 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:border-primary focus:outline-none">
            <option value="fresh">Newest First</option>
            <option value="engagement">Most Popular</option>
            <option value="likes">Most Likes</option>
          </select>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-xs text-zinc-400">Exclude Chinese content</span>
          <button id="sheet-lang-toggle" type="button" class="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-[10px] font-bold text-primary">On</button>
        </div>
        <button id="sheet-apply" class="w-full py-3 btn-secondary-modern rounded-xl text-sm font-black">Apply Filters</button>
      </div>
    `;
    document.body.appendChild(sheetBackdrop);
    document.body.appendChild(sheet);
    const sheetCat = sheet.querySelector('#sheet-category');
    sheetCat.innerHTML = '<option value="all">All Categories</option>' + catOptions;
    const sheetMedia = sheet.querySelector('#sheet-media-filter');
    sheetMedia.querySelectorAll('.sheet-media-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sheetMedia.querySelectorAll('.sheet-media-btn').forEach(b => { b.classList.remove('bg-primary', 'text-black'); b.classList.add('text-zinc-200'); });
        btn.classList.add('bg-primary', 'text-black'); btn.classList.remove('text-zinc-200');
      });
    });
    sheetMedia.querySelector('[data-mt="all"]').classList.add('bg-primary', 'text-black');
    sheetMedia.querySelector('[data-mt="all"]').classList.remove('text-zinc-200');
    const sheetSort = sheet.querySelector('#sheet-sort');
    const sheetModel = sheet.querySelector('#sheet-model');
    const sheetLang = sheet.querySelector('#sheet-lang-toggle');

    function openSheet() {
      bottomSheetOpen = true;
      sheetBackdrop.classList.add('open');
      sheet.classList.add('open');
      sheetMedia.querySelectorAll('.sheet-media-btn').forEach(b => {
        const mt = b.getAttribute('data-mt');
        if (mt === mediaTypeFilter) {
          sheetMedia.querySelectorAll('.sheet-media-btn').forEach(x => { x.classList.remove('bg-primary', 'text-black'); x.classList.add('text-zinc-200'); });
          b.classList.add('bg-primary', 'text-black'); b.classList.remove('text-zinc-200');
        }
      });
      sheetCat.value = categoryFilter;
      sheetModel.value = modelFilter;
      sheetSort.value = sortKey;
      sheetLang.textContent = excludeChinese ? 'On' : 'Off';
      sheetLang.className = excludeChinese
        ? 'px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-[10px] font-bold text-primary'
        : 'px-3 py-1.5 bg-zinc-800 border border-zinc-700/80 rounded-xl text-[10px] font-bold text-zinc-300';
    }
    function closeSheet() {
      bottomSheetOpen = false;
      sheetBackdrop.classList.remove('open');
      sheet.classList.remove('open');
    }
    mobileFiltersBtn.addEventListener('click', openSheet);
    sheetBackdrop.addEventListener('click', closeSheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
    sheet.querySelector('#sheet-apply').addEventListener('click', () => {
      mediaTypeFilter = sheetMedia.querySelector('.sheet-media-btn.bg-primary')?.getAttribute('data-mt') || 'all';
      categoryFilter = sheetCat.value;
      modelFilter = sheetModel.value;
      sortKey = sheetSort.value;
      excludeChinese = sheetLang.textContent === 'On';
      mediaFilter.querySelectorAll('.media-btn').forEach(b => {
        const mt = b.getAttribute('data-mt');
        if (mt === mediaTypeFilter) {
          mediaFilter.querySelectorAll('.media-btn').forEach(x => { x.classList.remove('bg-primary', 'text-black'); x.classList.add('text-zinc-200', 'hover:text-white'); });
          b.classList.add('bg-primary', 'text-black'); b.classList.remove('text-zinc-200', 'hover:text-white');
        }
      });
      categorySelect.value = categoryFilter;
      modelSelect.value = modelFilter;
      sortSelect.value = sortKey;
      if (excludeChinese) {
        langToggle.classList.add('bg-primary/10', 'border-primary/20', 'text-primary');
        langToggle.classList.remove('bg-zinc-800', 'border-zinc-700/80', 'text-zinc-300');
        langToggle.innerHTML = `<svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M12 4a8 8 0 0 0-8 8c0 2.8 1.4 5.2 3.6 6.6"/><path d="M12 12c2 1 3 3 3 5"/><path d="M12 12V7m0 10v1"/></svg>Exclude Chinese`;
      } else {
        langToggle.classList.remove('bg-primary/10', 'border-primary/20', 'text-primary');
        langToggle.classList.add('bg-zinc-800', 'border-zinc-700/80', 'text-zinc-300');
        langToggle.innerHTML = `<svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1.5 12c0-1.5.5-2.9 1.4-4L4 10l-2.5 2z"/><path d="M22.5 12c0 1.5-.5 2.9-1.4 4L19 14l2.5-2z"/></svg>Include Chinese`;
      }
      applyFilters();
      closeSheet();
    });
  }

  // =====================
  // EXPORT
  // =====================
  const exportBtn = infoBar.querySelector('#viral-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const data = filtered.map(item => ({
        title: item.title, prompt: item.prompt, mediaType: item.mediaType,
        categories: item.categories, model: item.recommendedModel,
        author: item.source?.author?.handle, sourceUrl: item.source?.url,
      }));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `viral-prompts-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${data.length} prompts`, 'success', 2000);
    });
  }

  // =====================
  // STATS + RAILS ON DATA LOAD
  // =====================
  function updateStatsAndRails() {
    const total = prompts.length;
    const videos = prompts.filter(p => p.mediaType === 'video').length;
    const images = prompts.filter(p => p.mediaType === 'image').length;
    const providers = new Set(prompts.map(p => p.recommendedModel).filter(Boolean)).size;
    const totalEl = document.getElementById('viral-stat-total');
    const videosEl = document.getElementById('viral-stat-videos');
    const imagesEl = document.getElementById('viral-stat-images');
    const providersEl = document.getElementById('viral-stat-providers');
    if (totalEl) totalEl.textContent = total.toLocaleString();
    if (videosEl) videosEl.textContent = videos.toLocaleString();
    if (imagesEl) imagesEl.textContent = images.toLocaleString();
    if (providersEl) providersEl.textContent = providers.toLocaleString();
    updateModelOptions();
    railSections.forEach(s => s.section.remove());
    railSections = [];
    buildRailSection('Trending', getTrendingItems(), renderTrendingCard);
    buildRailSection('Categories', CATEGORIES, renderCategoryPill);
    buildRailSection('Providers', [...new Set(prompts.map(p => p.recommendedModel).filter(Boolean))], renderProviderCard);
  }

  let loadDataController = null;

  // =====================
  // 5. LOAD DATA
  // =====================
  async function loadData() {
    if (loadDataController) loadDataController.abort();
    loadDataController = new AbortController();
    const signal = loadDataController.signal;
    try {
      const bustedUrl = VPF_DATA_URL + '?t=' + Date.now();
      const seedanceUrl = SEEDANCE_DATA_URL + '?t=' + Date.now();
      const [vpfRes, seedanceRes] = await Promise.all([
        fetch(bustedUrl, { cache: 'no-store', signal }),
        fetch(seedanceUrl, { cache: 'no-store', signal }).catch(() => null),
      ]);
      if (!vpfRes.ok) throw new Error(`VPF HTTP ${vpfRes.status}`);
      const vpfJson = await vpfRes.json();
      let seedanceItems = [];
      if (seedanceRes && seedanceRes.ok) {
        const seedanceJson = await seedanceRes.json();
        seedanceItems = (seedanceJson.items || []).map(normalizeSeedanceItem);
      }
      if (!mounted) return;
      const vpfItems = (vpfJson.items || []).map(normalizeVpfItem);
      prompts = [...vpfItems, ...seedanceItems];
      isLoading = false;
      lastUpdated = new Date();
      updateStatsAndRails();
      applyFilters();
      updateLastUpdatedDisplay();
    } catch (err) {
      if (!mounted) return;
      if (err.name === 'AbortError') return;
      error = err.message;
      isLoading = false;
      renderError();
    } finally {
      if (loadDataController && loadDataController.signal.aborted) {
        loadDataController = null;
      }
    }
  }

  function updateLastUpdatedDisplay() {
    const el = infoBar.querySelector('#viral-last-updated');
    if (!el) return;
    if (lastUpdated) {
      el.textContent = `Updated ${formatDate(lastUpdated)} at ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  const refreshBtn = infoBar.querySelector('#viral-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.disabled = true;
      refreshBtn.classList.add('opacity-50');
      infoBar.classList.add('viral-refresh-spinning');
      loadData().finally(() => {
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('opacity-50');
        infoBar.classList.remove('viral-refresh-spinning');
      });
    });
  }

  function applyFilters() {
    let result = [...prompts];
    if (excludeChinese) result = result.filter(item => item.language !== 'zh');
    if (mediaTypeFilter !== 'all') result = result.filter(item => item.mediaType === mediaTypeFilter);
    if (categoryFilter !== 'all') result = result.filter(item => (item.categories || []).includes(categoryFilter));
    if (modelFilter !== 'all') result = result.filter(item => item.recommendedModel === modelFilter || (item.sourceModels || []).includes(modelFilter));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        (item.title || '').toLowerCase().includes(q) ||
        (item.prompt || '').toLowerCase().includes(q) ||
        (item.source?.author?.handle || '').toLowerCase().includes(q) ||
        (item.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (item.recommendedModel || '').toLowerCase().includes(q)
      );
    }
    if (sortKey === 'fresh') {
      result.sort((a, b) => new Date(b.provenance?.updatedAt || b.source?.publishedAt || 0) - new Date(a.provenance?.updatedAt || a.source?.publishedAt || 0));
    } else if (sortKey === 'engagement') {
      result.sort((a, b) => {
        const ea = (a.source?.engagement?.likes ?? 0) + (a.source?.engagement?.reposts ?? 0) + (a.source?.engagement?.replies ?? 0);
        const eb = (b.source?.engagement?.likes ?? 0) + (b.source?.engagement?.reposts ?? 0) + (b.source?.engagement?.replies ?? 0);
        return eb - ea;
      });
    } else if (sortKey === 'likes') {
      result.sort((a, b) => (b.source?.engagement?.likes ?? 0) - (a.source?.engagement?.likes ?? 0));
    }
    filtered = result;
    currentPage = 0;
    hasMore = filtered.length > PAGE_SIZE;
    renderGrid();
    updateInfoBar();
  }

  function renderGrid() {
    gridEl.style.opacity = '0';
    gridEl.style.transition = 'opacity 200ms ease-in-out';
    if (isLoading) {
      gridEl.innerHTML = `
        <div class="col-span-full flex items-center justify-center py-16">
          <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span class="ml-3 text-sm text-zinc-400">Loading viral prompt feed…</span>
        </div>
      `;
      return;
    }
    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="col-span-full text-center py-16 text-zinc-400">
          <svg class="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M15 9a3 3 0 1 0-3 3 3 3 0 0 0 3-3z"/></svg>
          <p class="text-sm">No prompts match your filters.</p>
          <p class="text-xs text-zinc-500 mt-1">Try adjusting your search or clearing the category filter.</p>
          <button id="viral-reset-filters" class="mt-3 px-4 py-2 btn-secondary-modern rounded-xl text-xs font-black hover:shadow-glow transition">Reset All Filters</button>
        </div>
      `;
        const resetBtn = gridEl.querySelector('#viral-reset-filters');
        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            searchQuery = ''; mediaTypeFilter = 'all'; categoryFilter = 'all'; modelFilter = 'all'; sortKey = 'fresh'; excludeChinese = true;
            searchInput.value = ''; categorySelect.value = 'all'; modelSelect.value = 'all'; sortSelect.value = 'fresh';
            mediaFilter.querySelectorAll('.media-btn').forEach(b => { b.classList.remove('bg-primary', 'text-black'); b.classList.add('text-zinc-200', 'hover:text-white'); });
            mediaFilter.querySelector('[data-mt="all"]').classList.add('bg-primary', 'text-black');
            mediaFilter.querySelector('[data-mt="all"]').classList.remove('text-zinc-200');
            langToggle.classList.add('bg-primary/10', 'border-primary/20', 'text-primary');
            langToggle.classList.remove('bg-zinc-800', 'border-zinc-700/80', 'text-zinc-300');
            langToggle.innerHTML = `<svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M12 4a8 8 0 0 0-8 8c0 2.8 1.4 5.2 3.6 6.6"/><path d="M12 12c2 1 3 3 3 5"/><path d="M12 12V7m0 10v1"/></svg>Exclude Chinese`;
            applyFilters();
          });
        }
      return;
    }
    currentPage = 0;
    hasMore = filtered.length > PAGE_SIZE;
    const pageItems = filtered.slice(0, PAGE_SIZE);
    gridEl.innerHTML = pageItems.map(item => buildCardHtml(item)).join('');
    requestAnimationFrame(() => { gridEl.style.opacity = '1'; });
    const cardEls = gridEl.querySelectorAll('.smart-card');
    cardEls.forEach((card, i) => {
      card.style.transitionDelay = `${i * 20}ms`;
      requestAnimationFrame(() => card.classList.add('smart-animate'));
    });
    setupCardPostRender();
    setupInfiniteScroll();
  }

  // =====================
  // CLEANUP
  // =====================
  autoRefreshTimer = setInterval(() => { if (mounted) loadData(); }, REFRESH_INTERVAL_MS);
  loadData();

  const stopObserving = observeRemoval(container, () => unmount());
  window.addEventListener('beforeunload', () => {
    unmount();
  });

  return container;
}

function observeRemoval(node, onRemove) {
  if (!node.parentNode) return () => {};
  const observer = new MutationObserver(() => {
    if (!node.parentNode) {
      observer.disconnect();
      onRemove();
    }
  });
  observer.observe(node.parentNode || document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
