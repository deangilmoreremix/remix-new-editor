'use client'

import { useCallback, useState } from 'react'
import { detectObjects, grabFramePixels } from '../localAI/engine'
import { useLocalAI, type LocalAI } from '../localAI/useLocalAI'
import { AUTO_SUBJECT_ZONE_ID, findSubjectZone, subjectSampleTimes, type SubjectOutcome } from '../preview/placement/subjectDetect'
import type { PersonalizationPreviewSettings, ProtectedZone } from '../preview/types'

const CUSTOMER_SUBJECT_ID = 'customer-subject'

export interface SubjectFinder {
  ai: LocalAI
  /** An automatic zone is currently set. */
  hasAuto: boolean
  /** The customer marked the subject by hand; the automatic finder never replaces that. */
  hasCustomerMark: boolean
  /** Outcome text for the last run ("Found a person…", "Nothing clear…"). */
  message: string | null
  find: () => Promise<void>
  clear: () => void
}

const NONE_TEXT: Record<'no-frames' | 'nothing-found' | 'outside-frame', string> = {
  'no-frames': 'This footage could not be read in your browser, so the subject could not be looked for. You can still mark where it is.',
  'nothing-found': 'No clear person, animal, vehicle or product was found. Mark where the subject is instead.',
  'outside-frame': 'The subject found sits outside the visible part of this frame shape. Mark where it is instead.',
}

/**
 * Automatic "where is the subject?" for the layout check: free object detection on this device, turned into the same
 * protected zone as marking it by hand. It only ever replaces its own earlier result, never a zone the customer set.
 */
export function useSubjectFinder(opts: {
  settings: PersonalizationPreviewSettings
  videoUrl: string | null
  isImageSource: boolean
  setZones: (zones: ProtectedZone[]) => void
}): SubjectFinder {
  const { settings, videoUrl, isImageSource, setZones } = opts
  const ai = useLocalAI('detr')
  const [message, setMessage] = useState<string | null>(null)
  const zones = settings.protectedZones ?? []
  const hasAuto = zones.some((z) => z.id === AUTO_SUBJECT_ZONE_ID)
  const hasCustomerMark = zones.some((z) => z.id === CUSTOMER_SUBJECT_ID)

  const find = useCallback(async () => {
    if (!videoUrl || hasCustomerMark) return
    setMessage(null)
    const seconds = settings.fps > 0 ? settings.durationInFrames / settings.fps : 0
    const outcome = await ai.request<SubjectOutcome>(({ signal, onProgress }) =>
      findSubjectZone({
        times: isImageSource ? [0] : subjectSampleTimes(seconds),
        comp: { width: settings.width, height: settings.height },
        signal,
        grab: (t) => grabFramePixels(videoUrl, t, { maxSize: 640, image: isImageSource, signal }),
        detect: (frame) => detectObjects(frame, { signal }),
        onProgress: (done, total) => onProgress({ progress: done / total, message: `Looking at frame ${done} of ${total}…` }),
      }),
    )
    if (!outcome) return
    if (!outcome.ok) { setMessage(NONE_TEXT[outcome.reason]); return }
    // Replace only the earlier automatic zone; everything else the customer set stays.
    setZones([...(settings.protectedZones ?? []).filter((z) => z.id !== AUTO_SUBJECT_ZONE_ID), outcome.zone])
    setMessage(`Found a ${outcome.label} (${Math.round(outcome.score * 100)}% sure, in ${outcome.framesUsed} of ${outcome.framesTotal} frames). Text and pictures will keep off it. Wrong? Clear it and mark the subject yourself.`)
  }, [ai, videoUrl, hasCustomerMark, isImageSource, settings.fps, settings.durationInFrames, settings.width, settings.height, settings.protectedZones, setZones])

  const clear = useCallback(() => {
    setZones((settings.protectedZones ?? []).filter((z) => z.id !== AUTO_SUBJECT_ZONE_ID))
    setMessage(null)
  }, [settings.protectedZones, setZones])

  return { ai, hasAuto, hasCustomerMark, message, find, clear }
}
