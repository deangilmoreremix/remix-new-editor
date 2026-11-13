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
// template id : rve-liquid-wave
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/liquid-wave.tsx
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
//   upstream line 15  export default function LiquidWave() {
//                 ->  export const LiquidWave: React.FC<LiquidWaveProps> = ({ ... }) => {
//   upstream line 19  const numberOfPoints = 50;   -> `numberOfPoints` prop (default 50)
//   upstream line 22  Math.sin(frame / 20 + i / 5) * 50
//                 ->  Math.sin(frame / waveSpeed + i / phaseStep) * amplitude
//                     (defaults 20, 5, 50)
//   upstream line 23  const y = height / 2 + waveHeight;
//                 ->  height * baselineRatio + waveHeight  (default 0.5 — identical)
//   upstream line 28  style={{ background: "#111827" }} -> background (default "#111827")
//   upstream line 30  <linearGradient id="gradient" …> / fill="url(#gradient)"
//                 ->  id={gradientId} / fill={`url(#${gradientId})`} (default "gradient")
//                     The upstream id is document-global; the product adapter
//                     passes a per-instance id (React `useId`) so two waves —
//                     or another design that also uses id="gradient" — never
//                     resolve to each other's gradient.
//   upstream line 31  <stop offset="0%" stopColor="#1e3a8a" /> -> gradientStart
//   upstream line 32  <stop offset="100%" stopColor="#3b82f6" /> -> gradientEnd
//   upstream line 38  filter: "blur(10px)",    -> `blur(${blurPx}px)` (default 10)
//
// ADDED (not present upstream): `import React from "react";`, the prop
// types, `defaultLiquidWaveProps`, a trailing `export default`, and an
// OPTIONAL `pathOpacity` (default undefined = upstream fully opaque wave).
//
// NOT TOUCHED: the point generation, the closed path shape
// (`M 0,height … width,height Z`) and the horizontal gradient direction.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

export type LiquidWaveProps = {
  numberOfPoints?: number;
  waveSpeed?: number;
  phaseStep?: number;
  amplitude?: number;
  baselineRatio?: number;
  background?: string;
  gradientId?: string;
  gradientStart?: string;
  gradientEnd?: string;
  blurPx?: number;
  /** ADDED. */
  pathOpacity?: number;
};

export const defaultLiquidWaveProps = {
  numberOfPoints: 50,
  waveSpeed: 20,
  phaseStep: 5,
  amplitude: 50,
  baselineRatio: 0.5,
  background: "#111827",
  gradientId: "gradient",
  gradientStart: "#1e3a8a",
  gradientEnd: "#3b82f6",
  blurPx: 10,
};

export const LiquidWave: React.FC<LiquidWaveProps> = ({
  numberOfPoints = defaultLiquidWaveProps.numberOfPoints,
  waveSpeed = defaultLiquidWaveProps.waveSpeed,
  phaseStep = defaultLiquidWaveProps.phaseStep,
  amplitude = defaultLiquidWaveProps.amplitude,
  baselineRatio = defaultLiquidWaveProps.baselineRatio,
  background = defaultLiquidWaveProps.background,
  gradientId = defaultLiquidWaveProps.gradientId,
  gradientStart = defaultLiquidWaveProps.gradientStart,
  gradientEnd = defaultLiquidWaveProps.gradientEnd,
  blurPx = defaultLiquidWaveProps.blurPx,
  pathOpacity,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const points = Array.from({ length: numberOfPoints + 1 }).map((_, i) => {
    const x = (i / numberOfPoints) * width;
    const waveHeight = Math.sin(frame / waveSpeed + i / phaseStep) * amplitude;
    const y = height * baselineRatio + waveHeight;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} style={{ background }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={gradientStart} />
          <stop offset="100%" stopColor={gradientEnd} />
        </linearGradient>
      </defs>
      <path
        d={`M 0,${height} ${points.join(" ")} ${width},${height} Z`}
        fill={`url(#${gradientId})`}
        style={{
          filter: `blur(${blurPx}px)`,
          ...(pathOpacity !== undefined ? { opacity: pathOpacity } : null),
        }}
      />
    </svg>
  );
};

export default LiquidWave;
