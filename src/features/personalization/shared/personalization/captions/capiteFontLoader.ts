/**
 * Loads the caption fonts of `capiteFonts.ts` on demand. Each font is a small module of base64 woff2 data (`fontData/<slug>.ts`) that is only fetched
 * when a caption uses the font; it is registered with an `@font-face` rule whose source is a data URI, so a branded render issues no font request
 * (the same rule as the bundled design font in `templates/typography.ts`). Nothing here throws: a font that cannot load leaves the next family of
 * the stack in place.
 */
import { useEffect, useRef, useState } from 'react'
import { useDelayRender } from 'remotion'
import { CAPTION_FALLBACK_FONT, captionFontByName, captionFontFamily, type CaptionFont } from './capiteFonts'

interface Face { weight: string; style: 'normal' | 'italic'; data: string }
type FontModule = { faces: readonly Face[] }

const MODULES: Record<string, () => Promise<FontModule>> = {
  'inter': () => import('./fontData/inter'),
  'plus-jakarta-sans': () => import('./fontData/plus-jakarta-sans'),
  'montserrat': () => import('./fontData/montserrat'),
  'syne': () => import('./fontData/syne'),
  'playfair-display': () => import('./fontData/playfair-display'),
  'cinzel': () => import('./fontData/cinzel'),
  'outfit': () => import('./fontData/outfit'),
  'jetbrains-mono': () => import('./fontData/jetbrains-mono'),
  'orbitron': () => import('./fontData/orbitron'),
  'rubik': () => import('./fontData/rubik'),
  'space-grotesk': () => import('./fontData/space-grotesk'),
  'anton': () => import('./fontData/anton'),
  'bangers': () => import('./fontData/bangers'),
  'bebas-neue': () => import('./fontData/bebas-neue'),
  'permanent-marker': () => import('./fontData/permanent-marker'),
  'poppins': () => import('./fontData/poppins'),
  'ibm-plex-sans': () => import('./fontData/ibm-plex-sans'),
}

const STYLE_PREFIX = 'capite-font-'
const inFlight = new Map<string, Promise<boolean>>()

function register(font: CaptionFont): Promise<boolean> {
  if (typeof document !== 'undefined' && document.getElementById(STYLE_PREFIX + font.slug)) return Promise.resolve(true)
  const pending = inFlight.get(font.slug)
  if (pending) return pending
  const load = MODULES[font.slug]
  const job = (async () => {
    if (typeof document === 'undefined' || !document.head || !load) return false
    const { faces } = await load()
    const family = captionFontFamily(font)
    const css = faces.map((f) => `@font-face{font-family:"${family}";font-style:${f.style};font-weight:${f.weight};font-display:block;src:url(data:font/woff2;base64,${f.data}) format("woff2")}`).join('\n')
    const el = document.createElement('style')
    el.id = STYLE_PREFIX + font.slug
    el.setAttribute('data-capite-font', font.name)
    el.appendChild(document.createTextNode(css))
    document.head.appendChild(el)
    return true
  })().catch(() => false).finally(() => { inFlight.delete(font.slug) })
  inFlight.set(font.slug, job)
  return job
}

export interface CaptionFontLoad { loaded: boolean }

/**
 * Makes a caption font (and Capite's fallback) usable and waits until the browser has it at the given weight. Resolves `{ loaded: false }`
 * for a name that is not one of the 16 and when loading is not possible (no document); never rejects.
 */
export async function loadCaptionFont(name: string | undefined, opts: { weight?: number; italic?: boolean } = {}): Promise<CaptionFontLoad> {
  const font = captionFontByName(name)
  if (!font) return { loaded: false }
  try {
    const ok = (await Promise.all([register(font), register(CAPTION_FALLBACK_FONT)])).every(Boolean)
    if (!ok || !document.fonts) return { loaded: false }
    const spec = `${opts.italic ? 'italic ' : ''}${opts.weight ?? 400} 16px "${captionFontFamily(font)}"`
    const faces = await document.fonts.load(spec, 'AaBb 0123')
    await document.fonts.ready
    return { loaded: Array.isArray(faces) ? faces.length > 0 : true }
  } catch {
    return { loaded: false }
  }
}

/**
 * Holds a render (the live preview's frame and the in-browser export's frame capture) until the caption font is ready, so a frame is never
 * captured with the fallback face. A no-op for a name that is not one of the 16.
 */
export function useCaptionFont(name: string | undefined, opts: { weight?: number; italic?: boolean } = {}): void {
  const { delayRender, continueRender } = useDelayRender()
  const known = captionFontByName(name)?.name
  const [first] = useState(() => (known ? delayRender(`Loading the caption font ${known}`) : null))
  const pending = useRef<number | null>(first)
  const weight = opts.weight
  const italic = opts.italic

  useEffect(() => {
    // The first run takes over the handle opened while rendering; later runs (another font or weight) open their own.
    const handle = pending.current ?? (known ? delayRender(`Loading the caption font ${known}`) : null)
    pending.current = null
    let released = false
    const done = () => { if (handle !== null && !released) { released = true; continueRender(handle) } }
    if (!known) { done(); return done }
    loadCaptionFont(known, { weight, italic }).then(done, done)
    return done
  }, [known, weight, italic, delayRender, continueRender])
}
