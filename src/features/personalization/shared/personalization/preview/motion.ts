/**
 * Frame-local motion for overlay layers, kept out of the composition so it can
 * be unit-tested as plain functions of (frame, fps).
 *
 *  - `entranceFor`   whole-layer entrance (fade / slide / pop / pulse …)
 *  - `wordEntrance`  per-word staggered entrance for headlines and names
 *  - `exitFor`       short fade-and-lift before a layer's `endFrame`
 *
 * Everything is built on `spring`/`interpolate` from remotion, so the preview
 * Player and the browser export evaluate exactly the same numbers.
 */
import { Easing, interpolate, spring } from 'remotion'
import { EXIT_FRAMES } from './imageStyle'
import type { PreviewAnimationId, PreviewLayer } from './types'

export interface EntranceState {
  opacity: number
  scale: number
  translateX: number
  translateY: number
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0))

/** Quick, nearly critically damped spring used for fades and slides (settles in ~0.4 s at 30 fps). */
const SNAP = { damping: 24, stiffness: 170, mass: 0.8 }

/**
 * Entrance state at `frame`. Fades and slides follow a short spring instead of a
 * fixed ease so they start fast and settle softly; pop / logo-reveal keep their
 * overdamped spring; the CTA pulse is unchanged.
 */
export function entranceFor(layer: PreviewLayer, frame: number, fps: number): EntranceState {
  const entryStart = layer.startFrame + layer.animationDelay
  const safeFps = Math.max(1, fps)
  const local = Math.max(0, frame - entryStart)
  const snap = clamp01(spring({ frame: local, fps: safeFps, config: SNAP }))
  // Opacity leads the movement a little so text is readable before it lands.
  const fade = frame < entryStart ? 0 : clamp01(interpolate(snap, [0, 0.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
  const eased = frame < entryStart ? 0 : snap
  const overdamped = spring({ frame: local, fps: safeFps, config: { damping: 200 } })
  const popFade = interpolate(frame, [entryStart, entryStart + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })

  const animation: PreviewAnimationId = layer.animation
  switch (animation) {
    case 'none':
      return { opacity: 1, scale: 1, translateX: 0, translateY: 0 }
    case 'fade':
      return { opacity: fade, scale: 1, translateX: 0, translateY: 0 }
    case 'slide-up':
      return { opacity: fade, scale: 1, translateX: 0, translateY: (1 - eased) * 40 }
    case 'slide-down':
      return { opacity: fade, scale: 1, translateX: 0, translateY: -(1 - eased) * 40 }
    case 'slide-left':
      return { opacity: fade, scale: 1, translateX: (1 - eased) * 60, translateY: 0 }
    case 'pop':
      return { opacity: popFade, scale: 0.6 + 0.4 * overdamped, translateX: 0, translateY: 0 }
    case 'logo-reveal':
      return { opacity: popFade, scale: 0.85 + 0.15 * overdamped, translateX: 0, translateY: 0 }
    case 'lower-third':
      return { opacity: fade, scale: 1, translateX: -(1 - eased) * 30, translateY: 0 }
    case 'cta-pulse': {
      const pulse = interpolate(Math.sin((frame - entryStart) / 6), [-1, 1], [0.97, 1.03])
      return { opacity: popFade, scale: pulse, translateX: 0, translateY: 0 }
    }
    default:
      return { opacity: fade, scale: 1, translateX: 0, translateY: 0 }
  }
}

/** Longest the whole word stagger may take, in frames. */
const WORD_STAGGER_BUDGET = 18
const WORD_STAGGER_MAX = 3

/** Animations whose entrance a headline/name replaces with the per-word one. */
export function usesWordEntrance(layer: PreviewLayer): boolean {
  return (
    (layer.kind === 'headline' || layer.kind === 'businessName') &&
    (layer.animation === 'slide-up' || layer.animation === 'fade')
  )
}

export interface WordState {
  opacity: number
  translateY: number
}

/**
 * Staggered entrance of word `index` of `count`. Each word rises and fades in a
 * few frames after the previous one; the whole line always finishes within
 * `WORD_STAGGER_BUDGET` frames of its start, however long it is.
 */
export function wordEntrance(
  index: number,
  count: number,
  frame: number,
  startFrame: number,
  fps: number,
  fontSizePx: number,
): WordState {
  const n = Math.max(1, count)
  const stagger = Math.min(WORD_STAGGER_MAX, WORD_STAGGER_BUDGET / n)
  const wordStart = startFrame + Math.max(0, index) * stagger
  if (frame < wordStart) return { opacity: 0, translateY: fontSizePx * 0.45 }
  const p = clamp01(spring({ frame: frame - wordStart, fps: Math.max(1, fps), config: { damping: 20, stiffness: 150 } }))
  return { opacity: clamp01(p * 1.8), translateY: (1 - p) * fontSizePx * 0.45 }
}

export interface ExitState {
  opacity: number
  translateY: number
}

/**
 * Fade-and-lift over the last `EXIT_FRAMES` before the layer's `endFrame`.
 * A layer with no `endFrame` never exits. Image layers have their own exit
 * (`exitFactors`), so callers use this for text and CTA only.
 */
export function exitFor(layer: Pick<PreviewLayer, 'endFrame'>, frame: number): ExitState {
  if (layer.endFrame === undefined || !Number.isFinite(layer.endFrame)) return { opacity: 1, translateY: 0 }
  const p = clamp01((frame - (layer.endFrame - EXIT_FRAMES)) / EXIT_FRAMES)
  return { opacity: 1 - p, translateY: -p * 12 }
}

/**
 * Staggered reveal of the `index`-th item of a list that appears one after another
 * (end-card logo, name, contact line, button). Rises `distancePx` while fading in.
 */
export function itemEntrance(
  index: number,
  frame: number,
  fps: number,
  distancePx: number,
  staggerFrames = 6,
): WordState {
  const start = Math.max(0, index) * staggerFrames
  if (frame < start) return { opacity: 0, translateY: distancePx }
  const p = clamp01(spring({ frame: frame - start, fps: Math.max(1, fps), config: { damping: 22, stiffness: 140 } }))
  return { opacity: clamp01(p * 1.6), translateY: (1 - p) * distancePx }
}
