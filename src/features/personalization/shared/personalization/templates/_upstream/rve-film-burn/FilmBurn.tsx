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
// template id : rve-film-burn
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/film-burn.tsx
// license     : MIT License (README statement; no LICENSE file, no named
//               copyright holder). The verbatim MIT permission notice ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// Every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal; no props = the upstream design.
//
//   export default function FilmBurn()
//     -> export const FilmBurn: React.FC<FilmBurnProps>
//   root backgroundColor "#111827"            -> backgroundColor
//   "Film Burn Effect" / "white" / "2.5rem" / "bold" / "Inter, sans-serif"
//                                             -> title / titleColor / titleFontSize /
//                                                titleFontWeight / titleFontFamily
//   "Light leak overlay" / "#93c5fd" / "1.1rem" / "0.5rem"
//                                             -> subtitle / subtitleColor /
//                                                subtitleFontSize / subtitleMarginTop
//   "249, 115, 22" / "251, 191, 36" / "255, 255, 255" (rgba channels)
//                                             -> burnColor1 / burnColor2 / burnColor3
//   ADDED `contentBackground` (default undefined = no background, the upstream
//     DOM) and `content` (render slot replacing the h2 + p when provided).
//
// ADDED: `import React`, prop types, default object, trailing default export.
//
// NOT TOUCHED: the intensity curve (0 -> 0.85 -> 0 over fps * 3), the six
// sine/cosine drift expressions, the gradient stops (60 % / 50 % / 40 %) and
// the per-gradient intensity multipliers (0.7 / 0.5 / 0.3). The unused
// upstream `progress` constant is kept.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export type FilmBurnProps = {
  /** Root fill. Upstream literal: "#111827". */
  backgroundColor?: string;
  /** Background of the content panel. Upstream: none. */
  contentBackground?: string;
  title?: string;
  titleColor?: string;
  titleFontSize?: string;
  titleFontWeight?: string;
  titleFontFamily?: string;
  subtitle?: string;
  subtitleColor?: string;
  subtitleFontSize?: string;
  subtitleMarginTop?: string;
  /** Burn gradient 1, as "r, g, b". Upstream literal: "249, 115, 22". */
  burnColor1?: string;
  /** Burn gradient 2, as "r, g, b". Upstream literal: "251, 191, 36". */
  burnColor2?: string;
  /** Burn gradient 3, as "r, g, b". Upstream literal: "255, 255, 255". */
  burnColor3?: string;
  /** Render slot: replaces the h2 + p when provided. */
  content?: React.ReactNode;
};

export const defaultFilmBurnProps = {
  backgroundColor: "#111827",
  contentBackground: undefined as string | undefined,
  title: "Film Burn Effect",
  titleColor: "white",
  titleFontSize: "2.5rem",
  titleFontWeight: "bold",
  titleFontFamily: "Inter, sans-serif",
  subtitle: "Light leak overlay",
  subtitleColor: "#93c5fd",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
  burnColor1: "249, 115, 22",
  burnColor2: "251, 191, 36",
  burnColor3: "255, 255, 255",
};

export const FilmBurn: React.FC<FilmBurnProps> = ({
  backgroundColor = defaultFilmBurnProps.backgroundColor,
  contentBackground = defaultFilmBurnProps.contentBackground,
  title = defaultFilmBurnProps.title,
  titleColor = defaultFilmBurnProps.titleColor,
  titleFontSize = defaultFilmBurnProps.titleFontSize,
  titleFontWeight = defaultFilmBurnProps.titleFontWeight,
  titleFontFamily = defaultFilmBurnProps.titleFontFamily,
  subtitle = defaultFilmBurnProps.subtitle,
  subtitleColor = defaultFilmBurnProps.subtitleColor,
  subtitleFontSize = defaultFilmBurnProps.subtitleFontSize,
  subtitleMarginTop = defaultFilmBurnProps.subtitleMarginTop,
  burnColor1 = defaultFilmBurnProps.burnColor1,
  burnColor2 = defaultFilmBurnProps.burnColor2,
  burnColor3 = defaultFilmBurnProps.burnColor3,
  content,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = fps * 3;
  const progress = Math.min(frame / totalFrames, 1);

  // Peak at mid-animation
  const intensity = interpolate(frame, [0, totalFrames * 0.5, totalFrames], [0, 0.85, 0], {
    extrapolateRight: "clamp",
  });

  const xShift1 = 50 + Math.sin(frame * 0.05) * 30;
  const yShift1 = 50 + Math.cos(frame * 0.04) * 20;
  const xShift2 = 50 + Math.sin(frame * 0.07 + 2) * 25;
  const yShift2 = 50 + Math.cos(frame * 0.06 + 1) * 30;
  const xShift3 = 50 + Math.sin(frame * 0.03 + 4) * 20;
  const yShift3 = 50 + Math.cos(frame * 0.08 + 3) * 15;

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
      {/* Sample dark content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: contentBackground,
        }}
      >
        {content !== undefined ? (
          content
        ) : (
          <>
            <h2
              style={{
                color: titleColor,
                fontSize: titleFontSize,
                fontWeight: titleFontWeight,
                margin: 0,
                fontFamily: titleFontFamily,
              }}
            >
              {title}
            </h2>
            <p style={{ color: subtitleColor, fontSize: subtitleFontSize, marginTop: subtitleMarginTop }}>
              {subtitle}
            </p>
          </>
        )}
      </div>

      {/* Film burn overlay - gradient 1 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at ${xShift1}% ${yShift1}%, rgba(${burnColor1}, ${intensity * 0.7}), transparent 60%)`,
          pointerEvents: "none",
        }}
      />

      {/* Film burn overlay - gradient 2 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at ${xShift2}% ${yShift2}%, rgba(${burnColor2}, ${intensity * 0.5}), transparent 50%)`,
          pointerEvents: "none",
        }}
      />

      {/* Film burn overlay - gradient 3 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at ${xShift3}% ${yShift3}%, rgba(${burnColor3}, ${intensity * 0.3}), transparent 40%)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

export default FilmBurn;
