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
// template id : rve-bounce-text
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/bounce-text.tsx
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
// hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal exactly. Rendering this component
// with no props reproduces the upstream design verbatim.
//
//   upstream line 16   export default function BounceText() {
//                  ->  export const BounceText: React.FC<BounceTextProps> = ({ ... }) => {
//   upstream line 73   width: "80%",                      -> width            (default "80%")
//   upstream line 74   padding: "2rem 3rem",              -> padding          (default "2rem 3rem")
//   upstream line 75   background: "linear-gradient(45deg, #1e3a8a, #3b82f6)"
//                  ->  background: `linear-gradient(45deg, ${gradientFrom}, ${gradientTo})`
//                      (defaults "#1e3a8a" / "#3b82f6")
//   upstream line 76   borderRadius: "20px",              -> borderRadius     (default "20px")
//   upstream line 87   fontSize: "3.5rem",                -> titleFontSize    (default "3.5rem")
//   upstream line 89   color: "white",                    -> titleColor       (default "white")
//   upstream line 92   fontFamily: "Inter, sans-serif",   -> fontFamily       (default "Inter, sans-serif")
//   upstream line 96   Start Building                     -> {title}
//   upstream line 100  fontSize: "1.8rem",                -> subtitleFontSize (default "1.8rem")
//   upstream line 101  color: "white",                    -> subtitleColor    (default "white")
//   upstream line 103  marginTop: "0.75rem",              -> subtitleGap      (default "0.75rem")
//   upstream line 106  fontFamily: "Inter, sans-serif",   -> fontFamily
//   upstream line 110  Theres never been a better time    -> {subtitle}
//
// ADDED (not present upstream): `import React from "react";`, the
// `BounceTextProps` type, the `defaultBounceTextProps` object (the upstream
// literals) and a trailing `export default BounceText;`.
//
// NOT TOUCHED: the four springs (upstream lines 20-64), the transforms, the
// weights, the line height and both text shadows.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export type BounceTextProps = {
  /** Upstream literal: "Start Building". */
  title?: string;
  /** Upstream literal: "Theres never been a better time". */
  subtitle?: string;
  /** Upstream literal: "#1e3a8a". */
  gradientFrom?: string;
  /** Upstream literal: "#3b82f6". */
  gradientTo?: string;
  /** Upstream literal: "white". */
  titleColor?: string;
  /** Upstream literal: "white". */
  subtitleColor?: string;
  /** Upstream literal: "3.5rem". */
  titleFontSize?: string;
  /** Upstream literal: "1.8rem". */
  subtitleFontSize?: string;
  /** Upstream literal: "0.75rem". */
  subtitleGap?: string;
  /** Upstream literal: "80%". */
  width?: string;
  /** Upstream literal: "2rem 3rem". */
  padding?: string;
  /** Upstream literal: "20px". */
  borderRadius?: string;
  /** Upstream literal: "Inter, sans-serif". */
  fontFamily?: string;
};

export const defaultBounceTextProps: Required<BounceTextProps> = {
  title: "Start Building",
  subtitle: "Theres never been a better time",
  gradientFrom: "#1e3a8a",
  gradientTo: "#3b82f6",
  titleColor: "white",
  subtitleColor: "white",
  titleFontSize: "3.5rem",
  subtitleFontSize: "1.8rem",
  subtitleGap: "0.75rem",
  width: "80%",
  padding: "2rem 3rem",
  borderRadius: "20px",
  fontFamily: "Inter, sans-serif",
};

export const BounceText: React.FC<BounceTextProps> = ({
  title = defaultBounceTextProps.title,
  subtitle = defaultBounceTextProps.subtitle,
  gradientFrom = defaultBounceTextProps.gradientFrom,
  gradientTo = defaultBounceTextProps.gradientTo,
  titleColor = defaultBounceTextProps.titleColor,
  subtitleColor = defaultBounceTextProps.subtitleColor,
  titleFontSize = defaultBounceTextProps.titleFontSize,
  subtitleFontSize = defaultBounceTextProps.subtitleFontSize,
  subtitleGap = defaultBounceTextProps.subtitleGap,
  width = defaultBounceTextProps.width,
  padding = defaultBounceTextProps.padding,
  borderRadius = defaultBounceTextProps.borderRadius,
  fontFamily = defaultBounceTextProps.fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({
    frame,
    fps,
    from: -100,
    to: 0,
    config: {
      damping: 100,
      mass: 1,
      stiffness: 200,
    },
  });

  const fadeIn = spring({
    frame: frame - 15, // Slight delay for subtitle
    fps,
    from: 0,
    to: 1,
    config: {
      damping: 100,
      mass: 1,
    },
  });

  const scaleIn = spring({
    frame,
    fps,
    from: 0.5,
    to: 0.8,
    config: {
      damping: 100,
      mass: 1,
      stiffness: 200,
    },
  });

  const containerFadeIn = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: {
      damping: 100,
      mass: 1,
    },
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) scale(${scaleIn})`,
        width,
        padding,
        background: `linear-gradient(45deg, ${gradientFrom}, ${gradientTo})`,
        borderRadius,
        opacity: containerFadeIn,
      }}
    >
      <div
        style={{
          transform: `translateX(${slideIn}%)`,
        }}
      >
        <h1
          style={{
            fontSize: titleFontSize,
            fontWeight: "900",
            color: titleColor,
            margin: 0,
            lineHeight: "1",
            fontFamily,
            textShadow: "0px 4px 8px rgba(0, 0, 0, 0.3)",
          }}
        >
          {title}
        </h1>
        <h2
          style={{
            fontSize: subtitleFontSize,
            color: subtitleColor,
            margin: 0,
            marginTop: subtitleGap,
            fontWeight: "500",
            opacity: fadeIn,
            fontFamily,
            textShadow: "0px 2px 4px rgba(0, 0, 0, 0.2)",
          }}
        >
          {subtitle}
        </h2>
      </div>
    </div>
  );
};

export default BounceText;
