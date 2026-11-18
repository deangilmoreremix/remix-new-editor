// NOTE: the upstream file `templates/image-zoom-reveal.tsx` carries NO in-file
// credit header (unlike most files of the repository). The repository-wide
// React Video Editor credit is reproduced here so it travels with the copy:
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
// template id : rve-image-zoom-reveal
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/image-zoom-reveal.tsx
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
//   upstream line 5   export default function ImageZoomReveal() {
//                 ->  export const ImageZoomReveal: React.FC<ImageZoomRevealProps> = ({ ... }) => {
//   upstream line 9   const duration = fps * 2;  ->  fps * revealSeconds (default 2)
//   upstream line 11  [2, 1]   (scale ramp)      ->  [startScale, 1] (default 2)
//   upstream line 16  [10, 0]  (blur ramp)       ->  [startBlur, 0]  (default 10)
//   upstream line 31  backgroundColor: "#111827", -> background (default "#111827";
//                     longhand → shorthand so a brand gradient can be passed)
//   upstream line 41  width: "80%",           ->  frameWidth   (default "80%")
//   upstream line 42  height: "70%",          ->  frameHeight  (default "70%")
//   upstream line 43  borderRadius: "12px",   ->  frameRadius  (default "12px")
//   upstream line 45  border: "3px solid #1e293b", -> frameBorder
//   upstream line 53  background: "linear-gradient(135deg, #4361ee, #7209b7, #a855f7)",
//                 ->  imageBackground
//   upstream line 67  color: "white",         ->  labelColor      (default "white")
//   upstream line 68  fontSize: "1.8rem",     ->  labelFontSize   (default "1.8rem")
//   upstream line 69  fontWeight: 600,        ->  labelFontWeight (default 600)
//   upstream line 71  fontFamily: "Inter, sans-serif", -> labelFontFamily
//   upstream line 72  textShadow: "0 2px 8px rgba(0,0,0,0.5)", -> labelShadow
//   upstream line 75  Featured Image          ->  {label}  (default "Featured Image")
//
// ADDED (not present upstream): `import React from "react";`, the prop
// types, `defaultImageZoomRevealProps`, a trailing `export default`, an
// OPTIONAL `labelWhiteSpace` (default undefined = upstream wrapping), and an
// OPTIONAL `content` node drawn inside the zooming/blurring layer (the
// adapter puts the brand photo or brand placeholder there; the layer gains
// `position: relative` only when content is present). Without `content` the
// layer renders exactly as upstream.
//
// NOT TOUCHED: the three `interpolate` ramps and their clamps (scale, blur,
// and the label fade over the last 40 % of the reveal).
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, interpolate, useVideoConfig } from "remotion";

export type ImageZoomRevealProps = {
  revealSeconds?: number;
  startScale?: number;
  startBlur?: number;
  background?: string;
  frameWidth?: string;
  frameHeight?: string;
  frameRadius?: string;
  frameBorder?: string;
  imageBackground?: string;
  label?: string;
  labelColor?: string;
  labelFontSize?: string;
  labelFontWeight?: number;
  labelFontFamily?: string;
  labelShadow?: string;
  /** ADDED. */
  labelWhiteSpace?: React.CSSProperties["whiteSpace"];
  /** ADDED: node drawn inside the zooming layer. */
  content?: React.ReactNode;
};

export const defaultImageZoomRevealProps = {
  revealSeconds: 2,
  startScale: 2,
  startBlur: 10,
  background: "#111827",
  frameWidth: "80%",
  frameHeight: "70%",
  frameRadius: "12px",
  frameBorder: "3px solid #1e293b",
  imageBackground: "linear-gradient(135deg, #4361ee, #7209b7, #a855f7)",
  label: "Featured Image",
  labelColor: "white",
  labelFontSize: "1.8rem",
  labelFontWeight: 600,
  labelFontFamily: "Inter, sans-serif",
  labelShadow: "0 2px 8px rgba(0,0,0,0.5)",
};

export const ImageZoomReveal: React.FC<ImageZoomRevealProps> = ({
  revealSeconds = defaultImageZoomRevealProps.revealSeconds,
  startScale = defaultImageZoomRevealProps.startScale,
  startBlur = defaultImageZoomRevealProps.startBlur,
  background = defaultImageZoomRevealProps.background,
  frameWidth = defaultImageZoomRevealProps.frameWidth,
  frameHeight = defaultImageZoomRevealProps.frameHeight,
  frameRadius = defaultImageZoomRevealProps.frameRadius,
  frameBorder = defaultImageZoomRevealProps.frameBorder,
  imageBackground = defaultImageZoomRevealProps.imageBackground,
  label = defaultImageZoomRevealProps.label,
  labelColor = defaultImageZoomRevealProps.labelColor,
  labelFontSize = defaultImageZoomRevealProps.labelFontSize,
  labelFontWeight = defaultImageZoomRevealProps.labelFontWeight,
  labelFontFamily = defaultImageZoomRevealProps.labelFontFamily,
  labelShadow = defaultImageZoomRevealProps.labelShadow,
  labelWhiteSpace,
  content,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const duration = fps * revealSeconds;

  const scale = interpolate(frame, [0, duration], [startScale, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const blur = interpolate(frame, [0, duration], [startBlur, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const textOpacity = interpolate(frame, [duration * 0.6, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const hasContent = content !== undefined && content !== null;

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
          border: frameBorder,
          position: "relative",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: imageBackground,
            transform: `scale(${scale})`,
            filter: `blur(${blur}px)`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            ...(hasContent ? { position: "relative" as const } : null),
          }}
        >
          {hasContent ? content : null}
        </div>
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: labelColor,
            fontSize: labelFontSize,
            fontWeight: labelFontWeight,
            opacity: textOpacity,
            fontFamily: labelFontFamily,
            textShadow: labelShadow,
            ...(labelWhiteSpace ? { whiteSpace: labelWhiteSpace } : null),
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
};

export default ImageZoomReveal;
