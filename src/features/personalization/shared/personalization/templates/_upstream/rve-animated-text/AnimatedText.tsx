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
// template id : rve-animated-text
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/animated-text.tsx
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
//   upstream line 16  export default function AnimatedText() {
//                 ->  export const AnimatedText: React.FC<AnimatedTextProps> = ({ ... }) => {
//                     (the four props below are destructured with the upstream
//                     literal as their default value; the copy is destructured
//                     under the name `textValue` so the local `text` binding at
//                     upstream line 20 stays byte-identical)
//   upstream line 20  const text = "Hello Remotion".split("");
//                 ->  const text = textValue.split("");
//   upstream line 66  color: "white",
//                 ->  color,                             (default "white")
//   upstream line 67  fontSize: "5rem",
//                 ->  fontSize,                          (default "5rem")
//   upstream line 68  fontWeight: "bold",
//                 ->  fontWeight,                        (default "bold")
//
// ADDED (not present upstream): `import React from "react";` (needed for the
// React.FC prop type), the `AnimatedTextProps` type, the
// `defaultAnimatedTextProps` object (the upstream literals) and a trailing
// `export default AnimatedText;`.
//
// NOT TOUCHED: the three per-character springs (upstream lines 36-58 — their
// delays, masses, dampings and stiffnesses are byte-identical), the
// `translateY(...) rotate(...)` transform (69), the centred 100 %-wide
// container and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export type AnimatedTextProps = {
  /** The text that is split into characters. Upstream literal: "Hello Remotion". */
  text?: string;
  /** The glyph colour. Upstream literal: "white". */
  color?: string;
  /** The glyph size. Upstream literal: "5rem". */
  fontSize?: string;
  /** The glyph weight. Upstream literal: "bold". */
  fontWeight?: string;
};

export const defaultAnimatedTextProps: Required<AnimatedTextProps> = {
  text: "Hello Remotion",
  color: "white",
  fontSize: "5rem",
  fontWeight: "bold",
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text: textValue = defaultAnimatedTextProps.text,
  color = defaultAnimatedTextProps.color,
  fontSize = defaultAnimatedTextProps.fontSize,
  fontWeight = defaultAnimatedTextProps.fontWeight,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const text = textValue.split("");

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "100%",
        textAlign: "center",
      }}
    >
      {text.map((char, i) => {
        const delay = i * 5;

        const opacity = spring({
          frame: frame - delay,
          fps,
          from: 0,
          to: 1,
          config: { mass: 0.5, damping: 10 },
        });

        const y = spring({
          frame: frame - delay,
          fps,
          from: -50,
          to: 0,
          config: { mass: 0.5, damping: 10 },
        });

        const rotate = spring({
          frame: frame - delay,
          fps,
          from: -180,
          to: 0,
          config: { mass: 0.5, damping: 12 },
        });

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              color,
              fontSize,
              fontWeight,
              transform: `translateY(${y}px) rotate(${rotate}deg)`,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </div>
  );
};

export default AnimatedText;
