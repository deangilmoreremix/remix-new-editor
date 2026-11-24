/**
 * The caption fonts of Capite (https://github.com/muneebkhan08/Capite): the 16 families of its font picker and looks, plus IBM Plex Sans, its
 * fallback. Pure data and helpers (no React, no DOM); identical in remix-new-editor and OpenHiggsBolt. The font files themselves are in
 * `captionStudio/fonts/` (Latin subset, embedded, loaded on demand by `capiteFontLoader.ts`). In CSS they carry the alias "Capite <name>" so they can never be
 * confused with a same-named font the page already has; the real names are kept for the .ass export, where the viewer's own fonts are used.
 */
export type CaptionFontCategory = 'sans' | 'serif' | 'mono' | 'display'

export interface CaptionFont {
  /** The font's real name, as Capite and the .ass file use it. */
  name: string
  /** Key of the data module in the Studio's `fonts/data/`. */
  slug: string
  category: CaptionFontCategory
  popularIn: string
}

export const CAPTION_FONTS: readonly CaptionFont[] = Object.freeze([
  { name: 'Inter', slug: 'inter', category: 'sans', popularIn: 'Ali Abdaal, Tech, Productivity' },
  { name: 'Plus Jakarta Sans', slug: 'plus-jakarta-sans', category: 'sans', popularIn: 'DOAC Podcast, Modern Brands' },
  { name: 'Montserrat', slug: 'montserrat', category: 'sans', popularIn: 'Alex Hormozi, Business Reels' },
  { name: 'Bebas Neue', slug: 'bebas-neue', category: 'display', popularIn: 'MrBeast, High Energy' },
  { name: 'Syne', slug: 'syne', category: 'sans', popularIn: 'Vox, Video Essays, Journalism' },
  { name: 'Playfair Display', slug: 'playfair-display', category: 'serif', popularIn: 'Iman Gadzhi, Luxury, Finance' },
  { name: 'Cinzel', slug: 'cinzel', category: 'serif', popularIn: 'Magnates Media, Film, True Crime' },
  { name: 'Poppins', slug: 'poppins', category: 'sans', popularIn: 'Submagic, Creator Viral Shorts' },
  { name: 'Outfit', slug: 'outfit', category: 'sans', popularIn: 'Lifestyle, Vlogs, Modern Aesthetic' },
  { name: 'JetBrains Mono', slug: 'jetbrains-mono', category: 'mono', popularIn: 'Devs, Coding, Technical' },
  { name: 'Orbitron', slug: 'orbitron', category: 'display', popularIn: 'Cyberpunk, Gaming, Dark Stoic' },
  { name: 'Rubik', slug: 'rubik', category: 'sans', popularIn: 'Viral TikTok, Punchy Sans' },
  { name: 'Space Grotesk', slug: 'space-grotesk', category: 'display', popularIn: 'Modern Editorial, Tech Shorts' },
  { name: 'Anton', slug: 'anton', category: 'display', popularIn: 'TikTok Viral, Bold Attention' },
  { name: 'Permanent Marker', slug: 'permanent-marker', category: 'display', popularIn: 'Fitness, Street Sports' },
  { name: 'Bangers', slug: 'bangers', category: 'display', popularIn: 'Comic, Pop, Expressive' },
] as const)

/** Capite's non-display fallback font, loaded with any Capite font. */
export const CAPTION_FALLBACK_FONT: CaptionFont = Object.freeze({ name: 'IBM Plex Sans', slug: 'ibm-plex-sans', category: 'sans', popularIn: 'Fallback' } as const)

export const CAPTION_FONT_CATEGORIES: readonly { id: CaptionFontCategory; label: string }[] = Object.freeze([
  { id: 'sans', label: 'Sans' }, { id: 'serif', label: 'Serif' }, { id: 'mono', label: 'Monospace' }, { id: 'display', label: 'Display' },
] as const)

/** The weights of the caption weight control. */
export type CaptionWeight = 'light' | 'regular' | 'medium' | 'bold' | 'extra-bold'
export const CAPTION_WEIGHTS: Readonly<Record<CaptionWeight, number>> = Object.freeze({ light: 300, regular: 400, medium: 500, bold: 700, 'extra-bold': 800 })
export const isCaptionWeight = (v: unknown): v is CaptionWeight => typeof v === 'string' && Object.prototype.hasOwnProperty.call(CAPTION_WEIGHTS, v)

const BY_NAME = new Map(CAPTION_FONTS.map((f) => [f.name.toLowerCase(), f]))

/** The caption font a name stands for (any letter case), or undefined for anything that is not one of the 16. */
export function captionFontByName(name: unknown): CaptionFont | undefined {
  return typeof name === 'string' ? BY_NAME.get(name.trim().toLowerCase()) : undefined
}

/** The canonical name of a caption font, or undefined: how a saved or pasted value is made safe. */
export const normalizeCaptionFont = (name: unknown): string | undefined => captionFontByName(name)?.name

/** The CSS family name a font is registered under. */
export const captionFontFamily = (font: CaptionFont): string => `Capite ${font.name}`

/**
 * The CSS font stack for a caption font: its own face, then Capite's fallback, then `baseStack` (the app's own stack, which ends in generic
 * families). A name that is not one of the 16 changes nothing: `baseStack` is returned as it is.
 */
export function captionFontStack(name: string | undefined, baseStack: string): string {
  const font = captionFontByName(name)
  return font ? `"${captionFontFamily(font)}", "${captionFontFamily(CAPTION_FALLBACK_FONT)}", ${baseStack}` : baseStack
}
