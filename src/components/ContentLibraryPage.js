import { mountStudioChrome } from '../lib/studioChrome.js';
import { createUploadPicker } from '../components/UploadPicker.js';
import { createSafeVideo, createSafeImage, safeSetText } from '../lib/security.js';
import { listContentLibrary, saveContentLibraryEntry, deleteFromContentLibrary } from '../lib/contentLibrary.js';

export function ContentLibraryPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-hidden';

  let activeFilter = 'all';
  let searchQuery = '';
  let contentItems = [];
  let isLoading = true;

  // Studio chrome
  mountStudioChrome(container, { currentRoute: 'content-library', title: 'Content Library' });

  // Hero banner
  const hero = document.createElement('div');
  hero.className = 'relative w-full h-32 md:h-44 rounded-2xl overflow-hidden mb-4';
  hero.innerHTML = '<div class="absolute inset-0 bg-gradient-to-br from-primary/20 via-app-bg to-accent/20"></div>';
  const heroOverlay = document.createElement('div');
  heroOverlay.className = 'absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent';
  hero.appendChild(heroOverlay);
  const heroText = document.createElement('div');
  heroText.className = 'absolute bottom-0 left-0 right-0 p-4 z-10';
  heroText.innerHTML = '<h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Content Library</h1><p class="text-white/60 text-xs">Upload and manage PDFs and webinar replays</p>';
  hero.appendChild(heroText);

  const topBar = document.createElement('div');
  topBar.className = 'px-4 md:px-8 pt-6 pb-4 shrink-0';
  topBar.appendChild(hero);

  // Controls
  const controls = document.createElement('div');
  controls.className = 'flex items-center gap-3 flex-wrap mt-4';

  // Upload button
  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-primary text-black hover:shadow-glow flex items-center gap-2';
  uploadBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload';
  controls.appendChild(uploadBtn);

  // Filter tabs
  const filters = ['all', 'images', 'pdfs', 'videos'];
  const filterBtns = {};
  filters.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'px-4 py-2 rounded-full text-xs font-bold transition-all';
    safeSetText(btn, f.charAt(0).toUpperCase() + f.slice(1));
    btn.onclick = () => { activeFilter = f; updateFilters(); renderGrid(); };
    filterBtns[f] = btn;
    controls.appendChild(btn);
  });

  // Search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search by filename...';
  searchInput.className = 'ml-auto bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors w-48';
  searchInput.oninput = () => { searchQuery = searchInput.value.toLowerCase(); renderGrid(); };
  controls.appendChild(searchInput);

  topBar.appendChild(controls);
  container.appendChild(topBar);

  // Status bar
  const statusBar = document.createElement('div');
  statusBar.className = 'px-4 md:px-8 pb-2 shrink-0';
  const statusText = document.createElement('div');
  statusText.className = 'text-xs text-muted';
  statusBar.appendChild(statusText);
  container.appendChild(statusBar);

  // Grid area
  const gridArea = document.createElement('div');
  gridArea.className = 'flex-1 overflow-y-auto px-4 md:px-8 pb-8';
  container.appendChild(gridArea);

  // Preview overlay
  const previewOverlay = document.createElement('div');
  previewOverlay.className = 'fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-8 hidden';
  previewOverlay.onclick = (e) => {
    if (e.target === previewOverlay) previewOverlay.classList.add('hidden');
  };
  container.appendChild(previewOverlay);

  // Upload picker setup
  const uploadPicker = createUploadPicker({
    anchorContainer: uploadBtn,
    onSelect: async ({ url, urls }) => {
      const urlsToSave = urls || (url ? [url] : []);
      for (const uploadedUrl of urlsToSave) {
        await saveContentLibraryEntry(uploadedUrl);
      }
      await refreshContent();
    },
    onClear: () => {},
    maxImages: 10,
    acceptVideo: true,
  });

  // Wire the upload picker trigger into the visible controls
  controls.insertBefore(uploadPicker.trigger, uploadBtn.nextSibling);
  container.appendChild(uploadPicker.panel);

  function updateFilters() {
    Object.entries(filterBtns).forEach(([key, btn]) => {
      btn.className = key === activeFilter
        ? 'px-4 py-2 rounded-full text-xs font-bold transition-all bg-primary text-black'
        : 'px-4 py-2 rounded-full text-xs font-bold transition-all bg-white/5 text-secondary hover:bg-white/10';
    });
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function getFileIcon(type) {
    if (type === 'pdf') {
      return '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-red-400"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
    }
    return '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-blue-400"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';
  }

  function renderGrid() {
    let items = contentItems;

    if (activeFilter === 'images') items = items.filter(i => i.type === 'image' || (!i.type && /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(i.filename || '')));
    else if (activeFilter === 'pdfs') items = items.filter(i => i.type === 'pdf');
    else if (activeFilter === 'videos') items = items.filter(i => i.type === 'video');

    if (searchQuery) {
      items = items.filter(i => (i.filename || '').toLowerCase().includes(searchQuery));
    }

    // Update status
    safeSetText(statusText, `${items.length} item${items.length !== 1 ? 's' : ''}${activeFilter !== 'all' ? ` in ${activeFilter}` : ''}`);

    gridArea.innerHTML = '';

    if (isLoading) {
      gridArea.innerHTML = `
        <div class="flex flex-col items-center justify-center h-64 text-muted">
          <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-4"></div>
          <div class="text-sm">Loading content library...</div>
        </div>
      `;
      return;
    }

    if (items.length === 0) {
      gridArea.innerHTML = `
        <div class="flex flex-col items-center justify-center h-64 text-muted">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mb-4 opacity-30"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          <div class="text-sm">No content yet</div>
          <div class="text-xs mt-1">Upload PDFs and videos to get started</div>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'relative group cursor-pointer rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all aspect-square bg-white/[0.02] flex flex-col';

      // Media preview
      if (item.type === 'video') {
        const video = createSafeVideo(item.url, 'w-full h-full object-cover');
        card.appendChild(video);

        // Badge
        const badge = document.createElement('div');
        badge.className = 'absolute top-2 right-2 bg-blue-500/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-white';
        safeSetText(badge, 'VIDEO');
        card.appendChild(badge);
      } else if (item.type === 'image') {
        const img = createSafeImage(item.url, item.filename || 'Image', 'w-full h-full object-cover');
        img.loading = 'lazy';
        card.appendChild(img);

        const badge = document.createElement('div');
        badge.className = 'absolute top-2 right-2 bg-emerald-500/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-white';
        safeSetText(badge, 'IMAGE');
        card.appendChild(badge);
      } else {
        // PDF - show icon
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'w-full h-full flex items-center justify-center bg-white/5';
        iconWrapper.innerHTML = getFileIcon('pdf');
        card.appendChild(iconWrapper);

        // Badge
        const badge = document.createElement('div');
        badge.className = 'absolute top-2 right-2 bg-red-500/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-white';
        safeSetText(badge, 'PDF');
        card.appendChild(badge);
      }

      // Pexels badge for stock media
      if (item.source === 'pexels') {
        const pexelsBadge = document.createElement('div');
        pexelsBadge.className = 'absolute bottom-2 right-2 bg-emerald-500/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-white';
        safeSetText(pexelsBadge, 'PEXELS');
        card.appendChild(pexelsBadge);
      }

      // Overlay
      const overlay = document.createElement('div');
      overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3';

      const filenameEl = document.createElement('div');
      filenameEl.className = 'text-[10px] text-white/80 truncate';
      safeSetText(filenameEl, item.filename || 'Untitled');
      overlay.appendChild(filenameEl);

      const sizeEl = document.createElement('div');
      sizeEl.className = 'text-[9px] text-white/40 mt-0.5';
      safeSetText(sizeEl, formatFileSize(item.size || 0));
      overlay.appendChild(sizeEl);

      card.appendChild(overlay);

      // Click to preview
      card.onclick = () => showPreview(item);

      // Delete button (shown on hover)
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'absolute top-2 left-2 bg-red-500/80 hover:bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity';
      deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${item.filename}"?`)) {
          deleteFromContentLibrary(item.id)
            .then(() => refreshContent())
            .catch((err) => alert(`Failed to delete: ${err.message}`));
        }
      };
      card.appendChild(deleteBtn);

      grid.appendChild(card);
    });

    gridArea.appendChild(grid);
  }

  function showPreview(item) {
    previewOverlay.classList.remove('hidden');
    previewOverlay.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-4xl w-full flex flex-col items-center';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'self-end mb-4 text-secondary hover:text-white transition-colors';
    closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.onclick = () => previewOverlay.classList.add('hidden');
    wrapper.appendChild(closeBtn);

    if (item.type === 'pdf') {
      const embed = document.createElement('embed');
      embed.src = item.url;
      embed.type = 'application/pdf';
      embed.className = 'w-full max-h-[75vh] rounded-xl bg-white';
      wrapper.appendChild(embed);
    } else if (item.type === 'image') {
      const img = createSafeImage(item.url, item.filename || 'Image', 'max-h-[75vh] rounded-xl object-contain');
      wrapper.appendChild(img);
    } else {
      const video = document.createElement('video');
      video.src = item.url;
      video.controls = true;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.className = 'max-h-[75vh] rounded-xl';
      wrapper.appendChild(video);
    }

    // Info
    const info = document.createElement('div');
    info.className = 'mt-4 text-center';

    const filenameEl = document.createElement('div');
    filenameEl.className = 'text-sm text-white mb-1';
    safeSetText(filenameEl, item.filename || 'Untitled');
    info.appendChild(filenameEl);

    if (item.attribution) {
      const attributionEl = document.createElement('div');
      attributionEl.className = 'text-xs text-muted';
      safeSetText(attributionEl, item.attribution);
      info.appendChild(attributionEl);
    }

    const sizeEl = document.createElement('div');
    sizeEl.className = 'text-xs text-muted';
    safeSetText(sizeEl, formatFileSize(item.size || 0));
    info.appendChild(sizeEl);

    wrapper.appendChild(info);

    // Download button
    const dlBtn = document.createElement('a');
    dlBtn.href = item.url;
    dlBtn.download = item.filename || 'download';
    dlBtn.className = 'mt-4 bg-primary text-black px-8 py-2.5 rounded-xl font-bold text-sm hover:shadow-glow transition-all inline-flex items-center gap-2';
    dlBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download';
    wrapper.appendChild(dlBtn);

    previewOverlay.appendChild(wrapper);
  }

  async function refreshContent() {
    isLoading = true;
    renderGrid();
    contentItems = await listContentLibrary();
    isLoading = false;
    renderGrid();
  }

  // Initial load - trigger async refresh after mount
  updateFilters();
  refreshContent();

  return container;
}
