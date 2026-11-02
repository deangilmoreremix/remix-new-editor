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
// SMARTVIDEO GO AI — Phase 2 upstream template (repo 2: remotion-templates)
// template id : rve-popping-text
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/popping-text.tsx
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
// This file is EDITED. The upstream template has NO props surface at all, so
// every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal exactly. Rendering this component
// with no props reproduces the upstream design verbatim.
//
//   upstream line 16  export default function PoppingText() {
//                 ->  export const PoppingText: React.FC<PoppingTextProps> = ({ ... }) => {
//                     (the props below are destructured with the upstream
//                     literal as their default value; `text` and `colors` are
//                     destructured under the names `textValue` / `colorsValue`
//                     so the local bindings at upstream lines 20 and 22 stay
//                     byte-identical)
//   upstream line 14  import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
//                 ->  import { spring, useCurrentFrame, useVideoConfig } from "remotion";
//                     (the upstream never calls `interpolate`; only the dead
//                     import was removed)
//   upstream line 20  const text = "BINGO!".split("");
//                 ->  const text = textValue.split("");
//   upstream lines 22-26  const colors = ["#1e3a8a", "#3b82f6", "#A9D6E5"];
//                 ->  const colors = colorsValue;   (the default prop value is
//                     the same three-entry array, in the same order, so the
//                     `i % colors.length` rotation at upstream line 45 looks
//                     identical)
//   upstream line 71  fontSize: "8rem",
//                 ->  fontSize,                          (default "8rem")
//   upstream line 74-78  the four `#fff` entries of the text-shadow outline
//                 ->  `${outlineColor}`                 (default "#fff")
//   upstream line 80  fontFamily: "'Impact', 'Arial Black', sans-serif",
//                 ->  fontFamily,                        (default "'Impact', 'Arial Black', sans-serif")
//   upstream line 81  letterSpacing: "0.05em",
//                 ->  letterSpacing,                     (default "0.05em")
//
// ADDED (not present upstream): `import React from "react";` (needed for the
// React.FC prop type), the `PoppingTextProps` type, the
// `defaultPoppingTextProps` object (the upstream literals) and a trailing
// `export default PoppingText;`.
//
// NOT TOUCHED: the per-character delay (44), the colour rotation (45), the
// two springs (48-62), the glow `textShadow` colour that is derived from the
// palette (`${colors[colorIndex]}80`, upstream line 74), the font weight
// ("900", upstream line 72), the glyph margins (73) and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export type PoppingTextProps = {
  /** The text that is split into characters. Upstream literal: "BINGO!". */
  text?: string;
  /** The per-character palette. Upstream literal: ["#1e3a8a", "#3b82f6", "#A9D6E5"]. */
  colors?: string[];
  /** The glyph outline colour. Upstream literal: "#fff". */
  outlineColor?: string;
  /** The glyph size. Upstream literal: "8rem". */
  fontSize?: string;
  /** The glyph family. Upstream literal: "'Impact', 'Arial Black', sans-serif". */
  fontFamily?: string;
  /** The glyph letter spacing. Upstream literal: "0.05em". */
  letterSpacing?: string;
};

export const defaultPoppingTextProps: Required<PoppingTextProps> = {
  text: "BINGO!",
  colors: [
    "#1e3a8a", // teal/aqua blue
    "#3b82f6", // dark blue-green
    "#A9D6E5", // light blue
  ],
  outlineColor: "#fff",
  fontSize: "8rem",
  fontFamily: "'Impact', 'Arial Black', sans-serif",
  letterSpacing: "0.05em",
};

export const PoppingText: React.FC<PoppingTextProps> = ({
  text: textValue = defaultPoppingTextProps.text,
  colors: colorsValue = defaultPoppingTextProps.colors,
  outlineColor = defaultPoppingTextProps.outlineColor,
  fontSize = defaultPoppingTextProps.fontSize,
  fontFamily = defaultPoppingTextProps.fontFamily,
  letterSpacing = defaultPoppingTextProps.letterSpacing,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const text = textValue.split("");

  const colors = colorsValue;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "100%",
        textAlign: "center",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {text.map((char, i) => {
        const delay = i * 7;
        const colorIndex = i % colors.length;

        // Simple scale and opacity animation
        const scale = spring({
          frame: frame - delay,
          fps,
          from: 0,
          to: 1,
          config: { mass: 0.4, damping: 8, stiffness: 100 },
        });

        const opacity = spring({
          frame: frame - delay,
          fps,
          from: 0,
          to: 1,
          config: { mass: 0.3, damping: 8, stiffness: 100 },
        });

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              color: colors[colorIndex],
              fontSize,
              fontWeight: "900",
              margin: "0 0.1em",
              textShadow: `0 0 10px ${colors[colorIndex]}80,
                          -2px -2px 0 ${outlineColor}, 
                          2px -2px 0 ${outlineColor}, 
                          -2px 2px 0 ${outlineColor}, 
                          2px 2px 0 ${outlineColor}`,
              transform: `scale(${scale})`,
              fontFamily,
              letterSpacing,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </div>
  );
};

export default PoppingText;
