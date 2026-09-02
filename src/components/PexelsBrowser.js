import { mountStudioChrome } from '../lib/studioChrome.js';
import { createSafeImage, safeSetText } from '../lib/security.js';
import { showToast } from '../lib/loading.js';
import {
  searchPhotos,
  searchVideos,
  getCuratedPhotos,
  getPopularVideos,
  getFeaturedCollections,
  getCollectionMedia,
  clearPexelsCache,
} from '../lib/pexelsApi.js';

export function openPexelsBrowser({ accept = ['image', 'video'], onSelect, onCancel, onDownload, title = 'Stock Media', studioName = 'Studio' }) {
  if (!document.getElementById('pexels-browser-shimmer-style')) {
    const style = document.createElement('style');
    style.id = 'pexels-browser-shimmer-style';
    style.textContent = `
      @keyframes pexelsShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .shimmer-bg {
        background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0) 100%);
        background-size: 200% 100%;
        animation: pexelsShimmer 1.5s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/95 z-[200] flex flex-col';
  overlay.setAttribute('data-pexels-browser', 'true');

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

  // Controls
  const controls = document.createElement('div');
  controls.className = 'px-4 md:px-8 py-3 border-b border-white/5 shrink-0';
  controls.innerHTML = `
    <div class="flex items-center gap-2 flex-wrap">
      <div class="flex gap-1 bg-white/5 p-1 rounded-xl">
        <button class="tab-btn px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all btn-secondary-modern" data-tab="search">Search</button>
        <button class="tab-btn px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all text-secondary hover:text-white" data-tab="curated">Curated</button>
        ${accept.includes('video') ? '<button class="tab-btn px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all text-secondary hover:text-white" data-tab="popular">Popular</button>' : ''}
        <button class="tab-btn px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all text-secondary hover:text-white" data-tab="collections">Collections</button>
        <button class="tab-btn px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all text-secondary hover:text-white" data-tab="my-collections">My Collections</button>
      </div>
      <input type="text" placeholder="Search Pexels..." class="ml-auto bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors w-48 md:w-64 search-input" />
      <select class="filter-select bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-[10px] focus:outline-none cursor-pointer">
        <option value="">All Types</option>
        ${accept.includes('image') ? '<option value="image">Photos</option>' : ''}
        ${accept.includes('video') ? '<option value="video">Videos</option>' : ''}
      </select>
      <select class="orientation-select bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-[10px] focus:outline-none cursor-pointer">
        <option value="">All Orientations</option>
        <option value="landscape">Landscape</option>
        <option value="portrait">Portrait</option>
        <option value="square">Square</option>
      </select>
      <select class="size-select bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-[10px] focus:outline-none cursor-pointer">
        <option value="">All Sizes</option>
        <option value="large">Large</option>
        <option value="medium">Medium</option>
        <option value="small">Small</option>
      </select>
      <select class="color-select bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-[10px] focus:outline-none cursor-pointer">
        <option value="">All Colors</option>
        <option value="red">Red</option>
        <option value="orange">Orange</option>
        <option value="yellow">Yellow</option>
        <option value="green">Green</option>
        <option value="turquoise">Turquoise</option>
        <option value="blue">Blue</option>
        <option value="violet">Violet</option>
        <option value="pink">Pink</option>
        <option value="brown">Brown</option>
        <option value="black">Black</option>
        <option value="gray">Gray</option>
        <option value="white">White</option>
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
  footer.innerHTML = '<span class="text-[10px] text-muted">Media provided by <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Pexels</a></span>';
  overlay.appendChild(footer);

  // State
  let activeTab = 'search';
  let searchQuery = '';
  let filterType = '';
  let orientation = '';
  let size = '';
  let color = '';
  let currentItems = [];
  let currentPage = 1;
  let hasMore = true;
  let isLoading = false;
  let selectedAsset = null;
  let previousGridItems = null;
  const searchDebounce = { current: null };

  // Tab handling
  const tabs = controls.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.onclick = () => {
      activeTab = tab.dataset.tab;
      tabs.forEach(t => {
        t.className = t === tab
          ? 'tab-btn px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all btn-secondary-modern'
          : 'tab-btn px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all text-secondary hover:text-white';
      });
      currentPage = 1;
      hasMore = true;
      loadContent(true);
    };
  });

  // Search handling
  const searchInput = controls.querySelector('.search-input');
  searchInput.oninput = () => {
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      currentPage = 1;
      hasMore = true;
      loadContent(true);
    }, 300);
  };

  // Filter handling
  const filterSelect = controls.querySelector('.filter-select');
  filterSelect.onchange = () => {
    filterType = filterSelect.value;
    currentPage = 1;
    hasMore = true;
    loadContent(true);
  };

  const orientationSelect = controls.querySelector('.orientation-select');
  orientationSelect.onchange = () => {
    orientation = orientationSelect.value;
    currentPage = 1;
    hasMore = true;
    loadContent(true);
  };

  const sizeSelect = controls.querySelector('.size-select');
  sizeSelect.onchange = () => {
    size = sizeSelect.value;
    currentPage = 1;
    hasMore = true;
    loadContent(true);
  };

  const colorSelect = controls.querySelector('.color-select');
  colorSelect.onchange = () => {
    color = colorSelect.value;
    currentPage = 1;
    hasMore = true;
    loadContent(true);
  };

  // Close handling
  const closeBtn = header.querySelector('.close-btn');
  closeBtn.onclick = () => {
    overlay.remove();
    if (onCancel) onCancel();
  };

  // Keyboard
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      overlay.remove();
      if (onCancel) onCancel();
      document.removeEventListener('keydown', onKeyDown);
      return;
    }

    const focused = document.activeElement;
    if (focused && focused.classList.contains('pexels-card')) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        focused.click();
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const cards = Array.from(content.querySelectorAll('.pexels-card'));
        const idx = cards.indexOf(focused);
        if (idx === -1) return;

        const grid = content.querySelector('.grid');
        if (!grid) return;
        const cols = grid.classList.contains('grid-cols-5') ? 5
          : grid.classList.contains('grid-cols-4') ? 4
          : grid.classList.contains('grid-cols-3') ? 3
          : 2;

        let next = idx;
        if (e.key === 'ArrowRight') next = Math.min(idx + 1, cards.length - 1);
        else if (e.key === 'ArrowLeft') next = Math.max(idx - 1, 0);
        else if (e.key === 'ArrowDown') next = Math.min(idx + cols, cards.length - 1);
        else if (e.key === 'ArrowUp') next = Math.max(idx - cols, 0);

        if (next !== idx && cards[next]) {
          cards[next].focus();
          cards[next].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
  }
  document.addEventListener('keydown', onKeyDown);

  // Loading skeleton
  function renderSkeleton() {
    content.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        ${Array.from({ length: 12 }).map(() => `
          <div class="rounded-xl overflow-hidden border border-white/5 bg-white/[0.02] aspect-square animate-pulse">
            <div class="w-full h-full bg-white/5"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Empty state
  function renderEmpty() {
    content.innerHTML = `
      <div class="flex flex-col items-center justify-center h-64 text-muted">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mb-4 opacity-30"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <div class="text-sm text-white/80">No results found</div>
        <div class="text-xs mt-1">Try a different search term</div>
      </div>
    `;
  }

  // Grid rendering
  function renderGrid(items) {
    content.innerHTML = '';

    if (items.length === 0) {
      renderEmpty();
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3';

    items.forEach(item => {
      const isVideo = item.type === 'video' || !!item.video_files;
      if (filterType === 'image' && isVideo) return;
      if (filterType === 'video' && !isVideo) return;

      const card = document.createElement('div');
      card.className = 'pexels-card relative group cursor-pointer rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all aspect-square bg-white/[0.02]';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', (item.alt || 'Media item') + ' by ' + (item.photographer || (item.user && item.user.name) || 'Pexels'));

      let mediaEl;
      if (isVideo) {
        const thumb = item.image || (item.video_pictures && item.video_pictures[0] && item.video_pictures[0].picture) || '';
        mediaEl = createSafeImage(thumb, item.alt || 'Video thumbnail', 'w-full h-full object-cover');
        const playBadge = document.createElement('div');
        playBadge.className = 'absolute inset-0 flex items-center justify-center pointer-events-none';
        playBadge.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="white" opacity="0.8"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
        card.appendChild(mediaEl);
        card.appendChild(playBadge);

        const badge = document.createElement('div');
        badge.className = 'absolute top-2 right-2 bg-[#d9ff00] px-1.5 py-0.5 rounded text-[9px] font-bold text-black';
        safeSetText(badge, 'VIDEO');
        card.appendChild(badge);
      } else {
        const avgColor = item.avg_color || '#1a1a1a';
        card.style.backgroundColor = avgColor;

        const shimmerEl = document.createElement('div');
        shimmerEl.className = 'absolute inset-0 z-[5] transition-opacity duration-500 ease-out';
        shimmerEl.style.backgroundColor = avgColor;
        shimmerEl.innerHTML = '<div class="w-full h-full shimmer-bg"></div>';
        card.appendChild(shimmerEl);

        const src = item.src?.medium || item.src?.small || item.url;
        mediaEl = createSafeImage(src, item.alt || 'Photo', 'w-full h-full object-cover relative z-10');
        mediaEl.loading = 'lazy';
        mediaEl.onload = () => {
          card.style.backgroundColor = '';
          if (shimmerEl) {
            shimmerEl.style.opacity = '0';
            setTimeout(() => { if (shimmerEl.parentNode) shimmerEl.remove(); }, 500);
          }
        };
        card.appendChild(mediaEl);

        const badge = document.createElement('div');
        badge.className = 'absolute top-2 right-2 bg-[#d9ff00]/15 px-1.5 py-0.5 rounded text-[9px] font-bold text-[#d9ff00] border border-[#d9ff00]/40 z-20';
        safeSetText(badge, 'PHOTO');
        card.appendChild(badge);
      }

      const overlay = document.createElement('div');
      overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3';

      const photographerEl = document.createElement('div');
      photographerEl.className = 'text-[10px] text-white/80 truncate';
      const photographer = item.photographer || (item.user && item.user.name) || '';
      safeSetText(photographerEl, photographer ? 'By ' + photographer : '');
      overlay.appendChild(photographerEl);

      card.appendChild(overlay);
      card.onclick = () => {
        previousGridItems = currentItems;
        selectedAsset = item;
        showPreview(item);
      };
      grid.appendChild(card);
    });

    content.appendChild(grid);

    // Load more sentinel
    if (hasMore) {
      const sentinel = document.createElement('div');
      sentinel.className = 'h-8 flex items-center justify-center';
      const spinner = document.createElement('div');
      spinner.className = 'animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full';
      sentinel.appendChild(spinner);
      content.appendChild(sentinel);

      const observer = new window.IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadContent(false);
        }
      }, { root: content, threshold: 0.1 });
      observer.observe(sentinel);
    }
  }

  // Preview overlay
  function showPreview(item) {
    const previewOverlay = document.createElement('div');
    previewOverlay.className = 'fixed inset-0 bg-black/90 z-[300] flex items-center justify-center p-4 md:p-8';
    previewOverlay.onclick = (e) => {
      if (e.target === previewOverlay) {
        if (window._pexelsHlsInstance) { window._pexelsHlsInstance.destroy(); window._pexelsHlsInstance = null; }
        previewOverlay.remove();
      }
    };

    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-5xl w-full flex flex-col items-center max-h-[90vh]';

    const topBar = document.createElement('div');
    topBar.className = 'w-full flex items-center gap-3 mb-4';

    const backBtn = document.createElement('button');
    backBtn.className = 'text-secondary hover:text-white transition-colors flex items-center gap-1 text-xs font-bold';
    backBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Back to results';
    backBtn.onclick = () => {
      previewOverlay.remove();
      if (window._pexelsHlsInstance) { window._pexelsHlsInstance.destroy(); window._pexelsHlsInstance = null; }
      if (previousGridItems) {
        currentItems = previousGridItems;
        previousGridItems = null;
        renderGrid(currentItems);
      }
    };
    topBar.appendChild(backBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ml-auto text-secondary hover:text-white transition-colors';
    closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.onclick = () => {
      if (window._pexelsHlsInstance) { window._pexelsHlsInstance.destroy(); window._pexelsHlsInstance = null; }
      previewOverlay.remove();
    };
    topBar.appendChild(closeBtn);
    wrapper.appendChild(topBar);

    const mediaType = item.type === 'video' || !!item.video_files ? 'video' : 'image';

    if (mediaType === 'video') {
      const videoFiles = item.video_files || [];
      const hlsFile = videoFiles.find(f => f.quality === 'hls');
      const hdFile = videoFiles.find(f => f.quality === 'hd');
      const sdFile = videoFiles.find(f => f.quality === 'sd');
      const defaultSrc = hlsFile ? hlsFile.link : (hdFile ? hdFile.link : (sdFile ? sdFile.link : videoFiles[0]?.link || ''));

      const qualityControls = document.createElement('div');
      qualityControls.className = 'flex items-center gap-2 mb-3';
      const qualityLabel = document.createElement('span');
      qualityLabel.className = 'text-[10px] text-secondary uppercase tracking-wider';
      safeSetText(qualityLabel, 'Quality:');
      qualityControls.appendChild(qualityLabel);

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
        if (q.v === defaultSrc) opt.selected = true;
        qualitySelect.appendChild(opt);
      });
      qualitySelect.onchange = () => {
        const newSrc = qualitySelect.value;
        if (newSrc.includes('.m3u8') && typeof window.Hls !== 'undefined' && window.Hls.isSupported()) {
          if (window._pexelsHlsInstance) { window._pexelsHlsInstance.destroy(); }
          const hls = new window.Hls();
          hls.loadSource(newSrc);
          hls.attachMedia(video);
          hls.on(window.Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
          window._pexelsHlsInstance = hls;
        } else {
          if (window._pexelsHlsInstance) { window._pexelsHlsInstance.destroy(); window._pexelsHlsInstance = null; }
          video.src = newSrc;
          video.play().catch(() => {});
        }
      };
      qualityControls.appendChild(qualitySelect);
      wrapper.appendChild(qualityControls);

      const video = document.createElement('video');
      video.controls = true;
      video.autoplay = true;
      video.loop = true;
      video.className = 'max-h-[70vh] rounded-xl';

      const isHlsSrc = defaultSrc.includes('.m3u8');
      if (isHlsSrc) {
        if (typeof window.Hls !== 'undefined' && window.Hls.isSupported()) {
          const hls = new window.Hls();
          hls.loadSource(defaultSrc);
          hls.attachMedia(video);
          hls.on(window.Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = defaultSrc;
        } else {
          const fallback = hdFile ? hdFile.link : (sdFile ? sdFile.link : videoFiles[0]?.link || '');
          video.src = fallback;
        }
      } else {
        video.src = defaultSrc;
      }

      wrapper.appendChild(video);
    } else {
      const src = item.src?.large || item.src?.original || item.url;
      const img = createSafeImage(src, item.alt || 'Pexels photo', 'max-h-[70vh] rounded-xl object-contain');
      wrapper.appendChild(img);
    }

    // Attribution
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

    // Action buttons
    const actionsRow = document.createElement('div');
    actionsRow.className = 'mt-4 flex items-center gap-2 flex-wrap justify-center';

    const downloadUrl = (mediaType === 'video' && item.video_files && item.video_files.length)
      ? (item.video_files.find(f => f.quality === 'hd') || item.video_files[0]).link
      : (item.src?.original || item.src?.large || item.url);

    if (downloadUrl) {
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn-secondary-modern px-4 py-2.5 rounded-xl font-bold text-xs hover:shadow-glow transition-all flex items-center gap-2';
      downloadBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Download';
      downloadBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
          if (onDownload) {
            await onDownload(item, downloadUrl);
          } else {
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = (item.alt || 'pexels-media').replace(/[^a-z0-9]+/gi, '-').slice(0, 64);
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
          showToast('Downloading...', 'success');
        } catch (err) {
          console.error('Download failed:', err);
          showToast('Download failed. Try opening the file in a new tab.', 'error');
        }
      };
      actionsRow.appendChild(downloadBtn);
    }

    const useInStudioBtn = document.createElement('button');
    useInStudioBtn.className = 'btn-secondary-modern px-8 py-2.5 rounded-xl font-bold text-sm hover:shadow-glow transition-all';
    safeSetText(useInStudioBtn, 'Use in ' + studioName);
    useInStudioBtn.onclick = () => {
      if (window._pexelsHlsInstance) { window._pexelsHlsInstance.destroy(); window._pexelsHlsInstance = null; }
      if (onSelect) onSelect(item);
      previewOverlay.remove();
    };
    actionsRow.appendChild(useInStudioBtn);

    wrapper.appendChild(actionsRow);

    previewOverlay.appendChild(wrapper);
    document.body.appendChild(previewOverlay);

    // Focus trap
    previewOverlay.focus();
  }

  // Load content
  async function loadContent(reset) {
    if (isLoading) return;
    if (!reset && !hasMore) return;

    isLoading = true;
    if (reset) renderSkeleton();

    try {
      let newItems = [];
      let nextPage = null;

      if (activeTab === 'search' && searchQuery) {
        if (filterType === 'video' || (!filterType && accept.includes('video'))) {
          const videoParams = {
            query: searchQuery,
            page: currentPage,
            per_page: 20,
          };
          if (orientation) videoParams.orientation = orientation;
          if (size) videoParams.size = size;
          const data = await searchVideos(videoParams);
          newItems = (data.videos || []).map(v => Object.assign({}, v, { type: 'video' }));
          nextPage = data.next_page || null;
        }
        if (filterType === 'image' || (!filterType && accept.includes('image'))) {
          const photoParams = {
            query: searchQuery,
            page: currentPage,
            per_page: 20,
          };
          if (orientation) photoParams.orientation = orientation;
          if (size) photoParams.size = size;
          if (color) photoParams.color = color;
          const data = await searchPhotos(photoParams);
          const photos = (data.photos || []).map(p => Object.assign({}, p, { type: 'photo' }));
          if (!filterType) newItems = newItems.concat(photos);
          else newItems = photos;
          nextPage = data.next_page || nextPage;
        }
      } else if (activeTab === 'curated') {
        const data = await getCuratedPhotos({ page: currentPage, per_page: 20 });
        newItems = (data.photos || []).map(p => Object.assign({}, p, { type: 'photo' }));
        nextPage = data.next_page || null;
      } else if (activeTab === 'popular') {
        const data = await getPopularVideos({ page: currentPage, per_page: 20 });
        newItems = (data.videos || []).map(v => Object.assign({}, v, { type: 'video' }));
        nextPage = data.next_page || null;
      } else if (activeTab === 'collections' || activeTab === 'my-collections') {
        const collections = activeTab === 'my-collections'
          ? await getMyCollections({ page: currentPage, per_page: 20 })
          : await getFeaturedCollections({ page: currentPage, per_page: 20 });
        // Show collections as cards
        content.innerHTML = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">' +
          (collections.collections || []).map(c => `
            <div class="collection-card cursor-pointer rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all aspect-video bg-white/[0.02] p-4 flex flex-col justify-end" data-id="${c.id}" data-title="${escapeHtml(c.title)}">
              <div class="text-xs font-bold text-white">${escapeHtml(c.title)}</div>
              <div class="text-[10px] text-muted mt-1">${c.media_count || 0} items</div>
            </div>
          `).join('') + '</div>';
        
        content.querySelectorAll('.collection-card').forEach(card => {
          card.onclick = async () => {
            const collectionId = card.dataset.id;
            const media = await getCollectionMedia(collectionId, { type: filterType || undefined, sort: 'asc', page: 1, per_page: 40 });
            const items = (media.media || []).map(m => Object.assign({}, m, { type: m.type === 'Video' ? 'video' : 'photo' }));
            renderGrid(items);
          };
        });
        isLoading = false;
        return;
      }

      if (reset) {
        currentItems = newItems;
      } else {
        currentItems = currentItems.concat(newItems);
      }

      hasMore = Boolean(nextPage);
      currentPage = hasMore ? currentPage + 1 : currentPage;
      renderGrid(currentItems);
    } catch (err) {
      console.error('Pexels browser error:', err);
      content.innerHTML = `
        <div class="flex flex-col items-center justify-center h-64 text-muted">
          <div class="text-sm text-white/80 mb-2">Failed to load media</div>
          <button class="px-4 py-2 rounded-xl bg-white/5 text-xs font-bold hover:bg-white/10 transition-all retry-btn">Retry</button>
        </div>
      `;
      content.querySelector('.retry-btn').onclick = () => loadContent(true);
    } finally {
      isLoading = false;
    }
  }

  // Initial load
  if (activeTab === 'search' && !searchQuery) {
    // Show curated/popular by default
    activeTab = 'curated';
  }
  loadContent(true);

  document.body.appendChild(overlay);
  return overlay;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
