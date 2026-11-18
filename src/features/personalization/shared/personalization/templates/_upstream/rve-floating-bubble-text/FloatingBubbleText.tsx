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
// template id : rve-floating-bubble-text
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/floating-bubble-text.tsx
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
//   upstream line 16  export default function FloatingBubbleText() {
//                 ->  export const FloatingBubbleText: React.FC<FloatingBubbleTextProps> = ({ ... }) => {
//   upstream line 20  Math.sin(frame / 30) * 20          -> Math.sin(frame / 30) * floatDistance
//                     (default 20)
//   upstream line 43  fontSize: "4.5rem",                -> fontSize         (default "4.5rem")
//   upstream line 45  color: "white",                    -> color            (default "white")
//   upstream line 46  padding: "2rem 3.5rem",            -> padding          (default "2rem 3.5rem")
//   upstream line 47  borderRadius: "24px",              -> borderRadius     (default "24px")
//   upstream line 48  background: "linear-gradient(45deg, #1e3a8a, #3b82f6)",
//                 ->  `linear-gradient(45deg, ${gradientFrom}, ${gradientTo})`
//                     (defaults "#1e3a8a" / "#3b82f6")
//   upstream line 49  border: "3px solid transparent",   -> `${borderWidth} solid transparent`
//                     (default "3px")
//   upstream line 53  boxShadow: "0 8px 32px rgba(30, 58, 138, 0.2)",
//                 ->  boxShadow                          (default identical)
//   upstream line 59  inset: "-3px",                     -> `-${borderWidth}`
//   upstream line 60  background: "linear-gradient(45deg, cyan, magenta)",
//                 ->  `linear-gradient(45deg, ${rimFrom}, ${rimTo})`
//                     (defaults "cyan" / "magenta")
//   upstream line 67  Floating                           -> {text}
//
// REMOVED (contract addition C12 — the render must be a pure function of the
// frame): upstream line 63 `animation: \`rotate 3s linear infinite\`,`. The
// upstream defines no `rotate` keyframes anywhere, so the declaration never
// animated anything; it was a no-op that would only have made the output
// depend on wall-clock time had a global `rotate` keyframe ever existed.
// Removing it does not change what renders.
//
// ADDED (not present upstream): `import React from "react";`, the props type,
// the `defaultFloatingBubbleTextProps` object and a trailing default export.
// (No `whiteSpace` rule was added: the adapter fits the copy instead.)
//
// NOT TOUCHED: the spring (lines 21-30), the transform, `backgroundClip`,
// `overflow`, the `zIndex: -1` rim and its `margin: "-2px"`.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export type FloatingBubbleTextProps = {
  /** Upstream literal: "Floating". */
  text?: string;
  /** Upstream literal: "white". */
  color?: string;
  /** Upstream literal: "#1e3a8a". */
  gradientFrom?: string;
  /** Upstream literal: "#3b82f6". */
  gradientTo?: string;
  /** Upstream literal: "cyan". */
  rimFrom?: string;
  /** Upstream literal: "magenta". */
  rimTo?: string;
  /** Upstream literal: "0 8px 32px rgba(30, 58, 138, 0.2)". */
  boxShadow?: string;
  /** Upstream literal: "4.5rem". */
  fontSize?: string;
  /** Upstream literal: "2rem 3.5rem". */
  padding?: string;
  /** Upstream literal: "24px". */
  borderRadius?: string;
  /** Upstream literal: "3px". */
  borderWidth?: string;
  /** Upstream literal: 20 (px of vertical bob). */
  floatDistance?: number;
};

export const defaultFloatingBubbleTextProps: Required<FloatingBubbleTextProps> = {
  text: "Floating",
  color: "white",
  gradientFrom: "#1e3a8a",
  gradientTo: "#3b82f6",
  rimFrom: "cyan",
  rimTo: "magenta",
  boxShadow: "0 8px 32px rgba(30, 58, 138, 0.2)",
  fontSize: "4.5rem",
  padding: "2rem 3.5rem",
  borderRadius: "24px",
  borderWidth: "3px",
  floatDistance: 20,
};

export const FloatingBubbleText: React.FC<FloatingBubbleTextProps> = ({
  text = defaultFloatingBubbleTextProps.text,
  color = defaultFloatingBubbleTextProps.color,
  gradientFrom = defaultFloatingBubbleTextProps.gradientFrom,
  gradientTo = defaultFloatingBubbleTextProps.gradientTo,
  rimFrom = defaultFloatingBubbleTextProps.rimFrom,
  rimTo = defaultFloatingBubbleTextProps.rimTo,
  boxShadow = defaultFloatingBubbleTextProps.boxShadow,
  fontSize = defaultFloatingBubbleTextProps.fontSize,
  padding = defaultFloatingBubbleTextProps.padding,
  borderRadius = defaultFloatingBubbleTextProps.borderRadius,
  borderWidth = defaultFloatingBubbleTextProps.borderWidth,
  floatDistance = defaultFloatingBubbleTextProps.floatDistance,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const float = Math.sin(frame / 30) * floatDistance;
  const scale = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: {
      damping: 12,
      mass: 0.5,
    },
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) translateY(${float}px) scale(${scale})`,
      }}
    >
      <div
        style={{
          fontSize,
          fontWeight: "bold",
          color,
          padding,
          borderRadius,
          background: `linear-gradient(45deg, ${gradientFrom}, ${gradientTo})`,
          border: `${borderWidth} solid transparent`,
          backgroundClip: "padding-box",
          position: "relative",
          overflow: "hidden",
          boxShadow,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: `-${borderWidth}`,
            background: `linear-gradient(45deg, ${rimFrom}, ${rimTo})`,
            zIndex: -1,
            margin: "-2px",
          }}
        />
        {text}
      </div>
    </div>
  );
};

export default FloatingBubbleText;
