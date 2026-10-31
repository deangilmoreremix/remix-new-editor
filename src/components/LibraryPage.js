import { getPageThumbnail, createThumbnailImg } from '../lib/thumbnails.js';
import { createSafeImage, createSafeVideo, safeSetText } from '../lib/security.js';
import { MediaDetailView } from './MediaDetailView.js';
import { loadGenerationHistory } from '../lib/generationHistory.js';
import { queueAssetForStudio } from './UploadPicker.js';

// Studios that accept an Asset Library reference handed over from the Library.
// Ids match the `studioId` passed to createUploadPicker() by each studio.
const MUAPI_STUDIOS = [
  { id: 'effects-studio', name: 'Effects Studio' },
  { id: 'edit-studio', name: 'Edit Studio' },
  { id: 'upscale-studio', name: 'Upscale Studio' },
  { id: 'video-tools-studio', name: 'Video Tools' },
  { id: 'cinema-studio', name: 'Cinema Studio' },
  { id: 'storyboard-studio', name: 'Storyboard Studio' },
  { id: 'audio-studio', name: 'Audio Studio' },
  { id: 'image-studio', name: 'Image Studio' },
  { id: 'element-library', name: 'Elements' },
];

export function LibraryPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-hidden';

  let activeFilter = 'all';
  let searchQuery = '';

  const topBar = document.createElement('div');
  topBar.className = 'px-4 md:px-8 pt-6 pb-4 shrink-0';
  const libThumb = getPageThumbnail('library');
  if (libThumb) {
    const bannerWrapper = document.createElement('div');
    bannerWrapper.className = 'relative w-full h-32 md:h-44 rounded-2xl overflow-hidden mb-4';
    bannerWrapper.innerHTML = '<div class="thumb-skeleton absolute inset-0"></div>';
    const img = createThumbnailImg(libThumb, 'Library', 'w-full h-full object-cover');
    bannerWrapper.appendChild(img);
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent';
    bannerWrapper.appendChild(overlay);
    const textOverlay = document.createElement('div');
    textOverlay.className = 'absolute bottom-0 left-0 right-0 p-4 z-10';
    textOverlay.innerHTML = '<h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Library</h1><p class="text-white/60 text-xs">All your generated images and videos</p>';
    bannerWrapper.appendChild(textOverlay);
    topBar.appendChild(bannerWrapper);
  } else {
    topBar.innerHTML = '<h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Library</h1><p class="text-secondary text-xs mb-4">All your generated images and videos</p>';
  }

  const controls = document.createElement('div');
  controls.className = 'flex items-center gap-3 flex-wrap';

  // 'uploads' is the permanent Asset Library view (durable uploaded files) —
  // it only ever shows permanent storage references, never expiring URLs.
  const filters = ['all', 'images', 'videos', 'uploads', 'templates'];
  const filterBtns = {};
  filters.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'px-4 py-2 rounded-full text-xs font-bold transition-all';
    btn.textContent = f === 'uploads' ? 'Uploads' : f.charAt(0).toUpperCase() + f.slice(1);
    btn.onclick = () => { activeFilter = f; updateFilters(); renderGrid(); };
    filterBtns[f] = btn;
    controls.appendChild(btn);
  });

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search by prompt...';
  searchInput.className = 'ml-auto bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors w-48';
  searchInput.oninput = () => { searchQuery = searchInput.value.toLowerCase(); renderGrid(); };
  controls.appendChild(searchInput);

  topBar.appendChild(controls);
  container.appendChild(topBar);

  const gridArea = document.createElement('div');
  gridArea.className = 'flex-1 overflow-y-auto px-4 md:px-8 pb-8';
  container.appendChild(gridArea);

  async function loadHistory() {
    // Loads from Supabase (cloud) + localStorage (local), merged and deduplicated.
    let items;

    try {
      items = await loadGenerationHistory();
    } catch (e) {
      // Fallback: read localStorage only
      let imageHistory = [];
      let videoHistory = [];
      try { imageHistory = JSON.parse(localStorage.getItem('muapi_history') || '[]'); } catch (e) { /* ignore */ }
      try { videoHistory = JSON.parse(localStorage.getItem('video_history') || '[]'); } catch (e) { /* ignore */ }
      items = [
        ...imageHistory.map(h => ({ ...h, type: h.type || 'image' })),
        ...videoHistory.map(h => ({ ...h, type: 'video' })),
      ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    }

    // Fold in MuAPI's own history when a key is configured (best-effort).
    try {
      const { apiKeyManager } = await import('../lib/apiKeyManager.js');
      if (apiKeyManager.getKey()) {
        const [{ muapi }, { fetchServerHistory, mergeServerHistory }] = await Promise.all([
          import('../lib/muapi.js'),
          import('../lib/serverHistory.js'),
        ]);
        items = mergeServerHistory(items, (await fetchServerHistory(muapi)).filter((i) => i.type !== 'audio'));
      }
    } catch { /* server history is optional */ }

    return items;
  }

  function updateFilters() {
    Object.entries(filterBtns).forEach(([key, btn]) => {
      btn.className = key === activeFilter
        ? 'px-4 py-2 rounded-full text-xs font-bold transition-all btn-secondary-modern'
        : 'px-4 py-2 rounded-full text-xs font-bold transition-all bg-white/5 text-secondary hover:bg-white/10';
    });
  }

  async function renderGrid() {
    let items = await loadHistory();

    if (activeFilter === 'uploads') {
      await renderUploads();
      return;
    }

    if (activeFilter === 'images') items = items.filter(i => i.type === 'image' || !i.type);
    else if (activeFilter === 'videos') items = items.filter(i => i.type === 'video');
    else if (activeFilter === 'templates') items = items.filter(i => i.template || i.parameters?.template_id);

    if (searchQuery) {
      items = items.filter(i => (i.prompt || '').toLowerCase().includes(searchQuery));
    }

    gridArea.innerHTML = '';

    if (items.length === 0) {
      gridArea.innerHTML = `
        <div class="flex flex-col items-center justify-center h-64 text-muted">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mb-4 opacity-30"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
          <div class="text-sm">No generations yet</div>
          <div class="text-xs mt-1">Your creations will appear here</div>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'relative group cursor-pointer rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all aspect-square bg-white/[0.02]';

      if (item.type === 'video') {
        const video = createSafeVideo(item.url, 'w-full h-full object-cover');
        card.appendChild(video);
        
        const badge = document.createElement('div');
        badge.className = 'absolute top-2 right-2 bg-blue-500/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-white';
        badge.textContent = 'VIDEO';
        card.appendChild(badge);
      } else {
        const img = createSafeImage(item.url, 'Generated image', 'w-full h-full object-cover');
        img.loading = 'lazy';
        card.appendChild(img);
      }

      const overlay = document.createElement('div');
      overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3';
      
      const promptText = document.createElement('div');
      promptText.className = 'text-[10px] text-white/80 truncate';
      promptText.textContent = item.prompt || item.template || 'Generated';
      overlay.appendChild(promptText);
      
      const modelText = document.createElement('div');
      modelText.className = 'text-[9px] text-white/40 mt-0.5';
      modelText.textContent = item.model || '';
      overlay.appendChild(modelText);
      
      card.appendChild(overlay);

      card.onclick = () => showPreview(item);
      grid.appendChild(card);
    });

    gridArea.appendChild(grid);
  }

  // ── Uploads / Assets (permanent Asset Library) ────────────────────────────
  let cachedAssets = [];

  async function loadAssets() {
    try {
      const { listAssets } = await import('../lib/assetLibrary.js');
      const { getMuapiAuthContext } = await import('../lib/muapiStudioMedia.js');
      const auth = await getMuapiAuthContext();
      return await listAssets(auth, {});
    } catch {
      return [];
    }
  }

  async function renderUploads() {
    gridArea.innerHTML = '<div class="text-muted text-xs">Loading your uploads…</div>';
    cachedAssets = await loadAssets();

    gridArea.innerHTML = '';

    if (cachedAssets.length === 0) {
      gridArea.innerHTML = `
        <div class="flex flex-col items-center justify-center h-64 text-muted">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mb-4 opacity-30"><path d="M16 16l-4-4-4 4"/><path d="M12 12v9"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>
          <div class="text-sm">No uploaded assets yet</div>
          <div class="text-xs mt-1">Files you upload in a studio are stored here permanently</div>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3';

    cachedAssets.forEach(asset => {
      const card = document.createElement('div');
      card.className = 'relative group rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all bg-white/[0.02]';

      const mediaWrap = document.createElement('div');
      mediaWrap.className = 'aspect-square';
      if (asset.category === 'image') {
        const img = createSafeImage(asset.url, asset.name, 'w-full h-full object-cover');
        img.loading = 'lazy';
        mediaWrap.appendChild(img);
      } else if (asset.category === 'video') {
        mediaWrap.appendChild(createSafeVideo(asset.url, 'w-full h-full object-cover'));
      } else {
        mediaWrap.innerHTML = '<div class="w-full h-full flex items-center justify-center text-muted text-[10px] uppercase font-bold tracking-widest">File</div>';
      }
      card.appendChild(mediaWrap);

      const overlay = document.createElement('div');
      overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2';

      const nameText = document.createElement('div');
      nameText.className = 'text-[10px] text-white/80 truncate';
      nameText.textContent = asset.name;
      overlay.appendChild(nameText);

      const actions = document.createElement('div');
      actions.className = 'flex items-center gap-2';

      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'px-2 py-1 rounded-lg bg-primary/90 text-black text-[10px] font-bold hover:bg-primary transition-all';
      useBtn.textContent = 'Use in studio';
      useBtn.onclick = (e) => { e.stopPropagation(); showUseInStudio(asset); };
      actions.appendChild(useBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'px-2 py-1 rounded-lg bg-rose-500/80 text-white text-[10px] font-bold hover:bg-rose-500 transition-all';
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = (e) => { e.stopPropagation(); deleteUpload(asset, card); };
      actions.appendChild(deleteBtn);

      overlay.appendChild(actions);
      card.appendChild(overlay);
      grid.appendChild(card);
    });

    gridArea.appendChild(grid);
  }

  async function deleteUpload(asset, card) {
    try {
      const { deleteAsset } = await import('../lib/assetLibrary.js');
      const { getMuapiAuthContext } = await import('../lib/muapiStudioMedia.js');
      const auth = await getMuapiAuthContext();
      await deleteAsset(asset.id, auth);
      card.remove();
      cachedAssets = cachedAssets.filter(a => a.id !== asset.id);
      if (cachedAssets.length === 0) renderUploads();
    } catch {
      // leave the card in place on failure
    }
  }

  // Hands the asset id to the chosen studio's picker. A studio that is already
  // mounted receives it immediately; otherwise it is queued for the studio's
  // next mount. The studio resolves a FRESH upload URL from the id — the
  // permanent reference is what travels, never a temporary URL.
  function showUseInStudio(asset) {
    const chooser = document.createElement('div');
    chooser.className = 'fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4';

    const dialog = document.createElement('div');
    dialog.className = 'w-full max-w-sm bg-[#141418] border border-white/10 rounded-2xl p-5 shadow-2xl';

    const dialogTitle = document.createElement('div');
    dialogTitle.className = 'text-sm font-bold text-white mb-1';
    dialogTitle.textContent = 'Use in studio';
    dialog.appendChild(dialogTitle);

    const dialogHint = document.createElement('div');
    dialogHint.className = 'text-[11px] text-muted mb-4';
    dialogHint.textContent = asset.name;
    dialog.appendChild(dialogHint);

    MUAPI_STUDIOS.forEach(studio => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'w-full text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all mb-2';
      option.textContent = studio.name;
      option.onclick = async () => {
        const { selectAssetInStudio } = await import('./UploadPicker.js');
        const accepted = await selectAssetInStudio(studio.id, asset);
        if (!accepted) {
          queueAssetForStudio(studio.id, asset.id);
          try {
            const { navigate } = await import('../lib/router.js');
            navigate(studio.id);
          } catch { /* navigation unavailable — the asset stays queued */ }
        }
        chooser.remove();
      };
      dialog.appendChild(option);
    });

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'w-full px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-secondary text-xs font-bold transition-all';
    cancel.textContent = 'Cancel';
    cancel.onclick = () => chooser.remove();
    dialog.appendChild(cancel);

    chooser.appendChild(dialog);
    chooser.addEventListener('click', (e) => { if (e.target === chooser) chooser.remove(); });
    document.body.appendChild(chooser);
  }

  function showPreview(item) {
    const detailView = new MediaDetailView({
      mediaUrl: item.url,
      mediaType: item.type === 'video' ? 'video' : 'image',
      title: item.prompt || item.template || 'Generated',
      prompt: item.prompt || '',
      model: item.model || '',
      source: item.template || '',
      author: item.author || '',
      category: item.category || '',
      date: item.timestamp || '',
      tags: item.tags || [],
      relatedItems: [],
      actions: [
        {
          id: 'download',
          label: 'Download',
          onClick: () => {
            const a = document.createElement('a');
            a.href = item.url;
            a.download = `generation-${item.id || Date.now()}`;
            a.click();
          },
        },
      ],
    });
    detailView.show();
  }

  updateFilters();
  renderGrid();

  // Loading indicator while cloud data is being fetched
  const loadingEl = document.createElement('div');
  loadingEl.className = 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted text-xs';
  loadingEl.innerHTML = 'Loading your library…';
  gridArea.appendChild(loadingEl);
  setTimeout(() => { if (loadingEl.parentNode) loadingEl.remove(); }, 3000);

  return container;
}
