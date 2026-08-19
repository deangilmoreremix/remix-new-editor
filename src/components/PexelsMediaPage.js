import { createSafeImage, safeSetText } from '../lib/security.js';
import { showToast } from '../lib/loading.js';
import {
  searchPhotos,
  searchVideos,
  getCuratedPhotos,
  getPopularVideos,
} from '../lib/pexelsApi.js';

export function PexelsMediaPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-hidden';

  let activeFilter = 'photos';
  let searchQuery = '';
  let currentItems = [];
  let currentPage = 1;
  let isLoading = false;
  let hasMore = true;
  let errorMessage = '';
  let rateLimitRemaining = null;
  const searchTimestamps = [];
  const MAX_SEARCHES_PER_MINUTE = 30;

  // Filter state
  let filterOrientation = '';
  let filterSize = '';
  let filterColor = '';
  let filterLocale = '';
  let filterMinDuration = '';
  let filterMaxDuration = '';
  let filterMinWidth = '';
  let filterMinHeight = '';
  let activeTab = 'search'; // 'search' | 'curated' | 'popular' | 'collections'
  let selectedCollectionId = null;

  const hero = document.createElement('div');
  hero.className = 'relative w-full h-32 md:h-44 rounded-2xl overflow-hidden mb-4';
  hero.innerHTML = '<div class="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-app-bg to-teal-500/20"></div>';
  const heroOverlay = document.createElement('div');
  heroOverlay.className = 'absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent';
  hero.appendChild(heroOverlay);
  const heroText = document.createElement('div');
  heroText.className = 'absolute bottom-0 left-0 right-0 p-4 z-10';
  heroText.innerHTML = '<h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Stock Media</h1><p class="text-white/60 text-xs">Search and import free photos and videos from Pexels</p>';
  hero.appendChild(heroText);

  const topBar = document.createElement('div');
  topBar.className = 'px-4 md:px-8 pt-6 pb-4 shrink-0';
  topBar.appendChild(hero);

  const controls = document.createElement('div');
  controls.className = 'flex items-center gap-3 flex-wrap mt-4';

  const filters = [
    { key: 'photos', label: 'Photos' },
    { key: 'videos', label: 'Videos' },
    { key: 'all', label: 'All' },
  ];
  const filterBtns = {};
  filters.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'px-4 py-2 rounded-full text-xs font-bold transition-all';
    safeSetText(btn, f.label);
    btn.onclick = () => {
      activeFilter = f.key;
      currentPage = 1;
      hasMore = true;
      errorMessage = '';
      updateFilters();
      loadItems(true);
    };
    filterBtns[f.key] = btn;
    controls.appendChild(btn);
  });

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search Pexels...';
  searchInput.className = 'ml-auto bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors w-48';
  let searchDebounce;
  searchInput.oninput = () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      currentPage = 1;
      hasMore = true;
      errorMessage = '';
      loadItems(true);
    }, 300);
  };

  // Rate-limit searches to 30 per minute per session
  const originalLoadItems = loadItems;
  loadItems = async function(reset) {
    if (reset && !canSearch()) {
      showToast('Search limit reached. Please wait a moment before searching again.', 'warning');
      return;
    }
    if (reset) searchTimestamps.push(Date.now());
    return originalLoadItems(reset);
  };
  controls.appendChild(searchInput);

  const retryBtn = document.createElement('button');
  retryBtn.className = 'hidden px-4 py-2 rounded-full text-xs font-bold transition-all bg-primary text-black hover:shadow-glow';
  safeSetText(retryBtn, 'Retry');
  retryBtn.onclick = () => {
    errorMessage = '';
    retryBtn.classList.add('hidden');
    loadItems(true);
  };
  controls.appendChild(retryBtn);

  // Tabs: Search | Curated | Popular | Collections
  const tabs = [
    { key: 'search', label: 'Search' },
    { key: 'curated', label: 'Curated' },
    { key: 'popular', label: 'Popular Videos' },
    { key: 'collections', label: 'Collections' },
  ];
  const tabBtns = {};
  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'px-3 py-1.5 rounded-full text-[10px] font-bold transition-all';
    safeSetText(btn, tab.label);
    btn.onclick = () => {
      activeTab = tab.key;
      currentPage = 1;
      hasMore = true;
      errorMessage = '';
      searchQuery = '';
      searchInput.value = '';
      updateTabs();
      loadItems(true);
    };
    tabBtns[tab.key] = btn;
    controls.appendChild(btn);
  });

  // Advanced filters row
  const filtersRow = document.createElement('div');
  filtersRow.className = 'flex items-center gap-2 flex-wrap mt-2';

  const orientationSelect = createFilterSelect('Orientation', '', [{ v: '', l: 'Any' }, { v: 'landscape', l: 'Landscape' }, { v: 'portrait', l: 'Portrait' }, { v: 'square', l: 'Square' }], v => { filterOrientation = v; resetAndSearch(); });
  const sizeSelect = createFilterSelect('Size', '', [{ v: '', l: 'Any' }, { v: 'large', l: 'Large' }, { v: 'medium', l: 'Medium' }, { v: 'small', l: 'Small' }], v => { filterSize = v; resetAndSearch(); });
  const colorSelect = createFilterSelect('Color', '', [{ v: '', l: 'Any' }, { v: 'red', l: 'Red' }, { v: 'orange', l: 'Orange' }, { v: 'yellow', l: 'Yellow' }, { v: 'green', l: 'Green' }, { v: 'blue', l: 'Blue' }, { v: 'violet', l: 'Violet' }, { v: 'pink', l: 'Pink' }, { v: 'brown', l: 'Brown' }, { v: 'black', l: 'Black' }, { v: 'gray', l: 'Gray' }, { v: 'white', l: 'White' }], v => { filterColor = v; resetAndSearch(); });
  const durationSelect = createFilterSelect('Duration', '', [{ v: '', l: 'Any' }, { v: 'short', l: '< 15s' }, { v: 'medium', l: '15-60s' }, { v: 'long', l: '> 60s' }], v => {
    if (v === 'short') { filterMinDuration = '0'; filterMaxDuration = '15'; }
    else if (v === 'medium') { filterMinDuration = '15'; filterMaxDuration = '60'; }
    else if (v === 'long') { filterMinDuration = '60'; filterMaxDuration = ''; }
    else { filterMinDuration = ''; filterMaxDuration = ''; }
    resetAndSearch();
  });

  filtersRow.appendChild(orientationSelect);
  filtersRow.appendChild(sizeSelect);
  filtersRow.appendChild(colorSelect);
  filtersRow.appendChild(durationSelect);
  controls.appendChild(filtersRow);

  function createFilterSelect(label, value, options, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'relative';
    const select = document.createElement('select');
    select.className = 'bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-[10px] focus:outline-none appearance-none cursor-pointer pr-6';
    select.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")';
    select.style.backgroundRepeat = 'no-repeat';
    select.style.backgroundPosition = 'right 6px center';
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.v;
      o.textContent = opt.l;
      o.style.background = '#111';
      if (opt.v === value) o.selected = true;
      select.appendChild(o);
    });
    select.onchange = () => onChange(select.value);
    wrapper.appendChild(select);
    return wrapper;
  }

  function updateTabs() {
    Object.entries(tabBtns).forEach(([key, btn]) => {
      btn.className = key === activeTab
        ? 'px-3 py-1.5 rounded-full text-[10px] font-bold transition-all bg-primary text-black'
        : 'px-3 py-1.5 rounded-full text-[10px] font-bold transition-all bg-white/5 text-secondary hover:bg-white/10';
    });
  }

  function resetAndSearch() {
    currentPage = 1;
    hasMore = true;
    errorMessage = '';
    loadItems(true);
  }

  topBar.appendChild(controls);
  container.appendChild(topBar);

  // Rate limit banner
  const rateLimitBanner = document.createElement('div');
  rateLimitBanner.className = 'hidden px-4 md:px-8 py-2 shrink-0';
  container.appendChild(rateLimitBanner);

  const statusBar = document.createElement('div');
  statusBar.className = 'px-4 md:px-8 pb-2 shrink-0';
  const statusText = document.createElement('div');
  statusText.className = 'text-xs text-muted';
  statusBar.appendChild(statusText);
  container.appendChild(statusBar);

  const gridArea = document.createElement('div');
  gridArea.className = 'flex-1 overflow-y-auto px-4 md:px-8 pb-8';
  container.appendChild(gridArea);

  // Pexels branding footer
  const footer = document.createElement('div');
  footer.className = 'shrink-0 px-4 md:px-8 py-4 border-t border-white/5 flex items-center justify-between';
  footer.innerHTML = '<span class="text-[10px] text-muted">Media provided by <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Pexels</a></span>';
  container.appendChild(footer);

  const previewOverlay = document.createElement('div');
  previewOverlay.className = 'fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-8 hidden';
  previewOverlay.onclick = (e) => {
    if (e.target === previewOverlay) previewOverlay.classList.add('hidden');
  };
  container.appendChild(previewOverlay);

  function onKeyDown(e) {
    if (e.key === 'Escape' && !previewOverlay.classList.contains('hidden')) {
      previewOverlay.classList.add('hidden');
    }
  }
  document.addEventListener('keydown', onKeyDown);

  function updateFilters() {
    Object.entries(filterBtns).forEach(([key, btn]) => {
      btn.className = key === activeFilter
        ? 'px-4 py-2 rounded-full text-xs font-bold transition-all bg-primary text-black'
        : 'px-4 py-2 rounded-full text-xs font-bold transition-all bg-white/5 text-secondary hover:bg-white/10';
    });
  }

  function updateRateLimitBanner(remaining) {
    if (remaining === null || remaining === undefined) {
      rateLimitBanner.classList.add('hidden');
      searchInput.disabled = false;
      return;
    }

    if (remaining <= 0) {
      rateLimitBanner.className = 'px-4 md:px-8 py-2 shrink-0 bg-red-500/20 border-b border-red-500/30';
      rateLimitBanner.innerHTML = '<div class="text-xs text-red-300 font-bold">Pexels quota exhausted. Please try again later or add your own API key in Settings.</div>';
      searchInput.disabled = true;
    } else if (remaining < 50) {
      rateLimitBanner.className = 'px-4 md:px-8 py-2 shrink-0 bg-yellow-500/10 border-b border-yellow-500/20';
      rateLimitBanner.innerHTML = '<div class="text-xs text-yellow-200">Pexels API quota running low (' + remaining + ' remaining)</div>';
      searchInput.disabled = false;
    } else {
      rateLimitBanner.classList.add('hidden');
      searchInput.disabled = false;
    }
  }

  function canSearch() {
    const now = Date.now();
    const recent = searchTimestamps.filter(t => now - t < 60000);
    searchTimestamps.length = 0;
    recent.forEach(t => searchTimestamps.push(t));
    return recent.length < MAX_SEARCHES_PER_MINUTE;
  }

  function extractRateLimit(data) {
    if (data && data._rateLimit && typeof data._rateLimit.remaining === 'number') {
      return data._rateLimit.remaining;
    }
    return null;
  }

  function getMediaType(item) {
    if (activeFilter === 'photos') return 'photo';
    if (activeFilter === 'videos') return 'video';
    return item.type === 'video' ? 'video' : 'photo';
  }

  function renderSkeleton() {
    gridArea.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        ${Array.from({ length: 12 }).map(() => `
          <div class="rounded-xl overflow-hidden border border-white/5 bg-white/[0.02] aspect-square animate-pulse">
            <div class="w-full h-full bg-white/5"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderError() {
    gridArea.innerHTML = `
      <div class="flex flex-col items-center justify-center h-64 text-muted">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mb-4 opacity-30"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="text-sm">${errorMessage || 'Something went wrong'}</div>
      </div>
    `;
  }

  function renderEmpty() {
    gridArea.innerHTML = `
      <div class="flex flex-col items-center justify-center h-64 text-muted">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mb-4 opacity-30"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <div class="text-sm">No results found</div>
        <div class="text-xs mt-1">Try a different search term</div>
      </div>
    `;
  }

  function renderGrid() {
    if (isLoading && currentItems.length === 0) {
      renderSkeleton();
      return;
    }

    if (errorMessage) {
      renderError();
      retryBtn.classList.remove('hidden');
      return;
    }

    if (currentItems.length === 0) {
      renderEmpty();
      retryBtn.classList.add('hidden');
      return;
    }

    retryBtn.classList.add('hidden');

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3';

    currentItems.forEach(item => {
      const mediaType = getMediaType(item);
      const card = document.createElement('div');
      card.className = 'relative group cursor-pointer rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all aspect-square bg-white/[0.02]';

      let mediaEl;
      if (mediaType === 'video') {
        const thumb = item.image || (item.video_pictures && item.video_pictures[0] && item.video_pictures[0].picture) || '';
        mediaEl = createSafeImage(thumb, item.alt || 'Video thumbnail', 'w-full h-full object-cover');
        const playBadge = document.createElement('div');
        playBadge.className = 'absolute inset-0 flex items-center justify-center pointer-events-none';
        playBadge.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="white" opacity="0.8"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
        card.appendChild(mediaEl);
        card.appendChild(playBadge);

        const badge = document.createElement('div');
        badge.className = 'absolute top-2 right-2 bg-blue-500/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-white';
        safeSetText(badge, 'VIDEO');
        card.appendChild(badge);
      } else {
        const avgColor = item.avg_color || '#1a1a1a';
        card.style.backgroundColor = avgColor;
        const src = item.src || item.url;
        mediaEl = createSafeImage(src, item.alt || 'Photo', 'w-full h-full object-cover relative z-10');
        mediaEl.loading = 'lazy';
        mediaEl.onload = () => { card.style.backgroundColor = ''; };
        card.appendChild(mediaEl);
      }

      const overlay = document.createElement('div');
      overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3';

      const photographerEl = document.createElement('div');
      photographerEl.className = 'text-[10px] text-white/80 truncate';
      const photographer = item.photographer || (item.user && item.user.name) || '';
      safeSetText(photographerEl, photographer ? 'By ' + photographer : '');
      overlay.appendChild(photographerEl);

      card.appendChild(overlay);

      card.onclick = () => showPreview(item);
      grid.appendChild(card);
    });

    gridArea.innerHTML = '';
    gridArea.appendChild(grid);

    if (hasMore && !isLoading) {
      const sentinel = document.createElement('div');
      sentinel.className = 'h-8 flex items-center justify-center';
      sentinel.innerHTML = '<div class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full"></div>';
      gridArea.appendChild(sentinel);

      const observer = new window.IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      }, { root: gridArea, threshold: 0.1 });
      observer.observe(sentinel);
    }

    safeSetText(statusText, currentItems.length + ' item' + (currentItems.length !== 1 ? 's' : '') + (activeFilter !== 'all' ? ' in ' + activeFilter : ''));
  }

  function showPreview(item) {
    previewOverlay.classList.remove('hidden');
    previewOverlay.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-4xl w-full flex flex-col items-center';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'self-end mb-4 text-secondary hover:text-white transition-colors';
    closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.onclick = () => previewOverlay.classList.add('hidden');
    wrapper.appendChild(closeBtn);

    const mediaType = getMediaType(item);

    if (mediaType === 'video') {
      const videoFiles = item.video_files || [];
      const hlsFile = videoFiles.find(f => f.quality === 'hls');
      const hdFile = videoFiles.find(f => f.quality === 'hd');
      const sdFile = videoFiles.find(f => f.quality === 'sd');
      const defaultVideoSrc = hlsFile ? hlsFile.link : (hdFile ? hdFile.link : (sdFile ? sdFile.link : videoFiles[0] ? videoFiles[0].link : ''));

      const videoControls = document.createElement('div');
      videoControls.className = 'flex items-center gap-2 mb-3';

      const qualityLabel = document.createElement('span');
      qualityLabel.className = 'text-[10px] text-secondary uppercase tracking-wider';
      safeSetText(qualityLabel, 'Quality:');
      videoControls.appendChild(qualityLabel);

      const qualitySelect = document.createElement('select');
      qualitySelect.className = 'bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none';
      const qualities = [];
      if (hlsFile) qualities.push({ v: hlsFile.link, l: 'Auto (HLS)' });
      if (hdFile) qualities.push({ v: hdFile.link, l: 'HD (' + hdFile.width + 'x' + hdFile.height + ')' });
      if (sdFile) qualities.push({ v: sdFile.link, l: 'SD (' + sdFile.width + 'x' + sdFile.height + ')' });
      qualities.forEach(q => {
        const opt = document.createElement('option');
        opt.value = q.v;
        opt.textContent = q.l;
        opt.style.background = '#111';
        if (q.v === defaultVideoSrc) opt.selected = true;
        qualitySelect.appendChild(opt);
      });
      qualitySelect.onchange = () => {
        video.src = qualitySelect.value;
        video.play();
      };
      videoControls.appendChild(qualitySelect);
      wrapper.appendChild(videoControls);

      const video = document.createElement('video');
      video.src = defaultVideoSrc;
      video.controls = true;
      video.autoplay = true;
      video.loop = true;
      video.className = 'max-h-[70vh] rounded-xl';
      wrapper.appendChild(video);
    } else {
      const img = createSafeImage(item.src || item.url, item.alt || 'Pexels photo', 'max-h-[70vh] rounded-xl object-contain');
      wrapper.appendChild(img);
    }

    const attribution = document.createElement('div');
    attribution.className = 'mt-4 text-center';

    const photographerEl = document.createElement('div');
    photographerEl.className = 'text-sm text-white mb-1';
    const photographer = item.photographer || (item.user && item.user.name) || '';
    if (photographer) {
      const profileUrl = item.photographer_url || (item.user && item.user.url) || '#';
      const link = document.createElement('a');
      link.href = profileUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'text-primary hover:underline';
      safeSetText(link, photographer);
      photographerEl.appendChild(link);
    } else {
      safeSetText(photographerEl, 'Pexels');
    }
    attribution.appendChild(photographerEl);

    const pexelsLink = document.createElement('a');
    pexelsLink.href = item.url || ('https://www.pexels.com/photo/' + item.id + '/');
    pexelsLink.target = '_blank';
    pexelsLink.rel = 'noopener noreferrer';
    pexelsLink.className = 'text-xs text-muted hover:text-white transition-colors';
    safeSetText(pexelsLink, 'View on Pexels');
    attribution.appendChild(pexelsLink);

    wrapper.appendChild(attribution);

    const timelineBtn = document.createElement('button');
    timelineBtn.className = 'mt-2 bg-white/5 text-white px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-white/10 transition-all inline-flex items-center gap-2';
    timelineBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg> Add to Timeline';
    timelineBtn.onclick = async () => {
      timelineBtn.disabled = true;
      timelineBtn.textContent = 'Adding...';
      try {
        const pexelsApi = await import('../lib/editor/pexelsIntegration.js');
        const state = window.__timelineState;
        if (!state) {
          showToast('No active timeline. Open the Timeline Editor first.', 'warning');
          timelineBtn.disabled = false;
          timelineBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg> Add to Timeline';
          return;
        }
        const integration = pexelsApi.initializePexelsIntegration(state, showToast);
        const isVideo = mediaType === 'video';
        integration.addToTimeline({
          id: item.id,
          type: isVideo ? 'video' : 'image',
          url: mediaUrl,
          thumbnail: mediaType === 'video' ? (item.image || '') : (item.src || item.url),
          duration: item.duration || (isVideo ? 5 : 5),
          width: item.width || 0,
          height: item.height || 0,
          alt: item.alt || '',
          photographer: item.photographer || (item.user && item.user.name) || '',
          photographerUrl: item.photographer_url || (item.user && item.user.url) || '',
          source: 'pexels',
        }, isVideo ? 'video' : 'video');
        showToast('Added to timeline', 'success');
        previewOverlay.classList.add('hidden');
      } catch (err) {
        showToast('Failed to add to timeline: ' + err.message, 'error');
        timelineBtn.disabled = false;
        timelineBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg> Add to Timeline';
      }
    };
    wrapper.appendChild(timelineBtn);

    const importBtn = document.createElement('button');
    importBtn.className = 'mt-4 bg-primary text-black px-8 py-2.5 rounded-xl font-bold text-sm hover:shadow-glow transition-all inline-flex items-center gap-2';
    importBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Import to Project';
    importBtn.onclick = async () => {
      importBtn.disabled = true;
      importBtn.textContent = 'Importing...';
      try {
        const mediaUrl = mediaType === 'video'
          ? ((item.video_files && item.video_files.find(function(f) { return f.quality === 'hd' || f.quality === 'sd'; })) ? (item.video_files.find(function(f) { return f.quality === 'hd' || f.quality === 'sd'; }).link) : ((item.video_files && item.video_files[0]) ? item.video_files[0].link : item.url))
          : (item.src || item.url);

        const mod = await import('../lib/pexelsLibrary.js');
        const result = mod.savePexelsLibraryEntry({
          id: item.id,
          type: mediaType === 'video' ? 'video' : 'image',
          src: mediaUrl,
          thumb: mediaType === 'video' ? (item.image || '') : (item.src || item.url),
          width: item.width || 0,
          height: item.height || 0,
          duration: item.duration || 0,
          alt: item.alt || '',
          photographer: item.photographer || (item.user && item.user.name) || '',
          photographer_url: item.photographer_url || (item.user && item.user.url) || '',
          url: item.url || '',
          video_files: item.video_files,
          video_pictures: item.video_pictures,
        });
        if (result) {
          showToast('Imported to library', 'success');
          previewOverlay.classList.add('hidden');
        } else {
          showToast('Import failed. Please try again.', 'error');
          importBtn.disabled = false;
          importBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Import to Project';
        }
      } catch (err) {
        showToast('Import failed: ' + err.message, 'error');
        importBtn.disabled = false;
        importBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Import to Project';
      }
    };
    wrapper.appendChild(importBtn);

    previewOverlay.appendChild(wrapper);
  }

  async function loadItems(reset) {
    if (isLoading) return;
    if (!reset && !hasMore) return;

    isLoading = true;
    if (reset) renderSkeleton();

    try {
      let newItems = [];
      let nextPage = null;

      if (searchQuery || activeTab === 'search') {
        if (activeFilter === 'videos' || activeFilter === 'all') {
          const videoData = await searchVideos({
            query: searchQuery,
            page: currentPage,
            per_page: 20,
            orientation: filterOrientation || undefined,
            size: filterSize || undefined,
            locale: filterLocale || undefined,
            min_duration: filterMinDuration ? Number(filterMinDuration) : undefined,
            max_duration: filterMaxDuration ? Number(filterMaxDuration) : undefined,
            min_width: filterMinWidth ? Number(filterMinWidth) : undefined,
            min_height: filterMinHeight ? Number(filterMinHeight) : undefined,
          });
          newItems = videoData.videos || [];
          nextPage = videoData.next_page || null;
          updateRateLimitBanner(extractRateLimit(videoData));
        }
        if (activeFilter === 'photos' || activeFilter === 'all') {
          const photoData = await searchPhotos({
            query: searchQuery,
            page: currentPage,
            per_page: 20,
            orientation: filterOrientation || undefined,
            size: filterSize || undefined,
            color: filterColor || undefined,
            locale: filterLocale || undefined,
          });
          const photos = (photoData.photos || []).map(function(p) { return Object.assign({}, p, { type: 'photo' }); });
          if (activeFilter === 'all') {
            newItems = newItems.concat(photos);
          } else {
            newItems = photos;
          }
          nextPage = photoData.next_page || nextPage;
          updateRateLimitBanner(extractRateLimit(photoData));
        }
      } else {
        if (activeTab === 'popular' || activeFilter === 'videos') {
          const videoData = await getPopularVideos({
            page: currentPage,
            per_page: 20,
            min_duration: filterMinDuration ? Number(filterMinDuration) : undefined,
            max_duration: filterMaxDuration ? Number(filterMaxDuration) : undefined,
            min_width: filterMinWidth ? Number(filterMinWidth) : undefined,
            min_height: filterMinHeight ? Number(filterMinHeight) : undefined,
          });
          newItems = videoData.videos || [];
          nextPage = videoData.next_page || null;
          updateRateLimitBanner(extractRateLimit(videoData));
        }
        if (activeTab === 'curated' || activeFilter === 'photos') {
          const photoData = await getCuratedPhotos({ page: currentPage, per_page: 20 });
          const photos = (photoData.photos || []).map(function(p) { return Object.assign({}, p, { type: 'photo' }); });
          if (activeFilter === 'all') {
            newItems = newItems.concat(photos);
          } else {
            newItems = photos;
          }
          nextPage = photoData.next_page || nextPage;
          updateRateLimitBanner(extractRateLimit(photoData));
        }
      }

      if (reset) {
        currentItems = newItems;
      } else {
        currentItems = currentItems.concat(newItems);
      }

      hasMore = Boolean(nextPage);
      currentPage = hasMore ? currentPage + 1 : currentPage;
      errorMessage = '';
    } catch (err) {
      console.error('Pexels load error:', err);
      errorMessage = err.message || 'Failed to load media';
      if (reset) currentItems = [];
    } finally {
      isLoading = false;
      renderGrid();
    }
  }

  async function loadMore() {
    if (!isLoading && hasMore) {
      await loadItems(false);
    }
  }

  updateFilters();
  loadItems(true);

  return container;
}
