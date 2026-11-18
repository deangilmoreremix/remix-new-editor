// NOTE: the upstream file `templates/gallery-grid.tsx` carries NO in-file
// credit header (unlike most files of the repository). The repository-wide
// React Video Editor credit is reproduced here so it travels with the copy:
/**
 * Free Remotion Template Component
 * ---------------------------------
 * This template is free to use in your projects!
 * Credit appreciated but not required.
 *
 * Created by the team at https://www.reactvideoeditor.com
 */

// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 batch 3h upstream template (repo 2: remotion-templates)
// template id : rve-gallery-grid
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/gallery-grid.tsx
// license     : MIT License. The upstream repository ships NO LICENSE file and
//               names NO copyright holder; its README states "All templates in
//               this repository are available under the MIT License." The
//               verbatim MIT permission notice (WITHOUT a copyright line)
//               ships with the design credit in
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
//   upstream line 5   export default function GalleryGrid() {
//                 ->  export const GalleryGrid: React.FC<GalleryGridProps> = ({ ... }) => {
//   upstream 9-16     const cells = [ ...six gradient/delay literals... ];
//                 ->  `cells` prop (default `defaultGalleryGridProps.cells`, the
//                     six upstream literals verbatim)
//   upstream line 23  backgroundColor: "#111827",
//                 ->  background,                       (default "#111827";
//                     the `backgroundColor` longhand became the `background`
//                     shorthand so a brand gradient can be passed — identical
//                     render for the solid default)
//   upstream line 28  padding: "2rem",     ->  padding    (default "2rem")
//   upstream line 34  gridTemplateColumns: "1fr 1fr 1fr", -> gridTemplateColumns
//   upstream line 35  gridTemplateRows: "1fr 1fr",        -> gridTemplateRows
//   upstream line 36  gap: "1rem",         ->  gap        (default "1rem")
//   upstream line 37  width: "90%",        ->  gridWidth  (default "90%")
//   upstream line 38  height: "80%",       ->  gridHeight (default "80%")
//   upstream line 55  borderRadius: "10px",->  borderRadius (default "10px")
//
// ADDED (not present upstream): `import React from "react";`, the
// `GalleryGridProps` / `GalleryGridCell` types, `defaultGalleryGridProps`,
// a trailing `export default GalleryGrid;`, and an OPTIONAL per-cell
// `content` node. When a cell has `content`, the cell also gets
// `position: relative; overflow: hidden` and the node is drawn filling it
// (the adapter puts the customer's brand photo, logo or brand placeholder
// there). A cell without `content` renders exactly as upstream.
//
// NOT TOUCHED: the spring (`damping: 12`, `stiffness: 100`), the per-cell
// delays, the `0.8 + s * 0.2` scale and the `opacity: s` fade.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, spring, useVideoConfig } from "remotion";

export type GalleryGridCell = {
  /** The tile fill. */
  gradient: string;
  /** Frames before the tile springs in. */
  delay: number;
  /** ADDED: optional node drawn filling the tile (brand photo/placeholder). */
  content?: React.ReactNode;
};

export type GalleryGridProps = {
  cells?: GalleryGridCell[];
  background?: string;
  padding?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gap?: string;
  gridWidth?: string;
  gridHeight?: string;
  borderRadius?: string;
};

export const defaultGalleryGridProps: Required<GalleryGridProps> = {
  cells: [
    { gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)", delay: 0 },
    { gradient: "linear-gradient(135deg, #a855f7, #7c3aed)", delay: 4 },
    { gradient: "linear-gradient(135deg, #4361ee, #3b82f6)", delay: 8 },
    { gradient: "linear-gradient(135deg, #7209b7, #a855f7)", delay: 12 },
    { gradient: "linear-gradient(135deg, #1d4ed8, #4361ee)", delay: 16 },
    { gradient: "linear-gradient(135deg, #7c3aed, #7209b7)", delay: 20 },
  ],
  background: "#111827",
  padding: "2rem",
  gridTemplateColumns: "1fr 1fr 1fr",
  gridTemplateRows: "1fr 1fr",
  gap: "1rem",
  gridWidth: "90%",
  gridHeight: "80%",
  borderRadius: "10px",
};

export const GalleryGrid: React.FC<GalleryGridProps> = ({
  cells = defaultGalleryGridProps.cells,
  background = defaultGalleryGridProps.background,
  padding = defaultGalleryGridProps.padding,
  gridTemplateColumns = defaultGalleryGridProps.gridTemplateColumns,
  gridTemplateRows = defaultGalleryGridProps.gridTemplateRows,
  gap = defaultGalleryGridProps.gap,
  gridWidth = defaultGalleryGridProps.gridWidth,
  gridHeight = defaultGalleryGridProps.gridHeight,
  borderRadius = defaultGalleryGridProps.borderRadius,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
        padding,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns,
          gridTemplateRows,
          gap,
          width: gridWidth,
          height: gridHeight,
        }}
      >
        {cells.map((cell, i) => {
          const s = spring({
            frame: Math.max(frame - cell.delay, 0),
            fps,
            config: { damping: 12, stiffness: 100 },
          });

          const scale = 0.8 + s * 0.2;
          const hasContent = cell.content !== undefined && cell.content !== null;

          return (
            <div
              key={i}
              style={{
                background: cell.gradient,
                borderRadius,
                transform: `scale(${scale})`,
                opacity: s,
                ...(hasContent ? { position: "relative" as const, overflow: "hidden" as const } : null),
              }}
            >
              {hasContent ? cell.content : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GalleryGrid;
