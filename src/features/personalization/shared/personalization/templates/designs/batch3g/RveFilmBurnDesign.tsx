/**
 * Adapter for the upstream `rve-film-burn` template (batch 3g).
 *
 * Upstream: `templates/film-burn.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-film-burn/FilmBurn.tsx`.
 *
 * Intro reveal: the upstream is a 3 s light-leak flash (intensity 0 -> 0.85
 * -> 0) over static content. Used as a transition, the brand card sits under
 * the flash and is cut away behind its peak (frames 38..52 of 90), so when
 * the leak fades the customer's video is left. The three leaks are tinted
 * with the brand primary and accent; the third keeps the upstream white core.
 */

import React from 'react'
import { FilmBurn } from '../../_upstream/rve-film-burn/FilmBurn'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { BrandCardContent, brandPalette, fadeOut, rgbTriplet } from './batch3gShared'

/** The card is cut behind the burn's peak (the peak is frame 45 at 30 fps). */
const CUT_START = 38
const CUT_END = 52

export const RveFilmBurnDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  const cardOpacity = fadeOut(props.frame, CUT_START, CUT_END)
  return (
    <RveDesignStage designId="rve-film-burn" props={props}>
      <FilmBurn
        backgroundColor="transparent"
        burnColor1={rgbTriplet(palette.primary, '249, 115, 22')}
        burnColor2={rgbTriplet(palette.accent, '251, 191, 36')}
        content={
          <div
            data-rve-film-burn-card
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: palette.cardBackground,
              opacity: cardOpacity,
            }}
          >
            <BrandCardContent props={props} />
          </div>
        }
      />
    </RveDesignStage>
  )
}

export default RveFilmBurnDesign
