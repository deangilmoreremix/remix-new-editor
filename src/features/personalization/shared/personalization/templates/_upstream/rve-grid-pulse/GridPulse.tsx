// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 upstream template, batch 3f (repo 2: remotion-templates)
// template id : rve-grid-pulse
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/grid-pulse.tsx
// credit      : this upstream file carries NO in-file credit header (it starts
//               directly with "use client"). The repository-wide credit, used
//               by every other file in `remotion-templates`, is reproduced
//               here so it travels with the copy:
//               "Free Remotion Template Component — This template is free to
//               use in your projects! Credit appreciated but not required.
//               Created by the team at https://www.reactvideoeditor.com"
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
// This file is EDITED. The upstream template has NO props surface, so every
// hard-coded count, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal exactly. Rendering this component
// with no props reproduces the upstream design.
//
//   upstream line 5       export default function GridPulse() {
//                     ->  export const GridPulse: React.FC<GridPulseProps> = ({ ... }) => {
//   upstream line 9       const cols = 12;                              -> prop `cols`
//   upstream line 10      const rows = 8;                               -> prop `rows`
//   upstream line 11      const dotSize = 10;                           -> prop `dotSize`
//   upstream line 49      backgroundColor: "#111827"                    -> prop `background`
//   upstream line 64      backgroundColor: "#3b82f6"                    -> prop `dotColor`
//   upstream line 22      const dots = [];
//                     ->  const dots: GridPulseDot[] = [];   (type annotation only:
//                         this repo compiles with `strict: false`, where an
//                         unannotated `[]` is typed `never[]` and the upstream
//                         line does not type-check)
//
// ADDED (not present upstream): `import React from "react";`, the
// `GridPulseProps` / `GridPulseDot` types, `defaultGridPulseProps` (the upstream literals) and a
// trailing `export default GridPulse;`.
//
// NOT TOUCHED: the spacing (composition width / (cols + 1), height /
// (rows + 1)), the outward wave (`sin(t * 3 - distance * 0.8)`), the opacity
// (0.15-1) and scale (0.4-1) ranges and every layout rule. This template uses
// no SVG ids.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

/** ADDED: the element type of the upstream's untyped `dots` array. */
type GridPulseDot = { x: number; y: number; opacity: number; scale: number; key: number };

export type GridPulseProps = {
  /** Upstream literal: 12. */
  cols?: number;
  /** Upstream literal: 8. */
  rows?: number;
  /** Dot diameter in px. Upstream literal: 10. */
  dotSize?: number;
  /** Canvas fill. Upstream literal: "#111827". */
  background?: string;
  /** Upstream literal: "#3b82f6". */
  dotColor?: string;
};

export const defaultGridPulseProps = {
  cols: 12,
  rows: 8,
  dotSize: 10,
  background: "#111827",
  dotColor: "#3b82f6",
};

export const GridPulse: React.FC<GridPulseProps> = ({
  cols = defaultGridPulseProps.cols,
  rows = defaultGridPulseProps.rows,
  dotSize = defaultGridPulseProps.dotSize,
  background = defaultGridPulseProps.background,
  dotColor = defaultGridPulseProps.dotColor,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const spacingX = width / (cols + 1);
  const spacingY = height / (rows + 1);

  // Center of the grid
  const centerCol = (cols - 1) / 2;
  const centerRow = (rows - 1) / 2;

  const t = frame / fps;

  const dots: GridPulseDot[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = spacingX * (col + 1);
      const y = spacingY * (row + 1);

      // Distance from center in grid units
      const dx = col - centerCol;
      const dy = row - centerRow;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Wave: pulse travels outward from center
      const wave = Math.sin(t * 3 - distance * 0.8);
      const normalizedWave = wave * 0.5 + 0.5; // 0 to 1

      const opacity = 0.15 + normalizedWave * 0.85;
      const scale = 0.4 + normalizedWave * 0.6;

      dots.push({ x, y, opacity, scale, key: row * cols + col });
    }
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: background,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {dots.map((dot) => (
        <div
          key={dot.key}
          style={{
            position: "absolute",
            left: dot.x,
            top: dot.y,
            width: dotSize,
            height: dotSize,
            borderRadius: "50%",
            backgroundColor: dotColor,
            opacity: dot.opacity,
            transform: `translate(-50%, -50%) scale(${dot.scale})`,
          }}
        />
      ))}
    </div>
  );
};

export default GridPulse;
