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
// template id : rve-bubble-pop-text
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/bubble-pop-text.tsx
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
//   upstream line 16  export default function BubblePopText() {
//                 ->  export const BubblePopText: React.FC<BubblePopTextProps> = ({ ... }) => {
//   upstream line 19  const text = "HELLO";              -> text prop        (default "HELLO")
//   upstream line 29  gap: "0.5rem",                     -> gap              (default "0.5rem")
//   upstream line 52  fontSize: "4rem",                  -> fontSize         (default "4rem")
//   upstream line 54  color: "white",                    -> color            (default "white")
//   upstream line 55  border: "4px solid rgba(255, 255, 255, 0.2)",
//                 ->  border                             (default identical)
//   upstream line 57  width: "100px",                    -> bubbleSize       (default "100px")
//   upstream line 58  height: "100px",                   -> bubbleSize
//   upstream line 59  lineHeight: "92px",                -> lineHeight       (default "92px")
//   upstream line 61  background: "linear-gradient(45deg, #1e3a8a, #3b82f6)"
//                 ->  `linear-gradient(45deg, ${gradientFrom}, ${gradientTo})`
//                     (defaults "#1e3a8a" / "#3b82f6")
//   upstream line 62  boxShadow: "0 4px 15px rgba(59, 130, 246, 0.5)",
//                 ->  boxShadow                          (default identical)
//
// ADDED (not present upstream): `import React from "react";`, the props type,
// the `defaultBubblePopTextProps` object, a trailing default export, and ONE
// behavioural option, `hideSpaceBubbles` (default `false` = upstream
// behaviour). The upstream draws a bubble for every character, so a space in a
// multi-word string becomes an empty bubble; with the option on, a space keeps
// its slot (and its stagger delay) but paints nothing, so words read apart.
//
// NOT TOUCHED: the per-character spring (upstream lines 33-44 — the 5-frame
// stagger, damping 8, mass 0.3, stiffness 100), `backdropFilter: blur(8px)`
// (63), the layout and the weights.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export type BubblePopTextProps = {
  /** Upstream literal: "HELLO". */
  text?: string;
  /** Upstream literal: "white". */
  color?: string;
  /** Upstream literal: "#1e3a8a". */
  gradientFrom?: string;
  /** Upstream literal: "#3b82f6". */
  gradientTo?: string;
  /** Upstream literal: "4px solid rgba(255, 255, 255, 0.2)". */
  border?: string;
  /** Upstream literal: "0 4px 15px rgba(59, 130, 246, 0.5)". */
  boxShadow?: string;
  /** Upstream literal: "4rem". */
  fontSize?: string;
  /** Upstream literal: "100px" (both width and height). */
  bubbleSize?: string;
  /** Upstream literal: "92px". */
  lineHeight?: string;
  /** Upstream literal: "0.5rem". */
  gap?: string;
  /** ADDED. Upstream behaviour (false): a space gets a bubble too. */
  hideSpaceBubbles?: boolean;
};

export const defaultBubblePopTextProps: Required<BubblePopTextProps> = {
  text: "HELLO",
  color: "white",
  gradientFrom: "#1e3a8a",
  gradientTo: "#3b82f6",
  border: "4px solid rgba(255, 255, 255, 0.2)",
  boxShadow: "0 4px 15px rgba(59, 130, 246, 0.5)",
  fontSize: "4rem",
  bubbleSize: "100px",
  lineHeight: "92px",
  gap: "0.5rem",
  hideSpaceBubbles: false,
};

export const BubblePopText: React.FC<BubblePopTextProps> = ({
  text = defaultBubblePopTextProps.text,
  color = defaultBubblePopTextProps.color,
  gradientFrom = defaultBubblePopTextProps.gradientFrom,
  gradientTo = defaultBubblePopTextProps.gradientTo,
  border = defaultBubblePopTextProps.border,
  boxShadow = defaultBubblePopTextProps.boxShadow,
  fontSize = defaultBubblePopTextProps.fontSize,
  bubbleSize = defaultBubblePopTextProps.bubbleSize,
  lineHeight = defaultBubblePopTextProps.lineHeight,
  gap = defaultBubblePopTextProps.gap,
  hideSpaceBubbles = defaultBubblePopTextProps.hideSpaceBubbles,
}) => {
  const frame = useCurrentFrame();
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
        const delay = i * 5;
        const scale = spring({
          frame: frame - delay,
          fps,
          from: 0,
          to: 1,
          config: {
            damping: 8,
            mass: 0.3,
            stiffness: 100,
          },
        });

        if (hideSpaceBubbles && char.trim() === "") {
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                width: bubbleSize,
                height: bubbleSize,
              }}
            />
          );
        }

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `scale(${scale})`,
              fontSize,
              fontWeight: "bold",
              color,
              border,
              borderRadius: "50%",
              width: bubbleSize,
              height: bubbleSize,
              lineHeight,
              textAlign: "center",
              background: `linear-gradient(45deg, ${gradientFrom}, ${gradientTo})`,
              boxShadow,
              backdropFilter: "blur(8px)",
            }}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
};

export default BubblePopText;
