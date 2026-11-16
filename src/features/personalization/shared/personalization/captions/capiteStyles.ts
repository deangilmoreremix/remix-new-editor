/**
 * Caption looks: 27 styles with colours, outline, shadow, font and how the spoken word is picked out. Pure data and pure functions: no
 * React, no Remotion, no network, no repo imports, so the same file is used by remix-new-editor and OpenHiggsBolt.
 * Fonts are only NAMED here. A host that can load them does; any other host falls back to its own font stack.
 */
export type CapiteAnimation = 'highlight' | 'scale' | 'pop' | 'bounce' | 'glow' | 'box' | 'karaoke'
export type CapiteCategory = 'trending' | 'pop-expressive' | 'clean-tech' | 'editorial-film'

export interface CapiteCaptionStyle {
  id: string; name: string; category: CapiteCategory; description: string
  fontName: string; fontNameFallback: string
  /** Capite's size on a 1080-wide frame; only its ratio to outline/shadow sizes matters here. */
  fontSize: number
  primaryColor: string; highlightColor: string; outlineColor: string; shadowColor: string
  /** 0-255, as in Capite. */
  shadowAlpha: number
  outlineSize: number; shadowDepth: number
  bold: boolean; italic: boolean; letterSpacing: number; wordSpacing: number
  animationType: CapiteAnimation; bestFor: string
}

export const CAPITE_CAPTION_STYLES: readonly CapiteCaptionStyle[] = Object.freeze([
  {"id": "hormozi", "name": "Hormozi", "category": "trending", "description": "Bold cyan highlights with thick outline", "fontName": "Montserrat", "fontNameFallback": "IBM Plex Sans", "fontSize": 105, "primaryColor": "#FFFFFF", "highlightColor": "#00FFFF", "outlineColor": "#000000", "shadowColor": "#000000", "shadowAlpha": 128, "outlineSize": 5.0, "shadowDepth": 4.5, "bold": true, "italic": false, "letterSpacing": 0, "wordSpacing": 100, "animationType": "highlight", "bestFor": "Business & motivation"},
  {"id": "mrbeast", "name": "MrBeast", "category": "trending", "description": "Yellow text with orange highlights and extra thick outline", "fontName": "Bebas Neue", "fontNameFallback": "IBM Plex Sans", "fontSize": 120, "primaryColor": "#FFFF00", "highlightColor": "#FF6600", "outlineColor": "#000000", "shadowColor": "#000000", "shadowAlpha": 0, "outlineSize": 8.0, "shadowDepth": 6.0, "bold": true, "italic": false, "letterSpacing": 0, "wordSpacing": 100, "animationType": "highlight", "bestFor": "Gaming & entertainment"},
  {"id": "crimson-pop", "name": "Crimson Pop", "category": "trending", "description": "Active word red highlight box with crisp typography", "fontName": "Montserrat", "fontNameFallback": "IBM Plex Sans", "fontSize": 105, "primaryColor": "#FFFFFF", "highlightColor": "#E11D48", "outlineColor": "#000000", "shadowColor": "#000000", "shadowAlpha": 0, "outlineSize": 10.0, "shadowDepth": 0.0, "bold": true, "italic": false, "letterSpacing": 0.5, "wordSpacing": 105, "animationType": "box", "bestFor": "High impact hooks, story reels & viral shorts"},
  {"id": "karaoke", "name": "Karaoke", "category": "pop-expressive", "description": "Color wipe animation from left to right", "fontName": "Montserrat", "fontNameFallback": "IBM Plex Sans", "fontSize": 105, "primaryColor": "#FFFFFF", "highlightColor": "#0080FF", "outlineColor": "#000000", "shadowColor": "#000000", "shadowAlpha": 128, "outlineSize": 4.0, "shadowDepth": 3.0, "bold": true, "italic": false, "letterSpacing": 0, "wordSpacing": 100, "animationType": "karaoke", "bestFor": "Music & sing-alongs"},
  {"id": "minimal", "name": "Minimal", "category": "clean-tech", "description": "Mature Swiss minimalism with subtle platinum scaling", "fontName": "Inter", "fontNameFallback": "IBM Plex Sans", "fontSize": 105, "primaryColor": "#F8FAFC", "highlightColor": "#FFFFFF", "outlineColor": "#0F172A", "shadowColor": "#000000", "shadowAlpha": 110, "outlineSize": 3.5, "shadowDepth": 3.0, "bold": true, "italic": false, "letterSpacing": 0.5, "wordSpacing": 100, "animationType": "scale", "bestFor": "Professional & executive"},
  {"id": "bounce", "name": "Bounce", "category": "pop-expressive", "description": "Playful bounce animation with bright colors", "fontName": "Bangers", "fontNameFallback": "IBM Plex Sans", "fontSize": 110, "primaryColor": "#00FF88", "highlightColor": "#FF00FF", "outlineColor": "#000000", "shadowColor": "#000000", "shadowAlpha": 0, "outlineSize": 5.0, "shadowDepth": 5.0, "bold": true, "italic": false, "letterSpacing": 0, "wordSpacing": 100, "animationType": "bounce", "bestFor": "Fun & energetic"},
  {"id": "classic", "name": "Classic", "category": "trending", "description": "Executive grotesque with warm amber gold highlights", "fontName": "Plus Jakarta Sans", "fontNameFallback": "IBM Plex Sans", "fontSize": 105, "primaryColor": "#FFFFFF", "highlightColor": "#F59E0B", "outlineColor": "#18181B", "shadowColor": "#000000", "shadowAlpha": 150, "outlineSize": 5.0, "shadowDepth": 3.5, "bold": true, "italic": false, "letterSpacing": 0.5, "wordSpacing": 100, "animationType": "highlight", "bestFor": "Modern viral & brand reels"},
  {"id": "ali-abdaal", "name": "Ali Abdaal", "category": "clean-tech", "description": "Clean neo-grotesque with bright highlighter yellow accent", "fontName": "Inter", "fontNameFallback": "IBM Plex Sans", "fontSize": 100, "primaryColor": "#F8FAFC", "highlightColor": "#FFDE59", "outlineColor": "#0F172A", "shadowColor": "#000000", "shadowAlpha": 120, "outlineSize": 4.0, "shadowDepth": 3.5, "bold": true, "italic": false, "letterSpacing": 0.5, "wordSpacing": 100, "animationType": "pop", "bestFor": "Productivity, podcasts & tech"},
  {"id": "vox", "name": "Vox Explainer", "category": "editorial-film", "description": "Punchy structural sans with bold gold contrast", "fontName": "Syne", "fontNameFallback": "IBM Plex Sans", "fontSize": 105, "primaryColor": "#FFFFFF", "highlightColor": "#FFE600", "outlineColor": "#000000", "shadowColor": "#000000", "shadowAlpha": 160, "outlineSize": 5.5, "shadowDepth": 4.0, "bold": true, "italic": false, "letterSpacing": 0.5, "wordSpacing": 100, "animationType": "highlight", "bestFor": "Video essays & documentaries"},
  {"id": "luxury", "name": "Iman Luxury", "category": "editorial-film", "description": "Editorial serif with champagne text and warm gold highlights", "fontName": "Playfair Display", "fontNameFallback": "IBM Plex Sans", "fontSize": 102, "primaryColor": "#FBF7F0", "highlightColor": "#E5B869", "outlineColor": "#1A1A1A", "shadowColor": "#000000", "shadowAlpha": 140, "outlineSize": 4.0, "shadowDepth": 3.5, "bold": true, "italic": true, "letterSpacing": 1.0, "wordSpacing": 105, "animationType": "scale", "bestFor": "Luxury, finance & mindset"},
  {"id": "cyberpunk", "name": "Cyberpunk Neon", "category": "pop-expressive", "description": "Futuristic techno sans with glowing cyan and hot pink neon", "fontName": "Orbitron", "fontNameFallback": "IBM Plex Sans", "fontSize": 96, "primaryColor": "#00F0FF", "highlightColor": "#FF007F", "outlineColor": "#050515", "shadowColor": "#00F0FF", "shadowAlpha": 80, "outlineSize": 5.0, "shadowDepth": 6.0, "bold": true, "italic": false, "letterSpacing": 2.0, "wordSpacing": 100, "animationType": "glow", "bestFor": "AI, tech, crypto & gaming"},
  {"id": "cinema-noir", "name": "Cinema Noir", "category": "editorial-film", "description": "Majestic Roman serif with crimson flame highlight and dark shadow", "fontName": "Cinzel", "fontNameFallback": "IBM Plex Sans", "fontSize": 98, "primaryColor": "#E2E8F0", "highlightColor": "#E11D48", "outlineColor": "#0A0A0A", "shadowColor": "#000000", "shadowAlpha": 200, "outlineSize": 4.5, "shadowDepth": 5.0, "bold": true, "italic": false, "letterSpacing": 2.5, "wordSpacing": 105, "animationType": "highlight", "bestFor": "True crime, history & drama"},
  {"id": "terminal", "name": "Code Terminal", "category": "clean-tech", "description": "Crisp monospace with matrix green glow", "fontName": "JetBrains Mono", "fontNameFallback": "IBM Plex Sans", "fontSize": 92, "primaryColor": "#CBD5E1", "highlightColor": "#22C55E", "outlineColor": "#020617", "shadowColor": "#16A34A", "shadowAlpha": 100, "outlineSize": 4.0, "shadowDepth": 4.0, "bold": true, "italic": false, "letterSpacing": 0, "wordSpacing": 100, "animationType": "pop", "bestFor": "Coding tutorials & dev content"},
  {"id": "creator-pop", "name": "Creator Pop", "category": "pop-expressive", "description": "Punchy rounded bold sans with electric purple accents", "fontName": "Poppins", "fontNameFallback": "IBM Plex Sans", "fontSize": 105, "primaryColor": "#FFFFFF", "highlightColor": "#A855F7", "outlineColor": "#000000", "shadowColor": "#000000", "shadowAlpha": 160, "outlineSize": 6.0, "shadowDepth": 4.5, "bold": true, "italic": false, "letterSpacing": 0, "wordSpacing": 100, "animationType": "pop", "bestFor": "High-retention shorts & comedy"},
  {"id": "warm-pastel", "name": "Warm Pastel", "category": "editorial-film", "description": "Gentle oat and warm coral tones with soft diffuse shadow", "fontName": "Outfit", "fontNameFallback": "IBM Plex Sans", "fontSize": 102, "primaryColor": "#FFFBF5", "highlightColor": "#FF8A65", "outlineColor": "#2D2321", "shadowColor": "#1A0E0B", "shadowAlpha": 90, "outlineSize": 3.5, "shadowDepth": 4.0, "bold": true, "italic": false, "letterSpacing": 1.0, "wordSpacing": 100, "animationType": "scale", "bestFor": "Vlogs, wellness, food & ASMR"},
  {"id": "urban-rebel", "name": "Urban Rebel", "category": "pop-expressive", "description": "Raw handwritten marker with caution yellow highlight and deep stroke", "fontName": "Permanent Marker", "fontNameFallback": "IBM Plex Sans", "fontSize": 96, "primaryColor": "#F8FAFC", "highlightColor": "#FACC15", "outlineColor": "#000000", "shadowColor": "#000000", "shadowAlpha": 180, "outlineSize": 6.0, "shadowDepth": 5.0, "bold": false, "italic": false, "letterSpacing": 1.5, "wordSpacing": 100, "animationType": "bounce", "bestFor": "Fitness, sports & motivation"},
  {"id": "nordic-clean", "name": "Nordic Clean", "category": "clean-tech", "description": "Swiss executive minimalism with dimmed inactive focus reading", "fontName": "Inter", "fontNameFallback": "IBM Plex Sans", "fontSize": 104, "primaryColor": "#94A3B8", "highlightColor": "#FFFFFF", "outlineColor": "#000000", "shadowColor": "#000000", "shadowAlpha": 120, "outlineSize": 4.0, "shadowDepth": 3.0, "bold": true, "italic": false, "letterSpacing": -0.5, "wordSpacing": 100, "animationType": "highlight", "bestFor": "SaaS launches & keynotes"},
  {"id": "podcast-hook", "name": "Podcast Viral", "category": "trending", "description": "Electric lime pop on modern grotesque sans, inspired by DOAC & top podcasts", "fontName": "Plus Jakarta Sans", "fontNameFallback": "IBM Plex Sans", "fontSize": 108, "primaryColor": "#FFFFFF", "highlightColor": "#D4FF00", "outlineColor": "#0F172A", "shadowColor": "#000000", "shadowAlpha": 160, "outlineSize": 5.5, "shadowDepth": 4.5, "bold": true, "italic": false, "letterSpacing": -0.5, "wordSpacing": 100, "animationType": "pop", "bestFor": "Podcasts, interviews, founder stories & talking-head insights"},
  {"id": "wealth-hustle", "name": "Fintech & Wealth", "category": "trending", "description": "Pure white typography with vibrant cash emerald green highlights", "fontName": "Montserrat", "fontNameFallback": "IBM Plex Sans", "fontSize": 110, "primaryColor": "#FFFFFF", "highlightColor": "#00E676", "outlineColor": "#000000", "shadowColor": "#000000", "shadowAlpha": 180, "outlineSize": 6.5, "shadowDepth": 5.0, "bold": true, "italic": false, "letterSpacing": 0.5, "wordSpacing": 105, "animationType": "scale", "bestFor": "Finance, crypto, real estate & business mindset reels"},
  {"id": "magnates-mystery", "name": "Dark Documentary", "category": "editorial-film", "description": "Dramatic high-contrast serif with dossier hazard gold highlights", "fontName": "Cinzel", "fontNameFallback": "IBM Plex Sans", "fontSize": 102, "primaryColor": "#F8F6F0", "highlightColor": "#F59E0B", "outlineColor": "#0A0A0A", "shadowColor": "#000000", "shadowAlpha": 200, "outlineSize": 4.5, "shadowDepth": 6.0, "bold": true, "italic": false, "letterSpacing": 1.5, "wordSpacing": 110, "animationType": "highlight", "bestFor": "Investigative video essays, mysteries & historical true crime"},
  {"id": "typewriter-vibe", "name": "Submagic Storyteller", "category": "pop-expressive", "description": "Aesthetic typewriter rhythm with warm coral highlight wipe", "fontName": "JetBrains Mono", "fontNameFallback": "IBM Plex Sans", "fontSize": 98, "primaryColor": "#FFFDF7", "highlightColor": "#FB7185", "outlineColor": "#292524", "shadowColor": "#000000", "shadowAlpha": 120, "outlineSize": 4.0, "shadowDepth": 3.0, "bold": true, "italic": false, "letterSpacing": 0.0, "wordSpacing": 100, "animationType": "karaoke", "bestFor": "Storytelling, BookTok, personal journals & poetry"},
  {"id": "dark-psychology", "name": "Dark Psychology", "category": "pop-expressive", "description": "Cold technical typography with sinister blood red glow", "fontName": "Orbitron", "fontNameFallback": "IBM Plex Sans", "fontSize": 96, "primaryColor": "#F1F5F9", "highlightColor": "#DC2626", "outlineColor": "#050505", "shadowColor": "#DC2626", "shadowAlpha": 90, "outlineSize": 5.5, "shadowDepth": 7.0, "bold": true, "italic": false, "letterSpacing": 1.0, "wordSpacing": 105, "animationType": "glow", "bestFor": "Stoic philosophy, dark psychology & thriller hooks"},
  {"id": "kapwing-viral", "name": "Kapwing Viral", "category": "trending", "description": "High-contrast bright yellow highlights with punchy spring pop", "fontName": "Montserrat", "fontNameFallback": "IBM Plex Sans", "fontSize": 110, "primaryColor": "#FFFFFF", "highlightColor": "#FACC15", "outlineColor": "#000000", "shadowColor": "#000000", "shadowAlpha": 140, "outlineSize": 6.5, "shadowDepth": 4.0, "bold": true, "italic": false, "letterSpacing": 0.5, "wordSpacing": 105, "animationType": "pop", "bestFor": "Viral shorts, hooks & high-energy content"},
  {"id": "neon-cyber", "name": "Neon Cyber", "category": "clean-tech", "description": "Electric cyan with radioactive green pulse and glowing neon", "fontName": "Orbitron", "fontNameFallback": "IBM Plex Sans", "fontSize": 100, "primaryColor": "#00F0FF", "highlightColor": "#39FF14", "outlineColor": "#0A0A1A", "shadowColor": "#00F0FF", "shadowAlpha": 120, "outlineSize": 5.0, "shadowDepth": 6.0, "bold": true, "italic": false, "letterSpacing": 1.2, "wordSpacing": 105, "animationType": "glow", "bestFor": "AI demos, tech tutorials & gaming reels"},
  {"id": "retro-glitch", "name": "Retro Glitch", "category": "pop-expressive", "description": "Vivid hot magenta and electric yellow with spring bounce", "fontName": "Bebas Neue", "fontNameFallback": "IBM Plex Sans", "fontSize": 115, "primaryColor": "#FF007F", "highlightColor": "#FFE600", "outlineColor": "#050510", "shadowColor": "#000000", "shadowAlpha": 160, "outlineSize": 7.0, "shadowDepth": 5.0, "bold": true, "italic": false, "letterSpacing": 0.8, "wordSpacing": 100, "animationType": "bounce", "bestFor": "Entertainment, memes & fast pacing"},
  {"id": "cinema-gold", "name": "Cinema Gold", "category": "editorial-film", "description": "Luxurious crisp white with metallic gold zoom highlight", "fontName": "Playfair Display", "fontNameFallback": "IBM Plex Sans", "fontSize": 98, "primaryColor": "#F8FAFC", "highlightColor": "#FFD700", "outlineColor": "#0B0C10", "shadowColor": "#B8860B", "shadowAlpha": 80, "outlineSize": 4.0, "shadowDepth": 4.5, "bold": true, "italic": true, "letterSpacing": 1.5, "wordSpacing": 110, "animationType": "scale", "bestFor": "Documentary, finance, podcasts & luxury"},
  {"id": "tiktok-hype", "name": "TikTok Hype", "category": "trending", "description": "Bold white typography with active word red pill box highlight", "fontName": "Poppins", "fontNameFallback": "IBM Plex Sans", "fontSize": 105, "primaryColor": "#FFFFFF", "highlightColor": "#EF4444", "outlineColor": "#000000", "shadowColor": "#000000", "shadowAlpha": 0, "outlineSize": 9.0, "shadowDepth": 0.0, "bold": true, "italic": false, "letterSpacing": 0.5, "wordSpacing": 105, "animationType": "box", "bestFor": "Trending TikTok challenges & retention hooks"}
] as CapiteCaptionStyle[])

export const CAPITE_CATEGORIES: readonly { id: CapiteCategory; label: string }[] = Object.freeze([
  { id: 'trending', label: 'Trending' }, { id: 'pop-expressive', label: 'Pop & expressive' },
  { id: 'clean-tech', label: 'Clean & tech' }, { id: 'editorial-film', label: 'Editorial & film' },
])

const BY_ID = new Map(CAPITE_CAPTION_STYLES.map((s) => [s.id, s]))
export const capiteStyleById = (id: unknown): CapiteCaptionStyle | undefined => (typeof id === 'string' ? BY_ID.get(id) : undefined)
export const isCapiteStyleId = (id: unknown): boolean => capiteStyleById(id) !== undefined

/** Every distinct font family the styles name, for hosts that preload fonts. */
export const CAPITE_FONT_FAMILIES: readonly string[] = Object.freeze([...new Set(CAPITE_CAPTION_STYLES.map((s) => s.fontName))])

export type CapiteWordState = 'idle' | 'spoken' | 'active'

interface Css { [k: string]: string | number | undefined }

/** Round-cornered 8-direction outline (text-shadow only: no filters, so it exports the same as it previews). */
function ring(px: number, color: string): string[] {
  const r = Math.max(1, Math.round(px * 10) / 10)
  const d = Math.round(r * 0.7071 * 10) / 10
  return [[r, 0], [-r, 0], [0, r], [0, -r], [d, d], [-d, d], [d, -d], [-d, -d]].map(([x, y]) => `${x}px ${y}px 0 ${color}`)
}

function withAlpha(hex: string, alpha255: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.round((Math.min(255, Math.max(0, alpha255)) / 255) * 100) / 100})`
}

/**
 * CSS for the caption block. `fontSizePx` is what the HOST wants on screen (it knows the frame); the style only
 * contributes proportions: outline and shadow scale with the text, as in Capite.
 */
export function capiteTextCss(style: CapiteCaptionStyle, fontSizePx: number, fallbackStack: string): Css {
  const k = fontSizePx / Math.max(1, style.fontSize)
  const shadows: string[] = []
  if (style.outlineSize > 0 && style.animationType !== 'box') shadows.push(...ring(style.outlineSize * k, style.outlineColor))
  if (style.shadowDepth > 0) shadows.push(`0 ${Math.round(style.shadowDepth * k)}px ${Math.round(style.shadowDepth * 2 * k)}px ${withAlpha(style.shadowColor, style.shadowAlpha || 153)}`)
  if (style.animationType === 'glow') {
    shadows.push(`0 0 ${Math.max(8, Math.round(fontSizePx * 0.18))}px ${style.highlightColor}`, `0 0 ${Math.max(16, Math.round(fontSizePx * 0.36))}px ${style.highlightColor}`)
  }
  return {
    fontFamily: `"${style.fontName}", "${style.fontNameFallback}", ${fallbackStack}`,
    fontSize: fontSizePx, fontWeight: style.bold ? 800 : 500, fontStyle: style.italic ? 'italic' : 'normal',
    letterSpacing: style.letterSpacing ? `${Math.round(style.letterSpacing * k * 10) / 10}px` : undefined,
    wordSpacing: style.wordSpacing !== 100 ? `${Math.round((style.wordSpacing - 100) * 0.01 * fontSizePx * 10) / 10}px` : undefined,
    textTransform: 'uppercase', color: style.primaryColor, textShadow: shadows.length ? shadows.join(', ') : undefined,
  }
}

/** Per-word CSS: the spoken word is picked out the way the style's animation says. Static per frame (no CSS animation). */
export function capiteWordCss(style: CapiteCaptionStyle, state: CapiteWordState, fontSizePx: number): Css {
  const lit = state === 'active'
  switch (style.animationType) {
    case 'karaoke': return { color: state === 'idle' ? style.primaryColor : style.highlightColor }
    case 'box': return lit ? { color: style.primaryColor, background: style.highlightColor, borderRadius: Math.round(fontSizePx * 0.15), padding: `0 ${Math.round(fontSizePx * 0.12)}px`, textShadow: 'none' } : {}
    case 'scale': return lit ? { color: style.highlightColor, display: 'inline-block', transform: 'scale(1.14)' } : {}
    case 'pop': return lit ? { color: style.highlightColor, display: 'inline-block', transform: 'scale(1.22)' } : {}
    case 'bounce': return lit ? { color: style.highlightColor, display: 'inline-block', transform: `translateY(${-Math.round(fontSizePx * 0.12)}px)` } : {}
    default: return lit ? { color: style.highlightColor } : {}
  }
}
