/**
 * remix-new-editor replacement for `next/navigation` inside the ported
 * personalization system.
 *
 * OpenHiggsBolt routes to Next.js pages (`/studio/<slug>`). remix is a
 * hash-routed vanilla shell (`src/lib/router.js`), so `push()` maps each
 * OpenHiggsBolt studio slug to the matching remix route and forwards the
 * cross-studio handoff prompt through `prefill_prompt`, the key every remix
 * studio reads on mount (ImageStudio, VideoStudio, CinemaStudio, …).
 */
import { readHandoff } from '../shared/crossStudio'

const STUDIO_ROUTE: Record<string, string> = {
  image: 'image',
  video: 'video',
  cinema: 'cinema',
  'vfx-studio': 'effects',
  'thumbnail-studio': 'image',
  'ai-influencer': 'influencer',
  marketing: 'commercial',
  clipping: 'videotools',
  'vibe-motion': 'animate',
  'motion-studio': 'animate',
  lipsync: 'lipsync',
  recast: 'character',
}

/** Translate an OpenHiggsBolt href into a remix hash route (`#/image`). */
export function toRemixRoute(href: string): string {
  const [pathPart, query = ''] = String(href || '').split('?')
  const match = pathPart.match(/^\/studio\/([^/]+)/)
  const slug = match ? match[1] : pathPart.replace(/^\/+/, '')
  const route = STUDIO_ROUTE[slug] || slug || ''
  return `#/${route}${query ? `?${query}` : ''}`
}

function forwardHandoffPrompt(): void {
  try {
    const handoff = readHandoff() as { combinedPrompt?: string } | null
    const prompt = handoff?.combinedPrompt
    if (prompt && typeof prompt === 'string') localStorage.setItem('prefill_prompt', prompt)
  } catch {
    /* storage unavailable — the studio simply opens empty */
  }
}

export function navigate(href: string): void {
  if (typeof window === 'undefined') return
  forwardHandoffPrompt()
  window.location.hash = toRemixRoute(href).slice(1)
}

const router = {
  push: navigate,
  replace: navigate,
  back: () => { if (typeof window !== 'undefined') window.history.back() },
  refresh: () => {},
  prefetch: () => {},
}

export function useRouter() {
  return router
}
