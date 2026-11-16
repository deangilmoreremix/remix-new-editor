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
// template id : rve-typewriter-subtitle
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/typewriter-subtitle.tsx
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
//   upstream line 16  export default function TypewriterSubtitle() {
//                 ->  export const TypewriterSubtitle: React.FC<TypewriterSubtitleProps> = ({ ... }) => {
//   upstream line 19  const text = "I like typing...";   -> text prop        (default identical)
//   upstream line 21  interpolate(frame, [0, 45], ...)   -> [0, typingFrames] (default 45)
//   upstream line 35  padding: "2rem",                   -> padding          (default "2rem")
//   upstream line 50  fontFamily: "'Courier New', monospace",
//                 ->  fontFamily                         (default identical)
//   upstream lines 51/64  fontSize: "3rem",              -> fontSize         (default "3rem")
//   upstream line 53  color: `white`,                    -> color            (default "white")
//   upstream line 65  color: "#60a5fa",                  -> cursorColor      (default "#60a5fa")
//
// REMOVED (contract addition C12 — the render must be a pure function of the
// frame, and the browser exporter renders frames out of order):
//   upstream line 43  `const isGlitching = frame % 30 === 0 && Math.random() > 0.7;`
//                     — `isGlitching` is never read, so the line had no
//                     visible effect, but it called `Math.random()` on every
//                     render. Removed.
//   upstream line 55  `transition: "all 0.05s ease-out",` — a CSS transition
//                     ties the output to wall-clock time between frames
//                     (Remotion renders frames as independent stills).
//                     Removed; the characters already appear on frame
//                     boundaries.
// The unused `hue` local (line 42) is deterministic and is kept verbatim.
//
// ADDED (not present upstream): `import React from "react";`, the props type,
// the `defaultTypewriterSubtitleProps` object and a trailing default export.
//
// NOT TOUCHED: the visible-character interpolation, the non-breaking-space
// substitution, the blinking cursor (`frame % 15 < 7`), the layout.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export type TypewriterSubtitleProps = {
  /** Upstream literal: "I like typing...". */
  text?: string;
  /** Upstream literal: "white". */
  color?: string;
  /** Upstream literal: "#60a5fa". */
  cursorColor?: string;
  /** Upstream literal: "3rem". */
  fontSize?: string;
  /** Upstream literal: "'Courier New', monospace". */
  fontFamily?: string;
  /** Upstream literal: "2rem". */
  padding?: string;
  /** Upstream literal: 45 (frames to type the whole string). */
  typingFrames?: number;
};

export const defaultTypewriterSubtitleProps: Required<TypewriterSubtitleProps> = {
  text: "I like typing...",
  color: "white",
  cursorColor: "#60a5fa",
  fontSize: "3rem",
  fontFamily: "'Courier New', monospace",
  padding: "2rem",
  typingFrames: 45,
};

export const TypewriterSubtitle: React.FC<TypewriterSubtitleProps> = ({
  text = defaultTypewriterSubtitleProps.text,
  color = defaultTypewriterSubtitleProps.color,
  cursorColor = defaultTypewriterSubtitleProps.cursorColor,
  fontSize = defaultTypewriterSubtitleProps.fontSize,
  fontFamily = defaultTypewriterSubtitleProps.fontFamily,
  padding = defaultTypewriterSubtitleProps.padding,
  typingFrames = defaultTypewriterSubtitleProps.typingFrames,
}) => {
  const frame = useCurrentFrame();

  const visibleCharacters = Math.floor(
    interpolate(frame, [0, typingFrames], [0, text.length], {
      extrapolateRight: "clamp",
    })
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "100%",
        textAlign: "center",
        padding,
      }}
    >
      {text
        .slice(0, visibleCharacters)
        .split("")
        .map((char, index) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const hue = 210 + (index * 40) / text.length;

          return (
            <span
              key={index}
              style={{
                display: "inline-block",
                fontFamily,
                fontSize,
                fontWeight: "bold",
                color,
              }}
            >
              {char === " " ? " " : char}
            </span>
          );
        })}
      <span
        style={{
          fontSize,
          color: cursorColor,
          opacity: frame % 15 < 7 ? 1 : 0,

          marginLeft: "0.2rem",
          verticalAlign: "middle",
        }}
      >
        ▌
      </span>
    </div>
  );
};

export default TypewriterSubtitle;
