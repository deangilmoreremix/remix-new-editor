/** Free Remotion Template Component
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
// template id : rve-text-highlight
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/text-highlight.tsx
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
//   upstream line 15  export default function TextHighlight() {
//                 ->  export const TextHighlight: React.FC<TextHighlightProps> = ({ ... }) => {
//   upstream line 19  const words = ["Build", "amazing", "videos", "with", "code"];
//                 ->  words prop                         (default identical)
//   upstream line 20  Math.floor(fps * 0.6)              -> Math.floor(fps * secondsPerWord)
//                     (default 0.6)
//   upstream line 27  background: "linear-gradient(180deg, #111827, #1f2937)",
//                 ->  background                         (default identical)
//   upstream line 32  fontFamily: "Inter, sans-serif",   -> fontFamily       (default identical)
//   upstream line 41  gap: "16px",                       -> gap              (default "16px")
//   upstream line 42  maxWidth: "700px",                 -> maxWidth         (default "700px")
//   upstream line 43  padding: "40px",                   -> padding          (default "40px")
//   upstream line 63  fontSize: "3.5rem",                -> fontSize         (default "3.5rem")
//   upstream line 65  color: "white",                    -> color            (default "white")
//   upstream line 66  padding: "4px 12px",               -> wordPadding      (default "4px 12px")
//   upstream line 76  background: "linear-gradient(135deg, #3b82f6, #7209b7)",
//                 ->  `linear-gradient(135deg, ${highlightFrom}, ${highlightTo})`
//                     (defaults "#3b82f6" / "#7209b7")
//   upstream line 77  borderRadius: "6px",               -> highlightRadius  (default "6px")
//
// ADDED (not present upstream): `import React from "react";`, the props type,
// the `defaultTextHighlightProps` object, a trailing default export, and ONE
// optional style, `textShadow` on each word (default `undefined` = not set,
// exactly as upstream) so a word stays legible over a bright video before
// its highlight arrives.
//
// NOT TOUCHED: the per-word highlight interpolation (lines 47-55), the 0.85
// highlight opacity, the stacking and the flex-wrap layout.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, interpolate, useVideoConfig } from "remotion";

export type TextHighlightProps = {
  /** Upstream literal: ["Build", "amazing", "videos", "with", "code"]. */
  words?: string[];
  /** Upstream literal: "linear-gradient(180deg, #111827, #1f2937)". */
  background?: string;
  /** Upstream literal: "white". */
  color?: string;
  /** Upstream literal: "#3b82f6". */
  highlightFrom?: string;
  /** Upstream literal: "#7209b7". */
  highlightTo?: string;
  /** Upstream literal: "3.5rem". */
  fontSize?: string;
  /** Upstream literal: "16px". */
  gap?: string;
  /** Upstream literal: "700px". */
  maxWidth?: string;
  /** Upstream literal: "40px". */
  padding?: string;
  /** Upstream literal: "4px 12px". */
  wordPadding?: string;
  /** Upstream literal: "6px". */
  highlightRadius?: string;
  /** Upstream literal: 0.6. */
  secondsPerWord?: number;
  /** Upstream literal: "Inter, sans-serif". */
  fontFamily?: string;
  /** ADDED. Not set upstream. */
  textShadow?: string;
};

export const defaultTextHighlightProps: Required<Omit<TextHighlightProps, "textShadow">> = {
  words: ["Build", "amazing", "videos", "with", "code"],
  background: "linear-gradient(180deg, #111827, #1f2937)",
  color: "white",
  highlightFrom: "#3b82f6",
  highlightTo: "#7209b7",
  fontSize: "3.5rem",
  gap: "16px",
  maxWidth: "700px",
  padding: "40px",
  wordPadding: "4px 12px",
  highlightRadius: "6px",
  secondsPerWord: 0.6,
  fontFamily: "Inter, sans-serif",
};

export const TextHighlight: React.FC<TextHighlightProps> = ({
  words = defaultTextHighlightProps.words,
  background = defaultTextHighlightProps.background,
  color = defaultTextHighlightProps.color,
  highlightFrom = defaultTextHighlightProps.highlightFrom,
  highlightTo = defaultTextHighlightProps.highlightTo,
  fontSize = defaultTextHighlightProps.fontSize,
  gap = defaultTextHighlightProps.gap,
  maxWidth = defaultTextHighlightProps.maxWidth,
  padding = defaultTextHighlightProps.padding,
  wordPadding = defaultTextHighlightProps.wordPadding,
  highlightRadius = defaultTextHighlightProps.highlightRadius,
  secondsPerWord = defaultTextHighlightProps.secondsPerWord,
  fontFamily = defaultTextHighlightProps.fontFamily,
  textShadow,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerWord = Math.floor(fps * secondsPerWord);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        fontFamily,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap,
          maxWidth,
          padding,
        }}
      >
        {words.map((word, i) => {
          const wordStart = i * framesPerWord;
          const highlightProgress = interpolate(
            frame,
            [wordStart, wordStart + framesPerWord * 0.5],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          const isHighlighted = highlightProgress > 0;

          return (
            <span
              key={i}
              style={{
                position: "relative",
                display: "inline-block",
                fontSize,
                fontWeight: "bold",
                color,
                padding: wordPadding,
                ...(textShadow ? { textShadow } : null),
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${highlightProgress * 100}%`,
                  background: `linear-gradient(135deg, ${highlightFrom}, ${highlightTo})`,
                  borderRadius: highlightRadius,
                  zIndex: 0,
                  opacity: isHighlighted ? 0.85 : 0,
                }}
              />
              <span style={{ position: "relative", zIndex: 1 }}>{word}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default TextHighlight;
