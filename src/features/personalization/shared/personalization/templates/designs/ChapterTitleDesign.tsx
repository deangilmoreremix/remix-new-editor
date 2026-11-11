/**
 * Adapter for the upstream `chapter-title` template.
 *
 * Upstream: `src/components/chapter-title/ChapterTitle.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream zooms a chapter label in, draws a divider and floats the title
 * and subtitle up from below.
 *
 * `background` is the canvas fill and is forced to `transparent`; the upstream
 * default is the opaque `#0d1117`.
 *
 * TWO UPSTREAM TRAITS THAT CANNOT BE SWITCHED (A6's contract addition C5):
 *  - a full-canvas grid is painted at `inset: 0` (two 3 %-white linear
 *    gradients), so the design is placed at `scale < 1` and the wash stays
 *    inside the box;
 *  - the subtitle colour is a hard-coded `rgba(255,255,255,0.6)` in the
 *    upstream's JSX — it is not a prop, and the upstream file is frozen, so the
 *    adapter cannot restyle it. It is low contrast over a light video. The
 *    caveat is declared in the catalog's `capabilities.notes`.
 *
 * The upstream's type sizes are all relative to the composition
 * (`height * 0.085` and friends) and it switches to a portrait scale when the
 * composition is taller than it is wide, so nothing has to be fitted.
 */

import React from 'react'
import { ChapterTitle } from '../_upstream/chapter-title/ChapterTitle'
import { useDesignFonts } from './fonts'
import {
  DesignStage,
  TRANSPARENT,
  pickColor,
  slotText,
  slotValue,
  truncateText,
  type DesignAdapterProps,
} from './shared'

/** The upstream's type is relative to the canvas, so the caps are generous. */
const MAX_LABEL_LENGTH = 24
const MAX_TITLE_LENGTH = 48
const MAX_SUBTITLE_LENGTH = 48

export const ChapterTitleDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()

  const chapterLabel = truncateText(slotValue(props, 'chapterLabel'), MAX_LABEL_LENGTH)
  const title = truncateText(
    slotText(props, 'title', ['headline', 'businessName']),
    MAX_TITLE_LENGTH,
  )
  const subtitle = truncateText(slotValue(props, 'subtitle'), MAX_SUBTITLE_LENGTH)

  return (
    <DesignStage designId="chapter-title" props={props}>
      <ChapterTitle
        chapterLabel={chapterLabel}
        title={title}
        subtitle={subtitle}
        background={TRANSPARENT}
        chapterColor={pickColor([props.colors?.accent, props.colors?.primary], '#d4af37')}
        titleColor={pickColor([props.color, props.colors?.text], '#ffffff')}
      />
    </DesignStage>
  )
}

export default ChapterTitleDesign
