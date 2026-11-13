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
// template id : rve-comparison-chart
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/comparison-chart.tsx
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
// hard-coded data value, string, colour and the bar box became an OPTIONAL
// prop whose default reproduces the upstream literal exactly. Rendering this
// component with no props reproduces the upstream design.
//
//   upstream line 16      export default function ComparisonChart() {
//                     ->  export const ComparisonChart: React.FC<ComparisonChartProps> = ({ ... }) => {
//   upstream line 19      const maxBarHeight = 280;                     -> prop `maxBarHeight`
//   upstream lines 23/28  the "before" target 34 (value + bar height)   -> prop `beforeValue`
//   upstream lines 35/40  the "after" target 89 (value + bar height)    -> prop `afterValue`
//   upstream line 68      fontFamily: "Inter, system-ui, sans-serif"   -> prop `fontFamily`
//   upstream line 69      background: "linear-gradient(to bottom right, #111827, #1f2937)"
//                     ->  prop `background`         (same default)
//   upstream line 77      backgroundColor: "rgba(0, 0, 0, 0.2)"         -> prop `panelColor`
//   upstream line 79      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)"   -> prop `panelShadow`
//   upstream line 86      fontSize: "28px"                              -> prop `titleFontSize`
//   upstream line 88      color: "white"                                -> prop `titleColor`
//   upstream line 95      Performance Comparison                        -> prop `title`
//   upstream lines 122/134 "#ef4444" (value + bar)                      -> prop `beforeColor`
//   upstream line 136     boxShadow: "0 0 20px rgba(239, 68, 68, 0.3)"  -> prop `beforeGlow`
//   upstream lines 126/183 the "%" suffix after each value               -> prop `valueSuffix`
//   upstream lines 145/202 color: "rgba(255,255,255,0.8)" (labels)      -> prop `labelColor`
//   upstream line 149     Before                                        -> prop `beforeLabel`
//   upstream line 158     backgroundColor: "rgba(255,255,255,0.2)"      -> prop `dividerColor`
//   upstream lines 179/191 "#4361ee" (value + bar)                      -> prop `afterColor`
//   upstream line 193     boxShadow: "0 0 20px rgba(67, 97, 238, 0.3)"  -> prop `afterGlow`
//   upstream line 206     After                                         -> prop `afterLabel`
//
// ADDED (not present upstream): `import React from "react";`, the
// `ComparisonChartProps` type, `defaultComparisonChartProps` (the upstream
// literals), the optional `titleWhiteSpace` prop (default `undefined`,
// upstream style unchanged) and a trailing `export default ComparisonChart;`.
//
// NOT TOUCHED: the count-up / grow timing (before 10-40, after 20-50), the
// divider animation, the 700 x 480 card, the 120 px bars and every other
// layout rule. This template uses no SVG ids.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export type ComparisonChartProps = {
  /** Upstream literal: "Performance Comparison". */
  title?: string;
  /** Upstream literal: "Before". */
  beforeLabel?: string;
  /** Upstream literal: "After". */
  afterLabel?: string;
  /** Target of the "before" count-up, 0-100. Upstream literal: 34. */
  beforeValue?: number;
  /** Target of the "after" count-up, 0-100. Upstream literal: 89. */
  afterValue?: number;
  /** Upstream literal: "%". */
  valueSuffix?: string;
  /** Upstream literal: 280. */
  maxBarHeight?: number;
  /** Upstream literal: "#ef4444". */
  beforeColor?: string;
  /** Upstream literal: "0 0 20px rgba(239, 68, 68, 0.3)". */
  beforeGlow?: string;
  /** Upstream literal: "#4361ee". */
  afterColor?: string;
  /** Upstream literal: "0 0 20px rgba(67, 97, 238, 0.3)". */
  afterGlow?: string;
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
  /** Upstream literal: "rgba(255,255,255,0.8)". */
  labelColor?: string;
  /** Upstream literal: "rgba(255,255,255,0.2)". */
  dividerColor?: string;
  /** ADDED. Default `undefined` (upstream style unchanged). */
  titleWhiteSpace?: React.CSSProperties["whiteSpace"];
};

export const defaultComparisonChartProps = {
  title: "Performance Comparison",
  beforeLabel: "Before",
  afterLabel: "After",
  beforeValue: 34,
  afterValue: 89,
  valueSuffix: "%",
  maxBarHeight: 280,
  beforeColor: "#ef4444",
  beforeGlow: "0 0 20px rgba(239, 68, 68, 0.3)",
  afterColor: "#4361ee",
  afterGlow: "0 0 20px rgba(67, 97, 238, 0.3)",
  fontFamily: "Inter, system-ui, sans-serif",
  background: "linear-gradient(to bottom right, #111827, #1f2937)",
  panelColor: "rgba(0, 0, 0, 0.2)",
  panelShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
  titleColor: "white",
  titleFontSize: "28px",
  labelColor: "rgba(255,255,255,0.8)",
  dividerColor: "rgba(255,255,255,0.2)",
};

export const ComparisonChart: React.FC<ComparisonChartProps> = ({
  title = defaultComparisonChartProps.title,
  beforeLabel = defaultComparisonChartProps.beforeLabel,
  afterLabel = defaultComparisonChartProps.afterLabel,
  beforeValue: beforeTarget = defaultComparisonChartProps.beforeValue,
  afterValue: afterTarget = defaultComparisonChartProps.afterValue,
  valueSuffix = defaultComparisonChartProps.valueSuffix,
  maxBarHeight = defaultComparisonChartProps.maxBarHeight,
  beforeColor = defaultComparisonChartProps.beforeColor,
  beforeGlow = defaultComparisonChartProps.beforeGlow,
  afterColor = defaultComparisonChartProps.afterColor,
  afterGlow = defaultComparisonChartProps.afterGlow,
  fontFamily = defaultComparisonChartProps.fontFamily,
  background = defaultComparisonChartProps.background,
  panelColor = defaultComparisonChartProps.panelColor,
  panelShadow = defaultComparisonChartProps.panelShadow,
  titleColor = defaultComparisonChartProps.titleColor,
  titleFontSize = defaultComparisonChartProps.titleFontSize,
  labelColor = defaultComparisonChartProps.labelColor,
  dividerColor = defaultComparisonChartProps.dividerColor,
  titleWhiteSpace,
}) => {
  const frame = useCurrentFrame();

  // Before value animation
  const beforeValue = Math.round(
    interpolate(frame, [10, 40], [0, beforeTarget], {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    })
  );

  const beforeBarHeight = interpolate(frame, [10, 40], [0, (beforeTarget / 100) * maxBarHeight], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // After value animation (starts slightly later)
  const afterValue = Math.round(
    interpolate(frame, [20, 50], [0, afterTarget], {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    })
  );

  const afterBarHeight = interpolate(frame, [20, 50], [0, (afterTarget / 100) * maxBarHeight], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Divider line animation
  const dividerOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const dividerHeight = interpolate(frame, [0, 20], [0, 350], {
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
          width: "700px",
          height: "480px",
          backgroundColor: panelColor,
          borderRadius: "16px",
          boxShadow: panelShadow,
          padding: "40px",
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
            textAlign: "center",
            marginBottom: "30px",
            whiteSpace: titleWhiteSpace,
          }}
        >
          {title}
        </div>

        {/* Comparison container */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            height: `${maxBarHeight + 80}px`,
            position: "relative",
          }}
        >
          {/* Before side */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
            }}
          >
            {/* Value */}
            <div
              style={{
                fontSize: "48px",
                fontWeight: "bold",
                color: beforeColor,
                marginBottom: "15px",
              }}
            >
              {beforeValue}{valueSuffix}
            </div>

            {/* Bar */}
            <div
              style={{
                width: "120px",
                height: `${beforeBarHeight}px`,
                backgroundColor: beforeColor,
                borderRadius: "8px 8px 0 0",
                boxShadow: beforeGlow,
              }}
            />

            {/* Label */}
            <div
              style={{
                fontSize: "20px",
                fontWeight: "600",
                color: labelColor,
                marginTop: "15px",
              }}
            >
              {beforeLabel}
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              width: "2px",
              height: `${dividerHeight}px`,
              backgroundColor: dividerColor,
              opacity: dividerOpacity,
              alignSelf: "center",
              margin: "0 30px",
            }}
          />

          {/* After side */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
            }}
          >
            {/* Value */}
            <div
              style={{
                fontSize: "48px",
                fontWeight: "bold",
                color: afterColor,
                marginBottom: "15px",
              }}
            >
              {afterValue}{valueSuffix}
            </div>

            {/* Bar */}
            <div
              style={{
                width: "120px",
                height: `${afterBarHeight}px`,
                backgroundColor: afterColor,
                borderRadius: "8px 8px 0 0",
                boxShadow: afterGlow,
              }}
            />

            {/* Label */}
            <div
              style={{
                fontSize: "20px",
                fontWeight: "600",
                color: labelColor,
                marginTop: "15px",
              }}
            >
              {afterLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonChart;
