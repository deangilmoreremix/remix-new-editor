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
// template id : rve-area-chart
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/area-chart.tsx
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
// hard-coded data value, string, colour and chart dimension became an
// OPTIONAL prop whose default reproduces the upstream literal exactly.
// Rendering this component with no props reproduces the upstream design.
//
//   upstream line 16      export default function AreaChart() {
//                     ->  export const AreaChart: React.FC<AreaChartProps> = ({ ... }) => {
//   upstream lines 19-30  const data = [ { x: 0, y: 20, label: "Mon" }, ... ]
//                     ->  prop `data`               (default: the same ten points)
//   upstream line 32-34   chartWidth = 900 / chartHeight = 500 / padding = 70
//                     ->  props `chartWidth`, `chartHeight`, `padding` (same defaults)
//   upstream line 72      fontFamily: "Inter, system-ui, sans-serif"   -> prop `fontFamily`
//   upstream line 73      background: "linear-gradient(to bottom right, #111827, #1f2937)"
//                     ->  prop `background`         (same default)
//   upstream line 81      backgroundColor: "rgba(0, 0, 0, 0.2)"         -> prop `panelColor`
//   upstream line 83      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)"   -> prop `panelShadow`
//   upstream lines 92-93  stopColor="#4361ee" (x2)                      -> prop `areaColor`
//   upstream line 115     stroke="rgba(255,255,255,0.1)"                -> prop `gridColor`
//   upstream line 127     fill="rgba(255,255,255,0.6)"                  -> prop `yLabelColor`
//   upstream lines 140/148 stroke="rgba(255,255,255,0.2)"               -> prop `axisColor`
//   upstream line 159     fill="rgba(255,255,255,0.8)"                  -> prop `xLabelColor`
//   upstream lines 178/201 stroke="#4361ee" (line + point ring)         -> prop `lineColor`
//   upstream line 200     fill="white" (data points)                    -> prop `pointColor`
//   upstream line 216     fontSize: "28px"                              -> prop `titleFontSize`
//   upstream line 218     color: "white"                                -> prop `titleColor`
//   upstream line 223     Performance Metrics                           -> prop `title`
//
// ADDED (not present upstream): `import React from "react";`, the
// `AreaChartPoint` / `AreaChartProps` types, `defaultAreaChartProps` (the
// upstream literals), the optional `titleWhiteSpace` prop (default
// `undefined`, i.e. the upstream title style is unchanged; an adapter can set
// "nowrap" so a long title is truncated by the adapter instead of wrapping into
// the plot) and a trailing `export default AreaChart;`.
//
// NOT TOUCHED: the scales, the path construction, the reveal clip timing
// (frames 0-60) and the per-point stagger, every layout rule (radius, padding,
// title position, text shadow, letter spacing), the grid values 0/25/50/75/100,
// and the fixed SVG ids `areaGradient` and `revealClip` (two mounted instances
// would share them).
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export type AreaChartPoint = { x: number; y: number; label: string };

export type AreaChartProps = {
  /** The plotted points (y on a 0-100 scale). Upstream: ten points "Mon".."Wed". */
  data?: AreaChartPoint[];
  /** Upstream literal: "Performance Metrics". */
  title?: string;
  /** Upstream literal: 900. */
  chartWidth?: number;
  /** Upstream literal: 500. */
  chartHeight?: number;
  /** Upstream literal: 70. */
  padding?: number;
  /** Upstream literal: "Inter, system-ui, sans-serif". */
  fontFamily?: string;
  /** Canvas fill. Upstream literal: "linear-gradient(to bottom right, #111827, #1f2937)". */
  background?: string;
  /** Upstream literal: "rgba(0, 0, 0, 0.2)". */
  panelColor?: string;
  /** Upstream literal: "0 10px 30px rgba(0, 0, 0, 0.3)". */
  panelShadow?: string;
  /** Area gradient colour. Upstream literal: "#4361ee". */
  areaColor?: string;
  /** Line + point ring colour. Upstream literal: "#4361ee". */
  lineColor?: string;
  /** Data point fill. Upstream literal: "white". */
  pointColor?: string;
  /** Upstream literal: "rgba(255,255,255,0.1)". */
  gridColor?: string;
  /** Upstream literal: "rgba(255,255,255,0.2)". */
  axisColor?: string;
  /** Upstream literal: "rgba(255,255,255,0.6)". */
  yLabelColor?: string;
  /** Upstream literal: "rgba(255,255,255,0.8)". */
  xLabelColor?: string;
  /** Upstream literal: "white". */
  titleColor?: string;
  /** Upstream literal: "28px". */
  titleFontSize?: string;
  /** ADDED. Default `undefined` (upstream style unchanged). */
  titleWhiteSpace?: React.CSSProperties["whiteSpace"];
};

export const defaultAreaChartProps = {
  data: [
    { x: 0, y: 20, label: "Mon" },
    { x: 1, y: 45, label: "Tue" },
    { x: 2, y: 35, label: "Wed" },
    { x: 3, y: 60, label: "Thu" },
    { x: 4, y: 55, label: "Fri" },
    { x: 5, y: 75, label: "Sat" },
    { x: 6, y: 70, label: "Sun" },
    { x: 7, y: 85, label: "Mon" },
    { x: 8, y: 80, label: "Tue" },
    { x: 9, y: 95, label: "Wed" },
  ] as AreaChartPoint[],
  title: "Performance Metrics",
  chartWidth: 900,
  chartHeight: 500,
  padding: 70,
  fontFamily: "Inter, system-ui, sans-serif",
  background: "linear-gradient(to bottom right, #111827, #1f2937)",
  panelColor: "rgba(0, 0, 0, 0.2)",
  panelShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
  areaColor: "#4361ee",
  lineColor: "#4361ee",
  pointColor: "white",
  gridColor: "rgba(255,255,255,0.1)",
  axisColor: "rgba(255,255,255,0.2)",
  yLabelColor: "rgba(255,255,255,0.6)",
  xLabelColor: "rgba(255,255,255,0.8)",
  titleColor: "white",
  titleFontSize: "28px",
};

export const AreaChart: React.FC<AreaChartProps> = ({
  data = defaultAreaChartProps.data,
  title = defaultAreaChartProps.title,
  chartWidth = defaultAreaChartProps.chartWidth,
  chartHeight = defaultAreaChartProps.chartHeight,
  padding = defaultAreaChartProps.padding,
  fontFamily = defaultAreaChartProps.fontFamily,
  background = defaultAreaChartProps.background,
  panelColor = defaultAreaChartProps.panelColor,
  panelShadow = defaultAreaChartProps.panelShadow,
  areaColor = defaultAreaChartProps.areaColor,
  lineColor = defaultAreaChartProps.lineColor,
  pointColor = defaultAreaChartProps.pointColor,
  gridColor = defaultAreaChartProps.gridColor,
  axisColor = defaultAreaChartProps.axisColor,
  yLabelColor = defaultAreaChartProps.yLabelColor,
  xLabelColor = defaultAreaChartProps.xLabelColor,
  titleColor = defaultAreaChartProps.titleColor,
  titleFontSize = defaultAreaChartProps.titleFontSize,
  titleWhiteSpace,
}) => {
  const frame = useCurrentFrame();

  const xScale = (x: number) =>
    (x / (data.length - 1)) * (chartWidth - padding * 2) + padding;
  const yScale = (y: number) =>
    chartHeight - padding - (y / 100) * (chartHeight - padding * 2);

  // Build line path
  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(d.x)} ${yScale(d.y)}`)
    .join(" ");

  // Build area path (closed polygon)
  const areaPath =
    linePath +
    ` L ${xScale(data[data.length - 1].x)} ${chartHeight - padding}` +
    ` L ${xScale(data[0].x)} ${chartHeight - padding} Z`;

  // Clip rect animation - reveals left to right
  const clipWidth = interpolate(
    frame,
    [0, 60],
    [0, chartWidth - padding * 2],
    { extrapolateRight: "clamp" }
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
          width: `${chartWidth}px`,
          height: `${chartHeight}px`,
          backgroundColor: panelColor,
          borderRadius: "16px",
          boxShadow: panelShadow,
          overflow: "hidden",
          padding: "20px",
        }}
      >
        <svg width={chartWidth} height={chartHeight}>
          <defs>
            {/* Gradient fill for area */}
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={areaColor} stopOpacity="0.6" />
              <stop offset="100%" stopColor={areaColor} stopOpacity="0" />
            </linearGradient>

            {/* Clip path for reveal animation */}
            <clipPath id="revealClip">
              <rect
                x={padding}
                y={0}
                width={clipWidth}
                height={chartHeight}
              />
            </clipPath>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((val) => (
            <line
              key={`grid-${val}`}
              x1={padding}
              y1={yScale(val)}
              x2={chartWidth - padding}
              y2={yScale(val)}
              stroke={gridColor}
              strokeWidth="1"
            />
          ))}

          {/* Y-axis labels */}
          {[0, 25, 50, 75, 100].map((val) => (
            <text
              key={`y-${val}`}
              x={padding - 15}
              y={yScale(val) + 5}
              textAnchor="end"
              fill={yLabelColor}
              fontSize="12"
            >
              {val}
            </text>
          ))}

          {/* Axes */}
          <line
            x1={padding}
            y1={chartHeight - padding}
            x2={chartWidth - padding}
            y2={chartHeight - padding}
            stroke={axisColor}
            strokeWidth="2"
          />
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={chartHeight - padding}
            stroke={axisColor}
            strokeWidth="2"
          />

          {/* X-axis labels */}
          {data.map((point, i) => (
            <text
              key={`x-label-${i}`}
              x={xScale(point.x)}
              y={chartHeight - padding + 25}
              textAnchor="middle"
              fill={xLabelColor}
              fontSize="13"
              fontWeight="500"
            >
              {point.label}
            </text>
          ))}

          {/* Area fill with clip */}
          <path
            d={areaPath}
            fill="url(#areaGradient)"
            clipPath="url(#revealClip)"
          />

          {/* Line with clip */}
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath="url(#revealClip)"
          />

          {/* Data points */}
          {data.map((point, i) => {
            const pointProgress = interpolate(
              frame,
              [5 + i * 6, 10 + i * 6],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <circle
                key={`point-${i}`}
                cx={xScale(point.x)}
                cy={yScale(point.y)}
                r={4 * pointProgress}
                fill={pointColor}
                stroke={lineColor}
                strokeWidth="2"
                opacity={pointProgress}
              />
            );
          })}
        </svg>

        {/* Chart title */}
        <div
          style={{
            position: "absolute",
            top: "25px",
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
      </div>
    </div>
  );
};

export default AreaChart;
