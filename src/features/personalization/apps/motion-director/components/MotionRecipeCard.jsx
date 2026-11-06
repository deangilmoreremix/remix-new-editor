import { useState, useRef, useEffect, useCallback } from 'react';
import { Player } from '@remotion/player';
import { MoreHorizontal, Plus, ChevronDown, ChevronRight, Bookmark } from 'lucide-react';
import { CARDS } from '../cards/registry';
import { cardFps, cardSize } from '../cards/types';
import { themedProps } from '../theme';
import { MANIFEST } from '../cards/projectCards';
import { PromptMenuList, PromptMenuItem } from '../../../packages/studio/src/components/prompt/PromptComposer';
import { setDragPayload } from '../dnd';
import { MOTION_CATEGORIES, motionCardId, motionTemplateTitle } from '../../../data/motionRecipeCatalog';

const CATEGORY_LABEL_EN = Object.fromEntries(MOTION_CATEGORIES.map((c) => [c.key, c.labelEn]));

const CATEGORY_GRADIENTS = {
  opening: 'from-[#22d3ee]/20 to-[#0ea5e9]/20',
  typography: 'from-[#a855f7]/20 to-[#c084fc]/20',
  'ui-entrance': 'from-[#f472b6]/20 to-[#fbcfe8]/20',
  camera: 'from-[#60a5fa]/20 to-[#93c5fd]/20',
  data: 'from-[#34d399]/20 to-[#86efac]/20',
  interaction: 'from-[#fbbf24]/20 to-[#fcd34d]/20',
  transition: 'from-[#a78bfa]/20 to-[#c4b5fd]/20',
  rhythm: 'from-[#fdba74]/20 to-[#fed7aa]/20',
  effects: 'from-[#22d3ee]/20 to-[#818cf8]/20',
  outro: 'from-[#94a3b8]/20 to-[#cbd5e1]/20',
};

/**
 * Live <Player> mounting is deferred until the card scrolls into view: the
 * library grid can hold 150+ Remotion players at once, which is far too heavy
 * to mount eagerly. Once a card has been seen it stays mounted, so scrolling
 * back and forth does not re-create the player.
 */
function useInView(ref, rootMargin = '300px') {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

export default function MotionRecipeCard({
  recipe,
  onClick,
  onRename,
  onDelete,
  isUser,
  saved,
  onSave,
  onAddToTimeline,
  setPreview,
  variantCount = 0,
  variantsOpen = false,
  onToggleVariants,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const rootRef = useRef(null);
  const inView = useInView(rootRef);

  // The catalog id is `<category>/<slug>/<Component>`; the card registry keys
  // demo cards as `demo:<Stem>`. `motionCardId` is the single bridge between
  // the two — indexing CARDS with the raw catalog id always misses.
  const cardId = motionCardId(recipe);
  const card = CARDS[cardId];

  const openMenu = useCallback(
    (e) => {
      e.stopPropagation();
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 8, left: Math.max(8, rect.left) });
      setMenuOpen(true);
    },
    [],
  );

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    const onClickAway = (e) => {
      const el = btnRef.current;
      const menu = document.querySelector('[data-recipe-menu]');
      if (menu && el && !el.contains(e.target) && !menu.contains(e.target)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [closeMenu]);

  const gradient = CATEGORY_GRADIENTS[recipe.category] || CATEGORY_GRADIENTS.effects;

  /** Click = use the shot in the chat. Adding to the timeline is the Add button or a drag. */
  const handleCardClick = useCallback(
    (e) => {
      if (menuOpen) return;
      e.stopPropagation();
      onClick?.(recipe);
    },
    [menuOpen, recipe, onClick],
  );

  /** Drag the shot straight onto a timeline lane (timeline/Timeline.tsx onDrop). */
  const handleDragStart = useCallback(
    (e) => {
      setDragPayload(e, {
        cardId,
        duration: recipe.durationInFrames,
        label: recipe.nameEn ? motionTemplateTitle(recipe) : recipe.name,
      });
    },
    [cardId, recipe],
  );

  const handleAdd = useCallback(
    (e) => {
      e.stopPropagation();
      onAddToTimeline?.(recipe);
    },
    [onAddToTimeline, recipe],
  );

  /** Enter / Space on the focused card = the click (use it in the chat); keys on the nested Add button stay its own. */
  const handleCardKeyDown = useCallback(
    (e) => {
      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      onClick?.(recipe);
    },
    [onClick, recipe],
  );

  return (
      <div className="relative w-full" ref={rootRef} data-recipe-card={recipe.id}>
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        className="absolute top-1 right-1 z-20 p-1.5 rounded hover:bg-white/[0.08] text-white/40 hover:text-[#22d3ee] transition-colors"
        aria-label="Options"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {menuOpen && (
        <div
          data-recipe-menu
          className="fixed z-50 mt-1 w-48 rounded-lg border border-white/[0.08] bg-[#0a0a0a]/90 backdrop-blur-md shadow-2xl text-white/80"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <PromptMenuList>
            {isUser ? (
              <>
                <PromptMenuItem
                  onClick={() => {
                    onRename?.(recipe);
                    closeMenu();
                  }}
                >
                  Rename
                </PromptMenuItem>
                <PromptMenuItem onClick={closeMenu}>Duplicate</PromptMenuItem>
                <PromptMenuItem
                  onClick={() => {
                    onDelete?.(recipe.id);
                    closeMenu();
                  }}
                  className="text-rose-400 hover:text-rose-300"
                >
                  Delete
                </PromptMenuItem>
              </>
            ) : (
              <>
                <PromptMenuItem
                  onClick={() => {
                    onSave?.(recipe);
                    closeMenu();
                  }}
                >
                  {saved ? 'Saved to My Recipes' : 'Save to My Recipes'}
                </PromptMenuItem>
                <PromptMenuItem
                  onClick={() => {
                    onAddToTimeline?.(recipe);
                    closeMenu();
                  }}
                >
                  Add to timeline
                </PromptMenuItem>
                <PromptMenuItem
                  onClick={() => {
                    setPreview?.({ kind: "card", cardId });
                    closeMenu();
                  }}
                >
                  View template
                </PromptMenuItem>
              </>
            )}
          </PromptMenuList>
        </div>
      )}
      <div
        className="aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border border-white/[0.05] bg-[var(--bg-card)] transition-all hover:border-white/20 group"
        draggable
        onDragStart={handleDragStart}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Use ${recipe.nameEn || recipe.name} in the chat`}
        title="Click to use in the chat · drag to the timeline (or use Add)"
        data-testid="library-recipe-card"
      >
        <div className="w-full h-full relative">
          {card && inView ? (
            <Player
              component={card.component}
              inputProps={themedProps(MANIFEST, card, undefined, {}, undefined)}
              durationInFrames={Math.max(2, card.durationInFrames)}
              compositionWidth={cardSize(card).width}
              compositionHeight={cardSize(card).height}
              fps={cardFps(card)}
              initialFrame={Math.min(card.durationInFrames - 1, Math.round(card.durationInFrames * 0.45))}
              loop
              controls={false}
              initiallyMuted
              numberOfSharedAudioTags={0}
              acknowledgeRemotionLicense
              style={{ width: '100%', height: '100%' }}
            />
          ) : card ? (
            <div className="w-full h-full" data-recipe-thumb="pending" />
          ) : (
            <div className="w-full h-full">
              <div className={`absolute inset-0 ${gradient} rounded-lg`} />
            </div>
          )}
          <div className="absolute top-2 left-2 z-10">
            <span
              className="text-[9px] font-semibold text-[#60a5fa] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[rgba(59,130,246,0.15)] border border-[rgba(59,130,246,0.3)]"
            >
              {CATEGORY_LABEL_EN[recipe.category] ?? recipe.categoryLabel ?? recipe.category}
            </span>
          </div>
          {saved && (
            <div className="absolute top-2 right-8 z-10 text-[#fbbf24]">
              <Bookmark className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4">
            <h3 className="text-xs font-medium text-white truncate" title={recipe.nameEn}>{recipe.nameEn ? motionTemplateTitle(recipe) : recipe.name}</h3>
          </div>
          <div className="absolute bottom-8 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleAdd}
              title="Add to timeline"
              aria-label="Add to timeline"
              className="p-1.5 rounded bg-black/60 border border-white/10 text-white/70 hover:text-[#22d3ee] hover:border-[#22d3ee]/40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      {variantCount > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVariants?.(recipe);
          }}
          className="mt-1 w-full flex items-center justify-center gap-1 text-[10px] font-medium text-white/45 hover:text-[#22d3ee] transition-colors"
          aria-expanded={variantsOpen}
        >
          {variantsOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          {variantCount} variants
        </button>
      )}
    </div>
  );
}
