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
// SMARTVIDEO GO AI — Phase 4 batch 3h upstream template (repo 2: remotion-templates)
// template id : rve-matrix-rain
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/matrix-rain.tsx
// license     : MIT License (README); no LICENSE file, no named copyright
//               holder. The verbatim MIT permission notice (WITHOUT a
//               copyright line) ships with the design credit in
//               `templates/designs/rveSharedDesign.tsx` (RVE_LICENSE_NOTICE).
//
// DEVIATION RECORD (contract addition C8 — repo-2 edited copies)
// ----------------------------------------------------------------
// (Upstream line numbers refer to the file at the pinned commit and may be
// off by one or two; the quoted upstream literal is authoritative.)
// This file is EDITED. Every hard-coded string, colour and dimension became an
// OPTIONAL prop whose default reproduces the upstream literal exactly.
// Rendering this component with no props reproduces the upstream design.
//
//   upstream line 15  export default function MatrixRain() {
//                 ->  export const MatrixRain: React.FC<MatrixRainProps> = ({ ... }) => {
//   upstream line 19  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";
//                 ->  `characters` prop (same default)
//   upstream line 20  Math.floor(width / 20)  ->  Math.floor(width / columnWidth) (default 20)
//   upstream line 22  x: i * 20,              ->  i * columnWidth
//   upstream line 24  random(i) * 5 + 5       ->  random(i) * speedJitter + speedBase (5, 5)
//   upstream line 33  background: "linear-gradient(45deg, #0a1933, #1e40af)", -> background
//   upstream line 46  color: `rgba(255, 255, 255, ${1 - (y / height) * 0.6})`,
//                 ->  `rgba(${charRgb}, ${1 - (y / height) * fadeAmount})`
//                     (defaults "255, 255, 255" and 0.6)
//   upstream line 47  fontSize: "25px",       ->  fontSize    (default "25px")
//   upstream line 48  fontFamily: "monospace",->  fontFamily  (default "monospace")
//   upstream line 49  fontWeight: "bold",     ->  fontWeight  (default "bold")
//   upstream line 50  textShadow: "0 0 8px rgba(59, 130, 246, 0.9)", -> glow
//   upstream line 53  Math.floor((frame + i) / 5)  ->  / charSwapFrames (default 5)
//
// ADDED (not present upstream): `import React from "react";`, the prop
// types, `defaultMatrixRainProps`, a trailing `export default`.
//
// NOT TOUCHED: the seeded `random(i)` drop layout (y, speed and initial char
// all draw from the same seed, exactly as upstream) and the `% height` wrap.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { random, useCurrentFrame, useVideoConfig } from "remotion";

export type MatrixRainProps = {
  characters?: string;
  columnWidth?: number;
  speedBase?: number;
  speedJitter?: number;
  background?: string;
  charRgb?: string;
  fadeAmount?: number;
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: React.CSSProperties["fontWeight"];
  glow?: string;
  charSwapFrames?: number;
};

export const defaultMatrixRainProps = {
  characters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*",
  columnWidth: 20,
  speedBase: 5,
  speedJitter: 5,
  background: "linear-gradient(45deg, #0a1933, #1e40af)",
  charRgb: "255, 255, 255",
  fadeAmount: 0.6,
  fontSize: "25px",
  fontFamily: "monospace",
  fontWeight: "bold" as React.CSSProperties["fontWeight"],
  glow: "0 0 8px rgba(59, 130, 246, 0.9)",
  charSwapFrames: 5,
};

export const MatrixRain: React.FC<MatrixRainProps> = ({
  characters = defaultMatrixRainProps.characters,
  columnWidth = defaultMatrixRainProps.columnWidth,
  speedBase = defaultMatrixRainProps.speedBase,
  speedJitter = defaultMatrixRainProps.speedJitter,
  background = defaultMatrixRainProps.background,
  charRgb = defaultMatrixRainProps.charRgb,
  fadeAmount = defaultMatrixRainProps.fadeAmount,
  fontSize = defaultMatrixRainProps.fontSize,
  fontFamily = defaultMatrixRainProps.fontFamily,
  fontWeight = defaultMatrixRainProps.fontWeight,
  glow = defaultMatrixRainProps.glow,
  charSwapFrames = defaultMatrixRainProps.charSwapFrames,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const columns = Math.floor(width / columnWidth);
  const drops = Array.from({ length: columns }).map((_, i) => ({
    x: i * columnWidth,
    y: random(i) * height,
    speed: random(i) * speedJitter + speedBase,
    char: characters[Math.floor(random(i) * characters.length)],
  }));

  return (
    <div
      style={{
        width,
        height,
        background,
        position: "relative",
      }}
    >
      {drops.map((drop, i) => {
        const y = (drop.y + frame * drop.speed) % height;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: drop.x,
              top: y,
              color: `rgba(${charRgb}, ${1 - (y / height) * fadeAmount})`,
              fontSize,
              fontFamily,
              fontWeight,
              textShadow: glow,
            }}
          >
            {characters[Math.floor((frame + i) / charSwapFrames) % characters.length]}
          </div>
        );
      })}
    </div>
  );
};

export default MatrixRain;
