// NOTE: the upstream file `templates/polaroid-frame.tsx` carries NO in-file
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
// template id : rve-polaroid-frame
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/polaroid-frame.tsx
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
//   upstream line 5   export default function PolaroidFrame() {
//                 ->  export const PolaroidFrame: React.FC<PolaroidFrameProps> = ({ ... }) => {
//   upstream line 16  interpolate(dropIn, [0, 1], [-300, 0]) -> [-dropDistance, 0] (default 300)
//   upstream line 17  interpolate(dropIn, [0, 1], [8, -3])   -> [startRotation, endRotation] (8, -3)
//   upstream line 26  backgroundColor: "#111827", -> background (default "#111827";
//                     longhand → shorthand so `transparent`/a gradient can be passed)
//   upstream line 35  backgroundColor: "white",  -> cardBackground (default "white")
//   upstream line 36  padding: "12px 12px 48px 12px", -> cardPadding
//   upstream line 37  borderRadius: "4px",       -> cardRadius   (default "4px")
//   upstream line 40  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)", -> cardShadow
//   upstream line 45  width: "260px",            -> photoWidth   (default "260px")
//   upstream line 46  height: "260px",           -> photoHeight  (default "260px")
//   upstream line 47  background: "linear-gradient(135deg, #4361ee, #7209b7)", -> photoBackground
//   upstream line 48  borderRadius: "2px",       -> photoRadius  (default "2px")
//   upstream line 54  color: "#374151",          -> captionColor (default "#374151")
//   upstream line 55  fontSize: "0.95rem",       -> captionFontSize (default "0.95rem")
//   upstream line 56  fontWeight: 500,           -> captionFontWeight (default 500)
//   upstream line 58  marginTop: "12px",         -> captionMarginTop (default "12px")
//   upstream line 59  fontFamily: "Georgia, serif", -> captionFontFamily
//   upstream line 60  fontStyle: "italic",       -> captionFontStyle (default "italic")
//   upstream line 63  Summer 2024                -> {caption}  (default "Summer 2024")
//
// ADDED (not present upstream): `import React from "react";`, the prop
// types, `defaultPolaroidFrameProps`, a trailing `export default`, an
// OPTIONAL `captionWhiteSpace` (default undefined), and an OPTIONAL
// `photoContent` node drawn filling the photo area (the photo box gains
// `position: relative; overflow: hidden` only when content is present — the
// adapter puts the brand photo, logo or brand placeholder there).
//
// NOT TOUCHED: the drop-in spring (`damping: 10`, `stiffness: 80`), the
// opacity ramp ([0, 0.3] → [0, 1], clamped) and the transform order.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export type PolaroidFrameProps = {
  dropDistance?: number;
  startRotation?: number;
  endRotation?: number;
  background?: string;
  cardBackground?: string;
  cardPadding?: string;
  cardRadius?: string;
  cardShadow?: string;
  photoWidth?: string;
  photoHeight?: string;
  photoBackground?: string;
  photoRadius?: string;
  caption?: string;
  captionColor?: string;
  captionFontSize?: string;
  captionFontWeight?: number;
  captionMarginTop?: string;
  captionFontFamily?: string;
  captionFontStyle?: React.CSSProperties["fontStyle"];
  /** ADDED. */
  captionWhiteSpace?: React.CSSProperties["whiteSpace"];
  /** ADDED: node drawn filling the photo area. */
  photoContent?: React.ReactNode;
};

export const defaultPolaroidFrameProps = {
  dropDistance: 300,
  startRotation: 8,
  endRotation: -3,
  background: "#111827",
  cardBackground: "white",
  cardPadding: "12px 12px 48px 12px",
  cardRadius: "4px",
  cardShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
  photoWidth: "260px",
  photoHeight: "260px",
  photoBackground: "linear-gradient(135deg, #4361ee, #7209b7)",
  photoRadius: "2px",
  caption: "Summer 2024",
  captionColor: "#374151",
  captionFontSize: "0.95rem",
  captionFontWeight: 500,
  captionMarginTop: "12px",
  captionFontFamily: "Georgia, serif",
  captionFontStyle: "italic" as React.CSSProperties["fontStyle"],
};

export const PolaroidFrame: React.FC<PolaroidFrameProps> = ({
  dropDistance = defaultPolaroidFrameProps.dropDistance,
  startRotation = defaultPolaroidFrameProps.startRotation,
  endRotation = defaultPolaroidFrameProps.endRotation,
  background = defaultPolaroidFrameProps.background,
  cardBackground = defaultPolaroidFrameProps.cardBackground,
  cardPadding = defaultPolaroidFrameProps.cardPadding,
  cardRadius = defaultPolaroidFrameProps.cardRadius,
  cardShadow = defaultPolaroidFrameProps.cardShadow,
  photoWidth = defaultPolaroidFrameProps.photoWidth,
  photoHeight = defaultPolaroidFrameProps.photoHeight,
  photoBackground = defaultPolaroidFrameProps.photoBackground,
  photoRadius = defaultPolaroidFrameProps.photoRadius,
  caption = defaultPolaroidFrameProps.caption,
  captionColor = defaultPolaroidFrameProps.captionColor,
  captionFontSize = defaultPolaroidFrameProps.captionFontSize,
  captionFontWeight = defaultPolaroidFrameProps.captionFontWeight,
  captionMarginTop = defaultPolaroidFrameProps.captionMarginTop,
  captionFontFamily = defaultPolaroidFrameProps.captionFontFamily,
  captionFontStyle = defaultPolaroidFrameProps.captionFontStyle,
  captionWhiteSpace,
  photoContent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dropIn = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 80 },
  });

  const translateY = interpolate(dropIn, [0, 1], [-dropDistance, 0]);
  const rotation = interpolate(dropIn, [0, 1], [startRotation, endRotation]);
  const opacity = interpolate(dropIn, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  const hasContent = photoContent !== undefined && photoContent !== null;

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
          backgroundColor: cardBackground,
          padding: cardPadding,
          borderRadius: cardRadius,
          transform: `translateY(${translateY}px) rotate(${rotation}deg)`,
          opacity,
          boxShadow: cardShadow,
        }}
      >
        <div
          style={{
            width: photoWidth,
            height: photoHeight,
            background: photoBackground,
            borderRadius: photoRadius,
            ...(hasContent ? { position: "relative" as const, overflow: "hidden" as const } : null),
          }}
        >
          {hasContent ? photoContent : null}
        </div>
        <p
          style={{
            textAlign: "center",
            color: captionColor,
            fontSize: captionFontSize,
            fontWeight: captionFontWeight,
            margin: 0,
            marginTop: captionMarginTop,
            fontFamily: captionFontFamily,
            fontStyle: captionFontStyle,
            ...(captionWhiteSpace ? { whiteSpace: captionWhiteSpace } : null),
          }}
        >
          {caption}
        </p>
      </div>
    </div>
  );
};

export default PolaroidFrame;
