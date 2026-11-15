// SPDX-License-Identifier: MIT — the 27 caption looks of Capite (https://github.com/muneebkhan08/Capite, MIT, © 2026 Capite Contributors),
// ported from backend/caption-styles.config.json onto the editor's own caption style model so they render, animate and export like any other caption.
import type { CaptionStyle } from './styles';
import type { CaptionMotionPreset, CaptionTemplate } from './types';

export type CapiteCategory = 'trending' | 'clean-tech' | 'editorial-film' | 'pop-expressive';
export interface CapiteStyle extends CaptionStyle { category: CapiteCategory; motion: CaptionMotionPreset; bestFor: string }

export const CAPITE_CATEGORY_LABEL: Record<CapiteCategory, string> = { trending: 'Trending', 'clean-tech': 'Clean & tech', 'editorial-film': 'Editorial & film', 'pop-expressive': 'Pop & expressive' };

/** Capite's animation types → the editor's burn-in motion presets. */
const MOTION: Record<string, CaptionMotionPreset> = { highlight: 'word-pop', karaoke: 'karaoke-pulse', pop: 'pop', bounce: 'word-pop', box: 'word-pop', glow: 'fade-up', scale: 'pop' };
/** Loud, all-caps looks. */
const UPPER = new Set(['hormozi', 'mrbeast', 'crimson-pop', 'bounce', 'tiktok-hype', 'kapwing-viral', 'wealth-hustle', 'retro-glitch', 'neon-cyber', 'cyberpunk', 'dark-psychology']);

// id, name, category, animationType, font, size (Capite px at 1080p), text colour, highlight colour, outline, shadow depth, bold, italic, best for
const ROWS: [string, string, CapiteCategory, string, string, number, string, string, number, number, boolean, boolean, string][] = [
  ['hormozi', 'Hormozi', 'trending', 'highlight', 'Montserrat', 105, '#FFFFFF', '#00FFFF', 5.0, 4.5, true, false, 'Business & motivation'],
  ['mrbeast', 'MrBeast', 'trending', 'highlight', 'Bebas Neue', 120, '#FFFF00', '#FF6600', 8.0, 6.0, true, false, 'Gaming & entertainment'],
  ['crimson-pop', 'Crimson Pop', 'trending', 'box', 'Montserrat', 105, '#FFFFFF', '#E11D48', 10.0, 0.0, true, false, 'High impact hooks, story reels & viral shorts'],
  ['karaoke', 'Karaoke', 'pop-expressive', 'karaoke', 'Montserrat', 105, '#FFFFFF', '#0080FF', 4.0, 3.0, true, false, 'Music & sing-alongs'],
  ['minimal', 'Minimal', 'clean-tech', 'scale', 'Inter', 105, '#F8FAFC', '#FFFFFF', 3.5, 3.0, true, false, 'Professional & executive'],
  ['bounce', 'Bounce', 'pop-expressive', 'bounce', 'Bangers', 110, '#00FF88', '#FF00FF', 5.0, 5.0, true, false, 'Fun & energetic'],
  ['classic', 'Classic', 'trending', 'highlight', 'Plus Jakarta Sans', 105, '#FFFFFF', '#F59E0B', 5.0, 3.5, true, false, 'Modern viral & brand reels'],
  ['ali-abdaal', 'Ali Abdaal', 'clean-tech', 'pop', 'Inter', 100, '#F8FAFC', '#FFDE59', 4.0, 3.5, true, false, 'Productivity, podcasts & tech'],
  ['vox', 'Vox Explainer', 'editorial-film', 'highlight', 'Syne', 105, '#FFFFFF', '#FFE600', 5.5, 4.0, true, false, 'Video essays & documentaries'],
  ['luxury', 'Iman Luxury', 'editorial-film', 'scale', 'Playfair Display', 102, '#FBF7F0', '#E5B869', 4.0, 3.5, true, true, 'Luxury, finance & mindset'],
  ['cyberpunk', 'Cyberpunk Neon', 'pop-expressive', 'glow', 'Orbitron', 96, '#00F0FF', '#FF007F', 5.0, 6.0, true, false, 'AI, tech, crypto & gaming'],
  ['cinema-noir', 'Cinema Noir', 'editorial-film', 'highlight', 'Cinzel', 98, '#E2E8F0', '#E11D48', 4.5, 5.0, true, false, 'True crime, history & drama'],
  ['terminal', 'Code Terminal', 'clean-tech', 'pop', 'JetBrains Mono', 92, '#CBD5E1', '#22C55E', 4.0, 4.0, true, false, 'Coding tutorials & dev content'],
  ['creator-pop', 'Creator Pop', 'pop-expressive', 'pop', 'Poppins', 105, '#FFFFFF', '#A855F7', 6.0, 4.5, true, false, 'High-retention shorts & comedy'],
  ['warm-pastel', 'Warm Pastel', 'editorial-film', 'scale', 'Outfit', 102, '#FFFBF5', '#FF8A65', 3.5, 4.0, true, false, 'Vlogs, wellness, food & ASMR'],
  ['urban-rebel', 'Urban Rebel', 'pop-expressive', 'bounce', 'Permanent Marker', 96, '#F8FAFC', '#FACC15', 6.0, 5.0, false, false, 'Fitness, sports & motivation'],
  ['nordic-clean', 'Nordic Clean', 'clean-tech', 'highlight', 'Inter', 104, '#94A3B8', '#FFFFFF', 4.0, 3.0, true, false, 'SaaS launches & keynotes'],
  ['podcast-hook', 'Podcast Viral', 'trending', 'pop', 'Plus Jakarta Sans', 108, '#FFFFFF', '#D4FF00', 5.5, 4.5, true, false, 'Podcasts, interviews, founder stories & talking-head insights'],
  ['wealth-hustle', 'Fintech & Wealth', 'trending', 'scale', 'Montserrat', 110, '#FFFFFF', '#00E676', 6.5, 5.0, true, false, 'Finance, crypto, real estate & business mindset reels'],
  ['magnates-mystery', 'Dark Documentary', 'editorial-film', 'highlight', 'Cinzel', 102, '#F8F6F0', '#F59E0B', 4.5, 6.0, true, false, 'Investigative video essays, mysteries & historical true crime'],
  ['typewriter-vibe', 'Submagic Storyteller', 'pop-expressive', 'karaoke', 'JetBrains Mono', 98, '#FFFDF7', '#FB7185', 4.0, 3.0, true, false, 'Storytelling, BookTok, personal journals & poetry'],
  ['dark-psychology', 'Dark Psychology', 'pop-expressive', 'glow', 'Orbitron', 96, '#F1F5F9', '#DC2626', 5.5, 7.0, true, false, 'Stoic philosophy, dark psychology & thriller hooks'],
  ['kapwing-viral', 'Kapwing Viral', 'trending', 'pop', 'Montserrat', 110, '#FFFFFF', '#FACC15', 6.5, 4.0, true, false, 'Viral shorts, hooks & high-energy content'],
  ['neon-cyber', 'Neon Cyber', 'clean-tech', 'glow', 'Orbitron', 100, '#00F0FF', '#39FF14', 5.0, 6.0, true, false, 'AI demos, tech tutorials & gaming reels'],
  ['retro-glitch', 'Retro Glitch', 'pop-expressive', 'bounce', 'Bebas Neue', 115, '#FF007F', '#FFE600', 7.0, 5.0, true, false, 'Entertainment, memes & fast pacing'],
  ['cinema-gold', 'Cinema Gold', 'editorial-film', 'scale', 'Playfair Display', 98, '#F8FAFC', '#FFD700', 4.0, 4.5, true, true, 'Documentary, finance, podcasts & luxury'],
  ['tiktok-hype', 'TikTok Hype', 'trending', 'box', 'Poppins', 105, '#FFFFFF', '#EF4444', 9.0, 0.0, true, false, 'Trending TikTok challenges & retention hooks'],
];

const hexDark = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 150; };

function build([id, name, category, anim, font, size, color, highlight, outline, depth, bold, italic, bestFor]: ROWS_ITEM): CapiteStyle {
  const box = anim === 'box';
  const glow = anim === 'glow';
  return {
    id: `capite-${id}` as CaptionTemplate,
    label: name, labelZh: name, hint: bestFor,
    category, motion: MOTION[anim] ?? 'pop', bestFor,
    fontFamily: font, fontSize: Math.round((size / 1900) * 1000) / 1000, fontWeight: bold ? 800 : 500,
    ...(italic ? { fontStyle: 'italic' as const } : {}),
    color,
    // a "box" look highlights with a filled chip behind the word; the others recolour the word
    highlightColor: box ? (hexDark(highlight) ? '#fff' : '#111') : highlight,
    ...(box ? { highlightBackground: highlight } : {}),
    strokeColor: '#000', strokeWidth: box ? Math.min(3, outline * 0.3) : Math.min(7, Math.round(outline * 0.6 * 10) / 10),
    textShadow: glow ? `0 0 12px ${highlight}, 0 0 26px ${highlight}` : depth > 0 ? `0 ${Math.round(depth * 0.6)}px ${Math.round(depth * 1.6)}px rgba(0,0,0,.75)` : 'none',
    textShadowSize: glow ? 26 : Math.round(depth * 1.6),
    ...(UPPER.has(id) ? { textTransform: 'uppercase' as const } : {}),
  };
}
type ROWS_ITEM = (typeof ROWS)[number];

export const CAPITE_STYLES: CapiteStyle[] = ROWS.map(build);
