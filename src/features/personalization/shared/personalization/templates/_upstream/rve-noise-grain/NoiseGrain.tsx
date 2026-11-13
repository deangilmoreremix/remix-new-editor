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
// template id : rve-noise-grain
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/noise-grain.tsx
// license     : MIT License (README statement; no LICENSE file, no named
//               copyright holder). The verbatim MIT permission notice ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// Every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal; no props = the upstream design.
//
//   export default function NoiseGrain()
//     -> export const NoiseGrain: React.FC<NoiseGrainProps>
//   const cellSize = 8                         -> cellSize      (default 8)
//   sample background
//     "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)"
//                                             -> background (null = the sample
//                                                background div is not rendered)
//   "Film Grain Overlay" / "white" / "2.5rem" / "bold"
//                                             -> title / titleColor / titleFontSize /
//                                                titleFontWeight
//   "Subtle noise texture effect" / "#93c5fd" / "1.1rem" / "0.5rem"
//                                             -> subtitle / subtitleColor /
//                                                subtitleFontSize / subtitleMarginTop
//   ADDED `showSample` (default true): false drops the sample text block so
//     only the grain remains.
//   rect fill "white"                          -> grainColor
//   opacity 0.02 + noise * 0.06                -> grainMinOpacity (0.02) /
//                                                grainOpacityRange (0.06)
//
// ADDED: `import React`, prop types, default object, trailing default export,
// and an explicit element type on the `grainCells` array literal (the host
// tsconfig is non-strict, where a bare `[]` is inferred as `never[]`).
//
// NOT TOUCHED: the deterministic pseudo-random ((index * 1237 + f * 7919) %
// 997) / 997, the grid maths, the SVG viewBox and preserveAspectRatio.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

export type NoiseGrainProps = {
  cellSize?: number;
  /** Sample background; null drops the sample background layer. */
  background?: string | null;
  showSample?: boolean;
  title?: string;
  titleColor?: string;
  titleFontSize?: string;
  titleFontWeight?: string;
  subtitle?: string;
  subtitleColor?: string;
  subtitleFontSize?: string;
  subtitleMarginTop?: string;
  grainColor?: string;
  grainMinOpacity?: number;
  grainOpacityRange?: number;
};

export const defaultNoiseGrainProps = {
  cellSize: 8,
  background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" as string | null,
  showSample: true,
  title: "Film Grain Overlay",
  titleColor: "white",
  titleFontSize: "2.5rem",
  titleFontWeight: "bold",
  subtitle: "Subtle noise texture effect",
  subtitleColor: "#93c5fd",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
  grainColor: "white",
  grainMinOpacity: 0.02,
  grainOpacityRange: 0.06,
};

export const NoiseGrain: React.FC<NoiseGrainProps> = ({
  cellSize = defaultNoiseGrainProps.cellSize,
  background = defaultNoiseGrainProps.background,
  showSample = defaultNoiseGrainProps.showSample,
  title = defaultNoiseGrainProps.title,
  titleColor = defaultNoiseGrainProps.titleColor,
  titleFontSize = defaultNoiseGrainProps.titleFontSize,
  titleFontWeight = defaultNoiseGrainProps.titleFontWeight,
  subtitle = defaultNoiseGrainProps.subtitle,
  subtitleColor = defaultNoiseGrainProps.subtitleColor,
  subtitleFontSize = defaultNoiseGrainProps.subtitleFontSize,
  subtitleMarginTop = defaultNoiseGrainProps.subtitleMarginTop,
  grainColor = defaultNoiseGrainProps.grainColor,
  grainMinOpacity = defaultNoiseGrainProps.grainMinOpacity,
  grainOpacityRange = defaultNoiseGrainProps.grainOpacityRange,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);

  // Deterministic pseudo-random based on index and frame
  const pseudoRandom = (index: number, f: number) => {
    const val = ((index * 1237 + f * 7919) % 997) / 997;
    return val;
  };

  // Build grain cells
  const grainCells: Array<{ col: number; row: number; opacity: number; key: number }> = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const noise = pseudoRandom(index, frame);
      // Opacity between 0.02 and 0.08
      const opacity = grainMinOpacity + noise * grainOpacityRange;
      grainCells.push({ col, row, opacity, key: index });
    }
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Sample gradient background */}
      {background !== null && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background,
          }}
        />
      )}
      {/* Centered sample text */}
      {showSample && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1,
          }}
        >
          <h2
            style={{
              color: titleColor,
              fontSize: titleFontSize,
              fontWeight: titleFontWeight,
              margin: 0,
            }}
          >
            {title}
          </h2>
          <p style={{ color: subtitleColor, fontSize: subtitleFontSize, marginTop: subtitleMarginTop }}>
            {subtitle}
          </p>
        </div>
      )}
      {/* Grain overlay using SVG for performance */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 2,
          pointerEvents: "none",
        }}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        {grainCells.map((cell) => (
          <rect
            key={cell.key}
            x={cell.col * cellSize}
            y={cell.row * cellSize}
            width={cellSize}
            height={cellSize}
            fill={grainColor}
            opacity={cell.opacity}
          />
        ))}
      </svg>
    </div>
  );
};

export default NoiseGrain;
