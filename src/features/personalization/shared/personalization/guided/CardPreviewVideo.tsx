'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Silent, looping, autoplaying clip for an UNSELECTED gallery card.
 *
 * A grid of still thumbnails reads as a grid of pictures, so every card plays
 * its own clip. The grids mount many cards at once (123 demos, 124 Motion
 * Studio recipes), so the clip is only attached while the card is on screen:
 * it loads and plays when the card scrolls into view, and is detached (which
 * releases the decoder) when it scrolls away. Browsers cap the number of live
 * media players per page, and a full grid of attached clips would hit it.
 *
 * `fallback` (the card's poster or placeholder) is always rendered underneath
 * and stays visible until the first frame is decoded, so the card is never
 * blank while loading, and it remains the card's face if the clip fails or
 * the visitor prefers reduced motion. The clip has no controls and ignores
 * pointer events: clicks reach the card, which selects it.
 */
export function CardPreviewVideo({
  src,
  poster,
  fallback,
}: {
  src: string
  poster?: string | null
  fallback: ReactNode
}): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [inView, setInView] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    // No observer (old browser, test DOM): treat the card as visible.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { rootMargin: '120px 0px', threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const active = inView && !failed && !reducedMotion

  useEffect(() => {
    if (!active) {
      setReady(false)
      return
    }
    const el = videoRef.current
    if (!el) return
    // `muted` allows autoplay; the explicit call covers browsers that still
    // refuse the first attempt.
    const attempt = el.play()
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {})
  }, [active, src])

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      {fallback}
      {active && (
        <video
          ref={videoRef}
          data-testid="card-preview-video"
          src={src}
          poster={poster ?? undefined}
          muted
          playsInline
          loop
          autoPlay
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onLoadedData={() => setReady(true)}
          onError={() => setFailed(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 8,
            display: 'block',
            background: '#000',
            pointerEvents: 'none',
            opacity: ready ? 1 : 0,
            transition: 'opacity .2s ease',
          }}
        />
      )}
    </div>
  )
}
