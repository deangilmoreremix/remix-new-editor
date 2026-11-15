'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { transcribeVideo } from '../localAI/engine'
import { useLocalAI, type LocalAI } from '../localAI/useLocalAI'
import { groupCaptionCues, type CaptionCue } from './captionCues'

export interface Captions {
  ai: LocalAI
  /** Caption lines for the video the panel is showing, or null before a run. */
  cues: CaptionCue[] | null
  /** Plain-words outcome when there is nothing to show ("No speech was found"). */
  note: string | null
  generate: () => Promise<void>
  clear: () => void
}

/**
 * Free auto captions: the video's own sound is turned into text on this device (Whisper). A result belongs to the
 * video it was made for; if the person switches video meanwhile it is dropped instead of shown against the wrong clip.
 */
export function useCaptions(videoUrl: string | null): Captions {
  const ai = useLocalAI('whisper')
  const [cues, setCues] = useState<CaptionCue[] | null>(null)
  const [forUrl, setForUrl] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const latestUrl = useRef(videoUrl)
  latestUrl.current = videoUrl

  // A different video makes the old captions meaningless.
  useEffect(() => { setCues(null); setForUrl(null); setNote(null) }, [videoUrl])

  const generate = useCallback(async () => {
    if (!videoUrl) return
    const startedFor = videoUrl
    setNote(null)
    const out = await ai.request((helpers) => transcribeVideo(startedFor, helpers))
    if (!out || latestUrl.current !== startedFor) return
    const next = groupCaptionCues(out.captions)
    if (!next.length) { setCues(null); setForUrl(null); setNote('No speech was found in this video, so there is nothing to caption.'); return }
    setCues(next); setForUrl(startedFor)
  }, [ai, videoUrl])

  const clear = useCallback(() => { setCues(null); setForUrl(null); setNote(null) }, [])
  return { ai, cues: forUrl === videoUrl ? cues : null, note, generate, clear }
}
