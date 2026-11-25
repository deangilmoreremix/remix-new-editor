/**
 * How the personalization editor opens the Caption Studio without importing it. The Studio lives in each host app (a different path in
 * remix-new-editor and OpenHiggsBolt), so the host registers a function here at startup; this shared code only calls it.
 * With nothing registered the editor keeps its own simple captions panel.
 */
import type { StudioCaptionStyle } from './studioCaptions'

export interface CaptionStudioWord { text: string; startMs: number; endMs: number }

export interface CaptionStudioRequest {
  /** The video to caption. */
  videoUrl: string
  /** Existing captions to start from, word by word. */
  words?: CaptionStudioWord[]
  /** The look to start from (a StudioCaptionStyle, or part of one). */
  style?: Partial<StudioCaptionStyle>
  /** Fonts the editor can draw and export offline; the Studio limits its font menu to these. */
  fonts?: readonly string[]
  /** Called with `{ pages, style }` (see captions/studioCaptions.ts) when the person applies their captions. */
  onApply: (studio: unknown) => void
  onError?: (err: Error) => void
}

export type CaptionStudioOpener = (request: CaptionStudioRequest) => void

let opener: CaptionStudioOpener | null = null

/** Host apps call this once. Pass null to unregister. */
export function registerCaptionStudio(fn: CaptionStudioOpener | null): void { opener = fn }
export function getCaptionStudio(): CaptionStudioOpener | null { return opener }
