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
// template id : rve-pulsing-text
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/pulsing-text.tsx
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
//   upstream line 16  export default function PulsingText() {
//                 ->  export const PulsingText: React.FC<PulsingTextProps> = ({ ... }) => {
//   upstream line 19  const text = "Pulse";              -> text prop        (default "Pulse")
//   upstream line 29  gap: "1rem",                       -> gap              (default "1rem")
//   upstream line 62  fontSize: "5rem",                  -> fontSize         (default "5rem")
//   upstream line 64  color: "white",                    -> color            (default "white")
//   upstream line 77  width: "80px",                     -> glowSize         (default "80px")
//   upstream line 78  height: "80px",                    -> glowSize
//   upstream line 79  background: "rgba(255, 255, 255, 0.2)",
//                 ->  glowColor                          (default identical)
//   upstream line 81  filter: "blur(20px)",              -> glowFilter       (default "blur(20px)")
//
// ADDED (not present upstream): `import React from "react";`, the props type,
// the `defaultPulsingTextProps` object, a trailing default export, and ONE
// optional style, `glowShadow` (default `undefined` = not set, exactly as
// upstream). The browser export rasteriser (`@remotion/web-renderer`) does not
// implement CSS `filter`, so a `blur(20px)` halo exports as a hard disc; an
// adapter can instead pass `glowFilter: "none"` plus a `box-shadow` glow,
// which both the preview and the rasteriser draw identically.
//
// NOT TOUCHED: the per-character pulse and opacity interpolations (lines
// 33-50, including the upstream's negative-modulo behaviour before each
// character's delay), the 6-frame stagger, the weights and the stacking.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export type PulsingTextProps = {
  /** Upstream literal: "Pulse". */
  text?: string;
  /** Upstream literal: "white". */
  color?: string;
  /** Upstream literal: "5rem". */
  fontSize?: string;
  /** Upstream literal: "1rem". */
  gap?: string;
  /** Upstream literal: "80px". */
  glowSize?: string;
  /** Upstream literal: "rgba(255, 255, 255, 0.2)". */
  glowColor?: string;
  /** Upstream literal: "blur(20px)". */
  glowFilter?: string;
  /** ADDED. Not set upstream. */
  glowShadow?: string;
};

export const defaultPulsingTextProps: Required<Omit<PulsingTextProps, "glowShadow">> = {
  text: "Pulse",
  color: "white",
  fontSize: "5rem",
  gap: "1rem",
  glowSize: "80px",
  glowColor: "rgba(255, 255, 255, 0.2)",
  glowFilter: "blur(20px)",
};

export const PulsingText: React.FC<PulsingTextProps> = ({
  text = defaultPulsingTextProps.text,
  color = defaultPulsingTextProps.color,
  fontSize = defaultPulsingTextProps.fontSize,
  gap = defaultPulsingTextProps.gap,
  glowSize = defaultPulsingTextProps.glowSize,
  glowColor = defaultPulsingTextProps.glowColor,
  glowFilter = defaultPulsingTextProps.glowFilter,
  glowShadow,
}) => {
  const frame = useCurrentFrame();
  // `fps` is read but unused upstream too; kept verbatim.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        gap,
      }}
    >
      {text.split("").map((char, i) => {
        const delay = i * 6;
        const pulse = interpolate(
          ((frame - delay) % 30) / 30,
          [0, 0.5, 1],
          [1, 1.2, 1],
          {
            extrapolateRight: "clamp",
          }
        );

        const opacity = interpolate(
          ((frame - delay) % 30) / 30,
          [0, 0.5, 1],
          [0.5, 1, 0.5],
          {
            extrapolateRight: "clamp",
          }
        );

        return (
          <div
            key={i}
            style={{
              position: "relative",
              transform: `scale(${pulse})`,
            }}
          >
            <span
              style={{
                fontSize,
                fontWeight: "bold",
                color,
                position: "relative",
                zIndex: 2,
              }}
            >
              {char}
            </span>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: glowSize,
                height: glowSize,
                background: glowColor,
                borderRadius: "50%",
                filter: glowFilter,
                ...(glowShadow ? { boxShadow: glowShadow } : null),
                opacity: opacity,
                zIndex: 1,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default PulsingText;
