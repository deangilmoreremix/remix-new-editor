// Copied verbatim from upstream Open-Generative-AI
// (packages/studio/src/components/ImageStudio.jsx, ModelDropdown).
// Only the imports are changed to point at this app's modules.
import { useState, useEffect, useRef } from "react";
import {
  imageModelPickerEntries,
  imageModelPickerEntryByVariantId,
} from "../../lib/modelFamilies.js";

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
  stability: "https://cdn.muapi.ai/models/stability.png"
};

const invertLogos = ['openai', 'blackforest', 'runway', 'ideogram', 'lightricks', 'grok'];

function ModelDropdown({ selectedModel, onSelect, onClose, copy }) {
  const t = copy.modelDropdown;
  const [search, setSearch] = useState("");
  const selectedEntry = imageModelPickerEntryByVariantId.get(selectedModel);
  const modelCategories = [
    {
      id: "all",
      label: t.categoryAll,
      entries: imageModelPickerEntries,
    },
    {
      id: "t2i",
      label: t.categoryT2I,
      entries: imageModelPickerEntries.filter((entry) => entry.variantsByMode.t2i),
    },
    {
      id: "i2i",
      label: t.categoryI2I,
      entries: imageModelPickerEntries.filter((entry) => entry.variantsByMode.i2i),
    },
  ];
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProvider, setSelectedProvider] = useState("all");
  const activeCategory = modelCategories.find((category) => category.id === selectedCategory) || modelCategories[0];
  const modelEntries = activeCategory.entries;

  const activeItemRef = useRef(null);

  useEffect(() => {
    // Automatically scroll the active model into view when opening
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: "nearest" });
    }
  }, []);

  const getProviderStyle = (provider) => {
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
  };

  // Dynamically compute list of providers from the input models list
  const availableProviders = [];
  const seenProviders = new Set();
  
  modelEntries.forEach(({ family }) => {
    const pId = family.provider || 'muapi';
    const pName = family.provider_name || 'Muapi';
    if (!seenProviders.has(pId)) {
      seenProviders.add(pId);
      availableProviders.push({ id: pId, name: pName });
    }
  });

  const filtered = modelEntries.filter((entry) => {
    const { family } = entry;
    // 1. Filter by provider tab
    if (selectedProvider !== "all") {
      const pId = family.provider || 'muapi';
      if (pId !== selectedProvider) return false;
    }
    // 2. Filter by search query
    const query = search.toLowerCase();
    return entry.searchText.includes(query);
  });

  return (
    <div className="flex gap-4 h-full max-h-[60vh] min-h-[350px] overflow-x-hidden">
      {/* Left Sidebar: Provider tabs */}
      <div className="flex flex-col gap-2.5 items-center pr-2 border-r border-white/5 shrink-0 select-none overflow-y-auto custom-scrollbar w-14 pt-0.5">
        <button
          type="button"
          onClick={() => setSelectedProvider("all")}
          className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all flex-shrink-0 cursor-pointer ${
            selectedProvider === "all"
              ? "bg-white/10 text-yellow-400 border-yellow-500/30 shadow-md scale-105"
              : "bg-white/[0.02] text-white/50 border-white/[0.03] hover:bg-white/5 hover:text-white"
          }`}
          title={t.allProviders}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={selectedProvider === "all" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
        
        {availableProviders.map(p => {
          const style = getProviderStyle(p.id);
          const isSelected = selectedProvider === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProvider(p.id)}
              aria-pressed={isSelected}
              className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center overflow-hidden font-black text-[10px] border transition-all cursor-pointer ${
                isSelected
                  ? `${style.bg} scale-105 shadow-md shadow-black/10`
                  : "bg-white/[0.02] text-white/40 border-white/[0.02] hover:bg-white/5 hover:text-white/80"
              }`}
              title={p.name}
            >
              {PROVIDER_LOGOS[p.id] ? (
                <img
                  src={PROVIDER_LOGOS[p.id]}
                  alt={p.name}
                  className={`w-full h-full rounded-full object-contain ${invertLogos.includes(p.id) ? "invert" : ""}`}
                />
              ) : (
                style.text
              )}
            </button>
          );
        })}
      </div>

      {/* Right Pane: Search input + Models list */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="border-b border-white/5 shrink-0 pb-2 space-y-2">
          <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
            {modelCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSelectedProvider("all");
                }}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors border ${
                  selectedCategory === category.id
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-white/[0.02] text-white/50 border-white/[0.04] hover:bg-white/5 hover:text-white"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 border border-white/5 focus-within:border-primary/50 transition-colors">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-muted"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const value = e.target.value;
                setSearch(value);
                if (value.trim()) setSelectedProvider("all");
              }}
              className="bg-transparent border-none text-xs text-white focus:ring-0 w-full p-0 focus:outline-none"
            />
          </div>
        </div>
        
        <div className="text-xs font-semibold text-secondary py-1 shrink-0 flex items-center justify-between">
          <span>{activeCategory.label} {t.modelsSuffix}</span>
          {selectedProvider !== "all" && (
            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/60">
              {availableProviders.find(p => p.id === selectedProvider)?.name || selectedProvider}
            </span>
          )}
        </div>
        
        <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1 pb-2 flex-1">
          {filtered.length === 0 ? (
            <div className="text-xs text-white/30 text-center py-6">
              {t.noModelsFound}
            </div>
          ) : (
            filtered.map((entry) => {
              const { family } = entry;
              const isSelected = selectedEntry === entry;
              return (
              <div
                key={entry.id}
                ref={isSelected ? activeItemRef : null}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(entry, activeCategory.id);
                  onClose();
                }}
                className={`flex items-center justify-between p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-all border border-transparent hover:border-white/5 ${
                  isSelected ? "bg-white/5 border-white/5" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  {PROVIDER_LOGOS[family.provider] ? (
                    <div className="w-8 h-8 rounded-full border border-white/5 overflow-hidden shrink-0 flex items-center justify-center bg-white/[0.02]">
                      <img
                        src={PROVIDER_LOGOS[family.provider]}
                        alt={family.provider_name}
                        className={`w-full h-full object-contain p-1 ${invertLogos.includes(family.provider) ? "invert" : ""}`}
                      />
                    </div>
                  ) : (
                    <div
                      className={`w-8 h-8 ${
                        family.id.includes("kontext")
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/10"
                          : family.id.includes("effects")
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/10"
                            : "bg-primary/10 text-primary border-primary/10"
                      } border rounded-full flex items-center justify-center font-bold text-xs shadow-inner uppercase`}
                    >
                      {entry.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-bold text-white tracking-tight truncate">
                      {entry.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                    {selectedProvider === "all" && family.provider_name && (
                      <span className="text-[9px] text-white/40">
                        {family.provider_name}
                      </span>
                    )}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="4"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default ModelDropdown;
