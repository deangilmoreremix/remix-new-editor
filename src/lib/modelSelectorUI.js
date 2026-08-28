/**
 * Shared model selector UI utilities for image and video studios.
 *
 * Provides:
 * - Provider logo map and color styles
 * - Provider-aware filtering
 * - HTML generators for the split-pane provider sidebar dropdown
 */

// ---------------------------------------------------------------------------
// Provider branding
// ---------------------------------------------------------------------------

export const PROVIDER_LOGOS = {
  openai: "https://cdn.muapi.ai/models/openai.png",
  google: "https://cdn.muapi.ai/models/gemini.png",
  kling: "https://cdn.muapi.ai/models/kling.png",
  alibaba: "https://cdn.muapi.ai/models/alibaba.png",
  bytedance: "https://cdn.muapi.ai/models/bytedance.png",
  blackforest: "https://cdn.muapi.ai/models/bfl.png",
  minimax: "https://cdn.muapi.ai/models/minimax.png",
  suno: "https://cdn.muapi.ai/models/suno.png",
  anthropic: "https://cdn.muapi.ai/models/claude.png",
  meshy: "https://cdn.muapi.ai/models/meshy-3.png",
  tripo3d: "https://cdn.muapi.ai/models/tripo3d.png",
  grok: "https://cdn.muapi.ai/models/xai.png",
  muapi: "https://cdn.muapi.ai/models/muapi.png",
  midjourney: "https://cdn.muapi.ai/models/midjourney.png",
  vidu: "https://cdn.muapi.ai/models/vidu.png",
  runway: "https://cdn.muapi.ai/models/runway.png",
  luma: "https://cdn.muapi.ai/models/luma.png",
  ideogram: "https://cdn.muapi.ai/models/ideogram.png",
  leonardoai: "https://cdn.muapi.ai/models/leonardoai.png",
  hunyuan: "https://cdn.muapi.ai/models/hunyuan.png",
  hidream: "https://cdn.muapi.ai/models/hidream.png",
  lightricks: "https://cdn.muapi.ai/models/lightricks.png",
  pixverse: "https://cdn.muapi.ai/models/pixverse.png",
  reve: "https://cdn.muapi.ai/models/reve.png",
  stability: "https://cdn.muapi.ai/models/stability.png",
  ltx: "https://cdn.muapi.ai/models/ltx.png",
  wan: "https://cdn.muapi.ai/models/wan.png",
  ovi: "https://cdn.muapi.ai/models/ovi.png",
  infinitetalk: "https://cdn.muapi.ai/models/infinitetalk.png",
  topaz: "https://cdn.muapi.ai/models/topaz.png",
  heygen: "https://cdn.muapi.ai/models/heygen.png",
  latentsync: "https://cdn.muapi.ai/models/latentsync.png",
  veed: "https://cdn.muapi.ai/models/veed.png",
  creatify: "https://cdn.muapi.ai/models/creatify.png",
  openrouter: "https://cdn.muapi.ai/models/openrouter.png",
};

export const invertLogos = [
  'openai',
  'blackforest',
  'runway',
  'ideogram',
  'lightricks',
  'grok',
];

export function getProviderStyle(provider) {
  switch (provider) {
    case 'grok':
      return { text: 'xI', bg: 'bg-orange-500/10 text-orange-400 border-orange-500/25' };
    case 'openai':
      return { text: 'O', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' };
    case 'google':
      return { text: 'G', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/25' };
    case 'blackforest':
      return { text: 'BF', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/25' };
    case 'bytedance':
      return { text: 'BD', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/25' };
    case 'midjourney':
      return { text: 'MJ', bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25' };
    case 'kling':
      return { text: 'KL', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/25' };
    case 'vidu':
      return { text: 'VD', bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25' };
    case 'minimax':
      return { text: 'MX', bg: 'bg-pink-500/10 text-pink-400 border-pink-500/25' };
    case 'ideogram':
      return { text: 'ID', bg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25' };
    case 'luma':
      return { text: 'LM', bg: 'bg-teal-500/10 text-teal-400 border-teal-500/25' };
    case 'alibaba':
      return { text: 'AL', bg: 'bg-sky-500/10 text-sky-400 border-sky-500/25' };
    case 'leonardoai':
      return { text: 'LE', bg: 'bg-violet-500/10 text-violet-400 border-violet-500/25' };
    case 'stability':
      return { text: 'SD', bg: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/25' };
    case 'suno':
      return { text: 'SU', bg: 'bg-green-500/10 text-green-400 border-green-500/25' };
    case 'anthropic':
      return { text: 'AN', bg: 'bg-orange-500/10 text-orange-400 border-orange-500/25' };
    case 'reve':
      return { text: 'RE', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/25' };
    case 'pixverse':
      return { text: 'PX', bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25' };
    case 'hidream':
      return { text: 'HD', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/25' };
    case 'lightricks':
      return { text: 'LR', bg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25' };
    case 'tripo3d':
      return { text: 'TR', bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25' };
    case 'meshy':
      return { text: 'ME', bg: 'bg-teal-500/10 text-teal-400 border-teal-500/25' };
    case 'ltx':
      return { text: 'LT', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/25' };
    case 'hunyuan':
      return { text: 'HY', bg: 'bg-red-500/10 text-red-400 border-red-500/25' };
    case 'wan':
      return { text: 'WA', bg: 'bg-orange-500/10 text-orange-400 border-orange-500/25' };
    case 'ovi':
      return { text: 'OV', bg: 'bg-sky-500/10 text-sky-400 border-sky-500/25' };
    case 'infinitetalk':
      return { text: 'IT', bg: 'bg-pink-500/10 text-pink-400 border-pink-500/25' };
    case 'topaz':
      return { text: 'TP', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' };
    case 'heygen':
      return { text: 'HG', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/25' };
    case 'latentsync':
      return { text: 'LS', bg: 'bg-violet-500/10 text-violet-400 border-violet-500/25' };
    case 'veed':
      return { text: 'VD', bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25' };
    case 'creatify':
      return { text: 'CR', bg: 'bg-pink-500/10 text-pink-400 border-pink-500/25' };
    case 'openrouter':
      return { text: 'OR', bg: 'bg-gray-500/10 text-gray-400 border-gray-500/25' };
    default: {
      const text = (provider || 'AI').substring(0, 2).toUpperCase();
      return { text, bg: 'bg-primary/10 text-primary border-primary/25' };
    }
  }
}

// ---------------------------------------------------------------------------
// Provider discovery and filtering
// ---------------------------------------------------------------------------

export function getAvailableProviders(models) {
  const seen = new Set();
  const providers = [];
  for (const m of models) {
    const pId = m.provider || 'muapi';
    if (!seen.has(pId)) {
      seen.add(pId);
      providers.push({
        id: pId,
        name: m.provider_name || 'MuAPI',
      });
    }
  }
  return providers;
}

export function filterModels(models, search, selectedProvider) {
  const query = (search || '').toLowerCase();
  return models.filter((m) => {
    const pId = m.provider || 'muapi';
    if (selectedProvider !== 'all' && pId !== selectedProvider) {
      return false;
    }
    if (!query) return true;
    return (
      (m.name || '').toLowerCase().includes(query) ||
      (m.id || '').toLowerCase().includes(query)
    );
  });
}

// ---------------------------------------------------------------------------
// HTML generators for the split-pane dropdown
// ---------------------------------------------------------------------------

const LOGO_FALLBACK_HTML = (provider, text) =>
  `<div class="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center font-bold text-xs shadow-inner uppercase bg-primary/10 text-primary border-primary/10">${text}</div>`;

export function renderProviderSidebar(availableProviders, selectedProvider, onSelectProvider) {
  const allSelected = selectedProvider === 'all';
  const allClasses = allSelected
    ? 'bg-white/10 text-yellow-400 border-yellow-500/30 shadow-md scale-105'
    : 'bg-white/[0.02] text-white/50 border-white/[0.03] hover:bg-white/5 hover:text-white';

  let html = `<div class="flex flex-col gap-2.5 items-center pr-2.5 border-r border-white/5 shrink-0 select-none overflow-y-auto custom-scrollbar w-18 pt-0.5">`;
  html += `<button type="button" data-provider="all" class="w-10 h-10 rounded-lg flex items-center justify-center border transition-all flex-shrink-0 cursor-pointer ${allClasses}" title="All Providers"><svg width="18" height="18" viewBox="0 0 24 24" fill="${allSelected ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg></button>`;

  for (const p of availableProviders) {
    const style = getProviderStyle(p.id);
    const isSelected = selectedProvider === p.id;
    const logoUrl = PROVIDER_LOGOS[p.id];
    const hasLogo = Boolean(logoUrl);
    const itemClasses = isSelected
      ? `${style.bg} border-white/25 scale-105 shadow-md`
      : 'bg-white/[0.02] text-white/40 border-white/[0.02] hover:bg-white/5 hover:text-white/80';

    html += `<button type="button" data-provider="${p.id}" class="w-10 h-10 flex-shrink-0 rounded-lg flex items-center justify-center font-black text-[11px] border transition-all flex-shrink-0 cursor-pointer overflow-hidden ${itemClasses}" title="${p.name}">`;
    if (hasLogo) {
      const invertClass = invertLogos.includes(p.id) ? 'invert' : '';
      const sidebarBadge = LOGO_FALLBACK_HTML(p.id, getProviderStyle(p.id).text).replace(/'/g, "&#39;");
      html += `<img src="${logoUrl}" alt="${p.name}" class="w-full h-full rounded-full object-contain ${invertClass}" onerror="this.outerHTML='${sidebarBadge}'" />`;
    } else {
      html += `<span>${style.text}</span>`;
    }
    html += `</button>`;
  }

  html += `</div>`;
  return html;
}

export function renderSearchBar() {
  return `<div class="border-b border-white/5 shrink-0 pb-2"><div class="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 border border-white/5 focus-within:border-primary/50 transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-muted"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg><input type="text" data-provider-search placeholder="Search models..." class="bg-transparent border-none text-xs text-white focus:ring-0 w-full p-0 focus:outline-none" /></div></div>`;
}

export function getModelLogoHtml(model, sizeClasses = 'w-4 h-4') {
  const provider = model?.provider || 'muapi';
  const logoUrl = PROVIDER_LOGOS[provider];
  if (logoUrl) {
    const logoBadge = LOGO_FALLBACK_HTML(provider, getProviderStyle(provider).text).replace(/'/g, "&#39;");
    return `<div class="${sizeClasses} rounded-md flex items-center justify-center overflow-hidden bg-white/5 shrink-0"><img src="${logoUrl}" alt="" class="w-full h-full object-contain ${invertLogos.includes(provider) ? 'invert' : ''}" onerror="this.outerHTML='${logoBadge}'" /></div>`;
  }
  const style = getProviderStyle(provider);
  return `<div class="${sizeClasses} bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20 shrink-0"><span class="text-[9px] font-black text-black">${style.text}</span></div>`;
}

// Render a single model row. Shared by the default list and any custom
// sections (e.g. Video Studio's "Video Tools" group) so every studio's
// picker renders identical rows with a consistent cyan checkmark.
export function renderModelRow(model, opts = {}) {
  const {
    isSelected = false,
    showProviderName = false,
    sublabel = '',
    checkColor = '#22d3ee',
  } = opts;

  const itemClasses = isSelected
    ? 'bg-white/5 border-white/5'
    : 'border border-transparent hover:border-white/5';

  const logoUrl = PROVIDER_LOGOS[model.provider];
  const hasLogo = Boolean(logoUrl);
  const modelBadge = LOGO_FALLBACK_HTML(model.provider, getProviderStyle(model.provider).text).replace(/'/g, "&#39;");
  const iconHtml = hasLogo
    ? `<div class="w-10 h-10 rounded-lg border border-white/5 overflow-hidden shrink-0 flex items-center justify-center bg-white/[0.02]"><img src="${logoUrl}" alt="${model.provider_name || ''}" class="w-full h-full object-contain p-1.5 ${invertLogos.includes(model.provider) ? 'invert' : ''}" onerror="this.outerHTML='${modelBadge}'" /></div>`
    : `<div class="w-10 h-10 rounded-lg border border-white/5 flex items-center justify-center font-bold text-xs shadow-inner uppercase ${(model.family === 'kontext' ? 'bg-blue-500/10 text-blue-400 border-blue-500/10' : model.family === 'effects' ? 'bg-purple-500/10 text-purple-400 border-purple-500/10' : 'bg-primary/10 text-primary border-primary/10')}">${(model.name || model.id).charAt(0)}</div>`;

  const providerLabel = showProviderName && model.provider_name
    ? `<span class="text-[9px] text-white/40">${model.provider_name}</span>`
    : '';

  const sublabelHtml = sublabel
    ? `<span class="text-[9px] text-orange-400/70">${sublabel}</span>`
    : '';

  const checkSvg = isSelected
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${checkColor}" stroke-width="4"><polyline points="20 6 9 17 4 12" /></svg>`
    : '';

  let html = `<div data-model-id="${model.id}" class="flex items-center justify-between p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-all border border-transparent hover:border-white/5 ${isSelected ? 'bg-white/5 border-white/5' : ''}">`;
  html += `<div class="flex items-center gap-3">${iconHtml}<div class="flex flex-col gap-0.5 min-w-0"><span class="text-xs font-bold text-white tracking-tight truncate">${model.name}</span>${providerLabel}${sublabelHtml}</div></div>`;
  html += checkSvg;
  html += `</div>`;
  return html;
}

export function renderModelList(models, selectedModelId, showProviderName, onSelectModel) {
  if (models.length === 0) {
    return `<div class="text-xs text-white/30 text-center py-6">No models found</div>`;
  }

  let html = `<div class="flex flex-col gap-1.5 pb-2">`;
  for (const m of models) {
    html += renderModelRow(m, { isSelected: m.id === selectedModelId, showProviderName });
  }
  html += `</div>`;
  return html;
}

// Canonical split-pane shell shared by every model picker in the app.
// Sidebar (provider filter) on the left, search + model list on the right.
// Keeping this in one place guarantees the Image Studio / Video Studio /
// Audio Studio / Influencer Studio pickers all render identically.
export const MODEL_SELECTOR_PANEL_CLASS =
  'flex gap-5 h-full max-h-[70vh] min-h-[350px] overflow-hidden';

// Build the split-pane panel and wire its interactions. Returns an object with
// the `root` element and a `refresh()` method so callers can re-render without
// rebuilding the DOM (preserves search focus and scroll position).
//
// Options:
//   models           - flat model list (used when `sections` is omitted)
//   sections         - optional [{ models, label?, rowOptions?(m) }] for grouped
//                      lists (e.g. generation models + a "Video Tools" group)
//   selectedModelId  - id of the currently selected model
//   selectedProvider - initial provider filter ('all' or a provider id)
//   search           - initial search query
//   showProviderName - always show the provider name under each model
//   headerLabel      - text shown above the list
//   checkColor       - checkmark color (default cyan #22d3ee)
//   autoFocus        - focus the search input on open
//   emptyText        - message shown when no models match
//   loadingMessage   - message shown while `models` is empty and still loading
//   categories       - optional [{ id, label, models }] for category tabs
//                      shown above the search bar (e.g. T2I vs I2I modes)
//   onSelectModel    - (id) => void
//   onSelectProvider - (provider) => void
//   onSearch         - (query) => void
export function buildModelSelectorPanel(options = {}) {
  const {
    models = [],
    sections = null,
    selectedModelId,
    selectedProvider = 'all',
    search = '',
    showProviderName = false,
    headerLabel = 'Available models',
    checkColor = '#22d3ee',
    autoFocus = false,
    emptyText = 'No models found',
    loadingMessage = null,
    onSelectModel,
    onSelectProvider,
    onSearch,
    onSelectCategory,
    categories = null,
  } = options;

  const allModels = sections ? sections.flatMap((s) => s.models) : models;

  const st = {
    models,
    sections,
    selectedModelId,
    selectedProvider,
    search,
    showProviderName,
    headerLabel,
    checkColor,
    emptyText,
    loadingMessage,
    availableProviders: getAvailableProviders(allModels),
    onSelectModel,
    onSelectProvider,
    onSearch,
    onSelectCategory,
    categories,
    selectedCategory: categories && categories.length > 0 ? categories[0].id : null,
  };

  const root = document.createElement('div');
  root.className = MODEL_SELECTOR_PANEL_CLASS;

  const sidebarEl = document.createElement('div');
  sidebarEl.setAttribute('data-provider-sidebar', '');

  const mainEl = document.createElement('div');
  mainEl.className = 'flex-1 flex flex-col gap-2 min-w-0';

  const listEl = document.createElement('div');
  listEl.className = 'flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1';
  listEl.setAttribute('data-model-list', '');

  mainEl.innerHTML = renderSearchBar();

  let tabsContainer = null;
  if (st.categories && st.categories.length > 0) {
    tabsContainer = document.createElement('div');
    tabsContainer.className = 'flex gap-1.5 overflow-x-auto custom-scrollbar pb-0.5 shrink-0';
    st.categories.forEach((cat) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      const isActive = st.selectedCategory === cat.id;
      tab.className = `shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors border ${
        isActive
          ? 'bg-primary/15 text-primary border-primary/30'
          : 'bg-white/[0.02] text-white/50 border-white/[0.04] hover:bg-white/5 hover:text-white'
      }`;
      tab.textContent = cat.label;
      tab.onclick = (e) => {
        e.stopPropagation();
        st.selectedCategory = cat.id;
        if (st.onSelectCategory) st.onSelectCategory(cat.id);
        if (st.onSelectProvider) st.onSelectProvider('all');
        st.selectedProvider = 'all';
        st.refresh();
      };
      tabsContainer.appendChild(tab);
    });
    mainEl.insertBefore(tabsContainer, mainEl.firstChild);
  }

  const header = document.createElement('div');
  header.className =
    'text-xs font-semibold text-secondary py-1 shrink-0 flex items-center justify-between';
  header.innerHTML =
    `<span>${headerLabel}</span><span data-provider-badge class="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/60 hidden"></span>`;
  mainEl.appendChild(header);
  mainEl.appendChild(listEl);

  root.appendChild(sidebarEl);
  root.appendChild(mainEl);

  const badgeEl = header.querySelector('[data-provider-badge]');
  const searchInput = mainEl.querySelector('[data-provider-search]');

  const renderListHtml = () => {
    let baseModels = st.models;
    if (st.categories && st.selectedCategory) {
      const cat = st.categories.find((c) => c.id === st.selectedCategory);
      if (cat && cat.models) baseModels = cat.models;
    }

    const showName = st.showProviderName || st.selectedProvider === 'all';
    const groups = st.sections || [{ models: baseModels }];
    let html = '<div class="flex flex-col gap-1.5 pb-2">';
    let any = false;
    for (const g of groups) {
      const filtered = filterModels(g.models, st.search, st.selectedProvider);
      if (filtered.length === 0) continue;
      any = true;
      if (g.label) {
        html += `<div class="text-[10px] font-bold text-orange-400/70 px-3 py-2 mt-1 border-t border-white/5">${g.label}</div>`;
      }
      for (const m of filtered) {
        const sublabel = g.rowOptions ? g.rowOptions(m).sublabel : '';
        html += renderModelRow(m, {
          isSelected: m.id === st.selectedModelId,
          showProviderName: showName,
          sublabel,
          checkColor: st.checkColor,
        });
      }
    }
    html += '</div>';
    if (!any) {
      const msg = baseModels.length === 0 && st.loadingMessage ? st.loadingMessage : st.emptyText;
      return `<div class="text-xs text-white/30 text-center py-6">${msg}</div>`;
    }
    return html;
  };

  st.refresh = () => {
    sidebarEl.innerHTML = renderProviderSidebar(st.availableProviders, st.selectedProvider, () => {});
    listEl.innerHTML = renderListHtml();

    if (st.selectedProvider !== 'all') {
      const pName = st.availableProviders.find((p) => p.id === st.selectedProvider)?.name || st.selectedProvider;
      badgeEl.textContent = pName;
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.classList.add('hidden');
    }

    if (tabsContainer && st.categories) {
      const tabs = tabsContainer.querySelectorAll('button');
      tabs.forEach((tab, idx) => {
        const cat = st.categories[idx];
        if (cat.id === st.selectedCategory) {
          tab.className = 'shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors border bg-primary/15 text-primary border-primary/30';
        } else {
          tab.className = 'shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors border bg-white/[0.02] text-white/50 border-white/[0.04] hover:bg-white/5 hover:text-white';
        }
      });
    }
  };

  // Model selection via delegation on the list.
  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('[data-model-id]');
    if (!item) return;
    e.stopPropagation();
    const id = item.getAttribute('data-model-id');
    st.selectedModelId = id;
    st.refresh();
    if (st.onSelectModel) st.onSelectModel(id);
  });

  // Provider selection via delegation on the sidebar.
  sidebarEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-provider]');
    if (!btn) return;
    const provider = btn.getAttribute('data-provider');
    if (provider) {
      st.selectedProvider = provider;
      st.refresh();
      if (st.onSelectProvider) st.onSelectProvider(provider);
    }
  });

  // Live search — re-render the list without losing input focus.
  searchInput.addEventListener('click', (e) => e.stopPropagation());
  searchInput.addEventListener('input', () => {
    st.search = searchInput.value;
    if (st.onSearch) st.onSearch(searchInput.value);
    st.refresh();
  });

  st.root = root;
  st.scrollToSelected = () => {
    try {
      const items = listEl.querySelectorAll('[data-model-id]');
      let el = null;
      for (const it of items) {
        if (it.getAttribute('data-model-id') === st.selectedModelId) { el = it; break; }
      }
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
    } catch (_) { /* ignore: scroll is cosmetic */ }
  };
  st.refresh();
  st.scrollToSelected();
  if (autoFocus) searchInput.focus();
  return st;
}

// Mount a complete model selector into an existing container element.
// Returns the root element so callers can keep a reference for cleanup.
//
// The mount is idempotent: calling it again on the same container refreshes
// the existing panel instead of rebuilding it. This keeps the search input
// focused and the scroll position stable while the user types or filters.
export function mountModelSelector(container, options = {}) {
  if (!container) return null;

  const existing = container._msMount;
  if (existing && existing.root.isConnected) {
    const {
      models = [],
      sections = null,
      selectedModelId,
      selectedProvider,
      search,
      showProviderName,
      headerLabel,
      checkColor,
      emptyText,
      loadingMessage,
      onSelectModel,
      onSelectProvider,
      onSearch,
    } = options;

    if (sections) {
      existing.sections = sections;
      existing.availableProviders = getAvailableProviders(sections.flatMap((s) => s.models));
    } else {
      existing.models = models;
      existing.availableProviders = getAvailableProviders(models);
    }
    existing.selectedModelId = selectedModelId;
    if (typeof headerLabel === 'string') existing.headerLabel = headerLabel;
    if (typeof checkColor === 'string') existing.checkColor = checkColor;
    if (typeof emptyText === 'string') existing.emptyText = emptyText;
    if (typeof loadingMessage === 'string') existing.loadingMessage = loadingMessage;
    existing.showProviderName = showProviderName;
    existing.onSelectModel = onSelectModel;
    existing.onSelectProvider = onSelectProvider;
    existing.onSearch = onSearch;
    if (typeof selectedProvider === 'string') existing.selectedProvider = selectedProvider;
    if (typeof search === 'string') {
      existing.search = search;
      const input = existing.root.querySelector('[data-provider-search]');
      if (input && document.activeElement !== input) input.value = search;
    }
    existing.refresh();
    return existing.root;
  }

  const st = buildModelSelectorPanel(options);
  container.innerHTML = '';
  container.appendChild(st.root);
  container._msMount = st;
  return st.root;
}
