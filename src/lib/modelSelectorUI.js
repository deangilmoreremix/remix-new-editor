/**
 * MODEL SELECTOR UI
 * Shared vanilla-JavaScript model picker used by Template Studio,
 * Cinema Template Studio, and Cinema Studio.
 *
 * Implements the upstream split-pane dropdown design:
 *   - Provider-logo sidebar
 *   - All Providers control
 *   - Provider filtering
 *   - Search across family name, model name, and model ID
 *   - T2V / I2V / V2V categories where applicable
 *   - Model-family grouping
 *   - Selected item scrolled into view
 *   - Escape-to-close and outside-click close
 *   - Correct ARIA state
 *   - Responsive positioning with viewport flipping
 *   - Maximum viewport height
 *   - Loading, empty, and fallback states
 *   - Provider-logo fallbacks without unsafe inline error handlers
 */

import {
  imageModelPickerEntries,
  imageModelPickerEntryByVariantId,
  imageModelCatalog,
  videoModelPickerEntries,
  videoModelPickerEntryByVariantId,
  videoModelCatalog,
  getFamilyVariant,
} from "./modelFamilies.js";
import { getModelMediaCapabilities } from "./modelCapabilities.js";

const PROVIDER_LOGOS = {
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
};

const invertLogos = ["openai", "blackforest", "runway", "ideogram", "lightricks", "grok"];

function getProviderStyle(provider) {
  switch (provider) {
    case "grok":
      return { text: "xI", bg: "bg-orange-500/10 text-orange-400 border-orange-500/25" };
    case "openai":
      return { text: "O", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" };
    case "google":
      return { text: "G", bg: "bg-blue-500/10 text-blue-400 border-blue-500/25" };
    case "blackforest":
      return { text: "BF", bg: "bg-amber-500/10 text-amber-400 border-amber-500/25" };
    case "bytedance":
      return { text: "BD", bg: "bg-purple-500/10 text-purple-400 border-purple-500/25" };
    case "midjourney":
      return { text: "MJ", bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25" };
    case "kling":
      return { text: "KL", bg: "bg-rose-500/10 text-rose-400 border-rose-500/25" };
    case "vidu":
      return { text: "VD", bg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25" };
    case "minimax":
      return { text: "MX", bg: "bg-pink-500/10 text-pink-400 border-pink-500/25" };
    case "ideogram":
      return { text: "ID", bg: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25" };
    case "luma":
      return { text: "LM", bg: "bg-teal-500/10 text-teal-400 border-teal-500/25" };
    case "alibaba":
      return { text: "AL", bg: "bg-sky-500/10 text-sky-400 border-sky-500/25" };
    case "leonardoai":
      return { text: "LE", bg: "bg-violet-500/10 text-violet-400 border-violet-500/25" };
    case "stability":
      return { text: "SD", bg: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/25" };
    default:
      const name = provider ? provider.toUpperCase() : "AI";
      return { text: name.substring(0, 2), bg: "bg-primary/10 text-primary border-primary/25" };
  }
}

function renderProviderLogo(family) {
  const provider = family.provider || "muapi";
  const logoUrl = PROVIDER_LOGOS[provider];
  if (logoUrl) {
    return `<div class="w-8 h-8 rounded-full border border-white/5 overflow-hidden shrink-0 flex items-center justify-center bg-white/[0.02]">
      <img src="${logoUrl}" alt="${family.provider_name}" class="w-full h-full object-contain p-1 ${invertLogos.includes(provider) ? "invert" : ""}" loading="lazy" />
    </div>`;
  }
  const style = getProviderStyle(provider);
  return `<div class="w-8 h-8 ${style.bg} border rounded-full flex items-center justify-center font-black text-[10px] shadow-inner uppercase">${style.text}</div>`;
}

function renderProviderLogoImg(provider, _id, className, invertClass) {
  const logoUrl = PROVIDER_LOGOS[provider];
  if (logoUrl) {
    return `<img src="${logoUrl}" alt="${provider}" class="${className} ${invertClass}" loading="lazy" />`;
  }
  const style = getProviderStyle(provider);
  return `<span class="font-black text-[10px] uppercase">${style.text}</span>`;
}

function createProviderButton(provider, selectedProvider, availableProviders, copy) {
  const style = getProviderStyle(provider.id);
  const isSelected = selectedProvider === provider.id;
  return `<button type="button" data-provider="${provider.id}" aria-pressed="${isSelected}" class="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center overflow-hidden font-black text-[10px] border transition-all cursor-pointer ${isSelected ? `${style.bg} scale-105 shadow-md shadow-black/10` : "bg-white/[0.02] text-white/40 border-white/[0.02] hover:bg-white/5 hover:text-white/80"}" title="${provider.name}">
    ${PROVIDER_LOGOS[provider.id] ? `<img src="${PROVIDER_LOGOS[provider.id]}" alt="${provider.name}" class="w-full h-full rounded-full object-contain ${invertLogos.includes(provider.id) ? "invert" : ""}" loading="lazy" />` : style.text}
  </button>`;
}

function createModelItem(entry, isSelected, activeItemRef) {
  const { family } = entry;
  return `<button type="button" data-entry-id="${entry.id}" data-variant-ids="${[...entry.variantIds].join(",")}" aria-pressed="${isSelected}" ${isSelected ? `ref="${activeItemRef}"` : ""} class="flex w-full text-left items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${isSelected ? "bg-white/5 border-white/5" : ""}">
    <div class="flex items-center gap-3.5">
      ${PROVIDER_LOGOS[family.provider] ? `<div class="w-8 h-8 rounded-xl border border-white/5 overflow-hidden shrink-0 flex items-center justify-center bg-white/[0.02]"><img src="${PROVIDER_LOGOS[family.provider]}" alt="${family.provider_name}" class="w-full h-full object-contain p-1 ${invertLogos.includes(family.provider) ? "invert" : ""}" loading="lazy" /></div>` : `<div class="w-9 h-9 ${getProviderStyle(family.provider).bg} border rounded-xl flex items-center justify-center font-black text-xs shadow-inner uppercase">${entry.name.charAt(0)}</div>`}
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-xs font-bold text-white tracking-tight truncate">${entry.name}</span>
        <div class="flex items-center gap-1.5"></div>
      </div>
    </div>
    ${isSelected ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="4"><polyline points="20 6 9 17 4 12" /></svg>` : ""}
  </button>`;
}

/**
 * Mount a model selector dropdown.
 *
 * @param {Object} options
 * @param {HTMLElement} options.anchor - Element to anchor the dropdown to
 * @param {string} options.selectedModelId - Currently selected model variant ID
 * @param {string[]} options.allowedModelTypes - Allowed workflow modes (e.g. ['t2i','i2i'])
 * @param {Function} options.onSelectModel - Called with (pickerEntry, categoryId)
 * @param {Function} options.onClose - Called when dropdown closes
 * @param {string} [options.placeholder='Select model'] - Placeholder text
 * @param {boolean} [options.loading=false] - Show loading state
 * @param {string} [copy.searchPlaceholder='Search models...']
 * @param {string} [copy.noModelsFound='No models found']
 * @param {string} [copy.categoryAll='All']
 * @param {string} [copy.allProviders='All Providers']
 * @param {string} [copy.categories] - Object with t2v, i2v, v2v, t2i, i2i labels
 */
export function mountTemplateModelSelector({
  anchor,
  selectedModelId,
  allowedModelTypes = [],
  onSelectModel,
  onClose,
  placeholder = "Select model",
  loading = false,
  copy = {},
}) {
  const {
    searchPlaceholder = "Search models...",
    noModelsFound = "No models found",
    categoryAll = "All",
    allProviders = "All Providers",
    categories = {},
  } = copy;

  // Resolve selected entry from catalog
  const selectedEntry = selectedModelId
    ? imageModelPickerEntryByVariantId.get(selectedModelId) ||
      videoModelPickerEntryByVariantId.get(selectedModelId) ||
      null
    : null;

  // Determine which catalog to use based on allowed types
  const usesVideoCatalog = allowedModelTypes.some((t) => ["t2v", "i2v", "v2v"].includes(t));
  const allEntries = usesVideoCatalog ? videoModelPickerEntries : imageModelPickerEntries;

  // Build category definitions based on allowed types
  const modelCategories = [];
  if (allowedModelTypes.length === 0 || allowedModelTypes.includes("t2i")) {
    modelCategories.push({
      id: "all",
      label: categoryAll,
      entries: allEntries,
      allowed: allowedModelTypes.length === 0 || allowedModelTypes.includes("t2i"),
    });
  }
  if (allowedModelTypes.includes("t2v")) {
    modelCategories.push({
      id: "t2v",
      label: categories.t2v || "T2V",
      entries: allEntries.filter((entry) => entry.variantsByMode.t2v),
      allowed: true,
    });
  }
  if (allowedModelTypes.includes("i2v")) {
    modelCategories.push({
      id: "i2v",
      label: categories.i2v || "I2V",
      entries: allEntries.filter((entry) => entry.variantsByMode.i2v),
      allowed: true,
    });
  }
  if (allowedModelTypes.includes("v2v")) {
    modelCategories.push({
      id: "v2v",
      label: categories.v2v || "V2V",
      entries: allEntries.filter((entry) => entry.variantsByMode.v2v),
      allowed: true,
    });
  }
  if (allowedModelTypes.includes("i2i")) {
    modelCategories.push({
      id: "i2i",
      label: categories.i2i || "I2I",
      entries: allEntries.filter((entry) => entry.variantsByMode.i2i),
      allowed: true,
    });
  }

  // State
  let search = "";
  let selectedCategory = modelCategories[0]?.id || "all";
  let selectedProvider = selectedEntry ? (selectedEntry.family.provider || "all") : "all";
  let activeItemRef = null;

  // Build provider list from current category entries
  function getAvailableProviders(entries) {
    const providers = [];
    const seen = new Set();
    for (const { family } of entries) {
      const pId = family.provider || "muapi";
      const pName = family.provider_name || "Muapi";
      if (!seen.has(pId)) {
        seen.add(pId);
        providers.push({ id: pId, name: pName });
      }
    }
    return providers;
  }

  function getFilteredEntries() {
    const activeCategory = modelCategories.find((c) => c.id === selectedCategory) || modelCategories[0];
    if (!activeCategory) return [];
    const lf = search.toLowerCase();
    return activeCategory.entries.filter((entry) => {
      const { family } = entry;
      if (selectedProvider !== "all") {
        const pId = family.provider || "muapi";
        if (pId !== selectedProvider) return false;
      }
      return entry.searchText.includes(lf);
    });
  }

  function render() {
    const filtered = getFilteredEntries();
    const activeCategory = modelCategories.find((c) => c.id === selectedCategory) || modelCategories[0];
    const availableProviders = getAvailableProviders(activeCategory?.entries || []);
    const selectedProviderData = availableProviders.find((p) => p.id === selectedProvider);

    const categoryButtons = modelCategories
      .filter((c) => c.allowed)
      .map(
        (cat) => `<button type="button" data-category="${cat.id}" class="shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors border ${selectedCategory === cat.id ? "bg-primary/15 text-primary border-primary/30" : "bg-white/[0.02] text-white/50 border-white/[0.04] hover:bg-white/5 hover:text-white"}">${cat.label}</button>`,
      )
      .join("");

    const providerButtons = [
      `<button type="button" data-provider="all" aria-pressed="${selectedProvider === "all"}" class="w-8 h-8 rounded-full flex items-center justify-center border transition-all flex-shrink-0 cursor-pointer ${selectedProvider === "all" ? "bg-white/10 text-yellow-400 border-yellow-500/30 shadow-md scale-105" : "bg-white/[0.02] text-white/50 border-white/[0.03] hover:bg-white/5 hover:text-white"}" title="${allProviders}"><svg width="15" height="15" viewBox="0 0 24 24" fill="${selectedProvider === "all" ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg></button>`,
      ...availableProviders.map((p) => createProviderButton(p, selectedProvider, availableProviders, copy)),
    ].join("");

    const items = filtered.length === 0
      ? `<div class="text-xs text-white/30 text-center py-6">${noModelsFound}</div>`
      : filtered
          .map((entry) => createModelItem(entry, selectedEntry === entry, activeItemRef ? 'activeItemRef' : ''))
          .join("");

    return `
      <div class="model-picker-dropdown flex gap-4 h-full max-h-[70vh] min-h-[350px]" role="listbox" aria-label="Model selector">
        <div class="flex flex-col gap-2.5 items-center pr-2 border-r border-white/5 shrink-0 select-none overflow-y-auto custom-scrollbar w-14 pt-0.5">
          ${providerButtons}
        </div>
        <div class="flex-1 flex flex-col gap-2 min-w-0">
          <div class="px-1 pb-2 border-b border-white/5 shrink-0 space-y-2">
            <div class="flex gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
              ${categoryButtons}
            </div>
            <div class="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 border border-white/5 focus-within:border-primary/50 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-muted"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              <input type="text" placeholder="${searchPlaceholder}" value="${search}" class="bg-transparent border-none text-xs text-white focus:ring-0 w-full p-0 outline-none" />
            </div>
          </div>
          <div class="text-xs font-bold text-secondary px-2 py-1 shrink-0 flex items-center justify-between">
            <span>${activeCategory ? activeCategory.label : ""} models</span>
            ${selectedProviderData ? `<span class="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/60">${selectedProviderData.name}</span>` : ""}
          </div>
          <div class="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1 pb-2 flex-1">
            ${items}
          </div>
        </div>
      </div>
    `;
  }

  // Create dropdown panel
  const panel = document.createElement("div");
  panel.className = "model-picker-panel fixed bg-[#141414] border border-white/10 rounded-3xl p-4 shadow-2xl z-50 transform scale-95 opacity-0 pointer-events-none transition-all duration-200";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Select model");
  panel.innerHTML = render();

  // Position dropdown relative to anchor
  function positionPanel() {
    const rect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Reset classes
    panel.style.top = "";
    panel.style.bottom = "";
    panel.style.left = "";
    panel.style.right = "";

    // Default: below anchor
    let top = rect.bottom + 8;
    let flipped = false;

    // If not enough space below, flip above
    if (top + panelRect.height > viewportHeight - 16 && rect.top > panelRect.height + 16) {
      top = rect.top - panelRect.height - 8;
      flipped = true;
    }

    // Horizontal positioning
    let left = rect.left;
    if (left + panelRect.width > viewportWidth - 16) {
      left = viewportWidth - panelRect.width - 16;
    }
    if (left < 16) left = 16;

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
    panel.dataset.flipped = flipped ? "1" : "0";
  }

  function open() {
    document.body.appendChild(panel);
    // Reset state
    search = "";
    selectedCategory = modelCategories[0]?.id || "all";
    selectedProvider = selectedEntry ? (selectedEntry.family.provider || "all") : "all";
    panel.innerHTML = render();
    positionPanel();
    // Animate in
    requestAnimationFrame(() => {
      panel.classList.remove("scale-95", "opacity-0", "pointer-events-none");
      panel.classList.add("scale-100", "opacity-100");
    });
    // Scroll active item into view
    requestAnimationFrame(() => {
      const active = panel.querySelector('[aria-pressed="true"]');
      if (active && typeof active.scrollIntoView === 'function') {
        active.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function close() {
    panel.classList.add("scale-95", "opacity-0", "pointer-events-none");
    panel.classList.remove("scale-100", "opacity-100");
    setTimeout(() => {
      if (panel.parentNode) panel.parentNode.removeChild(panel);
      onClose?.();
    }, 200);
  }

  // Event delegation
  panel.addEventListener("click", (e) => {
    const categoryBtn = e.target.closest('[data-category]');
    if (categoryBtn) {
      selectedCategory = categoryBtn.dataset.category;
      selectedProvider = "all";
      panel.innerHTML = render();
      requestAnimationFrame(() => {
        const active = panel.querySelector('[aria-pressed="true"]');
        if (active && typeof active.scrollIntoView === 'function') {
          active.scrollIntoView({ block: "nearest" });
        }
      });
      return;
    }

    const providerBtn = e.target.closest('[data-provider]');
    if (providerBtn) {
      selectedProvider = providerBtn.dataset.provider;
      panel.innerHTML = render();
      requestAnimationFrame(() => {
        const active = panel.querySelector('[aria-pressed="true"]');
        if (active && typeof active.scrollIntoView === 'function') {
          active.scrollIntoView({ block: "nearest" });
        }
      });
      return;
    }

    const entryBtn = e.target.closest('[data-entry-id]');
    if (entryBtn) {
      const entryId = entryBtn.dataset.entryId;
      const variantIds = entryBtn.dataset.variantIds.split(",");
      // Find entry by id
      const entry = allEntries.find((e) => e.id === entryId);
      if (entry) {
        onSelectModel?.(entry, selectedCategory);
        close();
      }
      return;
    }

    const searchInput = e.target.closest('input[type="text"]');
    if (searchInput) {
      searchInput.focus();
      return;
    }
  });

  panel.addEventListener("input", (e) => {
    if (e.target.matches('input[type="text"]')) {
      search = e.target.value;
      if (search.trim()) selectedProvider = "all";
      panel.innerHTML = render();
      requestAnimationFrame(() => {
        const active = panel.querySelector('[aria-pressed="true"]');
        if (active && typeof active.scrollIntoView === 'function') {
          active.scrollIntoView({ block: "nearest" });
        }
      });
    }
  });

  // Escape to close
  function escapeHandler(e) {
    if (e.key === "Escape" && panel.parentNode) {
      close();
      document.removeEventListener("keydown", escapeHandler);
    }
  }
  document.addEventListener("keydown", escapeHandler);

  // Outside click to close
  function outsideClickHandler(e) {
    if (!panel.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) {
      close();
      document.removeEventListener("click", outsideClickHandler);
    }
  }
  document.addEventListener("click", outsideClickHandler);

  // Reposition on resize
  window.addEventListener("resize", positionPanel);

  // Cleanup
  const cleanup = () => {
    document.removeEventListener("keydown", escapeHandler);
    document.removeEventListener("click", outsideClickHandler);
    window.removeEventListener("resize", positionPanel);
    if (panel.parentNode) panel.parentNode.removeChild(panel);
  };

  return {
    open,
    close,
    panel,
    cleanup,
  };
}

/**
 * Convenience mount for image workflow picker (T2I / I2I).
 */
export function mountImageModelSelector(options) {
  return mountTemplateModelSelector({
    ...options,
    allowedModelTypes: options.allowedModelTypes || ["t2i", "i2i"],
    copy: {
      ...options.copy,
      categories: {
        t2i: options.copy?.categories?.t2i || "T2I",
        i2i: options.copy?.categories?.i2i || "I2I",
        ...options.copy?.categories,
      },
    },
  });
}

/**
 * Convenience mount for video workflow picker (T2V / I2V / V2V).
 */
export function mountVideoModelSelector(options) {
  return mountTemplateModelSelector({
    ...options,
    allowedModelTypes: options.allowedModelTypes || ["t2v", "i2v", "v2v"],
    copy: {
      ...options.copy,
      categories: {
        t2v: options.copy?.categories?.t2v || "T2V",
        i2v: options.copy?.categories?.i2v || "I2V",
        v2v: options.copy?.categories?.v2v || "V2V",
        ...options.copy?.categories,
      },
    },
  });
}

// Re-export model-family indexes for TemplateStudio compatibility
export {
  imageModelPickerEntryByVariantId,
  videoModelPickerEntryByVariantId,
} from "./modelFamilies.js";

export function positionModelSelectorDropdown(dropdown, trigger, offset, container) {
  if (!dropdown || !trigger) return;
  const rect = trigger.getBoundingClientRect();
  const panelRect = dropdown.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // Reset positioning
  dropdown.style.top = '';
  dropdown.style.bottom = '';
  dropdown.style.left = '';
  dropdown.style.right = '';

  // Default: below trigger
  let top = rect.bottom + (offset || 8);
  let flipped = false;

  // If not enough space below, flip above
  if (top + panelRect.height > viewportHeight - 16 && rect.top > panelRect.height + 16) {
    top = rect.top - panelRect.height - (offset || 8);
    flipped = true;
  }

  // Horizontal positioning
  let left = rect.left;
  if (left + panelRect.width > viewportWidth - 16) {
    left = viewportWidth - panelRect.width - 16;
  }
  if (left < 16) left = 16;

  dropdown.style.top = `${top}px`;
  dropdown.style.left = `${left}px`;
  if (flipped) {
    dropdown.classList.add('flipped');
  } else {
    dropdown.classList.remove('flipped');
  }
}

export { PROVIDER_LOGOS, invertLogos, getProviderStyle, renderProviderLogoImg };
