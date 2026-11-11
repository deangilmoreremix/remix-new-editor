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
// SMARTVIDEO GO AI — Phase 2 upstream template (repo 2: remotion-templates)
// template id : rve-slide-text
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/slide-text.tsx
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
// This file is EDITED. The upstream template has NO props surface at all, so
// every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal exactly. Rendering this component
// with no props reproduces the upstream design verbatim.
//
//   upstream line 16  export default function SlideText() {
//                 ->  export const SlideText: React.FC<SlideTextProps> = ({ ... }) => {
//                     (the four props below are destructured with the upstream
//                     literal as their default value)
//   upstream line 54  color: "white",
//                 ->  color,                             (default "white")
//   upstream line 55  fontSize: "4rem",
//                 ->  fontSize,                          (default "4rem")
//   upstream line 56  fontWeight: "bold",
//                 ->  fontWeight,                        (default "bold")
//   upstream line 59  Sliding Text!
//                 ->  {textValue}
//
// ADDED (not present upstream): `import React from "react";` (needed for the
// React.FC prop type), the `SlideTextProps` type, the
// `defaultSlideTextProps` object (the upstream literals) and a trailing
// `export default SlideText;`.
//
// NOT TOUCHED: the two springs (upstream lines 20-38 — the opacity spring's
// 30-frame duration and the slide spring's `from: 200`, `damping: 12`,
// `mass: 0.5` are byte-identical), the `translate(-50%, -50%) translateX(...)`
// transform (46) and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export type SlideTextProps = {
  /** The heading. Upstream literal: "Sliding Text!". */
  text?: string;
  /** The heading colour. Upstream literal: "white". */
  color?: string;
  /** The heading size. Upstream literal: "4rem". */
  fontSize?: string;
  /** The heading weight. Upstream literal: "bold". */
  fontWeight?: string;
};

export const defaultSlideTextProps: Required<SlideTextProps> = {
  text: "Sliding Text!",
  color: "white",
  fontSize: "4rem",
  fontWeight: "bold",
};

export const SlideText: React.FC<SlideTextProps> = ({
  text: textValue = defaultSlideTextProps.text,
  color = defaultSlideTextProps.color,
  fontSize = defaultSlideTextProps.fontSize,
  fontWeight = defaultSlideTextProps.fontWeight,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 30,
  });

  const slideX = spring({
    frame,
    fps,
    from: 200,
    to: 0,
    durationInFrames: 30,
    config: {
      damping: 12,
      mass: 0.5,
    },
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) translateX(${slideX}px)`,
        width: "100%",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          opacity,
          color,
          fontSize,
          fontWeight,
        }}
      >
        {textValue}
      </h1>
    </div>
  );
};

export default SlideText;
