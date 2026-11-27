// Capite-style captions: the data and rules below follow Capite (https://github.com/muneebkhan08/Capite).
// Source: frontend/src/types/caption.ts (the caption style types and transcript shapes only).

export type CaptionStyle =
  | "hormozi"
  | "mrbeast"
  | "crimson-pop"
  | "podcast-hook"
  | "wealth-hustle"
  | "magnates-mystery"
  | "typewriter-vibe"
  | "dark-psychology"
  | "karaoke"
  | "minimal"
  | "bounce"
  | "classic"
  | "ali-abdaal"
  | "vox"
  | "luxury"
  | "cyberpunk"
  | "cinema-noir"
  | "terminal"
  | "creator-pop"
  | "warm-pastel"
  | "urban-rebel"
  | "nordic-clean"
  | "kapwing-viral"
  | "neon-cyber"
  | "retro-glitch"
  | "cinema-gold"
  | "tiktok-hype";

export type AnimationType = "highlight" | "karaoke" | "scale" | "bounce" | "pop" | "glow" | "box";

export type CaptionCategory = "all" | "trending" | "clean-tech" | "editorial-film" | "pop-expressive";

export interface CaptionStyleConfig {
  id: CaptionStyle;
  name: string;
  category?: string;
  description: string;
  fontName: string;
  fontNameFallback: string;
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  outlineColor: string;
  backgroundColor?: string;
  shadowColor: string;
  shadowAlpha: number;
  outlineSize: number;
  shadowDepth: number;
  bold: boolean;
  italic: boolean;
  letterSpacing: number;
  wordSpacing: number;
  animationType: AnimationType;
  previewText: string;
  bestFor: string;
  previewFontSize: number;
  previewOutlineSize: number;
  previewShadowDepth: number;
  previewLetterSpacing: number;
}

export interface TranscriptData {
  language: string;
  segments: TranscriptSegment[];
}

export interface TranscriptSegment {
  id?: string;
  start: number;
  end: number;
  text: string;
  words: WordTimestamp[];
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}
