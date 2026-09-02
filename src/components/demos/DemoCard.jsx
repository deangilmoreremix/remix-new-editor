// DemoCard.jsx
//
// Reusable demo card — the React promotion of renderCard() in
// src/lib/examplesRail.js (roadmap §2.1). Everything media-related is delegated
// to the existing engine, src/components/landing/sections/minimax/mediaFrame.js,
// so lazy <video> hydration, the concurrent-playback governor, poster-404
// fallback and prefers-reduced-motion behave exactly as they do on the landing
// page. Chrome (badges, pills) is reused from that folder's ui.js atoms.
//
//   <DemoCard
//     asset={demo}                  // minimax demo | style preset | academy asset
//     source="minimax" | "academy"  // drives the source badge colour
//     variant="rail" | "grid" | "hero"
//     onOpen={openDetail}
//     onUse={optionalOverride}      // defaults to createThisStyle(asset.slug)
//   />

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createMediaFrame } from '../landing/sections/minimax/mediaFrame.js';
import {
  categoryBadge,
  metaPill,
  injectMinimaxStyles,
} from '../landing/sections/minimax/ui.js';
import { createThisStyle } from '../../lib/minimax/createThisStyle.js';
import {
  describeAsset,
  toMediaDemo,
  sourceLabel,
  sourceTone,
} from './assetShape.js';

const VARIANTS = {
  rail: {
    wrap: 'shrink-0 snap-start w-[200px] sm:w-[220px]',
    title: 'text-sm',
    body: 'p-3',
    showUseCase: false,
    // Uniform 16:9 box so a horizontal rail of mixed-ratio clips (40:17, 9:16,
    // 959:540 …) does not turn into a ragged staircase. The true ratio is still
    // stated honestly in the meta pill and in the detail modal.
    box: '16 / 9',
  },
  grid: {
    wrap: 'w-full',
    title: 'text-sm',
    body: 'p-3',
    showUseCase: true,
    box: '16 / 9',
  },
  hero: {
    wrap: 'w-full',
    title: 'text-base sm:text-lg',
    body: 'p-4',
    showUseCase: true,
    // Hero is a showcase surface, so it honours the clip's real aspect ratio.
    box: null,
  },
};

export function DemoCard({
  asset,
  source = 'minimax',
  variant = 'rail',
  onOpen,
  onUse,
  className = '',
}) {
  const cfg = VARIANTS[variant] || VARIANTS.rail;
  const info = useMemo(() => describeAsset(asset), [asset]);
  const mediaDemo = useMemo(() => toMediaDemo(asset), [asset]);

  const hostRef = useRef(null);
  const frameRef = useRef(null);
  const aliveRef = useRef(true);

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    injectMinimaxStyles();
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Mount the poster-first media frame. mode:'hover' means the <video> is only
  // created as the card nears the viewport and only plays (muted) on
  // pointerenter/focusin — createMediaFrame also short-circuits to a static
  // poster under prefers-reduced-motion, and keeps the poster if the video
  // errors (data-mmxVideoFailed).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const frame = createMediaFrame(mediaDemo, {
      mode: 'hover',
      ariaLabel: `${info.title} preview`,
      className: 'absolute inset-0 h-full w-full',
    });
    host.appendChild(frame);
    frameRef.current = frame;

    return () => {
      frame.cleanup?.();
      frame.remove();
      frameRef.current = null;
    };
  }, [mediaDemo, info.title]);

  // Keyboard playback parity: the focusable wrapper is an *ancestor* of the
  // frame, so the frame's own focusin/focusout listeners never see the event.
  // Re-dispatching on the frame reuses the engine's governor instead of
  // hand-rolling a second play/pause path.
  const startPreview = useCallback(() => {
    frameRef.current?.dispatchEvent(new Event('focusin'));
  }, []);
  const stopPreview = useCallback(() => {
    frameRef.current?.dispatchEvent(new Event('focusout'));
  }, []);

  const handleOpen = useCallback(() => {
    if (typeof onOpen === 'function') onOpen(asset);
  }, [asset, onOpen]);

  const handleKeyDown = useCallback(
    (event) => {
      // Let the nested CTA handle its own keys.
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        handleOpen();
      }
    },
    [handleOpen]
  );

  const handleUse = useCallback(
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (busy) return;

      setBusy(true);
      setFailed(false);
      try {
        if (typeof onUse === 'function') await onUse(asset);
        else await createThisStyle(info.slug);
      } catch (error) {
        console.error('[DemoCard] "Create This Style" failed', error);
        if (aliveRef.current) setFailed(true);
      } finally {
        // The happy path navigates away and unmounts this card.
        if (aliveRef.current) setBusy(false);
      }
    },
    [asset, busy, info.slug, onUse]
  );

  const ariaLabel = `${info.title}${info.author ? ` by ${info.author}` : ''}${
    info.category ? ` — ${info.category}` : ''
  }. Open demo details.`;

  return (
    <article
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      data-demo-card={variant}
      data-demo-source={source}
      data-demo-slug={info.slug}
      className={`mmx-card group relative cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-left transition-colors hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${cfg.wrap} ${className}`.trim()}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      onFocus={startPreview}
      onBlur={stopPreview}
    >
      <div
        ref={hostRef}
        className="relative w-full overflow-hidden bg-black/40"
        style={cfg.box ? { aspectRatio: cfg.box } : { aspectRatio: info.ratioNumber }}
      >
        {/* Legibility scrim for the badges sitting over the poster. */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/70 via-transparent to-black/25"
          aria-hidden="true"
        />
        <span
          className="absolute left-2 top-2 z-[2]"
          dangerouslySetInnerHTML={{
            __html: categoryBadge(sourceLabel(source), { tone: sourceTone(source) }),
          }}
        />
        <span
          className="absolute right-2 top-2 z-[2]"
          dangerouslySetInnerHTML={{ __html: metaPill(info.ratio) }}
        />
        {info.category ? (
          <span
            className="absolute bottom-2 left-2 z-[2]"
            dangerouslySetInnerHTML={{ __html: categoryBadge(info.category, { tone: 'neutral' }) }}
          />
        ) : null}
      </div>

      <div className={cfg.body}>
        <h4 className={`font-semibold leading-snug text-white line-clamp-2 ${cfg.title}`}>
          {info.title}
        </h4>

        {info.author ? (
          <p className="mt-1 truncate text-[11px] text-white/45">{info.author}</p>
        ) : null}

        {cfg.showUseCase && info.useCase ? (
          <p className="mt-1 text-[11px] leading-relaxed text-white/45 line-clamp-2">
            {info.useCase}
          </p>
        ) : null}

        {/* In-studio CTA uses the studio token (--color-primary via @theme), not
            the landing page's cyan. See roadmap §2.6. */}
        <button
          type="button"
          data-mmx-cta="create-style"
          data-studio={info.targetStudio || ''}
          aria-label={`Create this style: ${info.title}`}
          disabled={busy}
          onClick={handleUse}
          className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-bold text-black transition-all duration-300 hover:shadow-glow active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? 'Spinning up…' : 'Create This Style'}
          {busy ? null : (
            <svg
              className="h-3.5 w-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          )}
        </button>

        {failed ? (
          <p role="alert" className="mt-1.5 text-[11px] text-red-400/80">
            Could not open that style. Please try again.
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default DemoCard;
