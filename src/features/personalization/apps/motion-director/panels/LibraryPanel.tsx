import React, { useCallback, useMemo, useState } from "react";
import {
  MOTION_CATEGORIES,
  MOTION_TEMPLATE_CARDS,
  MOTION_TEMPLATES,
  motionTemplateTitle,
  motionTemplateVariants,
  resolveMotionTemplate,
  type MotionCategoryKey,
  type MotionTemplate,
} from "../../../data/motionRecipeCatalog";
import MotionRecipeCard from "../components/MotionRecipeCard";
import { useStore } from "../store";
import { setDragPayload } from "../dnd";
import { MEDIA_ITEMS, BGM_LIB, SFX_LIB, type MediaItem, type LibAudio } from "../mediaManifest";
import {
  loadSavedRecipes,
  removeRecipe,
  renameRecipe,
  saveRecipe,
  type SavedRecipe,
} from "../lib/savedRecipes";

interface LibraryPanelProps {
  categories?: readonly MotionCategoryKey[];
  onSelectRecipe: (recipe: MotionTemplate) => void;
  onRenameRecipe?: (recipe: MotionTemplate) => void;
  onDeleteRecipe?: (id: string) => void;
  /** Insert the shot on the timeline at the playhead (library → timeline). */
  onAddToTimeline?: (recipe: MotionTemplate) => void;
}

const TABS: { id: LibraryTab; label: string }[] = [
  { id: "templates", label: "Templates" },
  { id: "recipes", label: "My Motion Recipes" },
  { id: "media", label: "Media" },
  { id: "sound", label: "Sound" },
];

type LibraryTab = "templates" | "recipes" | "media" | "sound";
type CategoryFilter = MotionCategoryKey | "all";

const matchesQuery = (t: MotionTemplate, q: string) =>
  t.name.toLowerCase().includes(q) ||
  t.nameEn.toLowerCase().includes(q) ||
  motionTemplateTitle(t).toLowerCase().includes(q) ||
  t.slug.toLowerCase().includes(q) ||
  t.summary.toLowerCase().includes(q) ||
  t.summaryEn.toLowerCase().includes(q) ||
  t.componentName.toLowerCase().includes(q);

export default function LibraryPanel({
  categories,
  onSelectRecipe,
  onRenameRecipe,
  onDeleteRecipe,
  onAddToTimeline,
}: LibraryPanelProps) {
  const [tab, setTab] = useState<LibraryTab>("templates");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [saved, setSaved] = useState<SavedRecipe[]>(() => loadSavedRecipes());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  /** Recipes the user already used in a session — they belong to "My Recipes"
   *  too, so the tab is never empty for someone who has built something. */
  const sessions = useStore((s) => s.sessions);
  const sessionRecipeIds = useMemo(
    () => sessions.map((sess) => sess.recipeId).filter((id): id is string => Boolean(id)),
    [sessions],
  );
  const setPreview = useStore((s) => s.setPreview);
  /** Media library items (captured pages / cutouts / uploads from public/). */
  const mediaItems = useMemo<MediaItem[]>(() => MEDIA_ITEMS, []);
  /** SFX grouped by category for the Sound tab. */
  const sfxByCat = useMemo<Map<string, LibAudio[]>>(() => {
    const m = new Map<string, LibAudio[]>();
    for (const s of SFX_LIB) {
      const cat = s.cat;
      const arr = m.get(cat) ?? [];
      arr.push(s);
      m.set(cat, arr);
    }
    return m;
  }, []);

  /** Each tab reads a different source:
   *  - Templates  → the 124 grouped cards (a card groups its shot variants)
   *  - My Recipes → the shots the user saved (localStorage) plus the recipes
   *                 their sessions were built from */
  const source = useMemo<readonly MotionTemplate[]>(() => {
    if (tab === "templates") {
      const list = categories?.length
        ? MOTION_TEMPLATE_CARDS.filter((t) => categories.includes(t.category))
        : MOTION_TEMPLATE_CARDS;
      return list;
    }
    const out: MotionTemplate[] = [];
    const seen = new Set<string>();
    for (const rec of saved) {
      const template = resolveMotionTemplate(rec.id);
      if (!template || seen.has(template.id)) continue;
      seen.add(template.id);
      out.push(template);
    }
    for (const id of sessionRecipeIds) {
      const template = resolveMotionTemplate(id);
      if (!template || seen.has(template.id)) continue;
      seen.add(template.id);
      out.push(template);
    }
    return out;
  }, [tab, categories, saved, sessionRecipeIds]);

  /** Per-category counts for the active source (the chips read as a rail). */
  const counts = useMemo(() => {
    const map = new Map<MotionCategoryKey, number>();
    for (const t of source) map.set(t.category, (map.get(t.category) ?? 0) + 1);
    return map;
  }, [source]);

  const recipes = useMemo(() => {
    let list = source;
    if (category !== "all") list = list.filter((t) => t.category === category);
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter((t) => matchesQuery(t, q));
    return list;
  }, [source, category, searchQuery]);

  const savedIds = useMemo(() => new Set(saved.map((r) => r.id)), [saved]);

  const handleSave = useCallback((recipe: MotionTemplate) => {
    setSaved(saveRecipe(recipe.id));
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (onDeleteRecipe) {
        onDeleteRecipe(id);
        return;
      }
      setSaved(removeRecipe(id));
    },
    [onDeleteRecipe],
  );

  const handleRename = useCallback(
    (recipe: MotionTemplate) => {
      if (onRenameRecipe) {
        onRenameRecipe(recipe);
        return;
      }
      const current = saved.find((r) => r.id === recipe.id)?.name ?? recipe.name;
      const next = window.prompt("Rename recipe", current);
      if (next === null) return;
      setSaved(renameRecipe(recipe.id, next.trim() || current));
    },
    [onRenameRecipe, saved],
  );

  const toggleVariants = useCallback((recipe: MotionTemplate) => {
    setExpanded((prev) => ({ ...prev, [recipe.id]: !prev[recipe.id] }));
  }, []);

  const emptyMessage =
    tab === "recipes" && source.length === 0
      ? "No saved recipes yet — save a shot from Templates to pin it here."
      : "No recipes found";

  /** 素材库卡：点击预览（store.previewItem），拖拽落入时间轨（media/audio-clip 卡）。 */
  const MediaCard: React.FC<{ item: MediaItem }> = ({ item }) => {
    const cardId = item.kind === "audio" ? "audio-clip" : item.kind === "video" ? "video-clip" : "image-clip";
    const handleClick = () => setPreview({ kind: item.kind, file: item.file, label: item.name });
    const handleDragStart = (e: React.DragEvent) => {
      setDragPayload(e, { cardId, props: { file: item.file }, label: item.name, duration: 90 });
    };
    const isAudio = item.kind === "audio";
    return (
      <div
        key={item.file}
        className="library-item"
        draggable
        onDragStart={handleDragStart}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={item.name}
      >
        <div className="aspect-[4/3] rounded-xl overflow-hidden border border-white/[0.05] bg-[var(--bg-card)] group cursor-pointer hover:border-white/20">
          {isAudio ? (
            <div className="w-full h-full flex items-center justify-center bg-black/40 text-[#22d3ee]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18V5l10-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="16" cy="16" r="3" />
              </svg>
            </div>
          ) : (
            <img src={`/${item.file}`} alt={item.name} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1 pt-3">
            <h3 className="text-xs font-medium text-white truncate" title={item.name}>
              {item.name}
            </h3>
          </div>
        </div>
      </div>
    );
  };

  /** 音频库卡：点击预览，拖拽落入时间轨为 audio-clip 片段。 */
  const SoundCard: React.FC<{ item: LibAudio; kind: "bgm" | "sfx" }> = ({ item, kind }) => {
    const handleClick = () => setPreview({ kind: "audio", file: item.file, label: item.name });
    const handleDragStart = (e: React.DragEvent) => {
      setDragPayload(e, { cardId: "audio-clip", props: { file: item.file }, label: item.name, duration: 90 });
    };
    return (
      <div
        key={item.file}
        className="library-item"
        draggable
        onDragStart={handleDragStart}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={item.name}
      >
        <div className="rounded-xl overflow-hidden border border-white/[0.05] bg-[var(--bg-card)] group cursor-pointer hover:border-white/20 p-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded bg-black/40 flex items-center justify-center text-[#22d3ee]">
              🔊
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-medium text-white truncate" title={item.name}>
                {item.name}
              </h3>
              <span className="text-[10px] text-white/40">{kind === "bgm" ? "BGM" : item.cat}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
              className="p-1 rounded hover:bg-white/[0.08] text-white/50"
              aria-label="Preview"
            >
              ▶
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="library-panel p-3 text-white min-h-full" style={{ background: "var(--bg-app)" }}>
      <div className="library-toolbar mb-4 flex flex-col gap-3">
        <div className="library-tabs flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border border-white/[0.05] transition-all ${
                tab === t.id
                  ? "bg-[rgba(59,130,246,0.2)] text-[#60a5fa]"
                  : "bg-[var(--bg-card)] text-white/50 hover:text-white/80"
              }`}
              onClick={() => {
                setTab(t.id);
                setCategory("all");
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="library-search relative w-full">
          <input
            type="text"
            placeholder={tab === "media" ? "Search media..." : tab === "sound" ? "Search sound..." : "Search recipes..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none bg-[var(--bg-card)] border border-white/[0.05] focus:border-white/20"
          />
        </div>
        {tab !== "media" && tab !== "sound" && (
          <div className="library-categories flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
              category === "all"
                ? "border-[rgba(96,165,250,0.3)] bg-[rgba(59,130,246,0.15)] text-[#60a5fa]"
                : "border-white/[0.05] bg-[var(--bg-card)] text-white/50 hover:text-white/80"
            }`}
          >
            All <span className="opacity-60">{source.length}</span>
          </button>
          {MOTION_CATEGORIES.map((c) => {
            const n = counts.get(c.key) ?? 0;
            if (n === 0) return null;
            const active = category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(active ? "all" : c.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                  active
                    ? "border-[rgba(96,165,250,0.3)] bg-[rgba(59,130,246,0.15)] text-[#60a5fa]"
                    : "border-white/[0.05] bg-[var(--bg-card)] text-white/50 hover:text-white/80"
                }`}
              >
                {c.labelEn} <span className="opacity-60">{n}</span>
              </button>
            )
          })}
          </div>
        )}
      </div>
      <div className="library-grid grid grid-cols-2 gap-2">
        {tab === "media" ? (
          <>
            {mediaItems.map((item) => (
              <div key={item.file} className="library-item">
                <MediaCard item={item} />
              </div>
            ))}
            {mediaItems.length === 0 && (
              <div className="col-span-full text-center py-12 text-sm text-white/40">
                No media files found in public/motion-studio
              </div>
            )}
          </>
        ) : tab === "sound" ? (
          <>
            <div className="col-span-full">
              <h4 className="text-[10px] uppercase tracking-wider text-white/30 mb-3 px-2">BGM</h4>
              <div className="grid grid-cols-2 gap-2">
                {BGM_LIB.map((bgm) => (
                  <div key={bgm.file} className="library-item">
                    <SoundCard item={bgm} kind="bgm" />
                  </div>
                ))}
              </div>
            </div>
            {[...sfxByCat.entries()].map(([cat, items]) => (
              <div key={cat} className="col-span-full mb-4">
                <h4 className="text-[10px] uppercase tracking-wider text-white/30 mb-3 px-2">
                  SFX · {cat}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((s) => (
                    <div key={s.file} className="library-item">
                      <SoundCard item={s} kind="sfx" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {(BGM_LIB.length + SFX_LIB.length) === 0 && (
              <div className="col-span-full text-center py-12 text-sm text-white/40">
                No sound files found in public/motion-studio
              </div>
            )}
          </>
        ) : (
          <>
            {recipes.map((recipe) => {
              const variants = tab === "templates" ? motionTemplateVariants(recipe) : [];
              const isOpen = Boolean(expanded[recipe.id]);
              return (
                <div key={recipe.id} className="library-item">
                  <MotionRecipeCard
                    recipe={recipe}
                    onClick={onSelectRecipe}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onSave={handleSave}
                    onAddToTimeline={onAddToTimeline}
                    setPreview={setPreview}
                    saved={savedIds.has(recipe.id)}
                    isUser={tab === "recipes"}
                    variantCount={variants.length}
                    variantsOpen={isOpen}
                    onToggleVariants={toggleVariants}
                  />
                  {isOpen && variants.length > 1 && (
                    <div className="library-variants mt-2 flex flex-col gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                      {variants.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center gap-2 text-[11px] text-white/60"
                        >
                          <span className="truncate flex-1" title={v.nameEn}>
                            {motionTemplateTitle(v).split(" · ").pop()}
                          </span>
                          <span className="text-white/30">{v.durationSec}s</span>
                          <button
                            type="button"
                            className="px-1.5 py-0.5 rounded bg-white/[0.05] hover:text-[#22d3ee] transition-colors"
                            onClick={() => onSelectRecipe(v)}
                            title="Use this shot in the chat"
                          >
                            Use
                          </button>
                          <button
                            type="button"
                            className="px-1.5 py-0.5 rounded bg-white/[0.05] hover:text-[#22d3ee] transition-colors"
                            onClick={() => onAddToTimeline?.(v)}
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {recipes.length === 0 && (
              <div className="col-span-full text-center py-12 text-sm text-white/40">
                {emptyMessage}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
