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
// OPENHIGGSBOLT — Phase 4 upstream template, batch 3e (repo 2: remotion-templates)
// template id : rve-lower-third
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/lower-third.tsx
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
// This file is EDITED. Every hard-coded string, colour and dimension became
// an OPTIONAL prop whose default reproduces the upstream literal exactly.
// Rendering this component with no props reproduces the upstream design.
//
//   upstream line 16  export default function LowerThird() {
//                 ->  export const LowerThird: React.FC<LowerThirdProps> = ({ ... }) => {
//   upstream line 60  background: "linear-gradient(180deg, #111827 0%, #1f2937 100%)",
//                 ->  background                         (default identical)
//   upstream line 66  bottom: "20%",                     -> bottom           (default "20%")
//   upstream line 67  left: 40,                          -> left             (default 40)
//   upstream line 72  width: 200,                        -> accentWidth      (default 200)
//   upstream line 73  height: 3,                         -> accentHeight     (default 3)
//   upstream line 74  background: "linear-gradient(90deg, #3b82f6, #4361ee)",
//                 ->  `linear-gradient(90deg, ${accentFrom}, ${accentTo})`
//                     (defaults "#3b82f6" / "#4361ee")
//   upstream line 77  marginBottom: 4,                   -> accentGap        (default 4)
//   upstream line 89  width: 4,                          -> barWidth         (default 4)
//   upstream line 90  background: "#3b82f6",             -> barColor         (default "#3b82f6")
//   upstream line 96  background: "rgba(0, 0, 0, 0.7)",  -> panelBackground  (default identical)
//   upstream line 97  padding: "16px 32px",              -> panelPadding     (default identical)
//   upstream line 103 color: "white",                    -> nameColor        (default "white")
//   upstream line 104 fontSize: "1.6rem",                -> nameFontSize     (default "1.6rem")
//   upstream line 110 John Smith                         -> {name}
//   upstream line 114 color: "rgba(255, 255, 255, 0.7)", -> titleColor       (default identical)
//   upstream line 115 fontSize: "1rem",                  -> titleFontSize    (default "1rem")
//   upstream line 118 marginTop: 4,                      -> titleGap         (default 4)
//   upstream line 122 Senior Producer                    -> {title}
//
// ADDED (not present upstream): `import React from "react";`, the props type,
// the `defaultLowerThirdProps` object and a trailing default export.
//
//   upstream line 23  from: -300,                        -> from: -accentTravel (default 300)
//   upstream line 35  from: -400,                        -> from: -barTravel (default 400)
//
// NOT TOUCHED: the three springs' timing (lines 20-50: durations, damping,
// mass and delays), the corner radii, the weights and the letter spacing.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export type LowerThirdProps = {
  /** Upstream literal: "John Smith". */
  name?: string;
  /** Upstream literal: "Senior Producer". */
  title?: string;
  /** Upstream literal: "linear-gradient(180deg, #111827 0%, #1f2937 100%)". */
  background?: string;
  /** Upstream literal: "#3b82f6". */
  accentFrom?: string;
  /** Upstream literal: "#4361ee". */
  accentTo?: string;
  /** Upstream literal: "#3b82f6". */
  barColor?: string;
  /** Upstream literal: "rgba(0, 0, 0, 0.7)". */
  panelBackground?: string;
  /** Upstream literal: "white". */
  nameColor?: string;
  /** Upstream literal: "rgba(255, 255, 255, 0.7)". */
  titleColor?: string;
  /** Upstream literal: "1.6rem". */
  nameFontSize?: string;
  /** Upstream literal: "1rem". */
  titleFontSize?: string;
  /** Upstream literal: "16px 32px". */
  panelPadding?: string;
  /** Upstream literal: "20%". */
  bottom?: string;
  /** Upstream literal: 40. */
  left?: number;
  /** Upstream literal: 200. */
  accentWidth?: number;
  /** Upstream literal: 3. */
  accentHeight?: number;
  /** Upstream literal: 4. */
  accentGap?: number;
  /** Upstream literal: 4. */
  barWidth?: number;
  /** Upstream literal: 4. */
  titleGap?: number;
  /** Upstream literal: 300 (px the accent line slides in from). */
  accentTravel?: number;
  /** Upstream literal: 400 (px the name panel slides in from). */
  barTravel?: number;
};

export const defaultLowerThirdProps: Required<LowerThirdProps> = {
  name: "John Smith",
  title: "Senior Producer",
  background: "linear-gradient(180deg, #111827 0%, #1f2937 100%)",
  accentFrom: "#3b82f6",
  accentTo: "#4361ee",
  barColor: "#3b82f6",
  panelBackground: "rgba(0, 0, 0, 0.7)",
  nameColor: "white",
  titleColor: "rgba(255, 255, 255, 0.7)",
  nameFontSize: "1.6rem",
  titleFontSize: "1rem",
  panelPadding: "16px 32px",
  bottom: "20%",
  left: 40,
  accentWidth: 200,
  accentHeight: 3,
  accentGap: 4,
  barWidth: 4,
  titleGap: 4,
  accentTravel: 300,
  barTravel: 400,
};

export const LowerThird: React.FC<LowerThirdProps> = ({
  name = defaultLowerThirdProps.name,
  title = defaultLowerThirdProps.title,
  background = defaultLowerThirdProps.background,
  accentFrom = defaultLowerThirdProps.accentFrom,
  accentTo = defaultLowerThirdProps.accentTo,
  barColor = defaultLowerThirdProps.barColor,
  panelBackground = defaultLowerThirdProps.panelBackground,
  nameColor = defaultLowerThirdProps.nameColor,
  titleColor = defaultLowerThirdProps.titleColor,
  nameFontSize = defaultLowerThirdProps.nameFontSize,
  titleFontSize = defaultLowerThirdProps.titleFontSize,
  panelPadding = defaultLowerThirdProps.panelPadding,
  bottom = defaultLowerThirdProps.bottom,
  left = defaultLowerThirdProps.left,
  accentWidth = defaultLowerThirdProps.accentWidth,
  accentHeight = defaultLowerThirdProps.accentHeight,
  accentGap = defaultLowerThirdProps.accentGap,
  barWidth = defaultLowerThirdProps.barWidth,
  titleGap = defaultLowerThirdProps.titleGap,
  accentTravel = defaultLowerThirdProps.accentTravel,
  barTravel = defaultLowerThirdProps.barTravel,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const accentSlide = spring({
    frame,
    fps,
    from: -accentTravel,
    to: 0,
    durationInFrames: 25,
    config: {
      damping: 15,
      mass: 0.6,
    },
  });

  const barSlide = spring({
    frame: Math.max(0, frame - 5),
    fps,
    from: -barTravel,
    to: 0,
    durationInFrames: 30,
    config: {
      damping: 14,
      mass: 0.7,
    },
  });

  const textOpacity = spring({
    frame: Math.max(0, frame - 15),
    fps,
    from: 0,
    to: 1,
    durationInFrames: 20,
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background,
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom,
          left,
        }}
      >
        <div
          style={{
            width: accentWidth,
            height: accentHeight,
            background: `linear-gradient(90deg, ${accentFrom}, ${accentTo})`,
            transform: `translateX(${accentSlide}px)`,
            borderRadius: 2,
            marginBottom: accentGap,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            transform: `translateX(${barSlide}px)`,
          }}
        >
          <div
            style={{
              width: barWidth,
              background: barColor,
              borderRadius: "2px 0 0 2px",
            }}
          />
          <div
            style={{
              background: panelBackground,
              padding: panelPadding,
              borderRadius: "0 4px 4px 0",
            }}
          >
            <div
              style={{
                color: nameColor,
                fontSize: nameFontSize,
                fontWeight: "bold",
                opacity: textOpacity,
                letterSpacing: "0.02em",
              }}
            >
              {name}
            </div>
            <div
              style={{
                color: titleColor,
                fontSize: titleFontSize,
                fontWeight: 300,
                opacity: textOpacity,
                marginTop: titleGap,
                letterSpacing: "0.05em",
              }}
            >
              {title}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LowerThird;
