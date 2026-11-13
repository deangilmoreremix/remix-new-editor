/**
 * Pure edits to `settings.captions` (Stage 6). Each returns a NEW settings object and normalises the result.
 */
import type { PersonalizationPreviewSettings } from '../preview/types'
import {
  CAPTION_PRESETS, defaultCaptionStyle, normalizeCaptionTrack, parseCaptionFile,
  type CaptionCue, type CaptionSource, type CaptionStyle, type CaptionTrack,
} from '../preview/captions'

const base = (prev: PersonalizationPreviewSettings): CaptionTrack =>
  prev.captions ?? { enabled: true, cues: [], style: defaultCaptionStyle('tiktok'), source: 'typed' }

const put = (prev: PersonalizationPreviewSettings, t: CaptionTrack): PersonalizationPreviewSettings => {
  const n = normalizeCaptionTrack(t)
  return n ? { ...prev, captions: n } : prev
}

export function setCues(prev: PersonalizationPreviewSettings, cues: CaptionCue[], source?: CaptionSource): PersonalizationPreviewSettings {
  const t = base(prev)
  return put(prev, { ...t, cues, source: source ?? t.source })
}
export function patchCaptionStyle(prev: PersonalizationPreviewSettings, patch: Partial<CaptionStyle>): PersonalizationPreviewSettings {
  const t = base(prev)
  return put(prev, { ...t, style: { ...t.style, ...patch } })
}
/** A preset replaces the look but keeps the customer's position and size choices only when they were changed from the preset's own. */
export function applyCaptionPreset(prev: PersonalizationPreviewSettings, id: string): PersonalizationPreviewSettings {
  if (!CAPTION_PRESETS[id]) return prev
  const t = base(prev)
  return put(prev, { ...t, style: defaultCaptionStyle(id) })
}
export function setCaptionsEnabled(prev: PersonalizationPreviewSettings, enabled: boolean): PersonalizationPreviewSettings {
  return prev.captions ? put(prev, { ...prev.captions, enabled }) : prev
}
export function clearCaptions(prev: PersonalizationPreviewSettings): PersonalizationPreviewSettings {
  const { captions: _d, ...rest } = prev
  void _d
  return rest as PersonalizationPreviewSettings
}

export type ImportResult = { ok: true; settings: PersonalizationPreviewSettings; count: number; format: 'srt' | 'vtt' } | { ok: false; error: string }
export function importCaptionFile(prev: PersonalizationPreviewSettings, text: string, fileName: string): ImportResult {
  try {
    const { cues, format } = parseCaptionFile(text, fileName)
    // Subtitle files are sentence-level: show them as written.
    const t = base(prev)
    const next = put(prev, { ...t, cues, source: format, style: prev.captions ? t.style : defaultCaptionStyle('classic') })
    return { ok: true, settings: next, count: cues.length, format }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
