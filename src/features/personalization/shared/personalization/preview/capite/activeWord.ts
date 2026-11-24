// Capite-style captions: the data and rules below follow Capite (https://github.com/muneebkhan08/Capite).
// Source: frontend/src/app/globals.css (`.caption-word-active-*`) and frontend/src/components/studio/video-overlay-player.tsx
// (the five-word window around the spoken word). Capite applies these with CSS classes and transitions; a Remotion frame has no
// CSS transition, so the same end-state numbers are applied per frame instead (see `activeWordStyle`).
import type { AnimationType } from "./types";

/** video-overlay-player.tsx: only a window of this many words is shown, starting two words before the active one. */
export const WORD_WINDOW = 5;
export const WORD_WINDOW_LEAD = 2;

export function visibleWordRange(count: number, activeIdx: number): [number, number] {
  const current = activeIdx >= 0 ? activeIdx : 0;
  let start = Math.max(0, current - WORD_WINDOW_LEAD);
  const end = Math.min(count, start + WORD_WINDOW);
  if (end - start < WORD_WINDOW) start = Math.max(0, end - WORD_WINDOW);
  return [start, end];
}

/** The active word's look per animation type, from globals.css. Sizes in px at Capite's preview scale are kept as em-free ratios. */
export interface ActiveWordLook {
  scale: number;
  /** translateY in em (Capite: -5px at its 16px-ish preview text, i.e. about -0.3em). */
  rise: number;
  /** Two drop-shadows (blur radius in em) around the word, in the highlight color. */
  glow: [number, number] | null;
  /** Highlight background behind the word with this padding (em), radius (em), and a drop shadow. */
  box: { padX: number; padY: number; radius: number } | null;
}

export const ACTIVE_WORD: Record<AnimationType, ActiveWordLook> = {
  highlight: { scale: 1, rise: 0, glow: null, box: null },
  karaoke: { scale: 1, rise: 0, glow: null, box: null },
  pop: { scale: 1.16, rise: 0, glow: null, box: null },
  bounce: { scale: 1.18, rise: -5 / 16, glow: null, box: null },
  scale: { scale: 1.12, rise: 0, glow: null, box: null },
  glow: { scale: 1, rise: 0, glow: [8 / 16, 18 / 16], box: null },
  box: { scale: 1.08, rise: 0, glow: null, box: { padX: 7 / 16, padY: 1 / 16, radius: 6 / 16 } },
};
