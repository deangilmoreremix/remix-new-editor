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
// template id : rve-circular-progress
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/circular-progress.tsx
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
// every hard-coded colour and dimension became an OPTIONAL prop whose default
// reproduces the upstream literal exactly. Rendering this component with no
// props reproduces the upstream design verbatim.
//
//   upstream line 16  export default function CircularProgress() {
//                 ->  export const CircularProgress: React.FC<CircularProgressProps> = ({ ... }) => {
//                     (the six props below are destructured with the upstream
//                     literal as their default value)
//   upstream line 18  const { fps } = useVideoConfig();
//                 ->  useVideoConfig();                    (the upstream never
//                     uses `fps`; only the dead destructure was removed, the
//                     call itself is unchanged)
//   upstream line 73  stroke="rgba(255, 255, 255, 0.1)"
//                 ->  stroke={trackColor}                (default "rgba(255, 255, 255, 0.1)")
//   upstream line 108 stopColor="#3b82f6"
//                 ->  stopColor={progressFrom}           (default "#3b82f6")
//   upstream line 109 stopColor="#1e3a8a"
//                 ->  stopColor={progressTo}             (default "#1e3a8a")
//   upstream line 124 fill="#3b82f6"
//                 ->  fill={dotColor}                    (default "#3b82f6")
//   upstream line 134 fontSize: "3rem",
//                 ->  fontSize,                          (default "3rem")
//   upstream line 136 color: "white",
//                 ->  color: textColor,                  (default "white")
//
// ADDED (not present upstream): `import React from "react";` (needed for the
// React.FC prop type), the `CircularProgressProps` type, the
// `defaultCircularProgressProps` object (the upstream literals) and a trailing
// `export default CircularProgress;`.
//
// NOT TOUCHED: the progress VALUE (a time-driven loop, `interpolate(frame % 90,
// [0, 90], [0, 100])` at upstream lines 21-23 — it is a loading ring, not data),
// the rotation (26), the radius / circumference / dash offset (29-31), the
// pulse (34), every layout rule, the 300 px ring box, and the fixed SVG id
// `progressGradient` (102 — two mounted instances would share it).
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export type CircularProgressProps = {
  /** The unfilled ring's stroke. Upstream literal: "rgba(255, 255, 255, 0.1)". */
  trackColor?: string;
  /** The progress gradient's first stop. Upstream literal: "#3b82f6". */
  progressFrom?: string;
  /** The progress gradient's second stop. Upstream literal: "#1e3a8a". */
  progressTo?: string;
  /** The rotating dot's fill. Upstream literal: "#3b82f6". */
  dotColor?: string;
  /** The percentage label's colour. Upstream literal: "white". */
  textColor?: string;
  /** The percentage label's size. Upstream literal: "3rem". */
  fontSize?: string;
};

export const defaultCircularProgressProps: Required<CircularProgressProps> = {
  trackColor: "rgba(255, 255, 255, 0.1)",
  progressFrom: "#3b82f6",
  progressTo: "#1e3a8a",
  dotColor: "#3b82f6",
  textColor: "white",
  fontSize: "3rem",
};

export const CircularProgress: React.FC<CircularProgressProps> = ({
  trackColor = defaultCircularProgressProps.trackColor,
  progressFrom = defaultCircularProgressProps.progressFrom,
  progressTo = defaultCircularProgressProps.progressTo,
  dotColor = defaultCircularProgressProps.dotColor,
  textColor = defaultCircularProgressProps.textColor,
  fontSize = defaultCircularProgressProps.fontSize,
}) => {
  const frame = useCurrentFrame();
  // The upstream destructures `fps` here and never uses it; the call is kept
  // so the component still reads the composition context.
  useVideoConfig();

  // Calculate progress based on frame
  const progress = interpolate(frame % 90, [0, 90], [0, 100], {
    extrapolateRight: "clamp",
  });

  // Calculate rotation for the loading effect
  const rotation = (frame * 4) % 360;

  // Calculate radius and circumference
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Pulse effect
  const pulse = 1 + Math.sin(frame / 10) * 0.05;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "300px",
          height: "300px",
          transform: `scale(${pulse})`,
        }}
      >
        {/* Background circle */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 200 200"
          style={{
            position: "absolute",
            transform: "rotate(-90deg)",
          }}
        >
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth="12"
          />
        </svg>

        {/* Progress circle */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 200 200"
          style={{
            position: "absolute",
            transform: "rotate(-90deg)",
          }}
        >
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />

          <defs>
            <linearGradient
              id="progressGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor={progressFrom} />
              <stop offset="100%" stopColor={progressTo} />
            </linearGradient>
          </defs>
        </svg>

        {/* Rotating dots */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 200 200"
          style={{
            position: "absolute",
            transform: `rotate(${rotation}deg)`,
          }}
        >
          <circle cx="100" cy="20" r="8" fill={dotColor} />
        </svg>

        {/* Percentage text */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize,
            fontWeight: "bold",
            color: textColor,
          }}
        >
          {Math.round(progress)}%
        </div>
      </div>
    </div>
  );
};

export default CircularProgress;
