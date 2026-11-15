/**
 * Free Remotion Template Component
 * ---------------------------------
 * This template is free to use in your projects!
 * Credit appreciated but not required.
 *
 * Created by the team at https://www.reactvideoeditor.com
 *
 * Happy coding and building amazing videos! 🎉
 */

// ---------------------------------------------------------------------------
// OPENHIGGSBOLT — Phase 4 upstream template, batch 3e (repo 2: remotion-templates)
// template id : rve-cinematic-title-intro
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/cinematic-title-intro.tsx
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
//   upstream line 21  export default function CinematicTitleIntro() {
//                 ->  export const CinematicTitleIntro: React.FC<CinematicTitleIntroProps> = ({ ... }) => {
//   upstream line 63  background: "linear-gradient(135deg, #111827 0%, #1a1a2e 100%)",
//                 ->  background                         (default identical)
//   upstream line 72  color: "white",                    -> titleColor       (default "white")
//   upstream line 73  fontSize: "4rem",                  -> titleFontSize    (default "4rem")
//   upstream line 81  Your Story Begins                  -> {title}
//   upstream line 86  maxWidth: 320,                     -> underlineMaxWidth (default 320)
//   upstream line 87  height: 4,                         -> underlineHeight  (default 4)
//   upstream line 88  background: "linear-gradient(90deg, #4361ee, #7209b7)",
//                 ->  `linear-gradient(90deg, ${underlineFrom}, ${underlineTo})`
//                     (defaults "#4361ee" / "#7209b7")
//   upstream line 90  marginTop: 16,                     -> underlineGap     (default 16)
//   upstream line 95  color: "rgba(255, 255, 255, 0.8)", -> subtitleColor    (default identical)
//   upstream line 96  fontSize: "1.5rem",                -> subtitleFontSize (default "1.5rem")
//   upstream line 99  marginTop: 24,                     -> subtitleGap      (default 24)
//   upstream line 103 A Cinematic Experience             -> {subtitle}
//
// ADDED (not present upstream): `import React from "react";`, the props type,
// the `defaultCinematicTitleIntroProps` object and a trailing default export.
//
// NOT TOUCHED: the two springs (lines 25-43), the two interpolations
// (45-53), the weights, the letter spacings and the layout.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type CinematicTitleIntroProps = {
  /** Upstream literal: "Your Story Begins". */
  title?: string;
  /** Upstream literal: "A Cinematic Experience". */
  subtitle?: string;
  /** Upstream literal: "linear-gradient(135deg, #111827 0%, #1a1a2e 100%)". */
  background?: string;
  /** Upstream literal: "white". */
  titleColor?: string;
  /** Upstream literal: "rgba(255, 255, 255, 0.8)". */
  subtitleColor?: string;
  /** Upstream literal: "#4361ee". */
  underlineFrom?: string;
  /** Upstream literal: "#7209b7". */
  underlineTo?: string;
  /** Upstream literal: "4rem". */
  titleFontSize?: string;
  /** Upstream literal: "1.5rem". */
  subtitleFontSize?: string;
  /** Upstream literal: 320. */
  underlineMaxWidth?: number;
  /** Upstream literal: 4. */
  underlineHeight?: number;
  /** Upstream literal: 16. */
  underlineGap?: number;
  /** Upstream literal: 24. */
  subtitleGap?: number;
};

export const defaultCinematicTitleIntroProps: Required<CinematicTitleIntroProps> = {
  title: "Your Story Begins",
  subtitle: "A Cinematic Experience",
  background: "linear-gradient(135deg, #111827 0%, #1a1a2e 100%)",
  titleColor: "white",
  subtitleColor: "rgba(255, 255, 255, 0.8)",
  underlineFrom: "#4361ee",
  underlineTo: "#7209b7",
  titleFontSize: "4rem",
  subtitleFontSize: "1.5rem",
  underlineMaxWidth: 320,
  underlineHeight: 4,
  underlineGap: 16,
  subtitleGap: 24,
};

export const CinematicTitleIntro: React.FC<CinematicTitleIntroProps> = ({
  title = defaultCinematicTitleIntroProps.title,
  subtitle = defaultCinematicTitleIntroProps.subtitle,
  background = defaultCinematicTitleIntroProps.background,
  titleColor = defaultCinematicTitleIntroProps.titleColor,
  subtitleColor = defaultCinematicTitleIntroProps.subtitleColor,
  underlineFrom = defaultCinematicTitleIntroProps.underlineFrom,
  underlineTo = defaultCinematicTitleIntroProps.underlineTo,
  titleFontSize = defaultCinematicTitleIntroProps.titleFontSize,
  subtitleFontSize = defaultCinematicTitleIntroProps.subtitleFontSize,
  underlineMaxWidth = defaultCinematicTitleIntroProps.underlineMaxWidth,
  underlineHeight = defaultCinematicTitleIntroProps.underlineHeight,
  underlineGap = defaultCinematicTitleIntroProps.underlineGap,
  subtitleGap = defaultCinematicTitleIntroProps.subtitleGap,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleY = spring({
    frame,
    fps,
    from: 50,
    to: 0,
    durationInFrames: 40,
    config: {
      damping: 14,
      mass: 0.8,
    },
  });

  const titleOpacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 30,
  });

  const underlineWidth = interpolate(frame, [20, 50], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h1
        style={{
          color: titleColor,
          fontSize: titleFontSize,
          fontWeight: "bold",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          margin: 0,
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </h1>
      <div
        style={{
          width: `${underlineWidth}%`,
          maxWidth: underlineMaxWidth,
          height: underlineHeight,
          background: `linear-gradient(90deg, ${underlineFrom}, ${underlineTo})`,
          borderRadius: 2,
          marginTop: underlineGap,
        }}
      />
      <p
        style={{
          color: subtitleColor,
          fontSize: subtitleFontSize,
          fontWeight: 300,
          opacity: subtitleOpacity,
          marginTop: subtitleGap,
          letterSpacing: "0.1em",
        }}
      >
        {subtitle}
      </p>
    </div>
  );
};

export default CinematicTitleIntro;
