'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { transcribeVideo } from '../localAI/engine'
import { useLocalAI, type LocalAI } from '../localAI/useLocalAI'
import type { CaptionPosition, CaptionStyleId, PreviewCaptionCue, PreviewCaptions } from '../preview/types'
import { groupCaptionCues } from './captionCues'
import { getCaptionStudio, type CaptionStudioWord } from './captionStudioBridge'
import { BUNDLED_CAPTION_FONTS, cleanStudioCaptions, isBundledCaptionFont, studioFallbackStyle, studioToCues } from './studioCaptions'

export interface Captions {
  ai: LocalAI
  /** The captions in the project, when they were written for THIS video; otherwise null. */
  captions: PreviewCaptions | null
  /** Plain-words outcome when there is nothing to show ("No speech was found"). */
  note: string | null
  generate: () => Promise<void>
  /** True when the host app provides the Caption Studio: captions are then made and edited there, in one window. */
  studioAvailable: boolean
  /** Opens the Caption Studio on this video (existing captions are carried in). */
  openStudio: () => void
  setEnabled: (enabled: boolean) => void
  setStyle: (style: CaptionStyleId) => void
  setPosition: (position: CaptionPosition) => void
  /** Replaces a line's text. Clearing it deletes the line. Word-by-word timing is dropped for an edited line. */
  editCue: (index: number, text: string) => void
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

  const generate = useCallback(async () => {
    if (!videoUrl) return
    const startedFor = videoUrl
    setNote(null)
    const out = await ai.request((helpers) => transcribeVideo(startedFor, helpers))
    if (!out || latestUrl.current !== startedFor) return
    const cues = groupCaptionCues(out.captions)
    if (!cues.length) { setNote('No speech was found in this video, so there is nothing to caption.'); return }
    const keep = previewSettings.captions
    updatePreviewCaptions({ enabled: true, forUrl: startedFor, style: keep?.style ?? 'bold', position: keep?.position ?? 'bottom', cues, studio: undefined })
  }, [ai, videoUrl, previewSettings.captions, updatePreviewCaptions])

  const setEnabled = useCallback((enabled: boolean) => updatePreviewCaptions({ enabled }), [updatePreviewCaptions])
  const setStyle = useCallback((style: CaptionStyleId) => updatePreviewCaptions({ style, studio: undefined }), [updatePreviewCaptions])
  const setPosition = useCallback((position: CaptionPosition) => updatePreviewCaptions({ position, studio: undefined }), [updatePreviewCaptions])
  const editCue = useCallback((index: number, text: string) => {
    if (!captions) return
    const next: PreviewCaptionCue[] = captions.cues.map((c, i) => {
      if (i !== index) return c
      const same = text.replace(/\s+/g, ' ').trim() === c.text
      const { words, ...rest } = c
      return same && words ? { ...rest, words } : { ...rest, text }
    })
    updatePreviewCaptions({ cues: next, studio: undefined })
  }, [captions, updatePreviewCaptions])
  const remove = useCallback(() => { updatePreviewCaptions(null); setNote(null) }, [updatePreviewCaptions])

  const studioAvailable = !!getCaptionStudio()
  const openStudio = useCallback(() => {
    const open = getCaptionStudio()
    if (!open || !videoUrl) return
    const openedFor = videoUrl
    // Carry the current captions in, word by word, from the Studio data when there is any and otherwise from the saved cues.
    const words: CaptionStudioWord[] = captions?.studio
      ? captions.studio.pages.flatMap((p) => p.tokens.map((t) => ({ text: t.text.trim(), startMs: t.fromMs, endMs: t.toMs })))
      : (captions?.cues ?? []).flatMap((cue) => cue.words?.length ? cue.words.map((w) => ({ text: w.text, startMs: w.startMs, endMs: w.endMs })) : [{ text: cue.text, startMs: cue.startMs, endMs: cue.endMs }])
    open({
      videoUrl, words, style: captions?.studio?.style, fonts: BUNDLED_CAPTION_FONTS,
      onApply: (raw) => {
        if (latestUrl.current !== openedFor) { setNote('The video changed while you were captioning, so those captions were not added.'); return }
        const studio = cleanStudioCaptions(raw)
        if (!studio) { setNote('No captions were made, so there is nothing to show.'); return }
        updatePreviewCaptions({ enabled: true, forUrl: openedFor, style: studioFallbackStyle(studio.style), position: studio.style.position, cues: studioToCues(studio), studio })
        setNote(isBundledCaptionFont(studio.style.fontFamily) ? null : `“${studio.style.fontFamily}” is not built into this app, so these captions use the studio font. Pick one of the built-in fonts in the Caption Studio to keep that exact look.`)
      },
      onError: (err) => setNote(err.message),
    })
  }, [videoUrl, captions, updatePreviewCaptions])

  return { ai, captions, note, generate, studioAvailable, openStudio, setEnabled, setStyle, setPosition, editCue, remove }
}
