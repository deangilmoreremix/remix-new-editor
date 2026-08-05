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
    default:
      const text = (provider || 'AI').substring(0, 2).toUpperCase();
      return { text, bg: 'bg-primary/10 text-primary border-primary/25' };
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
      html += `<img src="${logoUrl}" alt="${p.name}" class="w-full h-full rounded-full object-contain ${invertClass}" />`;
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
    return `<div class="${sizeClasses} rounded-md flex items-center justify-center overflow-hidden bg-white/5 shrink-0"><img src="${logoUrl}" alt="" class="w-full h-full object-contain ${invertLogos.includes(provider) ? 'invert' : ''}" /></div>`;
  }
  const style = getProviderStyle(provider);
  return `<div class="${sizeClasses} bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20 shrink-0"><span class="text-[9px] font-black text-black">${style.text}</span></div>`;
}

export function renderModelList(models, selectedModelId, showProviderName, onSelectModel) {
  if (models.length === 0) {
    return `<div class="text-xs text-white/30 text-center py-6">No models found</div>`;
  }

  let html = `<div class="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1 pb-2 flex-1">`;
  for (const m of models) {
    const isSelected = m.id === selectedModelId;
    const itemClasses = isSelected
      ? 'bg-white/5 border-white/5'
      : 'border border-transparent hover:border-white/5';
    const logoUrl = PROVIDER_LOGOS[m.provider];
    const hasLogo = Boolean(logoUrl);
    const iconHtml = hasLogo
      ? `<div class="w-8 h-8 rounded-full border border-white/5 overflow-hidden shrink-0 flex items-center justify-center bg-white/[0.02]"><img src="${logoUrl}" alt="${m.provider_name || ''}" class="w-full h-full object-contain p-1 ${invertLogos.includes(m.provider) ? 'invert' : ''}" /></div>`
      : `<div class="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center font-bold text-xs shadow-inner uppercase ${(m.family === 'kontext' ? 'bg-blue-500/10 text-blue-400 border-blue-500/10' : m.family === 'effects' ? 'bg-purple-500/10 text-purple-400 border-purple-500/10' : 'bg-primary/10 text-primary border-primary/10')}">${(m.name || m.id).charAt(0)}</div>`;

    const providerLabel = showProviderName && m.provider_name
      ? `<span class="text-[9px] text-white/40">${m.provider_name}</span>`
      : '';

    const checkSvg = isSelected
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="4"><polyline points="20 6 9 17 4 12" /></svg>`
      : '';

    html += `<div data-model-id="${m.id}" class="flex items-center justify-between p-3 hover:bg-white/5 rounded-2xl cursor-pointer transition-all ${itemClasses}">`;
    html += `<div class="flex items-center gap-3">${iconHtml}<div class="flex flex-col gap-0.5 min-w-0"><span class="text-xs font-bold text-white tracking-tight truncate">${m.name}</span>${providerLabel}</div></div>`;
    html += checkSvg;
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}
