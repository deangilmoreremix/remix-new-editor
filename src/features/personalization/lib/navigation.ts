/**
 * remix-new-editor replacement for `next/navigation` inside the ported
 * personalization system.
 *
 * OpenHiggsBolt routes to Next.js pages (`/studio/<slug>`). remix is a
 * hash-routed vanilla shell (`src/lib/router.js`), so `push()` maps each
 * OpenHiggsBolt studio slug to the matching remix route and forwards the
 * cross-studio handoff (see forwardHandoff below).
 */
import { readHandoff } from '../shared/crossStudio'
import { stageStudioPrefill } from '../../../lib/studioPrefill.js'
import { navigate as shellNavigate } from '../../../lib/router.js'

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
  // OpenHiggsBolt's Motion Studio editor is the Motion Director's Workbench here.
  'motion-studio': 'motion-director/workbench',
  'motion-director': 'motion-director',
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

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

/**
 * Hand the personalization result to the receiving studio.
 *
 * Image and Video Studio read remix's staged prefill (src/lib/studioPrefill.js):
 * the prompt plus `params.referenceImageUrl`, which they load into their
 * upload picker (Image Studio → image-to-image, Video Studio → start image).
 * Other studios only read `prefill_prompt`, so they get the prompt.
 */
function forwardHandoff(route: string): void {
  try {
    const handoff = readHandoff() as {
      combinedPrompt?: string
      projectName?: string
      referenceImageUrl?: string | null
      firstFrameUrl?: string | null
      aspectRatio?: string | null
    } | null
    // Same fields, same order as OpenHiggsBolt's studios read them
    // (VideoStudio.jsx: `combinedPrompt || projectName`, then
    // `firstFrameUrl || referenceImageUrl` as the start image). The video
    // result itself is not loaded by OpenHiggsBolt's studios either.
    const prompt =
      (typeof handoff?.combinedPrompt === 'string' && handoff.combinedPrompt) ||
      (typeof handoff?.projectName === 'string' && handoff.projectName) ||
      ''
    const referenceImageUrl = safeHttpUrl(handoff?.firstFrameUrl) || safeHttpUrl(handoff?.referenceImageUrl)
    const aspectRatio = handoff?.aspectRatio === '9:16' || handoff?.aspectRatio === '16:9' ? handoff.aspectRatio : null
    if (route === 'image' || route === 'video') {
      stageStudioPrefill({
        route,
        prompt,
        params: {
          ...(referenceImageUrl ? { referenceImageUrl } : {}),
          ...(aspectRatio ? { aspectRatio } : {}),
        },
        ref: 'personalization',
      })
      return
    }
    if (prompt) localStorage.setItem('prefill_prompt', prompt)
  } catch {
    /* storage unavailable — the studio simply opens empty */
  }
}

/**
 * Go to the remix route for an OpenHiggsBolt href.
 *
 * Inside the app shell this calls the shell router directly: it takes the
 * query string as params (the router looks pages up by bare name, so
 * `animate?template=…` would miss), and it always remounts the page, so a
 * hand-off to the studio that is already open (Image → "Edit in Image
 * Studio") is applied. Setting the same hash again fires no `hashchange`.
 * Outside the shell (the standalone landing page) a page load boots it.
 */
export function navigate(href: string): void {
  if (typeof window === 'undefined') return
  const target = toRemixRoute(href)
  const [route, query = ''] = target.slice(2).split('?')
  forwardHandoff(route)
  if (document.getElementById('content-area')) {
    void shellNavigate(route, Object.fromEntries(new URLSearchParams(query)))
    return
  }
  window.location.hash = target.slice(1)
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
