// [remix] One picture card of the Library side panel: a thumbnail (pre-made image, a video poster that plays on hover, or a live preview
// render), a title, a small "+" that adds it straight away, and a click that opens the big Add to timeline window on that item.
// It only draws; what a click does is decided by library-panel.tsx. Live renders use the same capped slots as the big window (preview-card.tsx).
import { useEffect, useRef, useState, type HTMLAttributes } from 'react';
import type { CardPreview } from './preview-types';
import { ADD_TIP, LiveStage, STAGE_BG, useInView, useLiveSlot } from './preview-card';

/** Only this many cards play a video at once (browsers limit simultaneous media players). */
const MAX_VIDEOS = 3;
const playing = new Set<symbol>();
function useVideoSlot(wanted: boolean): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    if (!wanted) return undefined;
    const id = Symbol('lib-video');
    if (playing.size < MAX_VIDEOS) { playing.add(id); setHas(true); }
    return () => { playing.delete(id); setHas(false); };
  }, [wanted]);
  return has;
}

export interface LibraryCardProps {
  title: string;
  sub?: string;
  badge?: string;
  /** A pre-made picture (animations, motion graphics, video posters). */
  image?: string | null;
  /** A short clip that plays while the pointer is over the card. */
  video?: string;
  /** How to draw it live when there is no picture (or while hovering to play it). */
  preview?: CardPreview;
  testId?: string;
  /** Click on the card. */
  onOpen: () => void;
  /** Click on the "+". */
  onAdd: () => void;
  addTip?: string;
  /** Starred? When `onToggleFavorite` is given the card shows a star. */
  favorite?: boolean;
  onToggleFavorite?: () => void;
  /** Drag-to-timeline props (see library-dnd.ts). */
  drag?: Pick<HTMLAttributes<HTMLElement>, 'draggable' | 'onDragStart'>;
}

export function LibraryCard({ title, sub, badge, image, video, preview, testId, onOpen, onAdd, addTip = ADD_TIP, drag, favorite, onToggleFavorite }: LibraryCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  const [hover, setHover] = useState(false);
  const [hoverPlay, setHoverPlay] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => { setHoverPlay(false); if (!hover) return undefined; const t = window.setTimeout(() => setHoverPlay(true), 250); return () => window.clearTimeout(t); }, [hover]);

  const hasImage = !!image && imgOk;
  const wantLive = visible && !!preview && (!hasImage || hoverPlay);
  const slot = useLiveSlot(wantLive);
  const showImage = hasImage && !(wantLive && slot);
  const videoSlot = useVideoSlot(!!video && visible && hoverPlay);
  const key = (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } };

  return (
    <div ref={ref} className="lib-card" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)} style={{ position: 'relative' }}>
      <div role="button" tabIndex={0} {...drag} className="lib-card__body" aria-label={title} title={title} data-testid={testId} onClick={onOpen} onKeyDown={key}>
        <div className="lib-card__thumb" style={{ background: STAGE_BG }} data-live={slot ? 'true' : 'false'}>
          {showImage && <img src={image!} alt="" loading="lazy" draggable={false} onError={() => setImgOk(false)} className="lib-card__img" />}
          {wantLive && slot && preview && <LiveStage preview={preview} playing={hoverPlay} />}
          {video && videoSlot && <video src={video} poster={image ?? undefined} muted loop autoPlay playsInline preload="metadata" className="lib-card__img" style={{ background: '#000' }} />}
          {badge && <span className="lib-card__badge">{badge}</span>}
        </div>
        <div className="lib-card__title">{title}</div>
        {sub && <div className="lib-card__sub">{sub}</div>}
      </div>
      {onToggleFavorite && (
        <button type="button" className={`lib-card__star${favorite ? ' lib-card__star--on' : ''}`} aria-pressed={!!favorite} aria-label={`${favorite ? 'Remove from favorites' : 'Add to favorites'}: ${title}`} title={favorite ? 'Remove from favorites' : 'Add to favorites'} data-testid={testId ? `${testId}-star` : undefined} onClick={onToggleFavorite}>{favorite ? '★' : '☆'}</button>
      )}
      <button type="button" className="add-card-plus lib-card__plus" aria-label={`${addTip}: ${title}`} data-tip={addTip} data-testid={testId ? `${testId}-add` : undefined} onClick={onAdd}>+</button>
    </div>
  );
}
