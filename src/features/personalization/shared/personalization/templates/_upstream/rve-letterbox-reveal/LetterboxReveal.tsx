/**
 * Free Remotion Template Component
 * ---------------------------------
 * This template is free to use in your projects!
 * Credit appreciated but not required.
 *
 * Created by the team at https://www.reactvideoeditor.com
 *
 * (The upstream file itself opens directly with "use client"; the credit
 * above is the repository-wide credit every remotion-templates file carries
 * and is reproduced here so it travels with the copy.)
 */

// ---------------------------------------------------------------------------
// OPENHIGGSBOLT — Phase 4 batch 3g upstream template (repo 2: remotion-templates)
// template id : rve-letterbox-reveal
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/letterbox-reveal.tsx
// license     : MIT License (README statement; no LICENSE file, no named
//               copyright holder). The verbatim MIT permission notice ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// Every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal; no props = the upstream design.
//
//   export default function LetterboxReveal()
//     -> export const LetterboxReveal: React.FC<LetterboxRevealProps>
//   root backgroundColor "#111827"            -> backgroundColor
//   bar backgroundColor "#000000" (x2)         -> barColor
//   bar height interpolation [50, 12]          -> barFrom (50) / barTo (12)
//   "CINEMATIC" / "white" / "4rem" / "bold" / "0.3em" / "Inter, sans-serif"
//                                             -> title / titleColor / titleFontSize /
//                                                titleFontWeight / titleLetterSpacing /
//                                                titleFontFamily
//   "A letterbox reveal" / "#93c5fd" / "1.2rem" / "1rem" / "0.15em" / family
//                                             -> subtitle / subtitleColor /
//                                                subtitleFontSize / subtitleMarginTop /
//                                                subtitleLetterSpacing / subtitleFontFamily
//   ADDED `content` (render slot replacing the h1 + p when provided; it still
//     inherits the upstream content-opacity fade).
//
// ADDED: `import React`, prop types, default object, trailing default export.
//
// NOT TOUCHED: the timing (bars over fps * 2, content fade fps * 0.5 ->
// fps * 1.5, the upstream clamps), the zIndex and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export type LetterboxRevealProps = {
  backgroundColor?: string;
  barColor?: string;
  /** Bar height (percent of the canvas) at frame 0. Upstream: 50. */
  barFrom?: number;
  /** Bar height (percent of the canvas) at the end. Upstream: 12. */
  barTo?: number;
  title?: string;
  titleColor?: string;
  titleFontSize?: string;
  titleFontWeight?: string;
  titleLetterSpacing?: string;
  titleFontFamily?: string;
  subtitle?: string;
  subtitleColor?: string;
  subtitleFontSize?: string;
  subtitleMarginTop?: string;
  subtitleLetterSpacing?: string;
  subtitleFontFamily?: string;
  /** Render slot: replaces the h1 + p when provided. */
  content?: React.ReactNode;
};

export const defaultLetterboxRevealProps = {
  backgroundColor: "#111827",
  barColor: "#000000",
  barFrom: 50,
  barTo: 12,
  title: "CINEMATIC",
  titleColor: "white",
  titleFontSize: "4rem",
  titleFontWeight: "bold",
  titleLetterSpacing: "0.3em",
  titleFontFamily: "Inter, sans-serif",
  subtitle: "A letterbox reveal",
  subtitleColor: "#93c5fd",
  subtitleFontSize: "1.2rem",
  subtitleMarginTop: "1rem",
  subtitleLetterSpacing: "0.15em",
  subtitleFontFamily: "Inter, sans-serif",
};

export const LetterboxReveal: React.FC<LetterboxRevealProps> = ({
  backgroundColor = defaultLetterboxRevealProps.backgroundColor,
  barColor = defaultLetterboxRevealProps.barColor,
  barFrom = defaultLetterboxRevealProps.barFrom,
  barTo = defaultLetterboxRevealProps.barTo,
  title = defaultLetterboxRevealProps.title,
  titleColor = defaultLetterboxRevealProps.titleColor,
  titleFontSize = defaultLetterboxRevealProps.titleFontSize,
  titleFontWeight = defaultLetterboxRevealProps.titleFontWeight,
  titleLetterSpacing = defaultLetterboxRevealProps.titleLetterSpacing,
  titleFontFamily = defaultLetterboxRevealProps.titleFontFamily,
  subtitle = defaultLetterboxRevealProps.subtitle,
  subtitleColor = defaultLetterboxRevealProps.subtitleColor,
  subtitleFontSize = defaultLetterboxRevealProps.subtitleFontSize,
  subtitleMarginTop = defaultLetterboxRevealProps.subtitleMarginTop,
  subtitleLetterSpacing = defaultLetterboxRevealProps.subtitleLetterSpacing,
  subtitleFontFamily = defaultLetterboxRevealProps.subtitleFontFamily,
  content,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const barHeight = interpolate(frame, [0, fps * 2], [barFrom, barTo], {
    extrapolateRight: "clamp",
  });

  const contentOpacity = interpolate(frame, [fps * 0.5, fps * 1.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor,
        overflow: "hidden",
      }}
    >
      {/* Content underneath */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          opacity: contentOpacity,
        }}
      >
        {content !== undefined ? (
          content
        ) : (
          <>
            <h1
              style={{
                color: titleColor,
                fontSize: titleFontSize,
                fontWeight: titleFontWeight,
                margin: 0,
                letterSpacing: titleLetterSpacing,
                fontFamily: titleFontFamily,
              }}
            >
              {title}
            </h1>
            <p
              style={{
                color: subtitleColor,
                fontSize: subtitleFontSize,
                marginTop: subtitleMarginTop,
                letterSpacing: subtitleLetterSpacing,
                fontFamily: subtitleFontFamily,
              }}
            >
              {subtitle}
            </p>
          </>
        )}
      </div>

      {/* Top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: `${barHeight}%`,
          backgroundColor: barColor,
          zIndex: 10,
        }}
      />

      {/* Bottom bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: `${barHeight}%`,
          backgroundColor: barColor,
          zIndex: 10,
        }}
      />
    </div>
  );
};

export default LetterboxReveal;
