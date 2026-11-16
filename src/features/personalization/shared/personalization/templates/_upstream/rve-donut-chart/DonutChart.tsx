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
// template id : rve-donut-chart
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/donut-chart.tsx
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
//   upstream line 16      export default function DonutChart() {
//                     ->  export const DonutChart: React.FC<DonutChartProps> = ({ ... }) => {
//   upstream lines 19-24  const segments = [ { label: "Completed", value: 40, color: "#4361ee" }, ... ]
//                     ->  prop `segments`           (default: the same four segments)
//   upstream line 35      the centre count-up target 78                 -> prop `centerValue`
//   upstream line 55      fontFamily: "Inter, system-ui, sans-serif"   -> prop `fontFamily`
//   upstream line 56      background: "linear-gradient(to bottom right, #111827, #1f2937)"
//                     ->  prop `background`         (same default)
//   upstream line 64      backgroundColor: "rgba(0, 0, 0, 0.2)"         -> prop `panelColor`
//   upstream line 66      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)"   -> prop `panelShadow`
//   upstream line 78      fontSize: "28px"                              -> prop `titleFontSize`
//   upstream line 80      color: "white"                                -> prop `titleColor`
//   upstream line 85      Completion Rate (title)                       -> prop `title`
//   upstream line 95      stroke="rgba(255,255,255,0.05)"               -> prop `trackColor`
//   upstream line 137     fill="white" (centre number)                  -> prop `centerValueColor`
//   upstream line 141     the "%" suffix after the centre number        -> prop `centerSuffix`
//   upstream line 150     fill="rgba(255,255,255,0.6)" (centre label)   -> prop `centerLabelColor`
//   upstream line 153     Completion Rate (centre label)                -> prop `centerLabel`
//   upstream line 198     color: "rgba(255,255,255,0.8)" (legend)       -> prop `legendColor`
//
// ADDED (not present upstream): `import React from "react";`, the
// `DonutChartSegment` / `DonutChartProps` types, `defaultDonutChartProps`
// (the upstream literals), the optional `titleWhiteSpace` prop (default
// `undefined`, upstream style unchanged) and a trailing
// `export default DonutChart;`.
//
// NOT TOUCHED: the ring geometry (cx 300, cy 230, r 120, stroke 20), the
// per-segment sweep timing, the count-up timing (frames 10-50), the legend
// fade, the 600 x 520 card and every other layout rule. This template uses no
// SVG ids.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export type DonutChartSegment = { label: string; value: number; color: string };

export type DonutChartProps = {
  /** Upstream: four segments "Completed" / "In Progress" / "Pending" / "Remaining". */
  segments?: DonutChartSegment[];
  /** Upstream literal: "Completion Rate". */
  title?: string;
  /** Target of the centre count-up. Upstream literal: 78. */
  centerValue?: number;
  /** Upstream literal: "%". */
  centerSuffix?: string;
  /** Upstream literal: "Completion Rate". */
  centerLabel?: string;
  /** Upstream literal: "Inter, system-ui, sans-serif". */
  fontFamily?: string;
  /** Canvas fill. Upstream literal: "linear-gradient(to bottom right, #111827, #1f2937)". */
  background?: string;
  /** Upstream literal: "rgba(0, 0, 0, 0.2)". */
  panelColor?: string;
  /** Upstream literal: "0 10px 30px rgba(0, 0, 0, 0.3)". */
  panelShadow?: string;
  /** Upstream literal: "rgba(255,255,255,0.05)". */
  trackColor?: string;
  /** Upstream literal: "white". */
  titleColor?: string;
  /** Upstream literal: "28px". */
  titleFontSize?: string;
  /** Upstream literal: "white". */
  centerValueColor?: string;
  /** Upstream literal: "rgba(255,255,255,0.6)". */
  centerLabelColor?: string;
  /** Upstream literal: "rgba(255,255,255,0.8)". */
  legendColor?: string;
  /** ADDED. Default `undefined` (upstream style unchanged). */
  titleWhiteSpace?: React.CSSProperties["whiteSpace"];
};

export const defaultDonutChartProps = {
  segments: [
    { label: "Completed", value: 40, color: "#4361ee" },
    { label: "In Progress", value: 25, color: "#7209b7" },
    { label: "Pending", value: 20, color: "#f72585" },
    { label: "Remaining", value: 15, color: "#4cc9f0" },
  ] as DonutChartSegment[],
  title: "Completion Rate",
  centerValue: 78,
  centerSuffix: "%",
  centerLabel: "Completion Rate",
  fontFamily: "Inter, system-ui, sans-serif",
  background: "linear-gradient(to bottom right, #111827, #1f2937)",
  panelColor: "rgba(0, 0, 0, 0.2)",
  panelShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
  trackColor: "rgba(255,255,255,0.05)",
  titleColor: "white",
  titleFontSize: "28px",
  centerValueColor: "white",
  centerLabelColor: "rgba(255,255,255,0.6)",
  legendColor: "rgba(255,255,255,0.8)",
};

export const DonutChart: React.FC<DonutChartProps> = ({
  segments = defaultDonutChartProps.segments,
  title = defaultDonutChartProps.title,
  centerValue: centerTarget = defaultDonutChartProps.centerValue,
  centerSuffix = defaultDonutChartProps.centerSuffix,
  centerLabel = defaultDonutChartProps.centerLabel,
  fontFamily = defaultDonutChartProps.fontFamily,
  background = defaultDonutChartProps.background,
  panelColor = defaultDonutChartProps.panelColor,
  panelShadow = defaultDonutChartProps.panelShadow,
  trackColor = defaultDonutChartProps.trackColor,
  titleColor = defaultDonutChartProps.titleColor,
  titleFontSize = defaultDonutChartProps.titleFontSize,
  centerValueColor = defaultDonutChartProps.centerValueColor,
  centerLabelColor = defaultDonutChartProps.centerLabelColor,
  legendColor = defaultDonutChartProps.legendColor,
  titleWhiteSpace,
}) => {
  const frame = useCurrentFrame();

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const cx = 300;
  const cy = 230;
  const radius = 120;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  // Center stat animation
  const centerValue = Math.round(
    interpolate(frame, [10, 50], [0, centerTarget], {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    })
  );

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

        <svg width={600} height={460} style={{ marginTop: "10px" }}>
          {/* Background ring */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />

          {/* Donut segments */}
          {segments.map((segment, i) => {
            const segmentLength = (segment.value / total) * circumference;
            const currentOffset = cumulativeOffset;
            cumulativeOffset += segmentLength;

            const segmentProgress = interpolate(
              frame,
              [i * 12, 20 + i * 12],
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
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${animatedLength} ${circumference - animatedLength}`}
                strokeDashoffset={-currentOffset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
          })}

          {/* Center number */}
          <text
            x={cx}
            y={cy - 5}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={centerValueColor}
            fontSize="48"
            fontWeight="bold"
          >
            {centerValue}{centerSuffix}
          </text>

          {/* Center label */}
          <text
            x={cx}
            y={cy + 30}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={centerLabelColor}
            fontSize="16"
          >
            {centerLabel}
          </text>
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
              [5 + i * 12, 15 + i * 12],
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
                  {segment.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DonutChart;
