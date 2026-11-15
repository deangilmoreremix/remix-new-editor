// ---------------------------------------------------------------------------
// OPENHIGGSBOLT — Phase 4 upstream template, batch 3e (repo 2: remotion-templates)
// template id : rve-countdown-intro
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/countdown-intro.tsx
// credit      : The upstream file carries NO in-file credit header (it starts
//               at `"use client";`). The repository's credit applies: "Free
//               Remotion Template Component — Credit appreciated but not
//               required. Created by the team at https://www.reactvideoeditor.com"
//               (RVE_UPSTREAM_CREDIT in `templates/designs/rveSharedDesign.tsx`).
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
//   upstream line 5   export default function CountdownIntro() {
//                 ->  export const CountdownIntro: React.FC<CountdownIntroProps> = ({ ... }) => {
//   upstream line 9   const totalCountdownFrames = fps * 3;   -> fps * countFrom (default 3)
//   upstream line 12  Math.max(3 - …, 0)                 -> Math.max(countFrom - …, 0)
//   upstream line 18  2 * Math.PI * 70                   -> 2 * Math.PI * radius (default 70)
//   upstream line 41  backgroundColor: "#111827",        -> backgroundColor  (default "#111827")
//   upstream lines 48/50/51  180                         -> ringSize         (default 180)
//   upstream lines 55/56/64/65  cx/cy={90}               -> ringSize / 2     (= 90 by default)
//   upstream lines 57/66  r={70}                         -> radius
//   upstream line 59  stroke="#1e293b"                   -> trackColor       (default "#1e293b")
//   upstream lines 60/69  strokeWidth={6}                -> strokeWidth      (default 6)
//   upstream line 68  stroke="#3b82f6"                   -> ringColor        (default "#3b82f6")
//   upstream line 83  color: "white",                    -> numberColor      (default "white")
//   upstream line 84  fontSize: "4rem",                  -> numberFontSize   (default "4rem")
//   upstream lines 87/104  fontFamily: "Inter, sans-serif", -> fontFamily
//   upstream line 100 color: "#3b82f6",                  -> goColor          (default "#3b82f6")
//   upstream line 101 fontSize: "3.5rem",                -> goFontSize       (default "3.5rem")
//   upstream line 107 GO!                                -> {goText}         (default "GO!")
//
// ADDED (not present upstream): `import React from "react";`, the props type,
// the `defaultCountdownIntroProps` object, a trailing default export, and ONE
// optional style, `goWhiteSpace` (default `undefined` = not set, exactly as
// upstream). The closing word is absolutely positioned at the centre of the
// ring box, so a multi-word closing line would wrap at half the ring width;
// an adapter passes `"nowrap"` instead.
//
// NOT TOUCHED: the countdown arithmetic, the ring dash offset, the GO! spring
// (damping 8, stiffness 100) and its 5-frame fade, the -90deg rotation. The
// SVG declares NO `id`s, so several instances may share one composition.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export type CountdownIntroProps = {
  /** Upstream literal: "GO!". */
  goText?: string;
  /** Upstream literal: 3 (seconds counted down). */
  countFrom?: number;
  /** Upstream literal: "#111827". */
  backgroundColor?: string;
  /** Upstream literal: "#1e293b". */
  trackColor?: string;
  /** Upstream literal: "#3b82f6". */
  ringColor?: string;
  /** Upstream literal: "white". */
  numberColor?: string;
  /** Upstream literal: "#3b82f6". */
  goColor?: string;
  /** Upstream literal: "4rem". */
  numberFontSize?: string;
  /** Upstream literal: "3.5rem". */
  goFontSize?: string;
  /** Upstream literal: 180. */
  ringSize?: number;
  /** Upstream literal: 70. */
  radius?: number;
  /** Upstream literal: 6. */
  strokeWidth?: number;
  /** Upstream literal: "Inter, sans-serif". */
  fontFamily?: string;
  /** ADDED. Not set upstream. */
  goWhiteSpace?: React.CSSProperties["whiteSpace"];
};

export const defaultCountdownIntroProps: Required<Omit<CountdownIntroProps, "goWhiteSpace">> = {
  goText: "GO!",
  countFrom: 3,
  backgroundColor: "#111827",
  trackColor: "#1e293b",
  ringColor: "#3b82f6",
  numberColor: "white",
  goColor: "#3b82f6",
  numberFontSize: "4rem",
  goFontSize: "3.5rem",
  ringSize: 180,
  radius: 70,
  strokeWidth: 6,
  fontFamily: "Inter, sans-serif",
};

export const CountdownIntro: React.FC<CountdownIntroProps> = ({
  goText = defaultCountdownIntroProps.goText,
  countFrom = defaultCountdownIntroProps.countFrom,
  backgroundColor = defaultCountdownIntroProps.backgroundColor,
  trackColor = defaultCountdownIntroProps.trackColor,
  ringColor = defaultCountdownIntroProps.ringColor,
  numberColor = defaultCountdownIntroProps.numberColor,
  goColor = defaultCountdownIntroProps.goColor,
  numberFontSize = defaultCountdownIntroProps.numberFontSize,
  goFontSize = defaultCountdownIntroProps.goFontSize,
  ringSize = defaultCountdownIntroProps.ringSize,
  radius = defaultCountdownIntroProps.radius,
  strokeWidth = defaultCountdownIntroProps.strokeWidth,
  fontFamily = defaultCountdownIntroProps.fontFamily,
  goWhiteSpace,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalCountdownFrames = fps * countFrom;
  const secondFrames = fps;

  const currentSecond = Math.max(countFrom - Math.floor(frame / secondFrames), 0);
  const isCountdownDone = frame >= totalCountdownFrames;

  const frameInSecond = frame % secondFrames;
  const ringProgress = frameInSecond / secondFrames;

  const circumference = 2 * Math.PI * radius;
  const dashOffset = isCountdownDone ? circumference : circumference * ringProgress;

  const numberOpacity = isCountdownDone ? 0 : 1;

  const goScale = spring({
    frame: Math.max(frame - totalCountdownFrames, 0),
    fps,
    config: { damping: 8, stiffness: 100 },
  });

  const goOpacity = interpolate(
    frame,
    [totalCountdownFrames, totalCountdownFrames + 5],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const center = ringSize / 2;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", width: ringSize, height: ringSize }}>
        <svg
          width={ringSize}
          height={ringSize}
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          {!isCountdownDone && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          )}
        </svg>
        {!isCountdownDone && (
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: numberColor,
              fontSize: numberFontSize,
              fontWeight: 700,
              opacity: numberOpacity,
              fontFamily,
            }}
          >
            {currentSecond}
          </span>
        )}
        {isCountdownDone && (
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) scale(${goScale})`,
              color: goColor,
              fontSize: goFontSize,
              fontWeight: 800,
              opacity: goOpacity,
              fontFamily,
              ...(goWhiteSpace ? { whiteSpace: goWhiteSpace } : null),
            }}
          >
            {goText}
          </span>
        )}
      </div>
    </div>
  );
};

export default CountdownIntro;
