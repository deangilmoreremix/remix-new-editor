// Template videos library (additive). Same layout as hyperframes-modal.tsx / the Personalize demo picker, minus every personalization
// feature: category pills with counts, search, aspect filter, and a grid of cards whose clips load and play as they scroll into view.
// Picking a card hands the clip to the editor, which adds it to the timeline at the playhead.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { templateVideos, TEMPLATE_VIDEO_CATEGORIES, TEMPLATE_VIDEO_SUBCATEGORIES } from '../../../data/templateVideoLibrary.js';

export type TemplateVideo = {
  id: string; slug: string; title: string; sourceTitle: string; category: string; subcategory: string; duration: number | null; aspectRatio: string;
  videoSrc: string; posterSrc: string | null; tags: string[]; source: string;
};

const ALL = templateVideos as unknown as TemplateVideo[];
const CATEGORIES = TEMPLATE_VIDEO_CATEGORIES as unknown as string[];
const SUBCATEGORIES = TEMPLATE_VIDEO_SUBCATEGORIES as unknown as Record<string, string[]>;
const INITIAL = 24;
const STEP = 24;

const GLYPH: Record<string, string> = { All: '▦', Action: '⚡', Animation: '✺', Cinema: '🎬', Commercial: '◈', Fashion: '✦', Social: '◎', VFX: '✧' };
const INK = 'rgba(229,237,245,.9)';
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', color: 'inherit', border: '1px solid var(--border-medium)', borderRadius: 10, padding: '11px 12px', fontSize: 13 };
const label: CSSProperties = { fontSize: 11, letterSpacing: '.06em', fontWeight: 600, textTransform: 'uppercase', opacity: 0.75, marginBottom: 6 };

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
  return items.filter((i) => `${i.title} ${i.category} ${i.subcategory} ${i.sourceTitle} ${i.tags.join(' ')} ${i.source}`.toLowerCase().includes(s));
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
    <div ref={wrap} style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
      {poster && <img src={poster} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}
      {active && (
        <video src={src} poster={poster ?? undefined} muted playsInline loop autoPlay preload="auto" aria-label={`Preview of ${title}`} data-ratio={ratio}
          onLoadedData={() => setReady(true)} onError={() => setFailed(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000', pointerEvents: 'none', opacity: ready ? 1 : 0, transition: 'opacity .2s ease' }} />
      )}
    </div>
  );
}

export function TemplateVideosModal({ onClose, onPick }: { onClose: () => void; onPick: (item: TemplateVideo) => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [sub, setSub] = useState('all');
  const [ratio, setRatio] = useState('all');
  const [dur, setDur] = useState('all');
  const [shown, setShown] = useState(INITIAL);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  useEffect(() => { setSub('all'); }, [cat]);
  useEffect(() => { setShown(INITIAL); }, [q, cat, sub, ratio, dur]);
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const i of ALL) m.set(i.category, (m.get(i.category) ?? 0) + 1); return m; }, []);
  const tabs = useMemo(() => ['All', ...CATEGORIES.filter((c) => counts.has(c))], [counts]);
  const subTabs = useMemo(() => (cat === 'all' ? [] : SUBCATEGORIES[cat] ?? []), [cat]);
  const subCounts = useMemo(() => { const m = new Map<string, number>(); for (const i of ALL) if (i.category === cat) m.set(i.subcategory, (m.get(i.subcategory) ?? 0) + 1); return m; }, [cat]);
  const list = useMemo(() => searchTemplateVideos(ALL, q).filter((i) => (cat === 'all' || i.category === cat) && (sub === 'all' || i.subcategory === sub) && (ratio === 'all' || aspectBucket(i.aspectRatio) === ratio) && (dur === 'all' || durationBucket(i.duration) === dur)), [q, cat, sub, ratio, dur]);
  const visible = list.slice(0, shown);
  return (
    <div role="dialog" aria-label="Template videos" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', padding: 16 }} onClick={onClose}>
      <style>{'.tv-card:hover{border-color:var(--accent)!important}'}</style>
      <div style={{ width: 'min(1480px, 96vw)', height: 'min(900px, 92vh)', display: 'flex', flexDirection: 'column', background: 'var(--bg-raised)', border: '1px solid var(--border-medium)', borderRadius: 26, color: INK, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '24px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontSize: 20 }}>▶</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Template videos</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, maxWidth: 720 }}>Browse ready-made AI video templates by category. Click one to add it to your timeline at the playhead.</div>
          </div>
          <button aria-label="Close library" onClick={onClose} style={{ background: 'transparent', border: 0, color: 'inherit', fontSize: 22, cursor: 'pointer', padding: 6 }}>×</button>
        </div>
        <div style={{ margin: '18px 20px 20px', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, background: 'var(--bg-base)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <strong style={{ fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>▣ Choose a template video</strong>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, opacity: 0.6 }}>{ALL.length} videos</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.65, margin: '4px 0 12px' }}>Previews play as you scroll. Click a card to add it to the timeline.</div>
          <div role="tablist" aria-label="Categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {tabs.map((c) => {
              const on = cat === (c === 'All' ? 'all' : c);
              return (
                <button key={c} role="tab" aria-selected={on} onClick={() => setCat(c === 'All' ? 'all' : c)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? 'var(--accent)' : 'var(--border-medium)'}`, color: on ? 'var(--accent)' : 'inherit', background: on ? 'var(--accent-dim)' : 'var(--bg-elevated)' }}>
                  <span style={{ opacity: 0.8, fontSize: 12 }}>{GLYPH[c] ?? '•'}</span>{c}
                  <span style={{ minWidth: 22, height: 20, padding: '0 6px', borderRadius: 999, boxSizing: 'border-box', display: 'inline-grid', placeItems: 'center', fontSize: 11, background: on ? 'var(--accent-dim)' : 'var(--bg-overlay)' }}>{c === 'All' ? ALL.length : counts.get(c)}</span>
                </button>
              );
            })}
          </div>
          {subTabs.length > 0 && (
            <div role="tablist" aria-label="Subcategories" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '-4px 0 14px' }}>
              {['All', ...subTabs].map((c) => {
                const on = sub === (c === 'All' ? 'all' : c);
                return (
                  <button key={c} role="tab" aria-selected={on} onClick={() => setSub(c === 'All' ? 'all' : c)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: `1px solid ${on ? 'var(--accent)' : 'var(--border-subtle)'}`, color: on ? 'var(--accent)' : 'inherit', background: on ? 'var(--accent-dim)' : 'transparent' }}>
                    {c}<span style={{ opacity: 0.6, fontSize: 11 }}>{c === 'All' ? [...subCounts.values()].reduce((a, b) => a + b, 0) : subCounts.get(c)}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 18, marginBottom: 10 }}>
            <div><div style={label}>Search</div><input type="text" placeholder="⌕  Search template videos…" aria-label="Search template videos" value={q} onChange={(e) => setQ(e.target.value)} style={field} /></div>
            <div><div style={label}>Duration</div><select aria-label="Duration" value={dur} onChange={(e) => setDur(e.target.value)} style={field}><option value="all">Any length</option><option value="short">Up to 10s</option><option value="medium">10–20s</option><option value="long">20–30s</option><option value="extra">Over 30s</option></select></div>
            <div><div style={label}>Aspect ratio</div><select aria-label="Aspect ratio" value={ratio} onChange={(e) => setRatio(e.target.value)} style={field}><option value="all">All aspect ratios</option><option value="16:9">16:9 landscape</option><option value="9:16">9:16 portrait</option><option value="1:1">1:1 square</option></select></div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, margin: '6px 0 10px' }}>Showing {visible.length} of {list.length} videos</div>
          <div style={{ overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignContent: 'start', paddingRight: 4, minHeight: 0 }}>
            {visible.map((i) => (
              <button key={i.id} className="tv-card" onClick={() => onPick(i)} aria-label={i.title} data-testid={`template-video-${i.id}`}
                style={{ textAlign: 'left', padding: 12, borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'inherit', cursor: 'pointer' }}>
                <div style={{ position: 'relative' }}>
                  <CardVideo src={i.videoSrc} poster={i.posterSrc} title={i.title} ratio={ratioNumber(i.aspectRatio)} />
                  <span style={{ position: 'absolute', left: 8, top: 8, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 6, background: 'rgba(0,0,0,.55)' }}>{i.subcategory}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{i.duration ? `${Math.round(i.duration)}s · ` : ''}{aspectBucket(i.aspectRatio)} · {i.source}</div>
              </button>
            ))}
            {!list.length && <span style={{ fontSize: 13, opacity: 0.7 }}>No template videos match your search.</span>}
            {visible.length < list.length && (
              <button onClick={() => setShown((n) => n + STEP)} style={{ gridColumn: '1 / -1', justifySelf: 'center', padding: '10px 20px', borderRadius: 999, border: '1px solid var(--border-medium)', background: 'var(--bg-elevated)', color: 'inherit', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Show more ({list.length - visible.length} left)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
