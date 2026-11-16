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
// template id : rve-stat-counter
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/stat-counter.tsx
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
// hard-coded data value, string, colour and type size became an OPTIONAL prop
// whose default reproduces the upstream literal exactly. Rendering this
// component with no props reproduces the upstream design.
//
//   upstream line 16      export default function StatCounter() {
//                     ->  export const StatCounter: React.FC<StatCounterProps> = ({ ... }) => {
//   upstream line 29      the count-up target 1247                      -> prop `countTo`
//   upstream line 52      fontFamily: "Inter, system-ui, sans-serif"   -> prop `fontFamily`
//   upstream line 53      background: "linear-gradient(to bottom right, #111827, #1f2937)"
//                     ->  prop `background`         (same default)
//   upstream line 59      backgroundColor: "rgba(0, 0, 0, 0.2)"         -> prop `panelColor`
//   upstream line 61      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)"   -> prop `panelShadow`
//   upstream line 70      fontSize: "96px"                              -> prop `numberFontSize`
//   upstream line 72      color: "white" (number)                       -> prop `numberColor`
//   upstream line 78      {count.toLocaleString()}
//                     ->  {count.toLocaleString(locale)}{countSuffix}
//                         (`locale` defaults to `undefined`, which is exactly the
//                         upstream call; `countSuffix` defaults to "")
//   upstream line 84      fontSize: "24px" (label)                      -> prop `labelFontSize`
//   upstream line 85      color: "rgba(255,255,255,0.7)" (label)        -> prop `labelColor`
//   upstream line 91      Total Users                                   -> prop `label`
//   upstream line 113     color: "#22c55e" (highlight)                  -> prop `highlightColor`
//   upstream line 118     ↑ 12.5%                                       -> prop `highlight`
//   upstream line 130     color: "rgba(255,255,255,0.5)" (caption)      -> prop `captionColor`
//   upstream line 135     This Month                                    -> prop `caption`
//
// ADDED (not present upstream): `import React from "react";`, the
// `StatCounterProps` type, `defaultStatCounterProps` (the upstream literals),
// the optional `countSuffix` ("" by default), `locale` (`undefined` by
// default — an adapter pins "en-US" so the digit grouping does not depend on
// the machine the export runs on) and `labelWhiteSpace` (`undefined` by
// default, upstream style unchanged) props, and a trailing
// `export default StatCounter;`.
//
// NOT TOUCHED: the entrance spring, the count-up timing (frames 10-60), the
// sub-stat fade (40-55), the card padding and every other layout rule. This
// template uses no SVG ids.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type StatCounterProps = {
  /** Count-up target. Upstream literal: 1247. */
  countTo?: number;
  /** ADDED. Text after the number. Default "". */
  countSuffix?: string;
  /** ADDED. Locale for the digit grouping. Default `undefined` (as upstream). */
  locale?: string;
  /** Upstream literal: "Total Users". */
  label?: string;
  /** Upstream literal: "↑ 12.5%". */
  highlight?: string;
  /** Upstream literal: "This Month". */
  caption?: string;
  /** Upstream literal: "Inter, system-ui, sans-serif". */
  fontFamily?: string;
  /** Canvas fill. Upstream literal: "linear-gradient(to bottom right, #111827, #1f2937)". */
  background?: string;
  /** Upstream literal: "rgba(0, 0, 0, 0.2)". */
  panelColor?: string;
  /** Upstream literal: "0 10px 30px rgba(0, 0, 0, 0.3)". */
  panelShadow?: string;
  /** Upstream literal: "white". */
  numberColor?: string;
  /** Upstream literal: "96px". */
  numberFontSize?: string;
  /** Upstream literal: "rgba(255,255,255,0.7)". */
  labelColor?: string;
  /** Upstream literal: "24px". */
  labelFontSize?: string;
  /** Upstream literal: "#22c55e". */
  highlightColor?: string;
  /** Upstream literal: "rgba(255,255,255,0.5)". */
  captionColor?: string;
  /** ADDED. Default `undefined` (upstream style unchanged). */
  labelWhiteSpace?: React.CSSProperties["whiteSpace"];
};

export const defaultStatCounterProps = {
  countTo: 1247,
  countSuffix: "",
  label: "Total Users",
  highlight: "↑ 12.5%",
  caption: "This Month",
  fontFamily: "Inter, system-ui, sans-serif",
  background: "linear-gradient(to bottom right, #111827, #1f2937)",
  panelColor: "rgba(0, 0, 0, 0.2)",
  panelShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
  numberColor: "white",
  numberFontSize: "96px",
  labelColor: "rgba(255,255,255,0.7)",
  labelFontSize: "24px",
  highlightColor: "#22c55e",
  captionColor: "rgba(255,255,255,0.5)",
};

export const StatCounter: React.FC<StatCounterProps> = ({
  countTo = defaultStatCounterProps.countTo,
  countSuffix = defaultStatCounterProps.countSuffix,
  locale,
  label = defaultStatCounterProps.label,
  highlight = defaultStatCounterProps.highlight,
  caption = defaultStatCounterProps.caption,
  fontFamily = defaultStatCounterProps.fontFamily,
  background = defaultStatCounterProps.background,
  panelColor = defaultStatCounterProps.panelColor,
  panelShadow = defaultStatCounterProps.panelShadow,
  numberColor = defaultStatCounterProps.numberColor,
  numberFontSize = defaultStatCounterProps.numberFontSize,
  labelColor = defaultStatCounterProps.labelColor,
  labelFontSize = defaultStatCounterProps.labelFontSize,
  highlightColor = defaultStatCounterProps.highlightColor,
  captionColor = defaultStatCounterProps.captionColor,
  labelWhiteSpace,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring entrance
  const scaleSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // Count up animation
  const count = Math.round(
    interpolate(frame, [10, 60], [0, countTo], {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    })
  );

  const subStatsOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
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
          backgroundColor: panelColor,
          borderRadius: "16px",
          boxShadow: panelShadow,
          padding: "60px 80px",
          textAlign: "center",
          transform: `scale(${scaleSpring})`,
        }}
      >
        {/* Main number */}
        <div
          style={{
            fontSize: numberFontSize,
            fontWeight: "bold",
            color: numberColor,
            textShadow: "0 4px 8px rgba(0,0,0,0.3)",
            letterSpacing: "-2px",
            lineHeight: "1",
          }}
        >
          {count.toLocaleString(locale)}{countSuffix}
        </div>

        {/* Label */}
        <div
          style={{
            fontSize: labelFontSize,
            color: labelColor,
            marginTop: "12px",
            fontWeight: "500",
            letterSpacing: "1px",
            whiteSpace: labelWhiteSpace,
          }}
        >
          {label}
        </div>

        {/* Sub stats */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "30px",
            marginTop: "30px",
            opacity: subStatsOpacity,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                color: highlightColor,
                fontSize: "18px",
                fontWeight: "600",
              }}
            >
              {highlight}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                color: captionColor,
                fontSize: "18px",
                fontWeight: "400",
              }}
            >
              {caption}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatCounter;
