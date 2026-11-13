// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 upstream template, batch 3f (repo 2: remotion-templates)
// template id : rve-gradient-shift
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/gradient-shift.tsx
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
// This file is EDITED. The upstream template has NO props surface, so the
// hard-coded palette became an OPTIONAL prop whose default reproduces the
// upstream literal exactly. Rendering this component with no props reproduces
// the upstream design.
//
//   upstream line 5       export default function GradientShift() {
//                     ->  export const GradientShift: React.FC<GradientShiftProps> = ({ ... }) => {
//   upstream line 7       const { width, height, fps } = useVideoConfig();
//                     ->  const { fps } = useVideoConfig();   (`width` / `height`
//                         were never used upstream; only the dead destructure
//                         was removed, the call is unchanged)
//   upstream lines 17-22  const colors = [ { r: 26, g: 26, b: 46 }, ... ]
//                     ->  prop `colors`             (default: the same four stops)
//   upstream lines 30/36/42  `rgb(${r}, ${g}, ${b})` colour strings
//                     ->  built by the local `toCss(r, g, b)` helper, which
//                         returns the IDENTICAL `rgb(r, g, b)` string while
//                         `alpha` is 1 (the default) and `rgba(r, g, b, alpha)`
//                         otherwise
//
// ADDED (not present upstream): `import React from "react";`, the
// `GradientShiftStop` / `GradientShiftProps` types,
// `defaultGradientShiftProps` (the upstream literals), the optional `alpha`
// prop (default 1 — fully opaque, as upstream; an overlay adapter lowers it so
// the gradient becomes a translucent colour wash over the customer's video),
// the `toCss` helper and a trailing `export default GradientShift;`.
//
// NOT TOUCHED: the phase maths (`sin(t * 0.3 + k)`), the palette walk (index /
// fraction / lerp), the rotating angle (`frame * 0.5`), and the single
// full-size div. The palette MUST keep at least four stops, because the
// upstream walk reads `colors[idx + 1]` for idx up to 2 (the phase reaches 1
// exactly at the sine peak). This template uses no SVG ids.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

export type GradientShiftStop = { r: number; g: number; b: number };

export type GradientShiftProps = {
  /** Palette walked by the three phases. Upstream: #1a1a2e, #16213e, #0f3460, #1a1a2e. */
  colors?: GradientShiftStop[];
  /** ADDED. Opacity of the gradient colours, 0-1. Default 1 (as upstream). */
  alpha?: number;
};

export const defaultGradientShiftProps = {
  colors: [
    { r: 26, g: 26, b: 46 },   // #1a1a2e
    { r: 22, g: 33, b: 62 },   // #16213e
    { r: 15, g: 52, b: 96 },   // #0f3460
    { r: 26, g: 26, b: 46 },   // #1a1a2e
  ] as GradientShiftStop[],
  alpha: 1,
};

export const GradientShift: React.FC<GradientShiftProps> = ({
  colors = defaultGradientShiftProps.colors,
  alpha = defaultGradientShiftProps.alpha,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = frame / fps;

  // Slowly cycle through hue phases using sin waves
  const phase1 = Math.sin(t * 0.3) * 0.5 + 0.5;
  const phase2 = Math.sin(t * 0.3 + 2) * 0.5 + 0.5;
  const phase3 = Math.sin(t * 0.3 + 4) * 0.5 + 0.5;

  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

  // ADDED: identical to the upstream `rgb(...)` string while alpha is 1.
  const toCss = (r: number, g: number, b: number) =>
    alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;

  const idx1 = Math.floor(phase1 * 2);
  const frac1 = phase1 * 2 - idx1;
  const c1 = colors[idx1];
  const c1Next = colors[idx1 + 1];
  const color1 = toCss(lerp(c1.r, c1Next.r, frac1), lerp(c1.g, c1Next.g, frac1), lerp(c1.b, c1Next.b, frac1));

  const idx2 = Math.floor(phase2 * 2);
  const frac2 = phase2 * 2 - idx2;
  const c2 = colors[idx2];
  const c2Next = colors[idx2 + 1];
  const color2 = toCss(lerp(c2.r, c2Next.r, frac2), lerp(c2.g, c2Next.g, frac2), lerp(c2.b, c2Next.b, frac2));

  const idx3 = Math.floor(phase3 * 2);
  const frac3 = phase3 * 2 - idx3;
  const c3 = colors[idx3];
  const c3Next = colors[idx3 + 1];
  const color3 = toCss(lerp(c3.r, c3Next.r, frac3), lerp(c3.g, c3Next.g, frac3), lerp(c3.b, c3Next.b, frac3));

  // Slowly rotate the gradient angle
  const angle = (frame * 0.5) % 360;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `linear-gradient(${angle}deg, ${color1}, ${color2}, ${color3})`,
      }}
    />
  );
};

export default GradientShift;
