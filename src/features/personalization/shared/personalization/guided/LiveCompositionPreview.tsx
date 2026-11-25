'use client'

import { useEffect, useRef, useState } from 'react'
import { Player, Thumbnail } from '@remotion/player'
import { PersonalizationComposition } from '../preview/PersonalizationComposition'
import type { PreviewInputProps } from '../preview/types'

/**
 * A small, live render of the personalization composition for a gallery card.
 *
 * Shows a still frame (`Thumbnail`) until `playing` is true, then a looping
 * muted Player. Nothing mounts until the card has been near the viewport, so a
 * gallery of many cards stays light, and the caller decides which single card
 * plays. Because it renders the SAME composition as the editor and the export,
 * a card always shows exactly what choosing it produces.
 */

export interface LiveCompositionPreviewProps {
  /** Built lazily, only once the card is on screen. */
  buildInputProps: () => PreviewInputProps
  playing: boolean
  /** Frame the still thumbnail shows. */
  stillFrame: number
  durationInFrames: number
  width: number
  height: number
  fps: number
}

/** Dark backdrop for cards when the customer's video has no poster image. */
export const FALLBACK_BACKDROP =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18222d"/><stop offset="1" stop-color="#06090d"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/></svg>',
  )

/** One captured frame per video URL, shared by every card on the page. */
const backdropCache = new Map<string, Promise<string | null>>()

/** Captures one frame (about 1s in) of a video as a JPEG data URL, or null. */
function captureVideoFrame(url: string): Promise<string | null> {
  const cached = backdropCache.get(url)
  if (cached) return cached
  const promise = new Promise<string | null>((resolve) => {
    if (typeof document === 'undefined') return resolve(null)
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'
    video.playsInline = true
    const done = (value: string | null) => {
      video.removeAttribute('src')
      video.load()
      resolve(value)
    }
    const timer = window.setTimeout(() => done(null), 8000)
    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2)
    }, { once: true })
    video.addEventListener('seeked', () => {
      window.clearTimeout(timer)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 640
        canvas.height = Math.round((640 * (video.videoHeight || 360)) / (video.videoWidth || 640))
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
        done(canvas.toDataURL('image/jpeg', 0.8))
      } catch {
        // A cross-origin video without CORS headers taints the canvas.
        done(null)
      }
    }, { once: true })
    video.addEventListener('error', () => {
      window.clearTimeout(timer)
      done(null)
    }, { once: true })
    video.src = url
  })
  backdropCache.set(url, promise)
  return promise
}

/**
 * The still image cards draw behind a design: the video's poster when it has
 * one, otherwise a frame captured from the video itself, otherwise the dark
 * fallback gradient.
 */
export function useCardBackdrop(base: Pick<PreviewInputProps, 'posterUrl' | 'videoUrl' | 'isImageSource'> | null): string {
  const poster = base?.posterUrl || null
  const video = !poster && base && !base.isImageSource ? base.videoUrl : null
  const [captured, setCaptured] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setCaptured(null)
    if (!video) return
    captureVideoFrame(video).then((value) => {
      if (alive) setCaptured(value)
    })
    return () => {
      alive = false
    }
  }, [video])
  return poster || captured || FALLBACK_BACKDROP
}

/** Wait before a hovered card starts playing, so a quick click is not lost. */
const HOVER_PLAY_DELAY_MS = 250

/**
 * Hover-to-play for a card. Playing swaps the still for a Player, and a click
 * whose target is replaced mid-press is dropped by the browser, so play
 * starts after a short pause and only for a mouse (a touch tap selects).
 */
export function useHoverPlay(): {
  playing: boolean
  handlers: {
    onPointerEnter: (event: React.PointerEvent) => void
    onPointerLeave: () => void
    onFocus: (event: React.FocusEvent<HTMLElement>) => void
    onBlur: () => void
  }
} {
  const [playing, setPlaying] = useState(false)
  const timer = useRef<number | null>(null)
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => clear, [])
  return {
    playing,
    handlers: {
      onPointerEnter: (event) => {
        if (event.pointerType && event.pointerType !== 'mouse') return
        clear()
        timer.current = window.setTimeout(() => setPlaying(true), HOVER_PLAY_DELAY_MS)
      },
      onPointerLeave: () => {
        clear()
        setPlaying(false)
      },
      // Keyboard focus only: a mouse press also focuses the card, and swapping
      // the still mid-press would drop the click.
      onFocus: (event) => {
        let keyboard = false
        try {
          keyboard = event.currentTarget.matches(':focus-visible')
        } catch {
          keyboard = false
        }
        if (keyboard) setPlaying(true)
      },
      onBlur: () => setPlaying(false),
    },
  }
}

// The composition's props are an interface (no index signature), so the
// Player/Thumbnail generics are widened the same way PersonalizationPlayer does.
const Composition = PersonalizationComposition as unknown as React.ComponentType<Record<string, unknown>>

/** True once the element has been near the viewport. */
function useSeen(ref: React.RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || seen || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, seen])
  return seen
}

export function LiveCompositionPreview({
  buildInputProps,
  playing,
  stillFrame,
  durationInFrames,
  width,
  height,
  fps,
}: LiveCompositionPreviewProps): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useSeen(ref)
  const props = seen ? (buildInputProps() as unknown as Record<string, unknown>) : null
  const common = {
    component: Composition,
    durationInFrames,
    compositionWidth: width,
    compositionHeight: height,
    fps,
    style: { width: '100%', height: '100%' },
  }
  return (
    // Clicks go to the card around it, never to the Player (which would
    // otherwise swallow them to toggle playback).
    <span ref={ref} style={{ position: 'absolute', inset: 0, display: 'block', pointerEvents: 'none' }}>
      {props ? (
        playing ? (
          <Player {...common} inputProps={props} autoPlay loop initiallyMuted controls={false} clickToPlay={false} acknowledgeRemotionLicense />
        ) : (
          <Thumbnail {...common} inputProps={props} frameToDisplay={Math.min(durationInFrames - 1, Math.max(0, stillFrame))} />
        )
      ) : null}
      {/* The Player sets its own pointer handling, so a transparent shield
          sits on top and hands every click to the card. */}
      <span aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }} />
    </span>
  )
}
