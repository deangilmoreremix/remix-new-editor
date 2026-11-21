export interface CaptionToken { text: string; fromMs: number; toMs: number }
export interface CaptionPage { startMs: number; durationMs: number; tokens: CaptionToken[] }
export interface CaptionFrameStyle {
  fontSize?: number; position?: 'top' | 'middle' | 'bottom'; positionY?: number
  color?: string; highlightColor?: string; strokeColor?: string; backgroundColor?: string
  uppercase?: boolean; stroke?: boolean; background?: boolean; highlightActive?: boolean
  animation?: 'highlight' | 'scale' | 'pop' | 'bounce' | 'glow' | 'box' | 'karaoke'
}
export interface FrameBox { x: number; y: number; w: number; h: number; r: number; color: string }
export interface FrameWord {
  text: string; width: number; cx: number; cy: number; scale: number
  box: FrameBox | null; color: string; wipe: { fraction: number; color: string } | null
  outlinePx: number; outlineColor: string | null; shadow: { color: string; blur: number; offsetY: number } | null
}
export interface CaptionFrame { fontPx: number; lineH: number; anim: string; lineBoxes: FrameBox[]; words: FrameWord[] }
export function activePageAt(pages: CaptionPage[], ms: number, holdMs?: number): CaptionPage | null
export function layoutWords(tokens: { text: string }[], measure: (t: string) => number, maxWidth: number, uppercase?: boolean): { lines: { words: { text: string; width: number; token: unknown }[]; width: number }[]; space: number }
export function layoutCaptionFrame(o: { page: CaptionPage | null | undefined; style?: CaptionFrameStyle; ms: number; width: number; height: number; measure: (t: string) => number }): CaptionFrame | null
