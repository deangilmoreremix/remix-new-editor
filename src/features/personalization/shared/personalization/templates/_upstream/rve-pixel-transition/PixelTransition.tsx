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
// OPENHIGGSBOLT — Phase 4 batch 3g upstream template (repo 2: remotion-templates)
// template id : rve-pixel-transition
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/pixel-transition.tsx
// license     : MIT License (README statement; no LICENSE file, no named
//               copyright holder). The verbatim MIT permission notice ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// Every hard-coded colour and dimension became an OPTIONAL prop whose default
// reproduces the upstream literal; no props = the upstream design.
//
//   export default function PixelTransition()
//     -> export const PixelTransition: React.FC<PixelTransitionProps>
//   const pixelSize = 20                       -> pixelSize      (default 20)
//   random(seed) * 60 (max per-pixel delay)    -> delaySpread    (default 60)
//   background: "#0f172a"                      -> background
//   hsl(hue 200..420, sat 70..100, light 40..60)
//                                             -> colors (default undefined = the
//      upstream hsl formula; when a palette is given each pixel picks
//      colors[floor(random(seed * 2) * colors.length)] — the same seeded draw
//      the upstream uses for the hue)
//   ADDED `mode` (default "appear" = upstream: each pixel shows once
//     frame > delay). "disappear" inverts the test (pixel shows while
//     frame <= delay), so a full mosaic dissolves away instead of building up.
//
// ADDED: `import React`, prop types, default object, trailing default export,
// and an explicit element type on the `pixels` array literal (the host
// tsconfig is non-strict, where a bare `[]` is inferred as `never[]`).
//
// NOT TOUCHED: the grid maths, the seeds (x * 1000 + y, *2, *3, *4) and the
// per-pixel inline styles (including the upstream `transition` declaration,
// which never fires because pixels mount/unmount rather than change opacity).
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { random, useCurrentFrame, useVideoConfig } from "remotion";

export type PixelTransitionProps = {
  /** Pixel edge, px. Upstream literal: 20. */
  pixelSize?: number;
  /** Maximum per-pixel delay, frames. Upstream literal: 60. */
  delaySpread?: number;
  /** Canvas fill. Upstream literal: "#0f172a". */
  background?: string;
  /** Pixel palette. Upstream: undefined (a seeded hsl colour per pixel). */
  colors?: string[];
  /** "appear" (upstream) or "disappear". */
  mode?: "appear" | "disappear";
};

export const defaultPixelTransitionProps = {
  pixelSize: 20,
  delaySpread: 60,
  background: "#0f172a",
  colors: undefined as string[] | undefined,
  mode: "appear" as const,
};

export const PixelTransition: React.FC<PixelTransitionProps> = ({
  pixelSize = defaultPixelTransitionProps.pixelSize,
  delaySpread = defaultPixelTransitionProps.delaySpread,
  background = defaultPixelTransitionProps.background,
  colors = defaultPixelTransitionProps.colors,
  mode = defaultPixelTransitionProps.mode,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Calculate grid dimensions
  const cols = Math.ceil(width / pixelSize);
  const rows = Math.ceil(height / pixelSize);

  // Create pixel grid
  const pixels: Array<{ x: number; y: number; color: string }> = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // Use random seed based on position for consistent randomness
      const seed = x * 1000 + y;

      // Random frame delay for each pixel
      const delay = Math.floor(random(seed) * delaySpread);

      // Determine if pixel should be visible based on frame
      const isVisible = mode === "disappear" ? frame <= delay : frame > delay;

      // Random color for each pixel
      let color: string;
      if (colors && colors.length > 0) {
        color = colors[Math.floor(random(seed * 2) * colors.length) % colors.length];
      } else {
        const hue = Math.floor(random(seed * 2) * 220) + 200;
        const saturation = 70 + Math.floor(random(seed * 3) * 30);
        const lightness = 40 + Math.floor(random(seed * 4) * 20);
        color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      }

      if (isVisible) {
        pixels.push({
          x: x * pixelSize,
          y: y * pixelSize,
          color,
        });
      }
    }
  }

  return (
    <div
      style={{
        width,
        height,
        background,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {pixels.map((pixel, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: pixel.x,
            top: pixel.y,
            width: pixelSize,
            height: pixelSize,
            backgroundColor: pixel.color,
            transition: "opacity 0.2s ease",
          }}
        />
      ))}
    </div>
  );
};

export default PixelTransition;
