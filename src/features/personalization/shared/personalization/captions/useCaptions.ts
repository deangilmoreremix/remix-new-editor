'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { transcribeVideo } from '../localAI/engine'
import { useLocalAI, type LocalAI } from '../localAI/useLocalAI'
import type { CaptionPosition, CaptionStyleId, PreviewCaptionCue, PreviewCaptions } from '../preview/types'
import { groupCaptionCues } from './captionCues'

export interface Captions {
  ai: LocalAI
  /** The captions in the project, when they were written for THIS video; otherwise null. */
  captions: PreviewCaptions | null
  /** Plain-words outcome when there is nothing to show ("No speech was found"). */
  note: string | null
  generate: () => Promise<void>
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
    updatePreviewCaptions({ enabled: true, forUrl: startedFor, style: keep?.style ?? 'bold', position: keep?.position ?? 'bottom', cues })
  }, [ai, videoUrl, previewSettings.captions, updatePreviewCaptions])

  const setEnabled = useCallback((enabled: boolean) => updatePreviewCaptions({ enabled }), [updatePreviewCaptions])
  const setStyle = useCallback((style: CaptionStyleId) => updatePreviewCaptions({ style }), [updatePreviewCaptions])
  const setPosition = useCallback((position: CaptionPosition) => updatePreviewCaptions({ position }), [updatePreviewCaptions])
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
  const remove = useCallback(() => { updatePreviewCaptions(null); setNote(null) }, [updatePreviewCaptions])

  return { ai, captions, note, generate, setEnabled, setStyle, setPosition, editCue, remove }
}
