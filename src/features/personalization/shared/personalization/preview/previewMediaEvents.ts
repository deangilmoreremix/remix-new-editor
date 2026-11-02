/**
 * Lightweight module-level channel that reports media failures from the
 * personalization preview composition to the preview player wrapper.
 *
 * The composition renders inside {@link Player} from `@remotion/player`, so it
 * cannot simply bubble an `onError` prop up the React tree: it is instantiated
 * by the Player as a plain component with `inputProps`. A module-level channel
 * keeps the failure report decoupled from that render path while remaining
 * cheap (a `Set` of listeners, no timers, no network).
 *
 * Usage:
 * - the composition emits once per failure (`emitPreviewMediaFailure`)
 * - every player subscribes once and re-renders on change
 *   (`subscribePreviewMediaFailure`)
 * - the failure is cleared when the selected video changes, when the media
 *   recovers, or on unmount of the last listener
 *   (`clearPreviewMediaFailure`)
 */

export interface PreviewMediaFailure {
  /** Source media URL that failed to load or decode. */
  videoUrl: string | null
  /** Poster URL shown instead, when one exists. */
  posterUrl: string | null
  /** Short human label for the source (falls back to the URL). */
  label: string
  /** Optional underlying reason (codec / network / CORS). */
  reason?: string
}

export type PreviewMediaFailureListener = (failure: PreviewMediaFailure | null) => void

let currentFailure: PreviewMediaFailure | null = null
const listeners = new Set<PreviewMediaFailureListener>()

function notify(): void {
  // Copy first: a listener may unsubscribe while iterating.
  for (const listener of Array.from(listeners)) {
    try {
      listener(currentFailure)
    } catch {
      // A throwing listener must not break the other subscribers.
    }
  }
}

/** Records a media failure and notifies every subscribed player. */
export function emitPreviewMediaFailure(failure: PreviewMediaFailure): void {
  currentFailure = failure
  notify()
}

/** Clears the recorded failure (video switched, media recovered, unmount). */
export function clearPreviewMediaFailure(): void {
  if (currentFailure === null) return
  currentFailure = null
  notify()
}

/** Subscribes to failure changes; returns the unsubscribe function. */
export function subscribePreviewMediaFailure(
  listener: PreviewMediaFailureListener,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Current failure, or null when the media is healthy. */
export function getPreviewMediaFailure(): PreviewMediaFailure | null {
  return currentFailure
}

/** Test/SSR helper: drops listeners and the recorded failure. */
export function resetPreviewMediaEvents(): void {
  currentFailure = null
  listeners.clear()
}

/** Derives a short display label from a media URL. */
export function previewMediaLabel(videoUrl: string | null): string {
  if (!videoUrl) return 'this video'
  try {
    const withoutQuery = videoUrl.split('?')[0].split('#')[0]
    const fileName = withoutQuery.split('/').filter(Boolean).pop()
    if (!fileName) return 'this video'
    return fileName.length > 48 ? `${fileName.slice(0, 45)}…` : fileName
  } catch {
    return 'this video'
  }
}

/** True when a failure belongs to the video a player is currently rendering. */
export function isFailureForVideo(
  failure: PreviewMediaFailure | null,
  videoUrl: string | null | undefined,
): boolean {
  if (!failure) return false
  return (failure.videoUrl ?? null) === (videoUrl ?? null)
}
