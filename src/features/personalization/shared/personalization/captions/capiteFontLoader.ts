/**
 * Loads the caption fonts of `capiteFonts.ts` on demand. The data is the Caption Studio's embedded fonts (captionStudio/fonts), registered with a data-URI `@font-face` on demand, so a branded render issues no font request. Nothing here throws: a font that cannot load leaves the next family of
 * the stack in place.
 */
import { useEffect, useRef, useState } from 'react'
import { useDelayRender } from 'remotion'
import { captionFontByName } from './capiteFonts'
import { loadEmbeddedFont } from './studioFonts'

export interface CaptionFontLoad { loaded: boolean }

/**
 * Makes a caption font (and Capite's fallback) usable and waits until the browser has it at the given weight. Resolves `{ loaded: false }`
 * for a name that is not one of the 16 and when loading is not possible (no document); never rejects.
 */
export async function loadCaptionFont(name: string | undefined, opts: { weight?: number; italic?: boolean } = {}): Promise<CaptionFontLoad> {
  const font = captionFontByName(name)
  if (!font) return { loaded: false }
  return { loaded: await loadEmbeddedFont(font.name, { weight: opts.weight ?? 400, italic: opts.italic, text: 'AaBb 0123' }) }
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

/** Renders nothing; holds the render until the caption font is ready. Mount it only when a caption uses one of the 16 fonts. */
export function CaptionFontGate({ name, weight, italic }: { name: string | undefined; weight?: number; italic?: boolean }): null {
  useCaptionFont(name, { weight, italic })
  return null
}
