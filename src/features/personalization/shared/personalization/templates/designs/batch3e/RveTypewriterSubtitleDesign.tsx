/**
 * Adapter for the upstream `rve-typewriter-subtitle` template.
 *
 * Upstream: `templates/typewriter-subtitle.tsx` (remotion-templates, MIT —
 * React Video Editor, no named copyright holder).
 *
 * The line types itself out character by character behind a blinking block
 * cursor. Every character is its own inline-block, so a line that is too
 * long would wrap in the middle of a word; the adapter keeps it on ONE line
 * by fitting the type size first (down to 60 % of the upstream size × zoom)
 * and truncating only past that.
 *
 * Brand mapping: headline (then offer) → the typed line, the layer colour →
 * the characters, the brand accent → the cursor (the upstream's light blue).
 * The typing time scales with the length (≈ 2.8 frames per character, the
 * upstream's 45 frames for 16 characters), clamped to 30-90 frames.
 */

import React from 'react'
import { TypewriterSubtitle } from '../../_upstream/rve-typewriter-subtitle/TypewriterSubtitle'
import { DESIGN_FONT_STACK } from '../fonts'
import { type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  brandAccent,
  brandText,
  fitFontPx,
  px,
  remUnit,
  slotText,
  truncateText,
} from './batch3eShared'

export const RVE_TYPEWRITER_SUBTITLE_ID = 'rve-typewriter-subtitle'

const ZOOM = 1.6

/** The hard character ceiling. */
export const TYPEWRITER_MAX_CHARS = 48

/** Frames per character the upstream types at (45 frames / 16 characters). */
const FRAMES_PER_CHAR = 45 / 16

export const RveTypewriterSubtitleDesign: React.FC<DesignAdapterProps> = (props) => {
  const rem = remUnit(props, ZOOM)
  const baseFont = 3 * rem
  // Full width minus the 2rem padding on each side and room for the cursor.
  const available = props.width - 4 * rem - baseFont
  const raw = slotText(props, 'headline', ['offer', 'businessName'])
  const glyph = 0.62
  const fontPx = fitFontPx(available, Math.min(raw.length, TYPEWRITER_MAX_CHARS), baseFont, glyph, 0.6)
  const maxChars = Math.max(
    4,
    Math.min(TYPEWRITER_MAX_CHARS, Math.floor(available / (fontPx * glyph))),
  )
  const copy = truncateText(raw, maxChars)
  const typingFrames = Math.max(30, Math.min(90, Math.round(copy.length * FRAMES_PER_CHAR)))

  return (
    <RveDesignStage designId={RVE_TYPEWRITER_SUBTITLE_ID} props={props}>
      <TypewriterSubtitle
        text={copy}
        color={brandText(props)}
        cursorColor={brandAccent(props)}
        fontSize={px(fontPx)}
        fontFamily={DESIGN_FONT_STACK}
        padding={px(2 * rem)}
        typingFrames={typingFrames}
      />
    </RveDesignStage>
  )
}

export default RveTypewriterSubtitleDesign
