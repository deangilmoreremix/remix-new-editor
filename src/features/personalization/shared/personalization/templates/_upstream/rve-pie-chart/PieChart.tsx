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
// template id : rve-pie-chart
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/pie-chart.tsx
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
//   upstream line 16      export default function PieChart() {
//                     ->  export const PieChart: React.FC<PieChartProps> = ({ ... }) => {
//   upstream lines 19-25  const segments = [ { label: "Product A", value: 35, color: "#4361ee" }, ... ]
//                     ->  prop `segments`           (default: the same five segments)
//   upstream line 47      fontFamily: "Inter, system-ui, sans-serif"   -> prop `fontFamily`
//   upstream line 48      background: "linear-gradient(to bottom right, #111827, #1f2937)"
//                     ->  prop `background`         (same default)
//   upstream line 56      backgroundColor: "rgba(0, 0, 0, 0.2)"         -> prop `panelColor`
//   upstream line 58      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)"   -> prop `panelShadow`
//   upstream line 70      fontSize: "28px"                              -> prop `titleFontSize`
//   upstream line 72      color: "white"                                -> prop `titleColor`
//   upstream line 77      Market Share                                  -> prop `title`
//   upstream line 113     fill="#111827" (centre disc)                  -> prop `centerColor`
//   upstream line 157     color: "rgba(255,255,255,0.8)" (legend)       -> prop `legendColor`
//
// ADDED (not present upstream): `import React from "react";`, the
// `PieChartSegment` / `PieChartProps` types, `defaultPieChartProps` (the
// upstream literals), the optional `titleWhiteSpace` prop (default
// `undefined`, upstream style unchanged) and a trailing
// `export default PieChart;`.
//
// NOT TOUCHED: the pie geometry (cx 300, cy 220, r 140, stroke 80, centre
// disc r 60), the per-segment sweep timing, the legend fade and its
// "label (value%)" format, the 600 x 520 card and every other layout rule.
// This template uses no SVG ids.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export type PieChartSegment = { label: string; value: number; color: string };

export type PieChartProps = {
  /** Upstream: five segments "Product A".."Product E". */
  segments?: PieChartSegment[];
  /** Upstream literal: "Market Share". */
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
  /** Centre disc fill. Upstream literal: "#111827". */
  centerColor?: string;
  /** Upstream literal: "rgba(255,255,255,0.8)". */
  legendColor?: string;
  /** ADDED. Default `undefined` (upstream style unchanged). */
  titleWhiteSpace?: React.CSSProperties["whiteSpace"];
};

export const defaultPieChartProps = {
  segments: [
    { label: "Product A", value: 35, color: "#4361ee" },
    { label: "Product B", value: 25, color: "#7209b7" },
    { label: "Product C", value: 20, color: "#f72585" },
    { label: "Product D", value: 12, color: "#4cc9f0" },
    { label: "Product E", value: 8, color: "#a855f7" },
  ] as PieChartSegment[],
  title: "Market Share",
  fontFamily: "Inter, system-ui, sans-serif",
  background: "linear-gradient(to bottom right, #111827, #1f2937)",
  panelColor: "rgba(0, 0, 0, 0.2)",
  panelShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
  titleColor: "white",
  titleFontSize: "28px",
  centerColor: "#111827",
  legendColor: "rgba(255,255,255,0.8)",
};

export const PieChart: React.FC<PieChartProps> = ({
  segments = defaultPieChartProps.segments,
  title = defaultPieChartProps.title,
  fontFamily = defaultPieChartProps.fontFamily,
  background = defaultPieChartProps.background,
  panelColor = defaultPieChartProps.panelColor,
  panelShadow = defaultPieChartProps.panelShadow,
  titleColor = defaultPieChartProps.titleColor,
  titleFontSize = defaultPieChartProps.titleFontSize,
  centerColor = defaultPieChartProps.centerColor,
  legendColor = defaultPieChartProps.legendColor,
  titleWhiteSpace,
}) => {
  const frame = useCurrentFrame();

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const cx = 300;
  const cy = 220;
  const radius = 140;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

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
          width: "600px",
          height: "520px",
          backgroundColor: panelColor,
          borderRadius: "16px",
          boxShadow: panelShadow,
          overflow: "hidden",
          padding: "20px",
        }}
      >
        {/* Title */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: titleFontSize,
            fontWeight: "bold",
            color: titleColor,
            textShadow: "0 2px 4px rgba(0,0,0,0.3)",
            letterSpacing: "-0.5px",
            whiteSpace: titleWhiteSpace,
          }}
        >
          {title}
        </div>

        <svg width={600} height={440} style={{ marginTop: "10px" }}>
          {/* Pie segments */}
          {segments.map((segment, i) => {
            const segmentLength = (segment.value / total) * circumference;
            const currentOffset = cumulativeOffset;
            cumulativeOffset += segmentLength;

            const segmentProgress = interpolate(
              frame,
              [i * 10, 15 + i * 10],
              [0, 1],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            );

            const animatedLength = segmentLength * segmentProgress;

            return (
              <circle
                key={`seg-${i}`}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="80"
                strokeDasharray={`${animatedLength} ${circumference - animatedLength}`}
                strokeDashoffset={-currentOffset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
          })}

          {/* Center circle for visual balance */}
          <circle cx={cx} cy={cy} r={60} fill={centerColor} />
        </svg>

        {/* Legend */}
        <div
          style={{
            position: "absolute",
            bottom: "25px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "20px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {segments.map((segment, i) => {
            const legendOpacity = interpolate(
              frame,
              [5 + i * 10, 15 + i * 10],
              [0, 1],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            );

            return (
              <div
                key={`legend-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  opacity: legendOpacity,
                }}
              >
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: segment.color,
                  }}
                />
                <span
                  style={{
                    color: legendColor,
                    fontSize: "13px",
                  }}
                >
                  {segment.label} ({segment.value}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PieChart;
