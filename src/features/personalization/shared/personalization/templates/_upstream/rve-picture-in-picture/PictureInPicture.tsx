// NOTE: the upstream file `templates/picture-in-picture.tsx` carries NO in-file
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
// template id : rve-picture-in-picture
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/picture-in-picture.tsx
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
//   upstream line 5   export default function PictureInPicture() {
//                 ->  export const PictureInPicture: React.FC<PictureInPictureProps> = ({ ... }) => {
//   upstream line 10  frame: Math.max(frame - 15, 0), -> Math.max(frame - pipDelay, 0) (default 15)
//   upstream line 19  backgroundColor: "#111827", -> background (default "#111827";
//                     longhand → shorthand so `transparent`/a gradient can be passed)
//   upstream line 28  background: "linear-gradient(135deg, #1e293b, #111827)", -> mainBackground
//   upstream line 36  color: "#6b7280",       ->  mainLabelColor    (default "#6b7280")
//   upstream line 37  fontSize: "1.8rem",     ->  mainLabelFontSize (default "1.8rem")
//   upstream 38/62    fontWeight: 600,        ->  labelFontWeight   (default 600)
//   upstream 39/63    fontFamily: "Inter, sans-serif", -> labelFontFamily
//   upstream line 42  Main Content            ->  {mainLabel}  (default "Main Content")
//   upstream line 48  bottom: "20px",         ->  pipBottom    (default "20px")
//   upstream line 49  right: "20px",          ->  pipRight     (default "20px")
//   upstream line 50  width: "180px",         ->  pipWidth     (default "180px")
//   upstream line 51  height: "130px",        ->  pipHeight    (default "130px")
//   upstream line 52  background: "linear-gradient(135deg, #4361ee, #3b82f6)", -> pipBackground
//   upstream line 53  borderRadius: "10px",   ->  pipRadius    (default "10px")
//   upstream line 54  border: "2px solid rgba(255, 255, 255, 0.2)", -> pipBorder
//   upstream line 55  boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)", -> pipShadow
//   upstream line 60  color: "white",         ->  pipLabelColor    (default "white")
//   upstream line 61  fontSize: "0.9rem",     ->  pipLabelFontSize (default "0.9rem")
//   upstream line 66  Speaker                 ->  {pipLabel}  (default "Speaker")
//
// ADDED (not present upstream): `import React from "react";`, the prop
// types, `defaultPictureInPictureProps`, a trailing `export default`, and
// OPTIONAL `pipContent` (a node drawn filling the inset — the adapter puts
// the brand photo/logo/placeholder there; the inset gains `overflow: hidden`
// and the label is lifted above it with `position: relative; z-index: 1`),
// `pipAlignItems` / `pipPadding` (default undefined = upstream centred label
// with no padding), `pipLabelShadow` / `pipLabelWhiteSpace` (default
// undefined) and `showMainLabel` (default true; `false` drops the
// "Main Content" placeholder span so an overlay can let the customer's video
// be the main content). Without them the inset renders exactly as upstream.
//
// NOT TOUCHED: the inset's spring (`damping: 12`, `stiffness: 100`) and its
// `transform: scale(pipScale)`.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, spring, useVideoConfig } from "remotion";

export type PictureInPictureProps = {
  pipDelay?: number;
  background?: string;
  mainBackground?: string;
  mainLabel?: string;
  mainLabelColor?: string;
  mainLabelFontSize?: string;
  labelFontWeight?: number;
  labelFontFamily?: string;
  pipBottom?: string;
  pipRight?: string;
  pipWidth?: string;
  pipHeight?: string;
  pipBackground?: string;
  pipRadius?: string;
  pipBorder?: string;
  pipShadow?: string;
  pipLabel?: string;
  pipLabelColor?: string;
  pipLabelFontSize?: string;
  /** ADDED. */
  pipContent?: React.ReactNode;
  /** ADDED. */
  pipAlignItems?: React.CSSProperties["alignItems"];
  /** ADDED. */
  pipPadding?: string;
  /** ADDED. */
  pipLabelShadow?: string;
  /** ADDED. */
  pipLabelWhiteSpace?: React.CSSProperties["whiteSpace"];
  /** ADDED. Default true. */
  showMainLabel?: boolean;
};

export const defaultPictureInPictureProps = {
  pipDelay: 15,
  background: "#111827",
  mainBackground: "linear-gradient(135deg, #1e293b, #111827)",
  mainLabel: "Main Content",
  mainLabelColor: "#6b7280",
  mainLabelFontSize: "1.8rem",
  labelFontWeight: 600,
  labelFontFamily: "Inter, sans-serif",
  pipBottom: "20px",
  pipRight: "20px",
  pipWidth: "180px",
  pipHeight: "130px",
  pipBackground: "linear-gradient(135deg, #4361ee, #3b82f6)",
  pipRadius: "10px",
  pipBorder: "2px solid rgba(255, 255, 255, 0.2)",
  pipShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
  pipLabel: "Speaker",
  pipLabelColor: "white",
  pipLabelFontSize: "0.9rem",
};

export const PictureInPicture: React.FC<PictureInPictureProps> = ({
  pipDelay = defaultPictureInPictureProps.pipDelay,
  background = defaultPictureInPictureProps.background,
  mainBackground = defaultPictureInPictureProps.mainBackground,
  mainLabel = defaultPictureInPictureProps.mainLabel,
  mainLabelColor = defaultPictureInPictureProps.mainLabelColor,
  mainLabelFontSize = defaultPictureInPictureProps.mainLabelFontSize,
  labelFontWeight = defaultPictureInPictureProps.labelFontWeight,
  labelFontFamily = defaultPictureInPictureProps.labelFontFamily,
  pipBottom = defaultPictureInPictureProps.pipBottom,
  pipRight = defaultPictureInPictureProps.pipRight,
  pipWidth = defaultPictureInPictureProps.pipWidth,
  pipHeight = defaultPictureInPictureProps.pipHeight,
  pipBackground = defaultPictureInPictureProps.pipBackground,
  pipRadius = defaultPictureInPictureProps.pipRadius,
  pipBorder = defaultPictureInPictureProps.pipBorder,
  pipShadow = defaultPictureInPictureProps.pipShadow,
  pipLabel = defaultPictureInPictureProps.pipLabel,
  pipLabelColor = defaultPictureInPictureProps.pipLabelColor,
  pipLabelFontSize = defaultPictureInPictureProps.pipLabelFontSize,
  pipContent,
  pipAlignItems,
  pipPadding,
  pipLabelShadow,
  pipLabelWhiteSpace,
  showMainLabel = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pipScale = spring({
    frame: Math.max(frame - pipDelay, 0),
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const hasContent = pipContent !== undefined && pipContent !== null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: mainBackground,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {showMainLabel ? (
          <span
            style={{
              color: mainLabelColor,
              fontSize: mainLabelFontSize,
              fontWeight: labelFontWeight,
              fontFamily: labelFontFamily,
            }}
          >
            {mainLabel}
          </span>
        ) : null}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: pipBottom,
          right: pipRight,
          width: pipWidth,
          height: pipHeight,
          background: pipBackground,
          borderRadius: pipRadius,
          border: pipBorder,
          boxShadow: pipShadow,
          display: "flex",
          justifyContent: "center",
          alignItems: pipAlignItems ?? "center",
          transform: `scale(${pipScale})`,
          ...(pipPadding ? { padding: pipPadding, boxSizing: "border-box" as const } : null),
          ...(hasContent ? { overflow: "hidden" as const } : null),
        }}
      >
        {hasContent ? pipContent : null}
        <span
          style={{
            color: pipLabelColor,
            fontSize: pipLabelFontSize,
            fontWeight: labelFontWeight,
            fontFamily: labelFontFamily,
            ...(pipLabelShadow ? { textShadow: pipLabelShadow } : null),
            ...(pipLabelWhiteSpace ? { whiteSpace: pipLabelWhiteSpace } : null),
            ...(hasContent ? { position: "relative" as const, zIndex: 1 } : null),
          }}
        >
          {pipLabel}
        </span>
      </div>
    </div>
  );
};

export default PictureInPicture;
