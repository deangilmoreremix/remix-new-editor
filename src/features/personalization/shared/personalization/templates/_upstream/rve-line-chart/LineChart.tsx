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
// template id : rve-line-chart
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/line-chart.tsx
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
//   upstream line 16      export default function LineChart() {
//                     ->  export const LineChart: React.FC<LineChartProps> = ({ ... }) => {
//   upstream lines 19-30  const data = [ { x: 0, y: 25, label: "Jan" }, ... ]
//                     ->  prop `data`               (default: the same ten points)
//   upstream lines 32-34  chartWidth = 900 / chartHeight = 500 / padding = 70
//                     ->  props `chartWidth`, `chartHeight`, `padding` (same defaults)
//   upstream line 69      fontFamily: "Inter, system-ui, sans-serif"   -> prop `fontFamily`
//   upstream line 70      background: "linear-gradient(to bottom right, #111827, #1f2937)"
//                     ->  prop `background`         (same default)
//   upstream line 78      backgroundColor: "rgba(0, 0, 0, 0.2)"         -> prop `panelColor`
//   upstream line 80      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)"   -> prop `panelShadow`
//   upstream line 94      stroke="rgba(255,255,255,0.1)"                -> prop `gridColor`
//   upstream line 106     fill="rgba(255,255,255,0.6)"                  -> prop `yLabelColor`
//   upstream lines 119/129 stroke="rgba(255,255,255,0.2)"               -> prop `axisColor`
//   upstream line 140     fill="rgba(255,255,255,0.8)"                  -> prop `xLabelColor`
//   upstream line 152     stroke="#4361ee"                              -> prop `lineColor`
//   upstream line 175     fill="#f72585"                                -> prop `pointColor`
//   upstream line 176     stroke="white"                                -> prop `pointStroke`
//   upstream line 191     fontSize: "28px"                              -> prop `titleFontSize`
//   upstream line 193     color: "white"                                -> prop `titleColor`
//   upstream line 198     Revenue Growth                                -> prop `title`
//
// ADDED (not present upstream): `import React from "react";`, the
// `LineChartPoint` / `LineChartProps` types, `defaultLineChartProps` (the
// upstream literals), the optional `titleWhiteSpace` prop (default
// `undefined`, upstream style unchanged) and a trailing
// `export default LineChart;`.
//
// NOT TOUCHED: the scales, the polyline length approximation, the draw timing
// (frames 0-60), the per-point stagger, every layout rule and the grid values.
// This template uses no SVG ids.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export type LineChartPoint = { x: number; y: number; label: string };

export type LineChartProps = {
  /** The plotted points (y on a 0-100 scale). Upstream: ten points "Jan".."Oct". */
  data?: LineChartPoint[];
  /** Upstream literal: "Revenue Growth". */
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
  /** Upstream literal: "#4361ee". */
  lineColor?: string;
  /** Upstream literal: "#f72585". */
  pointColor?: string;
  /** Upstream literal: "white". */
  pointStroke?: string;
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

export const defaultLineChartProps = {
  data: [
    { x: 0, y: 25, label: "Jan" },
    { x: 1, y: 40, label: "Feb" },
    { x: 2, y: 35, label: "Mar" },
    { x: 3, y: 55, label: "Apr" },
    { x: 4, y: 50, label: "May" },
    { x: 5, y: 70, label: "Jun" },
    { x: 6, y: 65, label: "Jul" },
    { x: 7, y: 80, label: "Aug" },
    { x: 8, y: 75, label: "Sep" },
    { x: 9, y: 90, label: "Oct" },
  ] as LineChartPoint[],
  title: "Revenue Growth",
  chartWidth: 900,
  chartHeight: 500,
  padding: 70,
  fontFamily: "Inter, system-ui, sans-serif",
  background: "linear-gradient(to bottom right, #111827, #1f2937)",
  panelColor: "rgba(0, 0, 0, 0.2)",
  panelShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
  lineColor: "#4361ee",
  pointColor: "#f72585",
  pointStroke: "white",
  gridColor: "rgba(255,255,255,0.1)",
  axisColor: "rgba(255,255,255,0.2)",
  yLabelColor: "rgba(255,255,255,0.6)",
  xLabelColor: "rgba(255,255,255,0.8)",
  titleColor: "white",
  titleFontSize: "28px",
};

export const LineChart: React.FC<LineChartProps> = ({
  data = defaultLineChartProps.data,
  title = defaultLineChartProps.title,
  chartWidth = defaultLineChartProps.chartWidth,
  chartHeight = defaultLineChartProps.chartHeight,
  padding = defaultLineChartProps.padding,
  fontFamily = defaultLineChartProps.fontFamily,
  background = defaultLineChartProps.background,
  panelColor = defaultLineChartProps.panelColor,
  panelShadow = defaultLineChartProps.panelShadow,
  lineColor = defaultLineChartProps.lineColor,
  pointColor = defaultLineChartProps.pointColor,
  pointStroke = defaultLineChartProps.pointStroke,
  gridColor = defaultLineChartProps.gridColor,
  axisColor = defaultLineChartProps.axisColor,
  yLabelColor = defaultLineChartProps.yLabelColor,
  xLabelColor = defaultLineChartProps.xLabelColor,
  titleColor = defaultLineChartProps.titleColor,
  titleFontSize = defaultLineChartProps.titleFontSize,
  titleWhiteSpace,
}) => {
  const frame = useCurrentFrame();

  const xScale = (x: number) =>
    (x / (data.length - 1)) * (chartWidth - padding * 2) + padding;
  const yScale = (y: number) =>
    chartHeight - padding - (y / 100) * (chartHeight - padding * 2);

  // Build polyline points
  const points = data.map((d) => `${xScale(d.x)},${yScale(d.y)}`).join(" ");

  // Calculate total polyline length (approximate)
  let totalLength = 0;
  for (let i = 1; i < data.length; i++) {
    const dx = xScale(data[i].x) - xScale(data[i - 1].x);
    const dy = yScale(data[i].y) - yScale(data[i - 1].y);
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }

  // Animate line drawing
  const dashOffset = interpolate(frame, [0, 60], [totalLength, 0], {
    extrapolateRight: "clamp",
  });

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

          {/* X-axis line */}
          <line
            x1={padding}
            y1={chartHeight - padding}
            x2={chartWidth - padding}
            y2={chartHeight - padding}
            stroke={axisColor}
            strokeWidth="2"
          />

          {/* Y-axis line */}
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

          {/* Animated polyline */}
          <polyline
            points={points}
            fill="none"
            stroke={lineColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={totalLength}
            strokeDashoffset={dashOffset}
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
                r={5 * pointProgress}
                fill={pointColor}
                stroke={pointStroke}
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

export default LineChart;
