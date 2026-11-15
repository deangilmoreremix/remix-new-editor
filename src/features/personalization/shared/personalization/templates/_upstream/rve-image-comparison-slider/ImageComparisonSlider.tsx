// NOTE: the upstream file `templates/image-comparison-slider.tsx` carries NO
// in-file credit header (unlike most files of the repository). The
// repository-wide React Video Editor credit is reproduced here so it travels
// with the copy:
/**
 * Free Remotion Template Component
 * ---------------------------------
 * This template is free to use in your projects!
 * Credit appreciated but not required.
 *
 * Created by the team at https://www.reactvideoeditor.com
 */

// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 batch 3h upstream template (repo 2: remotion-templates)
// template id : rve-image-comparison-slider
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/image-comparison-slider.tsx
// license     : MIT License (README); no LICENSE file, no named copyright
//               holder. The verbatim MIT permission notice (WITHOUT a
//               copyright line) ships with the design credit in
//               `templates/designs/rveSharedDesign.tsx` (RVE_LICENSE_NOTICE).
//
// DEVIATION RECORD (contract addition C8 — repo-2 edited copies)
// ----------------------------------------------------------------
// (Upstream line numbers refer to the file at the pinned commit and may be
// off by one or two; the quoted upstream literal is authoritative.)
// This file is EDITED. Every hard-coded string, colour and dimension became an
// OPTIONAL prop whose default reproduces the upstream literal exactly.
// Rendering this component with no props reproduces the upstream design.
//
//   upstream line 5   export default function ImageComparisonSlider() {
//                 ->  export const ImageComparisonSlider: React.FC<ImageComparisonSliderProps> = ({ ... }) => {
//   upstream line 9   const duration = fps * 3;  ->  fps * sweepSeconds (default 3)
//   upstream line 10  interpolate(frame, [10, duration], [5, 95], …)
//                 ->  [sweepStartFrame, duration], [5, 95] (default 10)
//   upstream line 19  backgroundColor: "#111827", -> background (default "#111827";
//                     longhand → shorthand so a brand gradient can be passed)
//   upstream line 29  width: "85%",          ->  frameWidth   (default "85%")
//   upstream line 30  height: "75%",         ->  frameHeight  (default "75%")
//   upstream line 31  borderRadius: "12px",  ->  frameRadius  (default "12px")
//   upstream line 41  background: "linear-gradient(135deg, #4361ee, #7209b7, #a855f7)",
//                 ->  afterBackground
//   upstream line 49  color: "white",        ->  afterLabelColor (default "white")
//   upstream 50/70    fontSize: "1.5rem",    ->  labelFontSize   (default "1.5rem")
//   upstream 51/71    fontWeight: 600,       ->  labelFontWeight (default 600)
//   upstream 52/72    fontFamily: "Inter, sans-serif", -> labelFontFamily
//   upstream line 53  opacity: 0.8,          ->  afterLabelOpacity (default 0.8)
//   upstream line 56  After                  ->  {afterLabel}     (default "After")
//   upstream line 64  background: "linear-gradient(135deg, #1e293b, #374151, #4b5563)",
//                 ->  beforeBackground
//   upstream line 69  color: "#9ca3af",      ->  beforeLabelColor (default "#9ca3af")
//   upstream line 75  Before                 ->  {beforeLabel}    (default "Before")
//   upstream line 85  width: "3px",          ->  dividerWidth (default "3px")
//   upstream line 86  backgroundColor: "white", -> dividerColor (default "white")
//   upstream 96/97    width/height: "28px",  ->  handleSize   (default "28px")
//   upstream line 99  backgroundColor: "white", -> handleColor (default "white")
//   upstream line 100 border: "3px solid #3b82f6", -> handleBorder
//
// ADDED (not present upstream): `import React from "react";`, the prop
// types, `defaultImageComparisonSliderProps`, a trailing `export default`,
// an OPTIONAL `labelShadow` / `labelWhiteSpace` (default undefined = upstream
// has none), and OPTIONAL `afterContent` / `beforeContent` nodes. A content
// node is drawn filling its half (absolute, inset 0) and the label is lifted
// above it (`position: relative; z-index: 1`). Without content each half
// renders exactly as upstream.
//
// NOT TOUCHED: the `inset(0 ${100 - dividerPercent}% 0 0)` clip, the sweep
// ramp's [5, 95] range and clamps, and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, interpolate, useVideoConfig } from "remotion";

export type ImageComparisonSliderProps = {
  sweepSeconds?: number;
  sweepStartFrame?: number;
  background?: string;
  frameWidth?: string;
  frameHeight?: string;
  frameRadius?: string;
  afterBackground?: string;
  afterLabel?: string;
  afterLabelColor?: string;
  afterLabelOpacity?: number;
  beforeBackground?: string;
  beforeLabel?: string;
  beforeLabelColor?: string;
  labelFontSize?: string;
  labelFontWeight?: number;
  labelFontFamily?: string;
  dividerWidth?: string;
  dividerColor?: string;
  handleSize?: string;
  handleColor?: string;
  handleBorder?: string;
  /** ADDED. */
  labelShadow?: string;
  /** ADDED. */
  labelWhiteSpace?: React.CSSProperties["whiteSpace"];
  /** ADDED: node drawn filling the "after" half. */
  afterContent?: React.ReactNode;
  /** ADDED: node drawn filling the "before" half. */
  beforeContent?: React.ReactNode;
};

export const defaultImageComparisonSliderProps = {
  sweepSeconds: 3,
  sweepStartFrame: 10,
  background: "#111827",
  frameWidth: "85%",
  frameHeight: "75%",
  frameRadius: "12px",
  afterBackground: "linear-gradient(135deg, #4361ee, #7209b7, #a855f7)",
  afterLabel: "After",
  afterLabelColor: "white",
  afterLabelOpacity: 0.8,
  beforeBackground: "linear-gradient(135deg, #1e293b, #374151, #4b5563)",
  beforeLabel: "Before",
  beforeLabelColor: "#9ca3af",
  labelFontSize: "1.5rem",
  labelFontWeight: 600,
  labelFontFamily: "Inter, sans-serif",
  dividerWidth: "3px",
  dividerColor: "white",
  handleSize: "28px",
  handleColor: "white",
  handleBorder: "3px solid #3b82f6",
};

const hasNode = (node: React.ReactNode) => node !== undefined && node !== null;

export const ImageComparisonSlider: React.FC<ImageComparisonSliderProps> = ({
  sweepSeconds = defaultImageComparisonSliderProps.sweepSeconds,
  sweepStartFrame = defaultImageComparisonSliderProps.sweepStartFrame,
  background = defaultImageComparisonSliderProps.background,
  frameWidth = defaultImageComparisonSliderProps.frameWidth,
  frameHeight = defaultImageComparisonSliderProps.frameHeight,
  frameRadius = defaultImageComparisonSliderProps.frameRadius,
  afterBackground = defaultImageComparisonSliderProps.afterBackground,
  afterLabel = defaultImageComparisonSliderProps.afterLabel,
  afterLabelColor = defaultImageComparisonSliderProps.afterLabelColor,
  afterLabelOpacity = defaultImageComparisonSliderProps.afterLabelOpacity,
  beforeBackground = defaultImageComparisonSliderProps.beforeBackground,
  beforeLabel = defaultImageComparisonSliderProps.beforeLabel,
  beforeLabelColor = defaultImageComparisonSliderProps.beforeLabelColor,
  labelFontSize = defaultImageComparisonSliderProps.labelFontSize,
  labelFontWeight = defaultImageComparisonSliderProps.labelFontWeight,
  labelFontFamily = defaultImageComparisonSliderProps.labelFontFamily,
  dividerWidth = defaultImageComparisonSliderProps.dividerWidth,
  dividerColor = defaultImageComparisonSliderProps.dividerColor,
  handleSize = defaultImageComparisonSliderProps.handleSize,
  handleColor = defaultImageComparisonSliderProps.handleColor,
  handleBorder = defaultImageComparisonSliderProps.handleBorder,
  labelShadow,
  labelWhiteSpace,
  afterContent,
  beforeContent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const duration = fps * sweepSeconds;
  const dividerPercent = interpolate(frame, [sweepStartFrame, duration], [5, 95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const extraLabel = (lifted: boolean): React.CSSProperties => ({
    ...(labelShadow ? { textShadow: labelShadow } : null),
    ...(labelWhiteSpace ? { whiteSpace: labelWhiteSpace } : null),
    ...(lifted ? { position: "relative" as const, zIndex: 1 } : null),
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: frameWidth,
          height: frameHeight,
          borderRadius: frameRadius,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* After (full background) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: afterBackground,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {hasNode(afterContent) ? afterContent : null}
          <span
            style={{
              color: afterLabelColor,
              fontSize: labelFontSize,
              fontWeight: labelFontWeight,
              fontFamily: labelFontFamily,
              opacity: afterLabelOpacity,
              ...extraLabel(hasNode(afterContent)),
            }}
          >
            {afterLabel}
          </span>
        </div>
        {/* Before (clipped) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: `inset(0 ${100 - dividerPercent}% 0 0)`,
            background: beforeBackground,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {hasNode(beforeContent) ? beforeContent : null}
          <span
            style={{
              color: beforeLabelColor,
              fontSize: labelFontSize,
              fontWeight: labelFontWeight,
              fontFamily: labelFontFamily,
              ...extraLabel(hasNode(beforeContent)),
            }}
          >
            {beforeLabel}
          </span>
        </div>
        {/* Divider */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${dividerPercent}%`,
            width: dividerWidth,
            backgroundColor: dividerColor,
            zIndex: 2,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: handleSize,
              height: handleSize,
              borderRadius: "50%",
              backgroundColor: handleColor,
              border: handleBorder,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageComparisonSlider;
