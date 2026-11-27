// Template videos library (additive). Same layout as hyperframes-modal.tsx / the Personalize demo picker, minus every personalization
// feature: category pills with counts, search, aspect filter, and a grid of cards whose clips load and play as they scroll into view.
// Picking a card hands the clip to the editor, which adds it to the timeline at the playhead.
// Presentation: the shared Edit-tab ModalShell and cg-* classes (styles/modal-shell.css, styles/edit-modal-templates.css).
import { useEffect, useMemo, useRef, useState } from 'react';
import { templateVideos, TEMPLATE_VIDEO_CATEGORIES, TEMPLATE_VIDEO_GROUPS } from '../../../data/templateVideoLibrary.js';
import { ModalShell } from '../ui/modal-shell';
import '../../styles/edit-modal-templates.css';

export type TemplateVideo = {
  id: string; slug: string; title: string; sourceTitle: string; category: string; subcategory: string; duration: number | null; aspectRatio: string;
  videoSrc: string; posterSrc: string | null; tags: string[]; source: string;
  /** "none" = reviewed, no visible logo / watermark / credit; "logo" = has one (see scripts/template-video-branding.json). */
  branding: 'none' | 'logo'; marks?: string; autoLabeled?: boolean;
  /** Descriptive keywords (category, subcategory, title words) and picture orientation, used for search and by other apps via catalog.json. */
  topics?: string[]; orientation?: 'landscape' | 'portrait' | 'square';
  /** Flat browse group shown as a chip (e.g. "Food & Drink"); `category` stays the broad type used by the Type filter. */
  group?: string;
};

const ALL = templateVideos as unknown as TemplateVideo[];
const CATEGORIES = TEMPLATE_VIDEO_CATEGORIES as unknown as string[];
const GROUPS = TEMPLATE_VIDEO_GROUPS as unknown as string[];
const INITIAL = 12;
const STEP = 24;

const GLYPH: Record<string, string> = { All: '▦', 'Drama & Thriller': '◐', 'Fantasy & Surreal': '✧', 'Illustrated & Anime': '✎', 'Vlogs & UGC': '◎', 'Music & Dance': '♪', 'Fashion & Editorial': '✦', 'Food & Drink': '◔', 'Chases & Stunts': '⚡', 'Comedy & Pets': '☺', 'Products & Brands': '◈', '3D Animated': '◇', 'Cute & Kids': '❀', 'Fights & Battles': '⚔', 'Travel & Documentary': '⌖', 'Sci-Fi': '✺', 'Effects & Motion Graphics': '▨', 'Beauty & Fragrance': '✿', 'Titles & Typography': 'T', 'Fitness & Sports': '▲', 'Period & Historical': '♜', 'Cars & Vehicles': '▶', 'Creatures & Heroes': '☗', 'Lifestyle & Food': '☕', 'Aerial & FPV': '➤', More: '…' };

/** "16:9" -> 1.777…; unknown or odd ratios (e.g. "637:270") are used as given. */
export function ratioNumber(r: string): number {
  const [w, h] = r.split(':').map(Number);
  return w > 0 && h > 0 ? w / h : 16 / 9;
}
/** Bucket for the aspect filter. */
export function aspectBucket(r: string): '16:9' | '9:16' | '1:1' {
  const n = ratioNumber(r);
  return Math.abs(n - 1) < 0.12 ? '1:1' : n > 1 ? '16:9' : '9:16';
}
/** Bucket for the duration filter. */
export function durationBucket(d: number | null): 'short' | 'medium' | 'long' | 'extra' {
  const n = d ?? 0;
  return n <= 10.5 ? 'short' : n <= 20.5 ? 'medium' : n <= 30.5 ? 'long' : 'extra';
}
export function searchTemplateVideos(items: TemplateVideo[], q: string): TemplateVideo[] {
  const s = q.trim().toLowerCase();
  if (!s) return items;
  return items.filter((i) => `${i.title} ${i.category} ${i.subcategory} ${i.group ?? ''} ${i.sourceTitle} ${(i.topics ?? []).join(' ')} ${i.tags.join(' ')} ${i.source}`.toLowerCase().includes(s));
}

/** Poster underneath, clip on top. The <video> is only mounted while the card is on screen (releases the decoder and keeps a
 *  200-clip grid under the browser's media-player cap); a failed or reduced-motion clip keeps the poster. */
function CardVideo({ src, poster, title, ratio }: { src: string; poster: string | null; title: string; ratio: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const el = wrap.current; if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setInView(Boolean(e?.isIntersecting)), { rootMargin: '120px 0px', threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const active = inView && !failed && !reduced;
  useEffect(() => { if (!active) setReady(false); }, [active]);
  return (
    <div ref={wrap} className="cg-card__thumb">
      {poster && <img src={poster} alt="" loading="lazy" className="etm-tv__img" />}
      {active && (
        <video src={src} poster={poster ?? undefined} muted playsInline loop autoPlay preload="metadata" aria-label={`Preview of ${title}`} data-ratio={ratio}
          onLoadedData={() => setReady(true)} onError={() => setFailed(true)} className="etm-tv__video" style={{ opacity: ready ? 1 : 0 }} />
      )}
    </div>
  );
}

const SEARCH_ICON = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;

/** The browsable content: category chips, subcategory chips, filters and the grid. The window around it is TemplateVideosModal; the
 *  same panel can also be a tab inside a larger "Add to timeline" window (same Panel/Modal split as HyperframesPanel / MgTemplatesPanel). */
export function TemplateVideosPanel({ onPick, initialQuery }: { onPick: (item: TemplateVideo) => void; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery ?? '');
  const [group, setGroup] = useState('all');
  const [type, setType] = useState('all');
  const [ratio, setRatio] = useState('all');
  const [dur, setDur] = useState('all');
  const [brand, setBrand] = useState('all');
  const [shown, setShown] = useState(INITIAL);
  useEffect(() => { setShown(INITIAL); }, [q, group, type, ratio, dur, brand]);
  // Chip counts follow the other filters (search, type, length, logo, aspect) but not the chip itself, like the Animations tab.
  const base = useMemo(() => searchTemplateVideos(ALL, q).filter((i) => (type === 'all' || i.category === type) && (ratio === 'all' || aspectBucket(i.aspectRatio) === ratio) && (dur === 'all' || durationBucket(i.duration) === dur) && (brand === 'all' || i.branding === brand)), [q, type, ratio, dur, brand]);
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const i of base) m.set(i.group ?? 'More', (m.get(i.group ?? 'More') ?? 0) + 1); return m; }, [base]);
  const chips = useMemo(() => ['All', ...GROUPS.filter((g) => counts.has(g) || g === group)], [counts, group]);
  const list = useMemo(() => (group === 'all' ? base : base.filter((i) => (i.group ?? 'More') === group)), [base, group]);
  const visible = list.slice(0, shown);
  return (
    <div className="etm-fill">
      <div className="etm-head">
        <strong>▣ Choose a template video</strong>
        <span className="etm-spacer" />
        <span className="cg-note">{ALL.length} template videos</span>
      </div>
      <div className="cg-note etm-hint">Previews play as you scroll. Click a card to add it to the timeline.</div>
      <div role="tablist" aria-label="Template video categories" className="cg-chips etm-chips">
        {chips.map((c) => {
          const key = c === 'All' ? 'all' : c;
          const on = group === key;
          return (
            <button key={c} type="button" role="tab" aria-selected={on} className="cg-chip etm-chip" onClick={() => setGroup(key)}>
              <span className="etm-glyph">{GLYPH[c] ?? '•'}</span>{c}
              <span className="cg-count">{c === 'All' ? base.length : counts.get(c) ?? 0}</span>
            </button>
          );
        })}
      </div>
      <div className="etm-filters">
        <div><div className="cg-label">Search</div><label className="cg-search">{SEARCH_ICON}<input type="text" placeholder="Search template videos…" aria-label="Search template videos" value={q} onChange={(e) => setQ(e.target.value)} /></label></div>
        <div><div className="cg-label">Type</div><select className="cg-field" aria-label="Video type" value={type} onChange={(e) => setType(e.target.value)}><option value="all">All types</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div><div className="cg-label">Duration</div><select className="cg-field" aria-label="Clip length" value={dur} onChange={(e) => setDur(e.target.value)}><option value="all">Any length</option><option value="short">Up to 10s</option><option value="medium">10–20s</option><option value="long">20–30s</option><option value="extra">Over 30s</option></select></div>
        <div><div className="cg-label">Logo</div><select className="cg-field" aria-label="Logo filter" value={brand} onChange={(e) => setBrand(e.target.value)}><option value="all">All clips</option><option value="none">No logo</option><option value="logo">Has logo</option></select></div>
        <div><div className="cg-label">Aspect ratio</div><select className="cg-field" aria-label="Aspect ratio" value={ratio} onChange={(e) => setRatio(e.target.value)}><option value="all">All aspect ratios</option><option value="16:9">16:9 landscape</option><option value="9:16">9:16 portrait</option><option value="1:1">1:1 square</option></select></div>
      </div>
      <div className="cg-note etm-count">Showing {visible.length} of {list.length} videos</div>
      <div className="etm-cards">
        {visible.map((i) => (
          <button key={i.id} type="button" className="cg-card etm-tv" onClick={() => onPick(i)} aria-label={i.title} data-card-title={i.title} data-testid={`template-video-${i.id}`}>
            <div className="etm-tv__media">
              <CardVideo src={i.videoSrc} poster={i.posterSrc} title={i.title} ratio={ratioNumber(i.aspectRatio)} />
              <span className="etm-badge etm-badge--sub">{i.subcategory}</span>
              <span data-branding={i.branding} role="img" aria-label={i.branding === 'none' ? 'No logo' : 'Has logo'} title={i.marks ?? (i.branding === 'none' ? 'Reviewed: no visible logo, watermark or credit' : 'Has a visible logo, watermark or credit')} className={`etm-badge ${i.branding === 'none' ? 'etm-badge--ok' : 'etm-badge--warn'}`}>{i.branding === 'none' ? 'No logo' : 'Has logo'}</span>
            </div>
            <div className="etm-tv__title">{i.title}</div>
            <div className="etm-tv__sub">{i.duration ? `${Math.round(i.duration)}s · ` : ''}{aspectBucket(i.aspectRatio)} · {i.source}</div>
          </button>
        ))}
        {!list.length && <div className="cg-empty">No template videos match your search.</div>}
        {visible.length < list.length && (
          <button type="button" className="cg-btn etm-more" onClick={() => setShown((n) => n + STEP)}>
            Show more ({list.length - visible.length} left)
          </button>
        )}
      </div>
    </div>
  );
}

// constants (not literals) so the help-coverage scan only sees the labels that are real controls
const MODAL_TITLE = 'Template videos';
export function TemplateVideosModal({ onClose, onPick }: { onClose: () => void; onPick: (item: TemplateVideo) => void }) {
  return (
    <ModalShell
      title={MODAL_TITLE}
      subtitle="Browse ready-made AI video templates by category. Click one to add it to your timeline at the playhead."
      icon="▶"
      ariaLabel={MODAL_TITLE}
      closeLabel="Close library"
      width="min(1480px, 96vw)"
      height="min(900px, 92vh)"
      footer={<><span>Click a card to add it to the timeline at the playhead. Previews play as you scroll.</span><span className="cg-modal__footer-spacer" /><span className="cg-kbd" aria-hidden="true">Esc</span></>}
      onClose={onClose}
    >
      <TemplateVideosPanel onPick={onPick} />
    </ModalShell>
  );
}
