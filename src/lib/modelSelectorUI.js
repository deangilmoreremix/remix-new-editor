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

  let html = `<div class="flex flex-col gap-2.5 items-center pr-2 border-r border-white/5 shrink-0 select-none overflow-y-auto custom-scrollbar w-14 pt-0.5">`;
  html += `<button type="button" data-provider="all" class="w-8 h-8 rounded-full flex items-center justify-center border transition-all flex-shrink-0 cursor-pointer ${allClasses}" title="All Providers"><svg width="15" height="15" viewBox="0 0 24 24" fill="${allSelected ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg></button>`;

  for (const p of availableProviders) {
    const style = getProviderStyle(p.id);
    const isSelected = selectedProvider === p.id;
    const logoUrl = PROVIDER_LOGOS[p.id];
    const hasLogo = Boolean(logoUrl);
    const itemClasses = isSelected
      ? `${style.bg} border-white/25 scale-105 shadow-md`
      : 'bg-white/[0.02] text-white/40 border-white/[0.02] hover:bg-white/5 hover:text-white/80';

    html += `<button type="button" data-provider="${p.id}" class="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center font-black text-[10px] border transition-all flex-shrink-0 cursor-pointer overflow-hidden ${itemClasses}" title="${p.name}">`;
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
    ? `<div class="w-8 h-8 rounded-full border border-white/5 overflow-hidden shrink-0 flex items-center justify-center bg-white/[0.02]"><img src="${logoUrl}" alt="${model.provider_name || ''}" class="w-full h-full object-contain p-1 ${invertLogos.includes(model.provider) ? 'invert' : ''}" onerror="this.outerHTML='${modelBadge}'" /></div>`
    : `<div class="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center font-bold text-xs shadow-inner uppercase ${(model.family === 'kontext' ? 'bg-blue-500/10 text-blue-400 border-blue-500/10' : model.family === 'effects' ? 'bg-purple-500/10 text-purple-400 border-purple-500/10' : 'bg-primary/10 text-primary border-primary/10')}">${(model.name || model.id).charAt(0)}</div>`;

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
  'flex gap-4 h-full max-h-[60vh] min-h-[350px] overflow-x-hidden';

// Exact vanilla-JS port of the upstream React `ModelDropdown` component.
//
// Options:
//   models           - flat model list
//   sections         - optional grouped model list
//   selectedModelId  - id of the currently selected model
//   selectedProvider - initial provider filter ('all' or a provider id)
//   search           - initial search query
//   showProviderName - always show the provider name under each model
//   headerLabel      - text shown above the list
//   checkColor       - checkmark color (default cyan #22d3ee)
//   autoFocus        - focus the search input on open
//   emptyText        - message shown when no models match
//   loadingMessage   - message shown while `models` is empty and still loading
//   categories       - [{ id, label, models }]
//   onSelectModel    - (model, categoryId) => void
//   onSelectProvider - (provider) => void
//   onSearch         - (query) => void
//   onSelectCategory - (categoryId) => void
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

  // Normalize categories into the upstream `modelCategories` shape.
  const modelCategories = [];
  if (categories && categories.length > 0) {
    categories.forEach((cat) => {
      modelCategories.push({
        id: cat.id,
        label: cat.label,
        entries: (cat.models || []).map((m) => ({ model: m, category: cat.id })),
      });
    });
  } else {
    const flat = sections ? sections.flatMap((s) => s.models) : models;
    modelCategories.push({
      id: 'all',
      label: headerLabel || 'Available models',
      entries: flat.map((m) => ({ model: m, category: 'all' })),
    });
  }

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
    modelCategories,
    selectedCategory: modelCategories[0]?.id || 'all',
    availableProviders: [],
    onSelectModel,
    onSelectProvider,
    onSearch,
    onSelectCategory,
  };

  const root = document.createElement('div');
  root.className = MODEL_SELECTOR_PANEL_CLASS;

  // Left sidebar
  const sidebarEl = document.createElement('div');
  sidebarEl.className = 'flex flex-col gap-2.5 items-center pr-2 border-r border-white/5 shrink-0 select-none overflow-y-auto custom-scrollbar w-14 pt-0.5';

  // Right pane
  const rightEl = document.createElement('div');
  rightEl.className = 'flex-1 flex flex-col gap-2 min-w-0';

  // Category + search wrapper
  const categorySearchEl = document.createElement('div');
  categorySearchEl.className = 'border-b border-white/5 shrink-0 pb-2 space-y-2';

  const tabsEl = document.createElement('div');
  tabsEl.className = 'flex gap-1.5 overflow-x-auto custom-scrollbar pb-0.5';

  modelCategories.forEach((cat) => {
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
    tabsEl.appendChild(tab);
  });

  const searchEl = document.createElement('div');
  searchEl.className = 'flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 border border-white/5 focus-within:border-primary/50 transition-colors';
  searchEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-muted"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>`;
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search models...';
  searchInput.className = 'bg-transparent border-none text-xs text-white focus:ring-0 w-full p-0 focus:outline-none';
  searchInput.addEventListener('click', (e) => e.stopPropagation());
  searchInput.addEventListener('input', () => {
    st.search = searchInput.value;
    if (st.onSearch) st.onSearch(searchInput.value);
    st.refresh();
  });
  searchEl.appendChild(searchInput);

  categorySearchEl.appendChild(tabsEl);
  categorySearchEl.appendChild(searchEl);

  // Header with category label and provider badge
  const headerEl = document.createElement('div');
  headerEl.className = 'text-xs font-semibold text-secondary py-1 shrink-0 flex items-center justify-between';
  const badgeEl = document.createElement('span');
  badgeEl.className = 'text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/60 hidden';
  headerEl.appendChild(document.createTextNode(''));
  headerEl.appendChild(badgeEl);

  // Model list
  const listEl = document.createElement('div');
  listEl.className = 'flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1 pb-2 flex-1';

  rightEl.appendChild(categorySearchEl);
  rightEl.appendChild(headerEl);
  rightEl.appendChild(listEl);

  root.appendChild(sidebarEl);
  root.appendChild(rightEl);

  const getActiveCategory = () => modelCategories.find((c) => c.id === st.selectedCategory) || modelCategories[0];
  const getModelEntries = () => getActiveCategory().entries;

  const computeProviders = () => {
    const entries = getModelEntries();
    const providers = [];
    const seen = new Set();
    entries.forEach(({ model: m }) => {
      const pId = m.provider || 'muapi';
      const pName = m.provider_name || 'Muapi';
      if (!seen.has(pId)) {
        seen.add(pId);
        providers.push({ id: pId, name: pName });
      }
    });
    return providers;
  };

  const renderSidebar = () => {
    const providers = computeProviders();
    st.availableProviders = providers;
    let html = `<button type="button" data-provider="all" class="w-8 h-8 rounded-full flex items-center justify-center border transition-all flex-shrink-0 cursor-pointer ${
      st.selectedProvider === 'all'
        ? 'bg-white/10 text-yellow-400 border-yellow-500/30 shadow-md scale-105'
        : 'bg-white/[0.02] text-white/50 border-white/[0.03] hover:bg-white/5 hover:text-white'
    }" title="All Providers"><svg width="15" height="15" viewBox="0 0 24 24" fill="${st.selectedProvider === 'all' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg></button>`;

    providers.forEach((p) => {
      const style = getProviderStyle(p.id);
      const isSelected = st.selectedProvider === p.id;
      const logoUrl = PROVIDER_LOGOS[p.id];
      const hasLogo = Boolean(logoUrl);
      const itemClasses = isSelected
        ? `${style.bg} border-white/25 scale-105 shadow-md`
        : 'bg-white/[0.02] text-white/40 border-white/[0.02] hover:bg-white/5 hover:text-white/80';

      html += `<button type="button" data-provider="${p.id}" class="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center font-black text-[10px] border transition-all flex-shrink-0 cursor-pointer overflow-hidden ${itemClasses}" title="${p.name}">`;
      if (hasLogo) {
        const invertClass = invertLogos.includes(p.id) ? 'invert' : '';
        html += `<img src="${logoUrl}" alt="${p.name}" class="w-full h-full rounded-full object-contain ${invertClass}" onerror="this.outerHTML='${LOGO_FALLBACK_HTML(p.id, style.text).replace(/'/g, "&#39;")}" />`;
      } else {
        html += `<span>${style.text}</span>`;
      }
      html += `</button>`;
    });

    sidebarEl.innerHTML = html;
  };

  const renderList = () => {
    const entries = getModelEntries();
    const filtered = entries.filter(({ model: m }) => {
      if (st.selectedProvider !== 'all') {
        const pId = m.provider || 'muapi';
        if (pId !== st.selectedProvider) return false;
      }
      const query = (st.search || '').toLowerCase();
      if (!query) return true;
      return (
        (m.name || '').toLowerCase().includes(query) ||
        (m.id || '').toLowerCase().includes(query)
      );
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="text-xs text-white/30 text-center py-6">${st.emptyText || 'No models found'}</div>`;
      return;
    }

    let html = '';
    filtered.forEach(({ model: m, category }) => {
      const isSelected = st.selectedModelId === m.id;
      const style = getProviderStyle(m.provider);
      const logoUrl = PROVIDER_LOGOS[m.provider];
      const hasLogo = Boolean(logoUrl);
      const modelBadge = LOGO_FALLBACK_HTML(m.provider, style.text).replace(/'/g, "&#39;");
      const iconHtml = hasLogo
        ? `<div class="w-8 h-8 rounded-full border border-white/5 overflow-hidden shrink-0 flex items-center justify-center bg-white/[0.02]"><img src="${logoUrl}" alt="${m.provider_name || ''}" class="w-full h-full object-contain p-1 ${invertLogos.includes(m.provider) ? 'invert' : ''}" onerror="this.outerHTML='${modelBadge}'" /></div>`
        : `<div class="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center font-bold text-xs shadow-inner uppercase ${(m.family === 'kontext' ? 'bg-blue-500/10 text-blue-400 border-blue-500/10' : m.family === 'effects' ? 'bg-purple-500/10 text-purple-400 border-purple-500/10' : 'bg-primary/10 text-primary border-primary/10')}">${(m.name || m.id).charAt(0)}</div>`;

      const providerLabel = st.showProviderName || st.selectedProvider === 'all'
        ? `<span class="text-[9px] text-white/40">${m.provider_name || ''}</span>`
        : '';

      const checkSvg = isSelected
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${st.checkColor}" stroke-width="4"><polyline points="20 6 9 17 4 12" /></svg>`
        : '';

      html += `<div data-model-id="${m.id}" class="flex items-center justify-between p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-all border border-transparent hover:border-white/5 ${isSelected ? 'bg-white/5 border-white/5' : ''}">`;
      html += `<div class="flex items-center gap-3">${iconHtml}<div class="flex flex-col gap-0.5 min-w-0"><span class="text-xs font-bold text-white tracking-tight truncate">${m.name}</span>${providerLabel}</div></div>`;
      html += checkSvg;
      html += `</div>`;
    });

    listEl.innerHTML = html;
  };

  st.refresh = () => {
    renderSidebar();
    renderList();

    const activeCategory = getActiveCategory();
    const providerName = st.availableProviders.find((p) => p.id === st.selectedProvider)?.name || st.selectedProvider;
    headerEl.firstChild.textContent = `${activeCategory.label} models`;
    if (st.selectedProvider !== 'all') {
      badgeEl.textContent = providerName;
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.classList.add('hidden');
    }

    if (tabsEl && modelCategories) {
      const tabs = tabsEl.querySelectorAll('button');
      tabs.forEach((tab, idx) => {
        const cat = modelCategories[idx];
        if (cat.id === st.selectedCategory) {
          tab.className = 'shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors border bg-primary/15 text-primary border-primary/30';
        } else {
          tab.className = 'shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors border bg-white/[0.02] text-white/50 border-white/[0.04] hover:bg-white/5 hover:text-white';
        }
      });
    }
  };

  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('[data-model-id]');
    if (!item) return;
    e.stopPropagation();
    const id = item.getAttribute('data-model-id');
    const activeCategory = getActiveCategory();
    const entry = activeCategory.entries.find((en) => en.model.id === id);
    st.selectedModelId = id;
    st.refresh();
    if (st.onSelectModel) st.onSelectModel(entry ? entry.model : id, activeCategory.id);
  });

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

  searchInput.addEventListener('click', (e) => e.stopPropagation());

  st.root = root;
  st.refresh();
  if (autoFocus) searchInput.focus();
  return st;
}

// Keep `mountModelSelector` working with the updated panel builder.
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
      existing.models = sections.flatMap((s) => s.models);
    } else {
      existing.models = models;
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
      const input = existing.root.querySelector('input[type="text"]');
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

/**
 * Position a model-selector dropdown viewport-aware.
 *
 * Behavior:
 * - Prefers placing the dropdown below the anchor when there is enough room.
 * - Flips above the anchor when the viewport has more space there.
 * - Constrains the dropdown height to the viewport so it never overflows.
 *
 * @param {HTMLElement} dropdown
 * @param {HTMLElement} anchorBtn
 * @param {number} [gap=8]
 */
export function positionModelSelectorDropdown(dropdown, anchorBtn, gap = 8) {
  if (!dropdown || !anchorBtn) return;

  const anchorRect = anchorBtn.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - anchorRect.bottom;
  const spaceAbove = anchorRect.top;

  // Reset previous inline positioning so measurements are accurate.
  dropdown.style.top = '';
  dropdown.style.left = '';
  dropdown.style.bottom = '';
  dropdown.style.right = '';
  dropdown.style.maxHeight = '';
  dropdown.style.transform = '';

  const placeBelow = spaceBelow >= spaceAbove || spaceBelow >= 320;

  if (placeBelow) {
    dropdown.style.top = `${anchorRect.bottom + gap}px`;
  } else {
    dropdown.style.top = 'auto';
    dropdown.style.bottom = `${viewportHeight - anchorRect.top + gap}px`;
  }

  dropdown.style.left = `${anchorRect.left}px`;
  dropdown.style.maxHeight = `${Math.max(viewportHeight - 32, 320)}px`;
  dropdown.style.overflowY = 'auto';

  // Keep horizontal bounds inside the viewport.
  const estimatedWidth = Math.min(dropdown.offsetWidth || 480, window.innerWidth - 16);
  if (anchorRect.left + estimatedWidth > window.innerWidth - 8) {
    dropdown.style.left = `${Math.max(8, window.innerWidth - estimatedWidth - 8)}px`;
  }
}
