/**
 * Adapter for the upstream `rve-letterbox-reveal` template (batch 3g).
 *
 * Upstream: `templates/letterbox-reveal.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-letterbox-reveal/LetterboxReveal.tsx`.
 *
 * Intro reveal: two deep brand-coloured bars start closed (50 % each, the
 * upstream start) and part over 2 s to uncover the customer's video. The
 * upstream stops them at a 12 % letterbox; here `barTo` is 0 so the bars
 * clear the frame completely before the layer ends (no hard cut of a
 * persistent letterbox). The business name fades in with the upstream
 * timing (0.5 s -> 1.5 s), in the upstream's wide tracking, and fades out
 * again before the layer ends.
 */

import React from 'react'
import { LetterboxReveal } from '../../_upstream/rve-letterbox-reveal/LetterboxReveal'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { BrandCardContent, brandPalette, fadeOut } from './batch3gShared'

const TITLE_OUT_START = 50
const TITLE_OUT_END = 70
/** Smaller than the other cards: the title is tracked out (0.12em). */
const TITLE_RATIO = 0.06

export const RveLetterboxRevealDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  return (
    <RveDesignStage designId="rve-letterbox-reveal" props={props}>
      <LetterboxReveal
        backgroundColor="transparent"
        barColor={palette.deep}
        barTo={0}
        content={
          <div
            data-rve-letterbox-title
            style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              opacity: fadeOut(props.frame, TITLE_OUT_START, TITLE_OUT_END),
            }}
          >
            <BrandCardContent
              props={props}
              showEmblem={false}
              titleRatio={TITLE_RATIO}
              letterSpacing="0.12em"
            />
          </div>
        }
      />
    </RveDesignStage>
  )
}

export default RveLetterboxRevealDesign
