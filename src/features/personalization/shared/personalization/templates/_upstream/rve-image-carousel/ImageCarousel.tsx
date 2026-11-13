// NOTE: the upstream file `templates/image-carousel.tsx` carries NO in-file
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
// template id : rve-image-carousel
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/image-carousel.tsx
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
//   upstream line 5   export default function ImageCarousel() {
//                 ->  export const ImageCarousel: React.FC<ImageCarouselProps> = ({ ... }) => {
//   upstream 9-13     const slides = [ Mountain / Ocean / Forest literals ];
//                 ->  `slides` prop (default: the three upstream literals)
//   upstream line 15  const cycleLength = fps * 2;
//                 ->  fps * cycleSeconds              (default 2)
//   upstream line 22  backgroundColor: "#111827",
//                 ->  background,                     (default "#111827";
//                     longhand → shorthand so a brand gradient can be passed)
//   upstream line 33  gap: "1.5rem",        ->  gap            (default "1.5rem")
//   upstream line 40  const translateX = offset * 280;
//                 ->  offset * slideSpacing           (default 280)
//   upstream line 59  width: "240px",       ->  slideWidth     (default "240px")
//   upstream line 60  height: "320px",      ->  slideHeight    (default "320px")
//   upstream line 62  borderRadius: "12px", ->  slideRadius    (default "12px")
//   upstream line 68  padding: "1rem",      ->  slidePadding   (default "1rem")
//   upstream line 73  color: "white",       ->  labelColor     (default "white")
//   upstream line 74  fontSize: "1rem",     ->  labelFontSize  (default "1rem")
//   upstream line 75  fontWeight: 600,      ->  labelFontWeight (default 600)
//   upstream line 76  fontFamily: "Inter, sans-serif", -> labelFontFamily
//   upstream line 77  textShadow: "0 1px 4px rgba(0,0,0,0.3)", -> labelShadow
//
// ADDED (not present upstream): `import React from "react";`, the prop
// types, `defaultImageCarouselProps`, a trailing `export default`, an
// OPTIONAL `labelWhiteSpace` (default undefined = upstream wrapping), an
// OPTIONAL `centerSlides` flag (default false = upstream: the slides are
// absolutely positioned inside a zero-width flex container, so their LEFT
// edge — not their centre — sits on the canvas centre; `true` adds
// `margin-left: calc(slideWidth / -2)` so the active slide is centred), and an
// OPTIONAL per-slide `content` node. When a slide has `content` the node is
// drawn filling the slide (absolute, `overflow: hidden`) and the label is
// lifted above it (`position: relative; z-index: 1`). A slide without
// `content` renders exactly as upstream.
//
// NOT TOUCHED: the cycle maths, both `interpolate` ramps ([0,1,2] →
// [1,0.75,0.55] scale and [1,0.5,0.2] opacity) and the layout rules.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, interpolate, useVideoConfig } from "remotion";

export type ImageCarouselSlide = {
  label: string;
  gradient: string;
  /** ADDED: optional node drawn filling the slide (brand photo/placeholder). */
  content?: React.ReactNode;
};

export type ImageCarouselProps = {
  slides?: ImageCarouselSlide[];
  cycleSeconds?: number;
  background?: string;
  gap?: string;
  slideSpacing?: number;
  slideWidth?: string;
  slideHeight?: string;
  slideRadius?: string;
  slidePadding?: string;
  labelColor?: string;
  labelFontSize?: string;
  labelFontWeight?: number;
  labelFontFamily?: string;
  labelShadow?: string;
  /** ADDED. Default undefined (upstream wraps). */
  labelWhiteSpace?: React.CSSProperties["whiteSpace"];
  /** ADDED. Default false (upstream offset). */
  centerSlides?: boolean;
};

export const defaultImageCarouselProps = {
  slides: [
    { label: "Mountain", gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)" },
    { label: "Ocean", gradient: "linear-gradient(135deg, #4361ee, #7209b7)" },
    { label: "Forest", gradient: "linear-gradient(135deg, #a855f7, #7c3aed)" },
  ] as ImageCarouselSlide[],
  cycleSeconds: 2,
  background: "#111827",
  gap: "1.5rem",
  slideSpacing: 280,
  slideWidth: "240px",
  slideHeight: "320px",
  slideRadius: "12px",
  slidePadding: "1rem",
  labelColor: "white",
  labelFontSize: "1rem",
  labelFontWeight: 600,
  labelFontFamily: "Inter, sans-serif",
  labelShadow: "0 1px 4px rgba(0,0,0,0.3)",
};

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  slides = defaultImageCarouselProps.slides,
  cycleSeconds = defaultImageCarouselProps.cycleSeconds,
  background = defaultImageCarouselProps.background,
  gap = defaultImageCarouselProps.gap,
  slideSpacing = defaultImageCarouselProps.slideSpacing,
  slideWidth = defaultImageCarouselProps.slideWidth,
  slideHeight = defaultImageCarouselProps.slideHeight,
  slideRadius = defaultImageCarouselProps.slideRadius,
  slidePadding = defaultImageCarouselProps.slidePadding,
  labelColor = defaultImageCarouselProps.labelColor,
  labelFontSize = defaultImageCarouselProps.labelFontSize,
  labelFontWeight = defaultImageCarouselProps.labelFontWeight,
  labelFontFamily = defaultImageCarouselProps.labelFontFamily,
  labelShadow = defaultImageCarouselProps.labelShadow,
  labelWhiteSpace,
  centerSlides = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cycleLength = fps * cycleSeconds;
  const progress = (frame % (cycleLength * slides.length)) / cycleLength;

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
          display: "flex",
          alignItems: "center",
          gap,
          position: "relative",
        }}
      >
        {slides.map((slide, i) => {
          const offset = i - progress;
          const translateX = offset * slideSpacing;
          const scale = interpolate(
            Math.abs(offset),
            [0, 1, 2],
            [1, 0.75, 0.55],
            { extrapolateRight: "clamp" }
          );
          const opacity = interpolate(
            Math.abs(offset),
            [0, 1, 2],
            [1, 0.5, 0.2],
            { extrapolateRight: "clamp" }
          );
          const hasContent = slide.content !== undefined && slide.content !== null;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: slideWidth,
                height: slideHeight,
                background: slide.gradient,
                borderRadius: slideRadius,
                transform: `translateX(${translateX}px) scale(${scale})`,
                opacity,
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-end",
                padding: slidePadding,
                ...(hasContent ? { overflow: "hidden" as const } : null),
                ...(centerSlides ? { marginLeft: `calc(${slideWidth} / -2)` } : null),
              }}
            >
              {hasContent ? slide.content : null}
              <span
                style={{
                  color: labelColor,
                  fontSize: labelFontSize,
                  fontWeight: labelFontWeight,
                  fontFamily: labelFontFamily,
                  textShadow: labelShadow,
                  ...(labelWhiteSpace ? { whiteSpace: labelWhiteSpace } : null),
                  ...(hasContent ? { position: "relative" as const, zIndex: 1 } : null),
                }}
              >
                {slide.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImageCarousel;
