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
// template id : rve-progress-bars
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/progress-bars.tsx
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
// hard-coded data value, string and colour became an OPTIONAL prop whose
// default reproduces the upstream literal exactly. Rendering this component
// with no props reproduces the upstream design.
//
//   upstream line 16      export default function ProgressBars() {
//                     ->  export const ProgressBars: React.FC<ProgressBarsProps> = ({ ... }) => {
//   upstream lines 19-25  const skills = [ { label: "React", value: 90, color: "#4361ee" }, ... ]
//                     ->  prop `skills`             (default: the same five rows)
//   upstream line 38      fontFamily: "Inter, system-ui, sans-serif"   -> prop `fontFamily`
//   upstream line 39      background: "linear-gradient(to bottom right, #111827, #1f2937)"
//                     ->  prop `background`         (same default)
//   upstream line 46      backgroundColor: "rgba(0, 0, 0, 0.2)"         -> prop `panelColor`
//   upstream line 48      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)"   -> prop `panelShadow`
//   upstream line 55      fontSize: "28px"                              -> prop `titleFontSize`
//   upstream line 57      color: "white" (title)                        -> prop `titleColor`
//   upstream line 64      Skills Overview                               -> prop `title`
//   upstream line 102     color: "white" (row label)                    -> prop `labelColor`
//   upstream line 111     color: "rgba(255,255,255,0.8)" (row value)    -> prop `valueColor`
//   upstream line 125     backgroundColor: "rgba(255,255,255,0.1)"      -> prop `trackColor`
//
// ADDED (not present upstream): `import React from "react";`, the
// `ProgressBarsItem` / `ProgressBarsProps` types, `defaultProgressBarsProps`
// (the upstream literals), the optional `titleWhiteSpace` prop (default
// `undefined`, upstream style unchanged) and a trailing
// `export default ProgressBars;`.
//
// NOT TOUCHED: the fill / fade timing (row i fills over frames 5+8i..25+8i),
// the glow (`${skill.color}40`), the 700 px card and every other layout rule.
// This template uses no SVG ids.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export type ProgressBarsItem = { label: string; value: number; color: string };

export type ProgressBarsProps = {
  /** Upstream: five rows "React" / "TypeScript" / "Node.js" / "Python" / "Go". */
  skills?: ProgressBarsItem[];
  /** Upstream literal: "Skills Overview". */
  title?: string;
  /** Upstream literal: "Inter, system-ui, sans-serif". */
  fontFamily?: string;
  /** Canvas fill. Upstream literal: "linear-gradient(to bottom right, #111827, #1f2937)". */
  background?: string;
  /** Upstream literal: "rgba(0, 0, 0, 0.2)". */
  panelColor?: string;
  /** Upstream literal: "0 10px 30px rgba(0, 0, 0, 0.3)". */
  panelShadow?: string;
  /** Upstream literal: "white". */
  titleColor?: string;
  /** Upstream literal: "28px". */
  titleFontSize?: string;
  /** Upstream literal: "white". */
  labelColor?: string;
  /** Upstream literal: "rgba(255,255,255,0.8)". */
  valueColor?: string;
  /** Upstream literal: "rgba(255,255,255,0.1)". */
  trackColor?: string;
  /** ADDED. Default `undefined` (upstream style unchanged). */
  titleWhiteSpace?: React.CSSProperties["whiteSpace"];
};

export const defaultProgressBarsProps = {
  skills: [
    { label: "React", value: 90, color: "#4361ee" },
    { label: "TypeScript", value: 85, color: "#7209b7" },
    { label: "Node.js", value: 75, color: "#f72585" },
    { label: "Python", value: 60, color: "#4cc9f0" },
    { label: "Go", value: 45, color: "#a855f7" },
  ] as ProgressBarsItem[],
  title: "Skills Overview",
  fontFamily: "Inter, system-ui, sans-serif",
  background: "linear-gradient(to bottom right, #111827, #1f2937)",
  panelColor: "rgba(0, 0, 0, 0.2)",
  panelShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
  titleColor: "white",
  titleFontSize: "28px",
  labelColor: "white",
  valueColor: "rgba(255,255,255,0.8)",
  trackColor: "rgba(255,255,255,0.1)",
};

export const ProgressBars: React.FC<ProgressBarsProps> = ({
  skills = defaultProgressBarsProps.skills,
  title = defaultProgressBarsProps.title,
  fontFamily = defaultProgressBarsProps.fontFamily,
  background = defaultProgressBarsProps.background,
  panelColor = defaultProgressBarsProps.panelColor,
  panelShadow = defaultProgressBarsProps.panelShadow,
  titleColor = defaultProgressBarsProps.titleColor,
  titleFontSize = defaultProgressBarsProps.titleFontSize,
  labelColor = defaultProgressBarsProps.labelColor,
  valueColor = defaultProgressBarsProps.valueColor,
  trackColor = defaultProgressBarsProps.trackColor,
  titleWhiteSpace,
}) => {
  const frame = useCurrentFrame();

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
        fontFamily,
        background,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "700px",
          backgroundColor: panelColor,
          borderRadius: "16px",
          boxShadow: panelShadow,
          padding: "40px 50px",
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: titleFontSize,
            fontWeight: "bold",
            color: titleColor,
            textShadow: "0 2px 4px rgba(0,0,0,0.3)",
            letterSpacing: "-0.5px",
            marginBottom: "35px",
            textAlign: "center",
            whiteSpace: titleWhiteSpace,
          }}
        >
          {title}
        </div>

        {/* Bars */}
        {skills.map((skill, i) => {
          const barProgress = interpolate(
            frame,
            [5 + i * 8, 25 + i * 8],
            [0, skill.value],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          );

          const labelOpacity = interpolate(
            frame,
            [i * 8, 5 + i * 8],
            [0, 1],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          );

          return (
            <div
              key={`skill-${i}`}
              style={{
                marginBottom: i < skills.length - 1 ? "22px" : "0",
                opacity: labelOpacity,
              }}
            >
              {/* Label row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    color: labelColor,
                    fontSize: "16px",
                    fontWeight: "600",
                  }}
                >
                  {skill.label}
                </span>
                <span
                  style={{
                    color: valueColor,
                    fontSize: "16px",
                    fontWeight: "500",
                  }}
                >
                  {Math.round(barProgress)}%
                </span>
              </div>

              {/* Bar track */}
              <div
                style={{
                  width: "100%",
                  height: "14px",
                  backgroundColor: trackColor,
                  borderRadius: "7px",
                  overflow: "hidden",
                }}
              >
                {/* Bar fill */}
                <div
                  style={{
                    width: `${barProgress}%`,
                    height: "100%",
                    backgroundColor: skill.color,
                    borderRadius: "7px",
                    boxShadow: `0 0 10px ${skill.color}40`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressBars;
