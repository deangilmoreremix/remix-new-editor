// ---------------------------------------------------------------------------
// OPENHIGGSBOLT — Phase 4 upstream template, batch 3e (repo 2: remotion-templates)
// template id : rve-title-split
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/title-split.tsx
// credit      : The upstream file carries NO in-file credit header (it starts
//               at `"use client";`). The repository's credit applies: "Free
//               Remotion Template Component — Credit appreciated but not
//               required. Created by the team at https://www.reactvideoeditor.com"
//               (RVE_UPSTREAM_CREDIT in `templates/designs/rveSharedDesign.tsx`).
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
// This file is EDITED. Every hard-coded string, colour and dimension became
// an OPTIONAL prop whose default reproduces the upstream literal exactly.
// Rendering this component with no props reproduces the upstream design.
//
//   upstream line 5   export default function TitleSplit() {
//                 ->  export const TitleSplit: React.FC<TitleSplitProps> = ({ ... }) => {
//   upstream line 13  from: -120,                        -> from: -travel    (default 120)
//   upstream line 21  from: 120,                         -> from: travel
//   upstream line 41  backgroundColor: "#111827",        -> backgroundColor  (default "#111827")
//   upstream line 47  gap: "0.25rem",                    -> gap              (default "0.25rem")
//   upstream lines 53/70  fontSize: "5rem",              -> fontSize         (default "5rem")
//   upstream line 57  WebkitTextStroke: "2px white",     -> `${strokeWidth} ${strokeColor}`
//                     (defaults "2px" / "white")
//   upstream lines 59/75  fontFamily: "Inter, sans-serif", -> fontFamily
//   upstream lines 61/77  rgba(59, 130, 246, ${glowOpacity})
//                 ->  rgba(${glowRgb}, ${glowOpacity})   (default "59, 130, 246")
//   upstream line 65  CREATIVE                           -> {topText}
//   upstream line 69  color: "white",                    -> bottomColor      (default "white")
//   upstream line 81  STUDIO                             -> {bottomText}
//
// ADDED (not present upstream): `import React from "react";`, the props type,
// the `defaultTitleSplitProps` object and a trailing default export.
//
// NOT TOUCHED: the two springs (damping 14, stiffness 80), the sine glow
// (lines 25-29), the `meetProgress` gate (31-34), the weights, the letter
// spacing and the transparent fill of the outlined line.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export type TitleSplitProps = {
  /** Upstream literal: "CREATIVE". */
  topText?: string;
  /** Upstream literal: "STUDIO". */
  bottomText?: string;
  /** Upstream literal: "#111827". */
  backgroundColor?: string;
  /** Upstream literal: "white". */
  strokeColor?: string;
  /** Upstream literal: "2px". */
  strokeWidth?: string;
  /** Upstream literal: "white". */
  bottomColor?: string;
  /** Upstream literal: "59, 130, 246" (the glow's r, g, b). */
  glowRgb?: string;
  /** Upstream literal: "5rem". */
  fontSize?: string;
  /** Upstream literal: "0.25rem". */
  gap?: string;
  /** Upstream literal: 120 (px each line travels). */
  travel?: number;
  /** Upstream literal: "Inter, sans-serif". */
  fontFamily?: string;
};

export const defaultTitleSplitProps: Required<TitleSplitProps> = {
  topText: "CREATIVE",
  bottomText: "STUDIO",
  backgroundColor: "#111827",
  strokeColor: "white",
  strokeWidth: "2px",
  bottomColor: "white",
  glowRgb: "59, 130, 246",
  fontSize: "5rem",
  gap: "0.25rem",
  travel: 120,
  fontFamily: "Inter, sans-serif",
};

export const TitleSplit: React.FC<TitleSplitProps> = ({
  topText = defaultTitleSplitProps.topText,
  bottomText = defaultTitleSplitProps.bottomText,
  backgroundColor = defaultTitleSplitProps.backgroundColor,
  strokeColor = defaultTitleSplitProps.strokeColor,
  strokeWidth = defaultTitleSplitProps.strokeWidth,
  bottomColor = defaultTitleSplitProps.bottomColor,
  glowRgb = defaultTitleSplitProps.glowRgb,
  fontSize = defaultTitleSplitProps.fontSize,
  gap = defaultTitleSplitProps.gap,
  travel = defaultTitleSplitProps.travel,
  fontFamily = defaultTitleSplitProps.fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const topY = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80 },
    from: -travel,
    to: 0,
  });

  const bottomY = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80 },
    from: travel,
    to: 0,
  });

  const glowOpacity = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [0.3, 0.8],
  );

  const meetProgress = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        gap,
      }}
    >
      <h1
        style={{
          color: "transparent",
          fontSize,
          fontWeight: 800,
          margin: 0,
          letterSpacing: "0.15em",
          WebkitTextStroke: `${strokeWidth} ${strokeColor}`,
          transform: `translateY(${topY}px)`,
          fontFamily,
          textShadow: meetProgress === 1
            ? `0 0 ${20 * glowOpacity}px rgba(${glowRgb}, ${glowOpacity})`
            : "none",
        }}
      >
        {topText}
      </h1>
      <h1
        style={{
          color: bottomColor,
          fontSize,
          fontWeight: 800,
          margin: 0,
          letterSpacing: "0.15em",
          transform: `translateY(${bottomY}px)`,
          fontFamily,
          textShadow: meetProgress === 1
            ? `0 0 ${20 * glowOpacity}px rgba(${glowRgb}, ${glowOpacity})`
            : "none",
        }}
      >
        {bottomText}
      </h1>
    </div>
  );
};

export default TitleSplit;
