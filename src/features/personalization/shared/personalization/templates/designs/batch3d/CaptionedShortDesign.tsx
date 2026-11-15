/**
 * Adapter for the upstream `CaptionedShort` template (repo 3).
 *
 * Upstream: `src/templates/CaptionedShort/CaptionedShort.tsx`
 * (remotion-video-templates, MIT — © 2026 Alejandro Brito).
 *
 * The upstream is a TikTok/Reels-style caption track: word-timed captions in
 * groups of three with the spoken word popped and highlighted, an uppercase
 * title chip near the top and a progress bar above the bottom safe area.
 *
 * CAPTIONS FROM BRAND COPY: the upstream reads word timings from a Whisper
 * transcript (its demo seeds them from `public/captions.sample.json`, which
 * is not shipped — deviation D3 of the copy). The customer has no transcript
 * here, so the adapter builds the timed words from the brand copy instead:
 * the headline, then the offer, then the call to action are split into
 * words and timed like natural speech (`britoBrandCaptions`) — each word
 * 300-700 ms depending on its length, 40 ms apart, with a short pause
 * between sentences, starting at 200 ms like the upstream sample. The title
 * chip shows the business name.
 *
 * OVERLAY: captions belong over the customer's video, so the canvas must be
 * transparent. The upstream paints its root with a gradient derived from
 * `backgroundColor` (via `mix(...)`, so no value of the prop yields a
 * transparent fill); the adapter overrides that one root fill with a scoped
 * stylesheet rule (`background: transparent !important`). The captions keep
 * their own drop shadow, which keeps them legible over footage.
 *
 * FORMAT: natively 9:16, but every upstream position is a fraction of the
 * canvas (safe areas, progress bar) and the 118 px words wrap inside the
 * safe area, so it also works in 16:9, 1:1 and 4:5. Words are truncated to
 * what fits the safe-area width.
 *
 * FIXED DURATION: the upstream derives the length from the last caption's
 * end time + 20 frames; with at most `BRITO_CAPTION_MAX_WORDS` words the
 * caption track always ends within `BRITO_CAPTIONED_SHORT_FRAMES` (300).
 */

import React from 'react'
import {
  CaptionedShort,
  type CaptionWord,
} from '../../_upstream/brito-captioned-short/CaptionedShort'
import {
  TRANSPARENT,
  pickColor,
  slotText,
  slotValue,
  truncateText,
  type DesignAdapterProps,
} from '../shared'
import { BritoDesignStage, britoFitChars, britoRootBackgroundCss } from './britoShared'

export const BRITO_CAPTIONED_SHORT_ID = 'brito-captioned-short'

/** At most this many caption words are built from the brand copy. */
export const BRITO_CAPTION_MAX_WORDS = 16

/** The design's fixed length (the 16-word track ends well before it). */
export const BRITO_CAPTIONED_SHORT_FRAMES = 300

const FIRST_WORD_MS = 200
const WORD_GAP_MS = 40
const SENTENCE_PAUSE_MS = 140

/**
 * Turns brand sentences into word-timed captions in the upstream's
 * `{ word, startMs, endMs }` shape.
 */
export function britoBrandCaptions(
  sentences: string[],
  maxWordChars: number,
  maxWords = BRITO_CAPTION_MAX_WORDS,
): CaptionWord[] {
  const captions: CaptionWord[] = []
  let cursor = FIRST_WORD_MS
  for (const sentence of sentences) {
    const words = (sentence || '').trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) continue
    if (captions.length > 0) cursor += SENTENCE_PAUSE_MS
    for (const raw of words) {
      if (captions.length >= maxWords) return captions
      const word = truncateText(raw, maxWordChars)
      const duration = Math.max(300, Math.min(700, 240 + 45 * word.length))
      captions.push({ word, startMs: cursor, endMs: cursor + duration })
      cursor += duration + WORD_GAP_MS
    }
  }
  return captions
}

export const BritoCaptionedShortDesign: React.FC<DesignAdapterProps> = (props) => {
  // SHORT_SAFE_AREA.horizontal is 6 % each side.
  const safeWidth = props.width * 0.88
  const maxWordChars = britoFitChars(safeWidth, 118, 16, 0.64)
  const sentences = [
    slotText(props, 'headline'),
    slotValue(props, 'offer'),
    slotValue(props, 'cta'),
  ]
  let captions = britoBrandCaptions(sentences, maxWordChars)
  if (captions.length === 0) {
    captions = britoBrandCaptions([slotValue(props, 'businessName')], maxWordChars)
  }

  const title = truncateText(slotValue(props, 'title'), britoFitChars(props.width * 0.9, 40, 44, 0.7))

  return (
    <BritoDesignStage
      designId={BRITO_CAPTIONED_SHORT_ID}
      props={props}
      overlay
      css={britoRootBackgroundCss(BRITO_CAPTIONED_SHORT_ID, TRANSPARENT)}
    >
      <CaptionedShort
        captions={captions}
        title={title}
        accentColor={pickColor([props.colors?.accent, props.colors?.primary], '#FACC15')}
        backgroundColor={TRANSPARENT}
        mode="group"
        wordsPerGroup={3}
      />
    </BritoDesignStage>
  )
}

export default BritoCaptionedShortDesign
