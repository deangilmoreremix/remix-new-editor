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
// SMARTVIDEO GO AI — Phase 4 upstream template, batch 3f (repo 2: remotion-templates)
// template id : rve-geometric-patterns
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/geometric-patterns.tsx
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
//   upstream line 16      export default function GeometricPatterns() {
//                     ->  export const GeometricPatterns: React.FC<GeometricPatternsProps> = ({ ... }) => {
//   upstream line 20      Array.from({ length: 20 })                    -> prop `count`
//   upstream line 45      background: "linear-gradient(45deg, #0f172a, #1e293b)"
//                     ->  prop `background`         (same default)
//   upstream line 59      border: "2px solid rgba(255,255,255,0.1)"
//                     ->  border: `${strokeWidth} solid ${strokeColor}`
//                         (props `strokeWidth` "2px" and `strokeColor`
//                         "rgba(255,255,255,0.1)"; the default renders the
//                         identical declaration)
//
// ADDED (not present upstream): `import React from "react";`, the
// `GeometricPatternsProps` type, `defaultGeometricPatternsProps` (the
// upstream literals) and a trailing `export default GeometricPatterns;`.
//
// NOT TOUCHED: the two springs (their hard-coded `fps: 30`, `damping: 100`,
// the 0->360 rotation, the 0.5->1 scale and the 3-frame stagger), the
// `${index * 5}%` corner radius, the composition-sized root
// (`useVideoConfig()` width / height) and every layout rule. This template
// uses no SVG ids.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export type GeometricPatternsProps = {
  /** Number of nested outlines. Upstream literal: 20. */
  count?: number;
  /** Canvas fill. Upstream literal: "linear-gradient(45deg, #0f172a, #1e293b)". */
  background?: string;
  /** Outline width. Upstream literal: "2px". */
  strokeWidth?: string;
  /** Outline colour. Upstream literal: "rgba(255,255,255,0.1)". */
  strokeColor?: string;
};

export const defaultGeometricPatternsProps = {
  count: 20,
  background: "linear-gradient(45deg, #0f172a, #1e293b)",
  strokeWidth: "2px",
  strokeColor: "rgba(255,255,255,0.1)",
};

export const GeometricPatterns: React.FC<GeometricPatternsProps> = ({
  count = defaultGeometricPatternsProps.count,
  background = defaultGeometricPatternsProps.background,
  strokeWidth = defaultGeometricPatternsProps.strokeWidth,
  strokeColor = defaultGeometricPatternsProps.strokeColor,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const patterns = Array.from({ length: count }).map((_, i) => {
    const rotation = spring({
      frame: frame - i * 3,
      fps: 30,
      from: 0,
      to: 360,
      config: { damping: 100 },
    });

    const scale = spring({
      frame: frame - i * 3,
      fps: 30,
      from: 0.5,
      to: 1,
      config: { damping: 100 },
    });

    return { rotation, scale, index: i };
  });

  return (
    <div
      style={{
        width,
        height,
        background,
        overflow: "hidden",
      }}
    >
      {patterns.map(({ rotation, scale, index }) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "100%",
            height: "100%",
            transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
            border: `${strokeWidth} solid ${strokeColor}`,
            borderRadius: `${index * 5}%`,
          }}
        />
      ))}
    </div>
  );
};

export default GeometricPatterns;
