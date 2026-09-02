/**
 * StockMediaBrowser
 *
 * Unified stock media browser supporting Pexels, Pixabay, and Giphy.
 * Replaces and extends the old PexelsBrowser with a multi-provider UI.
 *
 * Usage:
 *   openStockMediaBrowser({
 *     accept: ['image', 'video', 'gif'],
 *     onSelect: (asset) => { ... },
 *     onCancel: () => { ... },
 *     title: 'Stock Media',
 *     studioName: 'My Studio',
 *   });
 */

import { searchPhotos, searchVideos, getCuratedPhotos, getPopularVideos, getFeaturedCollections, getCollectionMedia, clearPexelsCache } from '../lib/pexelsApi.js';
import { searchPixabayImages, searchPixabayVideos, getCuratedPixabayImages, getPopularPixabayVideos, clearPixabayCache } from '../lib/pixabayApi.js';
import { searchGiphy, getTrendingGiphy, clearGiphyCache, normalizeGiphyItem } from '../lib/giphyApi.js';
import { createSafeImage, safeSetText } from '../lib/security.js';
import { showToast } from '../lib/loading.js';

const PROVIDERS = {
  PEXELS: 'pexels',
  PIXABAY: 'pixabay',
  GIPHY: 'giphy',
};

const MEDIA_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  GIF: 'gif',
  STICKER: 'sticker',
};

export function openStockMediaBrowser({
  accept = ['image', 'video', 'gif'],
  providers,
  onSelect,
  onCancel,
  onDownload,
  title = 'Stock Media',
  studioName = 'Studio',
}) {
  // Use explicit providers if provided, otherwise auto-detect from accept
  let availableProviders = providers;
  if (!availableProviders) {
    availableProviders = [];
    if (accept.includes('image') || accept.includes('video')) {
      availableProviders.push(PROVIDERS.PEXELS);
      availableProviders.push(PROVIDERS.PIXABAY);
    }
    if (accept.includes('gif') || accept.includes('sticker')) {
      availableProviders.push(PROVIDERS.GIPHY);
    }
    // If no specific providers determined, default to all
    if (availableProviders.length === 0) {
      availableProviders.push(PROVIDERS.PEXELS, PROVIDERS.PIXABAY, PROVIDERS.GIPHY);
    }
  }

  // Create shimmer style if not exists
  if (!document.getElementById('stock-media-browser-shimmer-style')) {
    const style = document.createElement('style');
    style.id = 'stock-media-browser-shimmer-style';
    style.textContent = `
      @keyframes stockMediaShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .shimmer-bg {
        background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0) 100%);
        background-size: 200% 100%;
        animation: stockMediaShimmer 1.5s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/95 z-[200] flex flex-col';
  overlay.setAttribute('data-stock-media-browser', 'true');

  // Header
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between px-4 md:px-8 py-4 border-b border-white/5 shrink-0';
  header.innerHTML = `
    <div>
      <h2 class="text-lg font-black text-white">${title || 'Stock Media'}</h2>
      <p class="text-[10px] text-muted mt-0.5">Select media to use in ${studioName}</p>
    </div>
    <button class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-secondary hover:text-white transition-all close-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  overlay.appendChild(header);

  // Provider tabs + controls
  const controls = document.createElement('div');
  controls.className = 'px-4 md:px-8 py-3 border-b border-white/5 shrink-0';
  controls.innerHTML = `
    <div class="flex items-center gap-2 flex-wrap">
      <div class="flex gap-1 bg-white/5 p-1 rounded-xl">
        ${availableProviders.map(p => `<button class="tab-btn px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all btn-secondary-modern" data-provider="${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</button>`).join('')}
      </div>
      <input type="text" placeholder="Search stock media..." class="ml-auto bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors w-48 md:w-64 search-input" />
      <select class="type-filter-select bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-[10px] focus:outline-none cursor-pointer">
        <option value="all">All Types</option>
        ${accept.includes('image') ? '<option value="image">Photos</option>' : ''}
        ${accept.includes('video') ? '<option value="video">Videos</option>' : ''}
        ${accept.includes('gif') ? '<option value="gif">GIFs</option>' : ''}
        ${accept.includes('sticker') ? '<option value="sticker">Stickers</option>' : ''}
      </select>
    </div>
  `;
  overlay.appendChild(controls);

  // Content area
  const content = document.createElement('div');
  content.className = 'flex-1 overflow-y-auto px-4 md:px-8 py-4';
  overlay.appendChild(content);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'px-4 md:px-8 py-3 border-t border-white/5 shrink-0 flex items-center justify-between';
  footer.innerHTML = `
    <span class="text-[10px] text-muted">Media provided by <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Pexels</a>, <a href="https://pixabay.com" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Pixabay</a>, and <a href="https://giphy.com" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Giphy</a></span>
  `;
  overlay.appendChild(footer);

  // State
  let activeProvider = availableProviders[0] || PROVIDERS.PEXELS;
  let activeTab = 'search';
  let searchQuery = '';
  let filterType = 'all';
  let currentItems = [];
  let currentPage = 1;
  let hasMore = true;
  let isLoading = false;
  let selectedIndex = -1;

  // Provider-specific tab configurations
  const providerTabs = {
    [PROVIDERS.PEXELS]: ['search', 'curated', 'popular', 'collections', 'my-collections'],
    [PROVIDERS.PIXABAY]: ['search', 'curated'],
    [PROVIDERS.GIPHY]: ['search', 'trending'],
  };

  function getAvailableTabs() {
    return providerTabs[activeProvider] || ['search'];
  }

  function updateTabButtons() {
    const tabs = getAvailableTabs();
    const tabContainer = controls.querySelector('.bg-white\\/5');
    if (!tabContainer) return;
    tabContainer.innerHTML = tabs.map(tab =>
      `<button class="tab-btn px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${activeTab === tab ? 'btn-secondary-modern' : 'text-secondary hover:text-white'}" data-tab="${tab}">${tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}</button>`
    ).join('');
  }

  function setLoading(loading) {
    isLoading = loading;
    if (loading) {
      content.innerHTML = '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">' + Array(10).fill('<div class="shimmer-bg rounded-xl aspect-video"></div>').join('') + '</div>';
    }
  }

  function showError(message) {
    content.innerHTML = `
      <div class="flex flex-col items-center justify-center py-20 text-center">
        <div class="text-red-400 text-4xl mb-4">⚠️</div>
        <p class="text-white text-sm mb-2">Failed to load media</p>
        <p class="text-muted text-xs mb-4">${message}</p>
        <button class="retry-btn px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs hover:bg-white/10 transition-colors">Retry</button>
      </div>
    `;
    content.querySelector('.retry-btn')?.addEventListener('click', () => loadItems(true));
  }

  async function loadItems(reset = false) {
    if (isLoading) return;
    if (reset) {
      currentPage = 1;
      hasMore = true;
      currentItems = [];
    }
    if (!hasMore) return;

    setLoading(true);
    try {
      let items = [];
      let total = 0;

      if (activeProvider === PROVIDERS.PEXELS) {
        if (activeTab === 'search') {
          const type = filterType === 'video' ? 'videos' : 'photos';
          if (type === 'videos') {
            const data = await searchVideos({ query: searchQuery, page: currentPage, per_page: 20 });
            items = (data.videos || []).map(v => normalizePexelsVideo(v));
            total = data.total_results || 0;
          } else {
            const data = await searchPhotos({ query: searchQuery, page: currentPage, per_page: 20 });
            items = (data.photos || []).map(p => normalizePexelsPhoto(p));
            total = data.total_results || 0;
          }
        } else if (activeTab === 'curated') {
          const data = await getCuratedPhotos({ page: currentPage, per_page: 20 });
          items = (data.photos || []).map(p => normalizePexelsPhoto(p));
          total = data.total_results || 0;
        } else if (activeTab === 'popular') {
          const data = await getPopularVideos({ page: currentPage, per_page: 20 });
          items = (data.videos || []).map(v => normalizePexelsVideo(v));
          total = data.total_results || 0;
        } else if (activeTab === 'collections' || activeTab === 'my-collections') {
          // For now, show featured collections
          const data = await getFeaturedCollections({ page: currentPage, per_page: 20 });
          items = (data.collections || []).map(c => ({
            id: `pexels-collection-${c.id}`,
            type: 'collection',
            source: 'pexels',
            name: c.title || 'Collection',
            url: c.cover_photo?.src?.original || '',
            thumbnail: c.cover_photo?.src?.medium || c.cover_photo?.src?.small || '',
            width: c.cover_photo?.width,
            height: c.cover_photo?.height,
            metadata: { collectionId: c.id, description: c.description },
          }));
          total = data.total_results || 0;
        }
      } else if (activeProvider === PROVIDERS.PIXABAY) {
        if (activeTab === 'search') {
          if (filterType === 'video') {
            const data = await searchPixabayVideos({ query: searchQuery, page: currentPage, per_page: 20 });
            items = (data.hits || []).map(h => normalizePixabayVideo(h));
            total = data.totalHits || 0;
          } else {
            const data = await searchPixabayImages({ query: searchQuery, page: currentPage, per_page: 20 });
            items = (data.hits || []).map(h => normalizePixabayImage(h));
            total = data.totalHits || 0;
          }
        } else if (activeTab === 'curated') {
          if (filterType === 'video') {
            const data = await getPopularPixabayVideos({ page: currentPage, per_page: 20 });
            items = (data.hits || []).map(h => normalizePixabayVideo(h));
            total = data.totalHits || 0;
          } else {
            const data = await getCuratedPixabayImages({ page: currentPage, per_page: 20 });
            items = (data.hits || []).map(h => normalizePixabayImage(h));
            total = data.totalHits || 0;
          }
        }
      } else if (activeProvider === PROVIDERS.GIPHY) {
        if (activeTab === 'search') {
          const giphyType = filterType === 'sticker' ? 'stickers' : 'gifs';
          const data = await searchGiphy({ q: searchQuery, type: giphyType, limit: 20, offset: (currentPage - 1) * 20 });
          items = (data.data || []).map(item => normalizeGiphyItem(item, giphyType));
          total = data.pagination?.total_count || 0;
        } else if (activeTab === 'trending') {
          const giphyType = filterType === 'sticker' ? 'stickers' : 'gifs';
          const data = await getTrendingGiphy({ type: giphyType, limit: 20, offset: (currentPage - 1) * 20 });
          items = (data.data || []).map(item => normalizeGiphyItem(item, giphyType));
          total = data.pagination?.total_count || 0;
        }
      }

      if (reset) {
        currentItems = items;
      } else {
        currentItems = [...currentItems, ...items];
      }
      hasMore = currentItems.length < total;
      currentPage++;

      renderItems(items, reset);
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function normalizePexelsPhoto(photo) {
    return {
      id: `pexels-img-${photo.id}`,
      type: 'image',
      source: 'pexels',
      provider: 'pexels',
      name: photo.alt || `Pexels photo ${photo.id}`,
      url: photo.src?.original || photo.src?.large || photo.src?.medium || '',
      thumbnail: photo.src?.medium || photo.src?.small || photo.src?.tiny || '',
      width: photo.width,
      height: photo.height,
      metadata: {
        pexelsId: photo.id,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        avgColor: photo.avg_color,
      },
    };
  }

  function normalizePexelsVideo(video) {
    const best = video.video_files?.sort((a, b) => (b.width || 0) - (a.width || 0))?.[0];
    return {
      id: `pexels-vid-${video.id}`,
      type: 'video',
      source: 'pexels',
      provider: 'pexels',
      name: video.user?.name || `Pexels video ${video.id}`,
      url: best?.link || '',
      thumbnail: video.image || '',
      width: best?.width || video.width,
      height: best?.height || video.height,
      duration: video.duration,
      metadata: {
        pexelsId: video.id,
        userId: video.user?.id,
        userName: video.user?.name,
        userUrl: video.user?.url,
      },
    };
  }

  function normalizePixabayImage(hit) {
    return {
      id: `pixabay-img-${hit.id}`,
      type: 'image',
      source: 'pixabay',
      provider: 'pixabay',
      name: hit.tags || `Pixabay image ${hit.id}`,
      url: hit.largeImageURL || hit.webformatURL || hit.previewURL,
      thumbnail: hit.previewURL || hit.webformatURL,
      width: hit.imageWidth,
      height: hit.imageHeight,
      metadata: {
        tags: hit.tags,
        user: hit.user,
        pixabayId: hit.id,
      },
    };
  }

  function normalizePixabayVideo(hit) {
    const videos = hit.videos || {};
    const pick = (size) => videos[size]?.url || null;
    const url = pick('medium') || pick('small') || pick('tiny') || pick('large');
    return {
      id: `pixabay-vid-${hit.id}`,
      type: 'video',
      source: 'pixabay',
      provider: 'pixabay',
      name: (Array.isArray(hit.tags) ? hit.tags[0] : hit.tags?.split(',')[0]) || `Pixabay video ${hit.id}`,
      url,
      thumbnail: hit.picture_id ? `https://i.vimeocdn.com/video/${hit.picture_id}_640x360.jpg` : null,
      duration: hit.duration,
      width: hit.videos?.medium?.width,
      height: hit.videos?.medium?.height,
      metadata: {
        tags: hit.tags,
        user: hit.user,
        pixabayId: hit.id,
      },
    };
  }

  function renderItems(items, reset = false) {
    if (!reset) {
      // Append mode
      const grid = content.querySelector('.stock-media-grid');
      if (!grid) return;
      items.forEach(item => {
        const el = createMediaItem(item);
        grid.appendChild(el);
      });
      return;
    }

    // Reset mode
    if (items.length === 0) {
      content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="text-muted text-4xl mb-4">🔍</div>
          <p class="text-white text-sm mb-2">No results found</p>
          <p class="text-muted text-xs">Try a different search term or provider</p>
        </div>
      `;
      return;
    }

    content.innerHTML = `<div class="stock-media-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"></div>`;
    const grid = content.querySelector('.stock-media-grid');
    items.forEach(item => {
      const el = createMediaItem(item);
      grid.appendChild(el);
    });
  }

  function createMediaItem(item) {
    const el = document.createElement('div');
    el.className = 'stock-media-item group relative rounded-xl overflow-hidden bg-white/5 border border-white/5 hover:border-primary/30 cursor-pointer transition-all';
    el.setAttribute('data-media-id', item.id);
    el.setAttribute('data-provider', item.provider || item.source);
    el.setAttribute('data-type', item.type);

    const isVideo = item.type === 'video';
    const isGif = item.type === 'gif' || item.type === 'sticker';

    el.innerHTML = `
      <div class="aspect-video relative overflow-hidden bg-black/20">
        ${createSafeImage(item.thumbnail || item.url, item.name || 'Stock media', 'w-full h-full object-cover')}
        ${isVideo ? '<div class="absolute inset-0 flex items-center justify-center"><div class="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg></div></div>' : ''}
        ${isGif ? '<div class="absolute top-2 right-2 px-2 py-0.5 bg-black/60 rounded text-[8px] font-bold text-white">GIF</div>' : ''}
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button class="select-btn px-3 py-1.5 bg-primary text-black text-[10px] font-bold rounded-lg hover:opacity-80 transition-opacity">Select</button>
          ${onDownload ? `<button class="download-btn px-3 py-1.5 bg-white/10 text-white text-[10px] font-bold rounded-lg hover:bg-white/20 transition-opacity">Download</button>` : ''}
        </div>
      </div>
      <div class="p-2">
        <p class="text-white text-[10px] font-medium truncate">${safeSetText(item.name || '')}</p>
        <p class="text-muted text-[8px] mt-0.5 capitalize">${item.provider || item.source} · ${item.type}</p>
      </div>
    `;

    el.querySelector('.select-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onSelect) onSelect(item);
    });

    el.querySelector('.download-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onDownload) onDownload(item, item.url);
    });

    el.addEventListener('click', () => {
      if (onSelect) onSelect(item);
    });

    return el;
  }

  // Event listeners
  header.querySelector('.close-btn').addEventListener('click', () => {
    overlay.remove();
    if (onCancel) onCancel();
  });

  controls.querySelector('.search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (searchQuery.trim()) {
      activeTab = 'search';
      updateTabButtons();
      loadItems(true);
    }
  });

  controls.querySelector('.search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      activeTab = 'search';
      updateTabButtons();
      loadItems(true);
    }
  });

  controls.querySelector('.type-filter-select')?.addEventListener('change', (e) => {
    filterType = e.target.value;
    loadItems(true);
  });

  controls.addEventListener('click', (e) => {
    const providerBtn = e.target.closest('[data-provider]');
    if (providerBtn) {
      activeProvider = providerBtn.getAttribute('data-provider');
      activeTab = getAvailableTabs()[0] || 'search';
      searchQuery = '';
      controls.querySelector('.search-input').value = '';
      updateTabButtons();
      loadItems(true);
      return;
    }

    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) {
      activeTab = tabBtn.getAttribute('data-tab');
      updateTabButtons();
      loadItems(true);
    }
  });

  // Infinite scroll
  content.addEventListener('scroll', () => {
    if (isLoading || !hasMore) return;
    const scrollBottom = content.scrollHeight - content.scrollTop - content.clientHeight;
    if (scrollBottom < 200) {
      loadItems(false);
    }
  });

  // Keyboard navigation
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      if (onCancel) onCancel();
    }
  });

  // Initial load
  updateTabButtons();
  overlay.addEventListener('transitionend', () => {
    loadItems(true);
  }, { once: true });

  // Fallback: load after a tick
  setTimeout(() => loadItems(true), 50);

  document.body.appendChild(overlay);
}

/**
 * Normalize a Pexels photo to the standard SmartVideo asset shape.
 */
export function normalizePexelsPhoto(photo) {
  return {
    id: `pexels-img-${photo.id}`,
    type: 'image',
    source: 'pexels',
    provider: 'pexels',
    name: photo.alt || `Pexels photo ${photo.id}`,
    url: photo.src?.original || photo.src?.large || photo.src?.medium || '',
    thumbnail: photo.src?.medium || photo.src?.small || photo.src?.tiny || '',
    width: photo.width,
    height: photo.height,
    metadata: {
      pexelsId: photo.id,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      avgColor: photo.avg_color,
    },
  };
}

/**
 * Normalize a Pexels video to the standard SmartVideo asset shape.
 */
export function normalizePexelsVideo(video) {
  const best = video.video_files?.sort((a, b) => (b.width || 0) - (a.width || 0))?.[0];
  return {
    id: `pexels-vid-${video.id}`,
    type: 'video',
    source: 'pexels',
    provider: 'pexels',
    name: video.user?.name || `Pexels video ${video.id}`,
    url: best?.link || '',
    thumbnail: video.image || '',
    width: best?.width || video.width,
    height: best?.height || video.height,
    duration: video.duration,
    metadata: {
      pexelsId: video.id,
      userId: video.user?.id,
      userName: video.user?.name,
      userUrl: video.user?.url,
    },
  };
}

/**
 * Clear all stock media caches.
 */
export function clearAllStockMediaCaches() {
  clearPexelsCache();
  clearPixabayCache();
  clearGiphyCache();
}

export default {
  openStockMediaBrowser,
  PROVIDERS,
  MEDIA_TYPES,
  normalizePexelsPhoto,
  normalizePexelsVideo,
  clearAllStockMediaCaches,
};
