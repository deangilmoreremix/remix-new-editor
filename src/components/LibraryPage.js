import { createStudioHeader } from '../lib/thumbnails.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { loadGenerationHistory, confirmDeleteGeneration } from '../lib/generationHistory.js';
import { showToast } from '../lib/loading.js';
import { createSafeImage, createSafeVideo, safeSetText } from '../lib/security.js';
import { MediaDetailView } from './MediaDetailView.js';
import { queueAssetForStudio } from './UploadPicker.js';

// Studios that accept an Asset Library reference handed over from the Library.
// Ids match the `studioId` passed to createUploadPicker() by each studio.
const MUAPI_STUDIOS = [
  { id: 'image-studio', route: 'image', name: 'Image Studio' },
  { id: 'edit-studio', route: 'edit', name: 'Edit Studio' },
  { id: 'upscale-studio', route: 'upscale', name: 'Upscale Suite' },
  { id: 'effects-studio', route: 'effects', name: 'Vibe Motion' },
  { id: 'cinema-studio', route: 'cinema', name: 'Cinema Studio' },
  { id: 'storyboard-studio', route: 'storyboard', name: 'Storyboard Studio' },
  { id: 'video-tools-studio', route: 'videotools', name: 'Video Tools' },
  { id: 'audio-studio', route: 'audio', name: 'Audio Studio' },
];

export function LibraryPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-hidden';
  mountStudioChrome(container, { currentRoute: 'library' });

  let activeFilter = 'all';
  let searchQuery = '';
  let sortOrder = 'newest';
  let historyCache = null;

  const topBar = document.createElement('div');
  topBar.className = 'px-4 md:px-8 pb-4 shrink-0';
  topBar.appendChild(createStudioHeader('library', 'Library', 'Everything you have generated and uploaded, in one place', 'mb-4'));

  const controls = document.createElement('div');
  controls.className = 'flex items-center gap-2 flex-wrap';

  // 'uploads' is the permanent Asset Library view (durable uploaded files) —
  // it only ever shows permanent storage references, never expiring URLs.
  const FILTERS = [
    ['all', 'All'],
    ['images', 'Images'],
    ['videos', 'Videos'],
    ['audio', 'Audio'],
    ['uploads', 'Uploads'],
  ];
  const filterBtns = {};
  FILTERS.forEach(([f, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.libraryFilter = f;
    btn.className = 'px-4 py-2 rounded-full text-xs font-bold transition-all';
    btn.dataset.label = label;
    btn.textContent = label;
    btn.onclick = () => { activeFilter = f; updateFilters(); renderGrid(); };
    filterBtns[f] = btn;
    controls.appendChild(btn);
  });

  const right = document.createElement('div');
  right.className = 'ml-auto flex items-center gap-2';
  const sortSelect = document.createElement('select');
  sortSelect.className = 'bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none';
  sortSelect.innerHTML = '<option value="newest">Newest first</option><option value="oldest">Oldest first</option>';
  sortSelect.onchange = () => { sortOrder = sortSelect.value; renderGrid(); };
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search by prompt or model...';
  searchInput.className = 'bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors w-56';
  searchInput.oninput = () => { searchQuery = searchInput.value.toLowerCase(); renderGrid(); };
  right.append(sortSelect, searchInput);
  controls.appendChild(right);

  topBar.appendChild(controls);
  container.appendChild(topBar);

  const gridArea = document.createElement('div');
  gridArea.className = 'flex-1 overflow-y-auto px-4 md:px-8 pb-8';
  container.appendChild(gridArea);

  async function loadHistory() {
    if (historyCache) return historyCache;
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
        ...videoHistory.map(h => ({ ...h, type: h.type === 'audio' ? 'audio' : 'video' })),
      ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    }

    historyCache = items;
    updateCounts(items);
    return items;
  }

  const typeOf = (i) => (i.type === 'video' || i.type === 'audio' ? i.type : 'image');

  function updateCounts(items) {
    const counts = { all: items.length, images: 0, videos: 0, audio: 0 };
    items.forEach((i) => {
      const t = typeOf(i);
      if (t === 'image') counts.images++;
      else if (t === 'video') counts.videos++;
      else counts.audio++;
    });
    Object.entries(counts).forEach(([k, n]) => {
      const btn = filterBtns[k];
      if (btn) btn.textContent = `${btn.dataset.label} · ${n}`;
    });
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

    if (activeFilter === 'images') items = items.filter(i => typeOf(i) === 'image');
    else if (activeFilter === 'videos') items = items.filter(i => typeOf(i) === 'video');
    else if (activeFilter === 'audio') items = items.filter(i => typeOf(i) === 'audio');

    if (searchQuery) {
      items = items.filter(i => `${i.prompt || ''} ${i.model || ''} ${i.template || ''}`.toLowerCase().includes(searchQuery));
    }
    if (sortOrder === 'oldest') items = [...items].reverse();

    gridArea.innerHTML = '';

    if (items.length === 0) {
      gridArea.innerHTML = `
        <div class="flex flex-col items-center justify-center h-64 text-muted">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mb-4 opacity-30"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
          <div class="text-sm">${searchQuery || activeFilter !== 'all' ? 'Nothing matches this filter' : 'No generations yet'}</div>
          <div class="text-xs mt-1">${searchQuery || activeFilter !== 'all' ? 'Try another filter or search' : 'Everything you create in any studio is saved here automatically'}</div>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'relative group cursor-pointer rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all aspect-square bg-white/[0.02]';

      if (typeOf(item) === 'audio') {
        const wrap = document.createElement('div');
        wrap.className = 'w-full h-full flex flex-col items-center justify-center gap-2 p-3 bg-gradient-to-br from-purple-500/10 to-transparent';
        wrap.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-purple-300"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = item.url;
        audio.className = 'w-full';
        audio.onclick = (e) => e.stopPropagation();
        wrap.appendChild(audio);
        card.appendChild(wrap);
      } else if (item.type === 'video') {
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

      // Quick actions (top-left, on hover): download, copy prompt, delete.
      const quick = document.createElement('div');
      quick.className = 'absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity';
      const mk = (label, svg, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.title = label;
        b.setAttribute('aria-label', label);
        b.dataset.libraryAction = label.toLowerCase();
        b.className = 'w-7 h-7 rounded-lg bg-black/70 hover:bg-black text-white flex items-center justify-center';
        b.innerHTML = svg;
        b.onclick = (e) => { e.stopPropagation(); fn(); };
        quick.appendChild(b);
      };
      mk('Download', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>', () => downloadItem(item));
      if (item.prompt) {
        mk('Copy prompt', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>', () => {
          navigator.clipboard?.writeText(item.prompt).then(() => showToast('Prompt copied', 'success')).catch(() => {});
        });
      }
      mk('Save', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>', async () => {
        const { saveToContent } = await import('../lib/contentLibrary.js');
        saveToContent({ url: item.url, type: typeOf(item), prompt: item.prompt || '', model: item.model || '', studio: item.studio || '' });
        showToast('Saved to Content', 'success');
      });
      mk('Delete', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>', () => {
        if (!confirmDeleteGeneration(item.url, item.type)) return;
        historyCache = (historyCache || []).filter((i) => i.url !== item.url);
        updateCounts(historyCache);
        renderGrid();
      });
      card.appendChild(quick);

      card.onclick = () => { if (typeOf(item) !== 'audio') showPreview(item); };
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
            navigate(studio.route);
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

  function downloadItem(item) {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = `generation-${item.id || Date.now()}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
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
          onClick: () => downloadItem(item),
        },
      ],
    });
    detailView.show();
  }

  updateFilters();
  gridArea.innerHTML = '<div class="flex items-center justify-center h-64 text-muted text-xs">Loading your library…</div>';
  renderGrid();

  return container;
}
