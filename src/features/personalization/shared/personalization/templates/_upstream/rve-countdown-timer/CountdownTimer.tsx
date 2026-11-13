/** Free Remotion Template Component
 * ---------------------------------
 * This template is free to use in your projects!
 * Credit appreciated but not required.
 *
 * Created by the team at https://www.reactvideoeditor.com
 *
 * Happy coding and building amazing videos! 🎉
 */

// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 upstream template, batch 3f (repo 2: remotion-templates)
// template id : rve-countdown-timer
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/countdown-timer.tsx
// license     : MIT License. The upstream repository ships NO LICENSE file and
//               names NO copyright holder; its README states "All templates in
//               this repository are available under the MIT License. You can
//               use them in personal and commercial projects, but attribution
//               is appreciated where applicable." The verbatim MIT permission
//               notice (WITHOUT a copyright line, because no holder is named)
//               ships with the design credit in
//               `templates/designs/rveSharedDesign.tsx` (RVE_LICENSE_NOTICE).
//
// DEVIATION RECORD (contract addition C8 of docs/phase2/handoffs/A6.md)
// ----------------------------------------------------------------------
// This file is EDITED. The upstream template has NO props surface, so every
// hard-coded string, colour and type size became an OPTIONAL prop whose
// default reproduces the upstream literal exactly. Rendering this component
// with no props reproduces the upstream design.
//
//   upstream line 15      export default function CountdownTimer() {
//                     ->  export const CountdownTimer: React.FC<CountdownTimerProps> = ({ ... }) => {
//   upstream line 20      const totalNumbers = 6; // 5, 4, 3, 2, 1, GO
//                     ->  const totalNumbers = labels.length;   (6 for the default labels)
//   upstream line 27      const numbers = ["5", "4", "3", "2", "1", "GO"];
//                     ->  prop `labels`             (same default); `numbers` is now `labels`
//   upstream line 50      backgroundColor: "#111827"                    -> prop `background`
//   upstream line 61      fontSize: isGo ? "8rem" : "10rem"             -> props `finalFontSize` / `fontSize`
//   upstream line 63      fontFamily: "Inter, sans-serif"               -> prop `fontFamily`
//   upstream line 64      color: "white"                                -> prop `color`
//   upstream line 66      "linear-gradient(135deg, #3b82f6, #7209b7)"   -> prop `finalGradient`
//
// ADDED (not present upstream): `import React from "react";`, the
// `CountdownTimerProps` type, `defaultCountdownTimerProps` (the upstream
// literals), the optional `textShadow` prop applied to the NUMBERS only
// (default `undefined`, i.e. no shadow, exactly as upstream — an overlay
// adapter sets one so white digits stay legible over bright video; it is
// never applied to the gradient-clipped final label, where a shadow would
// show through the transparent glyph fill) and a trailing
// `export default CountdownTimer;`.
//
// NOT TOUCHED: the timing (`Math.floor(fps * 0.8)` frames per label), the
// spring and opacity curves, the "last label stays fully opaque" rule and
// every layout rule. This template uses no SVG ids.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export type CountdownTimerProps = {
  /** The labels shown in turn; the last one stays. Upstream: ["5","4","3","2","1","GO"]. */
  labels?: string[];
  /** Canvas fill. Upstream literal: "#111827". */
  background?: string;
  /** Number colour. Upstream literal: "white". */
  color?: string;
  /** Number size. Upstream literal: "10rem". */
  fontSize?: string;
  /** Final-label size. Upstream literal: "8rem". */
  finalFontSize?: string;
  /** Final-label gradient (clipped to the glyphs). Upstream literal: "linear-gradient(135deg, #3b82f6, #7209b7)". */
  finalGradient?: string;
  /** Upstream literal: "Inter, sans-serif". */
  fontFamily?: string;
  /** ADDED. Text shadow on the numbers only. Default `undefined` (none, as upstream). */
  textShadow?: string;
};

export const defaultCountdownTimerProps = {
  labels: ["5", "4", "3", "2", "1", "GO"],
  background: "#111827",
  color: "white",
  fontSize: "10rem",
  finalFontSize: "8rem",
  finalGradient: "linear-gradient(135deg, #3b82f6, #7209b7)",
  fontFamily: "Inter, sans-serif",
};

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  labels = defaultCountdownTimerProps.labels,
  background = defaultCountdownTimerProps.background,
  color = defaultCountdownTimerProps.color,
  fontSize = defaultCountdownTimerProps.fontSize,
  finalFontSize = defaultCountdownTimerProps.finalFontSize,
  finalGradient = defaultCountdownTimerProps.finalGradient,
  fontFamily = defaultCountdownTimerProps.fontFamily,
  textShadow,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerNumber = Math.floor(fps * 0.8);
  const totalNumbers = labels.length; // 5, 4, 3, 2, 1, GO
  const currentIndex = Math.min(
    Math.floor(frame / framesPerNumber),
    totalNumbers - 1
  );
  const frameInSegment = frame - currentIndex * framesPerNumber;

  const currentLabel = labels[currentIndex];

  const scale = spring({
    frame: frameInSegment,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.5 },
  });

  const opacity = interpolate(
    frameInSegment,
    [0, 5, framesPerNumber - 8, framesPerNumber],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" }
  );

  const isGo = currentIndex === totalNumbers - 1;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: background,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity: isGo ? 1 : opacity,
          fontSize: isGo ? finalFontSize : fontSize,
          fontWeight: "bold",
          fontFamily,
          color,
          background: isGo
            ? finalGradient
            : "none",
          WebkitBackgroundClip: isGo ? "text" : undefined,
          WebkitTextFillColor: isGo ? "transparent" : undefined,
          textShadow: isGo ? undefined : textShadow,
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        {currentLabel}
      </div>
    </div>
  );
};

export default CountdownTimer;
