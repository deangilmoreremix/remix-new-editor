'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { transcribeVideo } from '../localAI/engine'
import { useLocalAI, type LocalAI } from '../localAI/useLocalAI'
import type { CaptionPosition, CaptionStyleId, PreviewCaptionCue, PreviewCaptionCustom, PreviewCaptions } from '../preview/types'
import { groupCaptionCues } from './captionCues'
import { nudgeCue, retimeCue } from './cueEdit'
import { applyCasing, findReplace, type Casing, type FindOptions } from './textTools'

export interface Captions {
  ai: LocalAI
  /** The captions in the project, when they were written for THIS video; otherwise null. */
  captions: PreviewCaptions | null
  /** Plain-words outcome when there is nothing to show ("No speech was found"). */
  note: string | null
  generate: () => Promise<void>
  /** The language to write captions in: an ISO code, or 'auto' to detect it. */
  language: string
  setLanguage: (language: string) => void
  setEnabled: (enabled: boolean) => void
  setStyle: (style: CaptionStyleId) => void
  /** Moving to another place also puts the caption back in it (no vertical offset). */
  setPosition: (position: CaptionPosition) => void
  /** Sets or clears (undefined) customizer values: font, weight, italic, casing, outline and background colour, offset. */
  setCustom: (patch: Partial<PreviewCaptionCustom>) => void
  /** Replaces a line's text. Clearing it deletes the line. Word-by-word timing is dropped for an edited line. */
  editCue: (index: number, text: string) => void
  /** Sets a line's start and end (ms). Word times that still fit are kept. */
  setCueTimes: (index: number, startMs: number, endMs: number) => void
  /** Moves a line's start and/or end by the given milliseconds, inside the video and at least 0.1 s long. */
  nudgeCue: (index: number, dStartMs: number, dEndMs: number) => void
  /** Replaces text in every line; returns how many replacements were made. Edited lines lose their word-by-word timing. */
  replaceAll: (find: string, replacement: string, opts?: FindOptions) => number
  /** Changes every line to UPPER, Title or lower case. */
  recase: (casing: Casing) => void
  /** Takes the captions out of the video and the project. */
  remove: () => void
}

/**
 * Free auto captions, drawn into the video. The video's own sound is turned into text on this device (Whisper) and
 * stored in the project's preview settings, so they appear in the live preview and in every export. A result belongs
 * to the video it was made for: if the person switches video meanwhile it is dropped, and captions made for another
 * video are never drawn over this one.
 */
export function useCaptions(videoUrl: string | null): Captions {
  const ctx = useDemoPersonalize()
  const { previewSettings, updatePreviewCaptions } = ctx
  const ai = useLocalAI('whisper')
  const [note, setNote] = useState<string | null>(null)
  const latestUrl = useRef(videoUrl)
  latestUrl.current = videoUrl
  useEffect(() => { setNote(null) }, [videoUrl])

  const stored = previewSettings.captions
  const captions = stored && videoUrl && stored.forUrl === videoUrl ? stored : null
  // Before any captions exist the choice is kept here; afterwards it lives in the captions themselves.
  const [pendingLanguage, setPendingLanguage] = useState('auto')
  const language = captions ? captions.language ?? 'auto' : pendingLanguage
  const setLanguage = useCallback((next: string) => {
    setPendingLanguage(next)
    if (captions) updatePreviewCaptions({ language: next === 'auto' ? undefined : next })
  }, [captions, updatePreviewCaptions])

  const generate = useCallback(async () => {
    if (!videoUrl) return
    const startedFor = videoUrl
    setNote(null)
    const chosen = language === 'auto' ? undefined : language
    const out = await ai.request((helpers) => transcribeVideo(startedFor, chosen ? { ...helpers, language: chosen } : helpers))
    if (!out || latestUrl.current !== startedFor) return
    const cues = groupCaptionCues(out.captions)
    if (!cues.length) { setNote('No speech was found in this video, so there is nothing to caption.'); return }
    const keep = previewSettings.captions
    updatePreviewCaptions({ enabled: true, forUrl: startedFor, style: keep?.style ?? 'bold', position: keep?.position ?? 'bottom', cues, language: chosen })
  }, [ai, videoUrl, language, previewSettings.captions, updatePreviewCaptions])

  const setEnabled = useCallback((enabled: boolean) => updatePreviewCaptions({ enabled }), [updatePreviewCaptions])
  const setStyle = useCallback((style: CaptionStyleId) => updatePreviewCaptions({ style }), [updatePreviewCaptions])
  const setCustom = useCallback((patch: Partial<PreviewCaptionCustom>) => {
    if (captions) updatePreviewCaptions({ custom: { ...captions.custom, ...patch } })
  }, [captions, updatePreviewCaptions])
  const setPosition = useCallback((position: CaptionPosition) => updatePreviewCaptions({ position, custom: captions?.custom ? { ...captions.custom, offsetY: undefined } : undefined }), [captions, updatePreviewCaptions])
  const editCue = useCallback((index: number, text: string) => {
    if (!captions) return
    const next: PreviewCaptionCue[] = captions.cues.map((c, i) => {
      if (i !== index) return c
      const same = text.replace(/\s+/g, ' ').trim() === c.text
      const { words, ...rest } = c
      return same && words ? { ...rest, words } : { ...rest, text }
    })
    updatePreviewCaptions({ cues: next })
  }, [captions, updatePreviewCaptions])
  const videoMs = Number.isFinite(previewSettings.durationInFrames) && previewSettings.fps > 0 ? (previewSettings.durationInFrames / previewSettings.fps) * 1000 : 3_600_000
  const setCueTimes = useCallback((index: number, startMs: number, endMs: number) => {
    if (!captions || !captions.cues[index]) return
    updatePreviewCaptions({ cues: captions.cues.map((c, i) => (i === index ? retimeCue(c, startMs, Math.min(endMs, videoMs)) : c)) })
  }, [captions, videoMs, updatePreviewCaptions])
  const nudge = useCallback((index: number, dStartMs: number, dEndMs: number) => {
    if (!captions || !captions.cues[index]) return
    updatePreviewCaptions({ cues: captions.cues.map((c, i) => (i === index ? nudgeCue(c, dStartMs, dEndMs, videoMs) : c)) })
  }, [captions, videoMs, updatePreviewCaptions])
  // Text changes drop a line's word times (they would no longer match the words); lines that did not change keep theirs.
  const withText = (changed: PreviewCaptionCue[], before: PreviewCaptionCue[]): PreviewCaptionCue[] =>
    changed.map((c, i) => (c.text === before[i].text ? c : (({ words: _w, ...rest }) => rest)(c)))
  const replaceAll = useCallback((find: string, replacement: string, opts?: FindOptions) => {
    if (!captions || !find) return 0
    const { items, count } = findReplace(captions.cues, find, replacement, opts)
    if (count > 0) updatePreviewCaptions({ cues: withText(items, captions.cues) })
    return count
  }, [captions, updatePreviewCaptions])
  const recase = useCallback((casing: Casing) => {
    if (!captions) return
    updatePreviewCaptions({ cues: withText(captions.cues.map((c) => ({ ...c, text: applyCasing(c.text, casing) })), captions.cues) })
  }, [captions, updatePreviewCaptions])
  const remove = useCallback(() => { updatePreviewCaptions(null); setNote(null) }, [updatePreviewCaptions])

  return { ai, captions, note, generate, language, setLanguage, setEnabled, setStyle, setPosition, setCustom, editCue, setCueTimes, nudgeCue: nudge, replaceAll, recase, remove }
}
