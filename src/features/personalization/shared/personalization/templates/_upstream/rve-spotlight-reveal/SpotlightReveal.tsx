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
// template id : rve-spotlight-reveal
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/spotlight-reveal.tsx
// license     : MIT License (README statement; no LICENSE file, no named
//               copyright holder). The verbatim MIT permission notice ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// Every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal; no props = the upstream design.
//
//   export default function SpotlightReveal()
//     -> export const SpotlightReveal: React.FC<SpotlightRevealProps>
//   root backgroundColor "#0a0a0a"            -> backgroundColor
//   panel background "linear-gradient(135deg, #111827, #1e1b4b)"
//                                             -> contentBackground
//   top bar: "80px" / "4px" / "linear-gradient(90deg, #3b82f6, #a855f7)" /
//     "2px" / "1.5rem"                         -> barWidth / barHeight / topBarBackground /
//                                                barRadius / barGap
//   bottom bar gradient "linear-gradient(90deg, #a855f7, #3b82f6)"
//                                             -> bottomBarBackground
//   "REVEALED" / "white" / "3.5rem" / "bold" / "0.1em"
//                                             -> title / titleColor / titleFontSize /
//                                                titleFontWeight / titleLetterSpacing
//   "Spotlight reveal transition" / "#c4b5fd" / "1.1rem" / "0.75rem"
//                                             -> subtitle / subtitleColor /
//                                                subtitleFontSize / subtitleMarginTop
//   glow rgba channels "139, 92, 246"          -> glowRgb
//   ADDED `durationInFrames` (default undefined = upstream: read from
//     useVideoConfig()). An adapter can pin the reveal length instead of
//     inheriting the host composition's duration.
//   ADDED `content` (render slot replacing the bars + h1 + p when provided).
//   ADDED `outsideColor` (default undefined = not rendered). Upstream the
//     area outside the spotlight is the opaque root fill; for overlay use an
//     extra layer paints this colour OUTSIDE the current clip circle (same
//     radius as the clip-path: r % of sqrt((w^2 + h^2) / 2)).
//
// ADDED: `import React`, prop types, default object, trailing default export.
//
// NOT TOUCHED: the radius curve (0 -> 75 over 80 % of the duration), the glow
// curve (0 -> 0.6 -> 0 at 30 % / 80 %) and the glow gradient geometry.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export type SpotlightRevealProps = {
  backgroundColor?: string;
  contentBackground?: string;
  barWidth?: string;
  barHeight?: string;
  barRadius?: string;
  barGap?: string;
  topBarBackground?: string;
  bottomBarBackground?: string;
  title?: string;
  titleColor?: string;
  titleFontSize?: string;
  titleFontWeight?: string;
  titleLetterSpacing?: string;
  subtitle?: string;
  subtitleColor?: string;
  subtitleFontSize?: string;
  subtitleMarginTop?: string;
  /** Glow colour as "r, g, b". Upstream literal: "139, 92, 246". */
  glowRgb?: string;
  /** Reveal length override. Upstream: useVideoConfig().durationInFrames. */
  durationInFrames?: number;
  /** Colour painted outside the spotlight (overlay use). Upstream: none. */
  outsideColor?: string;
  /** Render slot: replaces the bars + title + subtitle when provided. */
  content?: React.ReactNode;
};

export const defaultSpotlightRevealProps = {
  backgroundColor: "#0a0a0a",
  contentBackground: "linear-gradient(135deg, #111827, #1e1b4b)",
  barWidth: "80px",
  barHeight: "4px",
  barRadius: "2px",
  barGap: "1.5rem",
  topBarBackground: "linear-gradient(90deg, #3b82f6, #a855f7)",
  bottomBarBackground: "linear-gradient(90deg, #a855f7, #3b82f6)",
  title: "REVEALED",
  titleColor: "white",
  titleFontSize: "3.5rem",
  titleFontWeight: "bold",
  titleLetterSpacing: "0.1em",
  subtitle: "Spotlight reveal transition",
  subtitleColor: "#c4b5fd",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.75rem",
  glowRgb: "139, 92, 246",
};

export const SpotlightReveal: React.FC<SpotlightRevealProps> = ({
  backgroundColor = defaultSpotlightRevealProps.backgroundColor,
  contentBackground = defaultSpotlightRevealProps.contentBackground,
  barWidth = defaultSpotlightRevealProps.barWidth,
  barHeight = defaultSpotlightRevealProps.barHeight,
  barRadius = defaultSpotlightRevealProps.barRadius,
  barGap = defaultSpotlightRevealProps.barGap,
  topBarBackground = defaultSpotlightRevealProps.topBarBackground,
  bottomBarBackground = defaultSpotlightRevealProps.bottomBarBackground,
  title = defaultSpotlightRevealProps.title,
  titleColor = defaultSpotlightRevealProps.titleColor,
  titleFontSize = defaultSpotlightRevealProps.titleFontSize,
  titleFontWeight = defaultSpotlightRevealProps.titleFontWeight,
  titleLetterSpacing = defaultSpotlightRevealProps.titleLetterSpacing,
  subtitle = defaultSpotlightRevealProps.subtitle,
  subtitleColor = defaultSpotlightRevealProps.subtitleColor,
  subtitleFontSize = defaultSpotlightRevealProps.subtitleFontSize,
  subtitleMarginTop = defaultSpotlightRevealProps.subtitleMarginTop,
  glowRgb = defaultSpotlightRevealProps.glowRgb,
  durationInFrames: durationOverride,
  outsideColor,
  content,
}) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const durationInFrames = durationOverride ?? config.durationInFrames;

  // Clip-path radius grows from 0% to 75%
  const radius = interpolate(frame, [0, durationInFrames * 0.8], [0, 75], {
    extrapolateRight: "clamp",
  });

  // Glow opacity peaks mid-animation then fades
  const glowOpacity = interpolate(
    frame,
    [0, durationInFrames * 0.3, durationInFrames * 0.8],
    [0, 0.6, 0],
    { extrapolateRight: "clamp" }
  );

  // ADDED (outsideColor only): the clip-path radius in px.
  const radiusPx =
    (radius / 100) * Math.sqrt((config.width * config.width + config.height * config.height) / 2);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor,
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Revealed content behind clip */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: contentBackground,
          clipPath: `circle(${radius}% at 50% 50%)`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {content !== undefined ? (
          content
        ) : (
          <>
            {/* Decorative top bar */}
            <div
              style={{
                width: barWidth,
                height: barHeight,
                background: topBarBackground,
                borderRadius: barRadius,
                marginBottom: barGap,
              }}
            />
            <h1
              style={{
                color: titleColor,
                fontSize: titleFontSize,
                fontWeight: titleFontWeight,
                margin: 0,
                letterSpacing: titleLetterSpacing,
              }}
            >
              {title}
            </h1>
            <p
              style={{
                color: subtitleColor,
                fontSize: subtitleFontSize,
                marginTop: subtitleMarginTop,
              }}
            >
              {subtitle}
            </p>
            {/* Decorative bottom bar */}
            <div
              style={{
                width: barWidth,
                height: barHeight,
                background: bottomBarBackground,
                borderRadius: barRadius,
                marginTop: barGap,
              }}
            />
          </>
        )}
      </div>

      {outsideColor !== undefined && (
        <div
          data-spotlight-outside
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle ${Math.max(1, radiusPx)}px at 50% 50%, transparent ${Math.max(0, radiusPx - 1)}px, ${outsideColor} ${Math.max(0, radiusPx)}px)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Glow at the edge of the circle */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 50%, transparent ${radius - 2}%, rgba(${glowRgb}, ${glowOpacity}) ${radius}%, transparent ${radius + 3}%)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

export default SpotlightReveal;
