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
// template id : rve-chart-animation
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/chart-animation.tsx
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
//   upstream line 16      export default function ChartAnimation() {
//                     ->  export const ChartAnimation: React.FC<ChartAnimationProps> = ({ ... }) => {
//   upstream lines 20-31  const data = [ { x: 0, y: 50, label: "Jan" }, ... ]
//                     ->  prop `data`               (default: the same ten points)
//   upstream lines 34-45  const colors = [ "#4361ee", ... "#00b4d8" ]
//                     ->  prop `colors`             (default: the same ten colours)
//   upstream lines 48-50  chartWidth = 900 / chartHeight = 500 / padding = 60
//                     ->  props `chartWidth`, `chartHeight`, `padding` (same defaults)
//   upstream line 72      fontFamily: "Inter, system-ui, sans-serif"   -> prop `fontFamily`
//   upstream line 73      background: "linear-gradient(to bottom right, #111827, #1f2937)"
//                     ->  prop `background`         (same default)
//   upstream line 81      backgroundColor: "rgba(0, 0, 0, 0.2)"         -> prop `panelColor`
//   upstream line 83      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)"   -> prop `panelShadow`
//   upstream line 95      stroke="rgba(255, 255, 255, 0.2)"             -> prop `axisColor`
//   upstream line 106     fill="rgba(255, 255, 255, 0.8)"               -> prop `xLabelColor`
//   upstream line 145     fill="white" (bar value labels)               -> prop `valueColor`
//   upstream line 171     fontSize: "28px"                              -> prop `titleFontSize`
//   upstream line 173     color: "white"                                -> prop `titleColor`
//   upstream line 178     Monthly Performance                           -> prop `title`
//   upstream line 188     fontSize: "16px"                              -> prop `subtitleFontSize`
//   upstream line 189     color: "rgba(255, 255, 255, 0.7)"             -> prop `subtitleColor`
//   upstream line 193     Data visualization for 2023                   -> prop `subtitle`
//
// ADDED (not present upstream): `import React from "react";`, the
// `ChartAnimationPoint` / `ChartAnimationProps` types,
// `defaultChartAnimationProps` (the upstream literals), the optional
// `titleWhiteSpace` / `subtitleWhiteSpace` props (default `undefined`,
// upstream style unchanged) and a trailing `export default ChartAnimation;`.
//
// NOT TOUCHED: the scales, the bar width, the grow timing (bar i grows over
// frames 3i..15+3i), the value-label reveal, every layout rule, and the fixed
// SVG id `shadow` (the drop-shadow filter — two mounted instances would share
// it).
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export type ChartAnimationPoint = { x: number; y: number; label: string };

export type ChartAnimationProps = {
  /** The bars (y on a 0-100 scale). Upstream: ten bars "Jan".."Oct". */
  data?: ChartAnimationPoint[];
  /** Bar colours, rotated per bar. Upstream: ten colours. */
  colors?: string[];
  /** Upstream literal: "Monthly Performance". */
  title?: string;
  /** Upstream literal: "Data visualization for 2023". */
  subtitle?: string;
  /** Upstream literal: 900. */
  chartWidth?: number;
  /** Upstream literal: 500. */
  chartHeight?: number;
  /** Upstream literal: 60. */
  padding?: number;
  /** Upstream literal: "Inter, system-ui, sans-serif". */
  fontFamily?: string;
  /** Canvas fill. Upstream literal: "linear-gradient(to bottom right, #111827, #1f2937)". */
  background?: string;
  /** Upstream literal: "rgba(0, 0, 0, 0.2)". */
  panelColor?: string;
  /** Upstream literal: "0 10px 30px rgba(0, 0, 0, 0.3)". */
  panelShadow?: string;
  /** Upstream literal: "rgba(255, 255, 255, 0.2)". */
  axisColor?: string;
  /** Upstream literal: "rgba(255, 255, 255, 0.8)". */
  xLabelColor?: string;
  /** Upstream literal: "white". */
  valueColor?: string;
  /** Upstream literal: "white". */
  titleColor?: string;
  /** Upstream literal: "28px". */
  titleFontSize?: string;
  /** Upstream literal: "rgba(255, 255, 255, 0.7)". */
  subtitleColor?: string;
  /** Upstream literal: "16px". */
  subtitleFontSize?: string;
  /** ADDED. Default `undefined` (upstream style unchanged). */
  titleWhiteSpace?: React.CSSProperties["whiteSpace"];
  /** ADDED. Default `undefined` (upstream style unchanged). */
  subtitleWhiteSpace?: React.CSSProperties["whiteSpace"];
};

export const defaultChartAnimationProps = {
  data: [
    { x: 0, y: 50, label: "Jan" },
    { x: 1, y: 80, label: "Feb" },
    { x: 2, y: 30, label: "Mar" },
    { x: 3, y: 70, label: "Apr" },
    { x: 4, y: 45, label: "May" },
    { x: 5, y: 90, label: "Jun" },
    { x: 6, y: 60, label: "Jul" },
    { x: 7, y: 75, label: "Aug" },
    { x: 8, y: 40, label: "Sep" },
    { x: 9, y: 85, label: "Oct" },
  ] as ChartAnimationPoint[],
  colors: [
    "#4361ee",
    "#3a0ca3",
    "#7209b7",
    "#f72585",
    "#4cc9f0",
    "#4895ef",
    "#560bad",
    "#b5179e",
    "#f15bb5",
    "#00b4d8",
  ],
  title: "Monthly Performance",
  subtitle: "Data visualization for 2023",
  chartWidth: 900,
  chartHeight: 500,
  padding: 60,
  fontFamily: "Inter, system-ui, sans-serif",
  background: "linear-gradient(to bottom right, #111827, #1f2937)",
  panelColor: "rgba(0, 0, 0, 0.2)",
  panelShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
  axisColor: "rgba(255, 255, 255, 0.2)",
  xLabelColor: "rgba(255, 255, 255, 0.8)",
  valueColor: "white",
  titleColor: "white",
  titleFontSize: "28px",
  subtitleColor: "rgba(255, 255, 255, 0.7)",
  subtitleFontSize: "16px",
};

export const ChartAnimation: React.FC<ChartAnimationProps> = ({
  data = defaultChartAnimationProps.data,
  colors = defaultChartAnimationProps.colors,
  title = defaultChartAnimationProps.title,
  subtitle = defaultChartAnimationProps.subtitle,
  chartWidth = defaultChartAnimationProps.chartWidth,
  chartHeight = defaultChartAnimationProps.chartHeight,
  padding = defaultChartAnimationProps.padding,
  fontFamily = defaultChartAnimationProps.fontFamily,
  background = defaultChartAnimationProps.background,
  panelColor = defaultChartAnimationProps.panelColor,
  panelShadow = defaultChartAnimationProps.panelShadow,
  axisColor = defaultChartAnimationProps.axisColor,
  xLabelColor = defaultChartAnimationProps.xLabelColor,
  valueColor = defaultChartAnimationProps.valueColor,
  titleColor = defaultChartAnimationProps.titleColor,
  titleFontSize = defaultChartAnimationProps.titleFontSize,
  subtitleColor = defaultChartAnimationProps.subtitleColor,
  subtitleFontSize = defaultChartAnimationProps.subtitleFontSize,
  titleWhiteSpace,
  subtitleWhiteSpace,
}) => {
  const frame = useCurrentFrame();

  // Scale data to fit chart dimensions
  const xScale = (x: number) =>
    (x / (data.length - 1)) * (chartWidth - padding * 2) + padding;
  const yScale = (y: number) =>
    chartHeight - padding - (y / 100) * (chartHeight - padding * 2);

  const barWidth = ((chartWidth - padding * 2) / data.length) * 0.7;

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
          {/* X-axis line */}
          <line
            x1={padding}
            y1={chartHeight - padding}
            x2={chartWidth - padding}
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
              fontSize="14"
              fontWeight="500"
            >
              {point.label}
            </text>
          ))}

          {/* Bar chart with animation and different colors */}
          {data.map((point, i) => {
            const barHeight = (point.y / 100) * (chartHeight - padding * 2);

            // Animation that grows bars from bottom
            const barProgress = interpolate(
              frame,
              [i * 3, 15 + i * 3],
              [0, 1],
              { extrapolateRight: "clamp" }
            );

            const currentHeight = barHeight * barProgress;
            const currentY = chartHeight - padding - currentHeight;

            return (
              <g key={`bar-${i}`}>
                <rect
                  x={xScale(point.x) - barWidth / 2}
                  y={currentY}
                  width={barWidth}
                  height={currentHeight}
                  fill={colors[i % colors.length]}
                  rx="6"
                  ry="6"
                  filter="url(#shadow)"
                />
                <text
                  x={xScale(point.x)}
                  y={currentY - 10}
                  textAnchor="middle"
                  fill={valueColor}
                  fontSize="14"
                  fontWeight="bold"
                  opacity={barProgress > 0.9 ? 1 : 0}
                >
                  {point.y}
                </text>
              </g>
            );
          })}

          {/* Define shadow filter */}
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.3" />
            </filter>
          </defs>
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

        {/* Chart subtitle */}
        <div
          style={{
            position: "absolute",
            top: "60px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: subtitleFontSize,
            color: subtitleColor,
            textShadow: "0 1px 2px rgba(0,0,0,0.2)",
            whiteSpace: subtitleWhiteSpace,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
};

export default ChartAnimation;
