// [remix] The one card every "Add to timeline" item is drawn with. A card MUST say how it previews (see CardPreview), so a new
// feature can never ship as a text placeholder: TypeScript rejects an entry without `preview`, and add-to-timeline-registry.test.ts
// checks that every preview actually resolves.
//   overlay  live render through the editor's own OverlayLayer (motion graphics, HyperFrames animations, forms, overlays, end screens)
//   video    a looping muted clip (poster shown until hover)
//   art      small purpose-built looping visual for features that have no timeline output yet (Template Generator)
// An optional `image` (pre-made thumbnail) is shown while idle; if it is missing or fails to load, the live render takes over, so
// a card is never black. Live renders only mount while the card is on screen, show a paused representative frame, and play on hover.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { OverlayClip } from '@cinegen/types/workspace';
import { OverlayLayer } from './overlay-layer';
import type { CardPreview, ArtKind } from './preview-types';

export type { CardPreview, ArtKind } from './preview-types';

const noop = () => undefined;
const STAGE_BG = 'radial-gradient(120% 120% at 20% 10%, #243247 0%, #111827 55%, #0b1220 100%)';

/** Live renders are heavy (some run in a sandboxed iframe), so only a handful exist at once; the rest wait for a free slot. */
const MAX_LIVE = 20;
const live = new Set<symbol>();
function useLiveSlot(wanted: boolean): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    if (!wanted) return undefined;
    const id = Symbol('live');
    let timer = 0;
    const tryTake = () => { if (live.size < MAX_LIVE) { live.add(id); setHas(true); } else timer = window.setTimeout(tryTake, 400); };
    tryTake();
    return () => { window.clearTimeout(timer); live.delete(id); setHas(false); };
  }, [wanted]);
  return has;
}

function useInView(ref: React.RefObject<Element | null>): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return seen;
}

/** Steps `currentTime` through the overlay's duration while `playing`, otherwise holds the representative frame. */
function LiveStage({ preview, playing }: { preview: Extract<CardPreview, { kind: 'overlay' }>; playing: boolean }) {
  const overlays = useMemo(() => preview.build(), [preview]);
  const frame = preview.frame ?? { width: 1280, height: 720 };
  const dur = Math.max(0.5, preview.duration);
  const still = Math.min(preview.still ?? dur * 0.45, Math.max(0, dur - 0.05));
  const [t, setT] = useState(still);
  useEffect(() => {
    if (!playing) { setT(still); return undefined; }
    let raf = 0; const t0 = performance.now();
    const tick = (now: number) => { setT(((now - t0) / 1000) % dur); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, dur, still]);
  // portrait / square templates are letterboxed inside the 16:9 card so every card in the grid has the same size
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
      <div style={{ position: 'relative', height: '100%', aspectRatio: `${frame.width} / ${frame.height}`, maxWidth: '100%', overflow: 'hidden' }}>
        <OverlayLayer overlays={overlays} currentTime={t} isPlaying={false} onPause={noop} frame={frame} />
      </div>
    </div>
  );
}

function Art({ art }: { art: ArtKind }) {
  const css = '@keyframes pc-type{0%{width:0}60%,100%{width:100%}}@keyframes pc-pop{0%,40%{opacity:0;transform:translateY(8px) scale(.96)}60%,100%{opacity:1;transform:none}}';
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: STAGE_BG }}>
      <style>{css}</style>
      {(
        <div style={{ display: 'grid', gap: 10, width: '62%' }}>
          <div style={{ border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, padding: '8px 10px', fontSize: 11, color: 'rgba(229,237,245,.85)', overflow: 'hidden' }}>
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', borderRight: '2px solid var(--accent, #22d3ee)', animation: 'pc-type 3.2s steps(26) infinite' }}>A 10s product launch teaser…</div>
          </div>
          <div style={{ height: 54, borderRadius: 10, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, color: '#fff', animation: 'pc-pop 3.2s ease-out infinite' }}>Launch teaser</div>
        </div>
      )}
    </div>
  );
}

export function PreviewCard({ preview, title, sub, badge, onClick, testId, ariaLabel, footer }: {
  preview: CardPreview; title: string; sub?: string; badge?: string; onClick: () => void; testId?: string; ariaLabel?: string; footer?: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const visible = useInView(ref);
  const [hover, setHover] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => { setPlaying(false); if (!hover) return undefined; const t = window.setTimeout(() => setPlaying(true), 250); return () => window.clearTimeout(t); }, [hover]);

  const image = preview.kind === 'overlay' ? preview.image : undefined;
  const showImage = !!image && imgOk && !playing;
  // live render when visible AND (no usable image, or the user is hovering to play it)
  const wantLive = preview.kind === 'overlay' && visible && !showImage;
  const slot = useLiveSlot(wantLive);

  return (
    <button ref={ref} type="button" className="add-card" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)} aria-label={ariaLabel ?? title} data-testid={testId}
      style={{ textAlign: 'left', padding: 12, borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'inherit', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box', height: '100%' }}>
      <div data-preview={preview.kind} data-live={slot ? 'true' : 'false'} style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden', background: STAGE_BG }}>
        {preview.kind === 'overlay' && image && imgOk && <img src={image} alt="" loading="lazy" onError={() => setImgOk(false)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />}
        {preview.kind === 'overlay' && wantLive && slot && <LiveStage preview={preview} playing={playing} />}
        {preview.kind === 'video' && (visible ? <video src={preview.src} poster={preview.poster} muted loop playsInline preload="metadata" ref={(v) => { if (!v) return; if (playing) void v.play().catch(() => undefined); else v.pause(); }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null)}
        {preview.kind === 'art' && <Art art={preview.art} />}
        {badge && <span style={{ position: 'absolute', left: 8, top: 8, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 6, background: 'rgba(0,0,0,.65)', color: '#fff', zIndex: 20 }}>{badge}</span>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{sub}</div>}
      {footer}
    </button>
  );
}
