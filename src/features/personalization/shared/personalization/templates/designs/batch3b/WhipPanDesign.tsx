/**
 * Adapter for the upstream `whip-pan` template.
 *
 * Upstream: `src/components/whip-pan/WhipPan.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * A fast horizontal pan with motion blur between full-frame title scenes. The
 * segment timing is a fraction of `useVideoConfig().durationInFrames`, so the
 * adapter pins it with a `<Timebox>` of 90 frames.
 *
 * NOT A TWO-CLIP TRANSITION: the upstream pans between its OWN scenes and
 * paints a hard-coded black root behind them, so it cannot pan onto the
 * customer's video. It is adapted as a whipping branded title intro: scene 1
 * (brand primary) shows the business name and headline, a blurred whip pan
 * (frames 27-45) lands on scene 2 (a deep shade of the accent) with the offer
 * and call to action, which holds and then dissolves into the video (frames
 * 76-90, layer ends at 90).
 *
 * Titles use the upstream's fixed 132 px (92 px below 1920 px wide) and wrap;
 * they are fitted to two lines, subtitles to one line.
 */

import React from 'react'
import { WhipPan } from '../../_upstream/whip-pan/WhipPan'
import { DesignStage, pickColor, slotText, slotValue, type DesignAdapterProps } from '../shared'
import { FadeOut, Timebox, charsPerLine, ensureDark, fitWords, hex6, mix } from './shared'

export const WHIP_PAN_DURATION = 90
export const WHIP_PAN_FADE_START = 76

export const WhipPanDesign: React.FC<DesignAdapterProps> = (props) => {
  const wide = props.width >= 1920
  const titlePerLine = charsPerLine(props.width - 160, wide ? 132 : 92, { safe: 0.95, advanceEm: 0.66, letterSpacing: 4 })
  const subPerLine = charsPerLine(props.width - 160, wide ? 40 : 32, { safe: 0.95, letterSpacing: 2 })
  const textColor = pickColor([props.color, props.colors?.text], '#ffffff')

  const name = slotText(props, 'businessName', ['headline'])
  const headline = slotValue(props, 'headline')
  const offer = slotValue(props, 'offer') || headline || name
  const cta = slotValue(props, 'cta')

  const accent = hex6(pickColor([props.colors?.accent, props.colors?.primary]), '#7c3aed')

  return (
    <DesignStage designId="whip-pan" props={props}>
      <FadeOut from={WHIP_PAN_FADE_START} to={WHIP_PAN_DURATION}>
        <Timebox durationInFrames={WHIP_PAN_DURATION}>
          <WhipPan
            scenes={[
              {
                background: pickColor([props.colors?.primary], '#0f172a'),
                title: fitWords(name, titlePerLine, 2),
                subtitle: fitWords(headline, subPerLine, 1) || undefined,
                textColor,
              },
              {
                background: ensureDark(mix(accent, '#000000', 0.45), 0.12),
                title: fitWords(offer, titlePerLine, 2),
                subtitle: fitWords(cta, subPerLine, 1) || undefined,
                textColor,
              },
            ]}
            panLeft
            maxBlur={24}
          />
        </Timebox>
      </FadeOut>
    </DesignStage>
  )
}

export default WhipPanDesign
