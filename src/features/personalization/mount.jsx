/**
 * React island for the Personalization + Lead Finder modal (ported from
 * OpenHiggsBolt).
 *
 * remix is a vanilla-JS shell, so there is no app-wide React tree to host
 * `DemoPersonalizeProvider`. This module lazily creates ONE root on
 * `document.body` the first time the modal is requested and keeps it for the
 * rest of the session. Every studio's Personalize button and the Lead Finder
 * page go through `openPersonalization()`, which opens the same modal.
 */
import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { DemoPersonalizeProvider, useDemoPersonalize } from './shared/personalization/DemoPersonalizeProvider'
import { buildStudioPersonalizeSource } from './shared/personalization/studioEntry'
import { installPersonalizationApiAuth } from './lib/apiAuth'

/** remix studio ids → OpenHiggsBolt `originStudio` values. */
const ORIGIN_STUDIO = {
  image: 'image',
  video: 'video',
  cinema: 'cinema',
  'cinema-template': 'cinema',
  character: 'recast',
  influencer: 'ai-influencer',
  avatar: 'ai-influencer',
  effects: 'vfx-studio',
  storyboard: 'storyboard',
  lipsync: 'lipsync',
  audio: 'apps',
  videotools: 'clipping',
  templates: 'apps',
  personalizer: 'demo-personalization',
  leadfinder: 'demo-personalization',
}

let root = null
let host = null
let openRef = null
const pending = []

function Bridge() {
  const { openPersonalize, closePersonalize, isOpen } = useDemoPersonalize()
  useEffect(() => {
    openRef = openPersonalize
    while (pending.length) openPersonalize(pending.shift())
    return () => { if (openRef === openPersonalize) openRef = null }
  }, [openPersonalize])

  // The provider outlives page changes (it is mounted once on <body>), so
  // close the modal when the hash route changes, as a page-level modal would.
  useEffect(() => {
    if (!isOpen || typeof closePersonalize !== 'function') return undefined
    const onRouteChange = () => closePersonalize()
    window.addEventListener('hashchange', onRouteChange)
    return () => window.removeEventListener('hashchange', onRouteChange)
  }, [isOpen, closePersonalize])
  return null
}

function ensureMounted() {
  if (root) return
  installPersonalizationApiAuth()
  host = document.createElement('div')
  host.id = 'remix-personalization-root'
  document.body.appendChild(host)
  root = createRoot(host)
  root.render(
    <DemoPersonalizeProvider>
      <Bridge />
    </DemoPersonalizeProvider>,
  )
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|m3u8)(\?|#|$)/i
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?|#|$)/i

/**
 * The URL's own extension wins over the studio's hint: a studio can report
 * `type: 'video'` while previewing a reference image (Cinema Studio shows
 * its reference/thumbnail before a video exists).
 */
export function inferMediaType(url, hint) {
  const value = String(url || '')
  if (/^data:image\//i.test(value) || IMAGE_EXT.test(value)) return 'image'
  if (/^data:video\//i.test(value) || VIDEO_EXT.test(value)) return 'video'
  if (hint === 'video' || hint === 'image') return hint
  return 'image'
}

/**
 * Build an OpenHiggsBolt `PersonalizationSource` from what a remix studio has
 * on screen. With media it uses the shared studio entry mapping; without
 * media (nothing generated yet) it opens prompt-only, which starts the guided
 * wizard at "Find business" → "Choose video".
 */
export function buildRemixSource({ studioId, studioName, mediaUrl, mediaType, prompt, model, aspectRatio, title } = {}) {
  const originStudio = ORIGIN_STUDIO[studioId] || 'apps'
  const url = typeof mediaUrl === 'string' ? mediaUrl.trim() : ''
  const text = typeof prompt === 'string' ? prompt.trim() : ''
  if (url) {
    return buildStudioPersonalizeSource({
      originStudio,
      media: { mediaType: inferMediaType(url, mediaType), url, aspectRatio: aspectRatio || undefined },
      prompt: text ? { text, model: model || undefined } : undefined,
      title: title || studioName || 'Studio project',
    })
  }
  const label = title || (studioName ? `${studioName} project` : 'Personalized video')
  return {
    sourceType: 'studio-project',
    id: `remix-${studioId || 'app'}`,
    title: label,
    mediaType: 'prompt-only',
    sourceMedia: null,
    poster: null,
    shortPrompt: text || 'Find a local business, pick a video and personalize it with their brand.',
    fullPrompt: text,
    originalPrompt: text,
    model: model || undefined,
    aspectRatio: aspectRatio || undefined,
    sourceMetadata: { originStudio, remixStudioId: studioId || null },
  }
}

/**
 * Open the personalization modal. Accepts either OpenHiggsBolt
 * `OpenPersonalizeOptions` (`{ source, ... }`) or remix studio context
 * (`{ studioId, mediaUrl, prompt, ... }`).
 */
export function openPersonalization(options = {}) {
  if (typeof document === 'undefined') return
  const opts = options.source
    ? options
    : {
        source: buildRemixSource(options),
        trigger: options.trigger || null,
        access: 'authenticated',
        originStudio: ORIGIN_STUDIO[options.studioId] || undefined,
        onComplete: options.onComplete,
      }
  ensureMounted()
  if (openRef) openRef(opts)
  else pending.push(opts)
}

if (typeof window !== 'undefined') {
  window.remixPersonalize = { open: openPersonalization }
  window.addEventListener('remix:open-personalize', (event) => {
    openPersonalization(event?.detail || {})
  })
}

export default openPersonalization
