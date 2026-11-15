// NOTE: the upstream file `templates/masonry-gallery.tsx` carries NO in-file
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
// template id : rve-masonry-gallery
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/masonry-gallery.tsx
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
//   upstream line 5   export default function MasonryGallery() {
//                 ->  export const MasonryGallery: React.FC<MasonryGalleryProps> = ({ ... }) => {
//   upstream 9-16     const blocks = [ ...six col/height/gradient/delay literals... ];
//                 ->  `blocks` prop (default: the six upstream literals)
//   upstream line 18  const columns: typeof blocks[] = [[], [], []];
//                 ->  `columnCount` empty columns (default 3)
//   upstream line 25  backgroundColor: "#111827", -> background (default "#111827";
//                     longhand → shorthand so a brand gradient can be passed)
//   upstream line 30  padding: "2rem",      ->  padding      (default "2rem")
//   upstream 36/48    gap: "1rem",          ->  gap          (default "1rem")
//   upstream line 37  width: "90%",         ->  galleryWidth (default "90%")
//   upstream line 38  height: "85%",        ->  galleryHeight (default "85%")
//   upstream line 66  borderRadius: "10px", ->  borderRadius (default "10px")
//
// ADDED (not present upstream): `import React from "react";`, the prop
// types, `defaultMasonryGalleryProps`, a trailing `export default`, and an
// OPTIONAL per-block `content` node. A block with `content` also gets
// `position: relative; overflow: hidden` and draws the node filling it (the
// adapter puts the brand photo, logo or brand placeholder there). A block
// without `content` renders exactly as upstream. A block whose `col` is
// outside `0..columnCount-1` is skipped instead of throwing.
//
// NOT TOUCHED: the spring (`damping: 12`, `stiffness: 100`), the per-block
// delays, the `0.8 + s * 0.2` scale and the `opacity: s` fade.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, spring, useVideoConfig } from "remotion";

export type MasonryGalleryBlock = {
  col: number;
  height: string;
  gradient: string;
  delay: number;
  /** ADDED: optional node drawn filling the block. */
  content?: React.ReactNode;
};

export type MasonryGalleryProps = {
  blocks?: MasonryGalleryBlock[];
  columnCount?: number;
  background?: string;
  padding?: string;
  gap?: string;
  galleryWidth?: string;
  galleryHeight?: string;
  borderRadius?: string;
};

export const defaultMasonryGalleryProps = {
  blocks: [
    { col: 0, height: "45%", gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)", delay: 0 },
    { col: 0, height: "50%", gradient: "linear-gradient(135deg, #a855f7, #7c3aed)", delay: 6 },
    { col: 1, height: "55%", gradient: "linear-gradient(135deg, #4361ee, #3b82f6)", delay: 3 },
    { col: 1, height: "40%", gradient: "linear-gradient(135deg, #7209b7, #a855f7)", delay: 9 },
    { col: 2, height: "40%", gradient: "linear-gradient(135deg, #1d4ed8, #4361ee)", delay: 5 },
    { col: 2, height: "55%", gradient: "linear-gradient(135deg, #7c3aed, #7209b7)", delay: 11 },
  ] as MasonryGalleryBlock[],
  columnCount: 3,
  background: "#111827",
  padding: "2rem",
  gap: "1rem",
  galleryWidth: "90%",
  galleryHeight: "85%",
  borderRadius: "10px",
};

export const MasonryGallery: React.FC<MasonryGalleryProps> = ({
  blocks = defaultMasonryGalleryProps.blocks,
  columnCount = defaultMasonryGalleryProps.columnCount,
  background = defaultMasonryGalleryProps.background,
  padding = defaultMasonryGalleryProps.padding,
  gap = defaultMasonryGalleryProps.gap,
  galleryWidth = defaultMasonryGalleryProps.galleryWidth,
  galleryHeight = defaultMasonryGalleryProps.galleryHeight,
  borderRadius = defaultMasonryGalleryProps.borderRadius,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const columns: MasonryGalleryBlock[][] = Array.from({ length: columnCount }, () => []);
  blocks.forEach((block) => columns[block.col]?.push(block));

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
          display: "flex",
          gap,
          width: galleryWidth,
          height: galleryHeight,
        }}
      >
        {columns.map((col, colIdx) => (
          <div
            key={colIdx}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap,
            }}
          >
            {col.map((block, blockIdx) => {
              const s = spring({
                frame: Math.max(frame - block.delay, 0),
                fps,
                config: { damping: 12, stiffness: 100 },
              });
              const scale = 0.8 + s * 0.2;
              const hasContent = block.content !== undefined && block.content !== null;

              return (
                <div
                  key={blockIdx}
                  style={{
                    height: block.height,
                    background: block.gradient,
                    borderRadius,
                    transform: `scale(${scale})`,
                    opacity: s,
                    ...(hasContent ? { position: "relative" as const, overflow: "hidden" as const } : null),
                  }}
                >
                  {hasContent ? block.content : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MasonryGallery;
