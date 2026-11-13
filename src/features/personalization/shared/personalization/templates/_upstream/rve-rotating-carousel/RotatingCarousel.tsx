/** Free Remotion Template Component
 * ---------------------------------
 * This template is free to use in your projects!
 * Credit appreciated but not required.
 *
 * Created by the team at https://www.reactvideoeditor.com
 *
 * Happy coding and building amazing videos! 🎉
 */

// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 batch 3h upstream template (repo 2: remotion-templates)
// template id : rve-rotating-carousel
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/rotating-carousel.tsx
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
//   upstream line 15  export default function RotatingCarousel() {
//                 ->  export const RotatingCarousel: React.FC<RotatingCarouselProps> = ({ ... }) => {
//   upstream line 17  const { fps } = useVideoConfig();  (unused upstream; kept)
//   upstream line 19  const cards = ["Feature 1", …, "Feature 4"]; -> `cards` prop
//   upstream line 20  const rotationSpeed = 0.015;  -> `rotationSpeed` prop (default 0.015)
//   upstream line 27  background: "linear-gradient(180deg, #111827, #1f2937)", -> background
//   upstream line 38  top: "40px",            ->  titleTop        (default "40px")
//   upstream line 39  color: "white",         ->  titleColor      (default "white")
//   upstream line 40  fontSize: "1.8rem",     ->  titleFontSize   (default "1.8rem")
//   upstream line 41  fontWeight: "bold",     ->  titleFontWeight (default "bold")
//   upstream 42/97    fontFamily: "Inter, sans-serif", -> fontFamily
//   upstream line 46  Our Features            ->  {title}  (default "Our Features")
//   upstream line 51  width: "600px",         ->  stageWidth      (default "600px")
//   upstream line 52  height: "300px",        ->  stageHeight     (default "300px")
//   upstream line 60  Math.sin(cardAngle) * 220 -> * radius        (default 220)
//   upstream line 63  [0.6, 1]  (scale ramp)  ->  [minCardScale, 1] (default 0.6)
//   upstream line 64  [0.3, 1]  (opacity ramp)->  [minCardOpacity, 1] (default 0.3)
//   upstream line 76  width: "180px",         ->  cardWidth       (default "180px")
//   upstream line 77  height: "220px",        ->  cardHeight      (default "220px")
//   upstream line 78  borderRadius: "16px",   ->  cardRadius      (default "16px")
//   upstream line 79  background: "linear-gradient(135deg, #1f2937, #374151)", -> cardBackground
//   upstream line 80  border: "1px solid rgba(59, 130, 246, 0.3)", -> cardBorder
//   upstream line 85  padding: "24px",        ->  cardPadding     (default "24px")
//   upstream 90/91    width/height: "48px",   ->  iconSize        (default "48px")
//   upstream line 92  borderRadius: "12px",   ->  iconRadius      (default "12px")
//   upstream line 93  background: "linear-gradient(135deg, #3b82f6, #a855f7)", -> iconBackground
//   upstream line 94  marginBottom: "16px",   ->  iconGap         (default "16px")
//   upstream line 99  color: "white",         ->  labelColor      (default "white")
//   upstream line 100 fontSize: "1.1rem",     ->  labelFontSize   (default "1.1rem")
//   upstream line 101 fontWeight: "600",      ->  labelFontWeight (default "600")
//
// ADDED (not present upstream): `import React from "react";`, the prop
// types, `defaultRotatingCarouselProps`, a trailing `export default`,
// OPTIONAL `titleWhiteSpace` / `labelWhiteSpace` (default undefined), and an
// OPTIONAL `cardContents` array: `cardContents[i]` (when set) is drawn
// filling card i's icon square (which gains `position: relative;
// overflow: hidden`) — the adapter puts a brand photo/logo there. Cards
// without content render exactly as upstream.
//
// NOT TOUCHED: the orbit maths (`angle = frame * rotationSpeed`, the
// sin/cos placement, `(z + 1) / 2` depth and `zIndex`) and the layout rules.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, interpolate, useVideoConfig } from "remotion";

export type RotatingCarouselProps = {
  cards?: string[];
  rotationSpeed?: number;
  background?: string;
  title?: string;
  titleTop?: string;
  titleColor?: string;
  titleFontSize?: string;
  titleFontWeight?: React.CSSProperties["fontWeight"];
  fontFamily?: string;
  stageWidth?: string;
  stageHeight?: string;
  radius?: number;
  minCardScale?: number;
  minCardOpacity?: number;
  cardWidth?: string;
  cardHeight?: string;
  cardRadius?: string;
  cardBackground?: string;
  cardBorder?: string;
  cardPadding?: string;
  iconSize?: string;
  iconRadius?: string;
  iconBackground?: string;
  iconGap?: string;
  labelColor?: string;
  labelFontSize?: string;
  labelFontWeight?: React.CSSProperties["fontWeight"];
  /** ADDED. */
  titleWhiteSpace?: React.CSSProperties["whiteSpace"];
  /** ADDED. */
  labelWhiteSpace?: React.CSSProperties["whiteSpace"];
  /** ADDED: nodes drawn filling each card's icon square. */
  cardContents?: Array<React.ReactNode | null | undefined>;
};

export const defaultRotatingCarouselProps = {
  cards: ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],
  rotationSpeed: 0.015,
  background: "linear-gradient(180deg, #111827, #1f2937)",
  title: "Our Features",
  titleTop: "40px",
  titleColor: "white",
  titleFontSize: "1.8rem",
  titleFontWeight: "bold" as React.CSSProperties["fontWeight"],
  fontFamily: "Inter, sans-serif",
  stageWidth: "600px",
  stageHeight: "300px",
  radius: 220,
  minCardScale: 0.6,
  minCardOpacity: 0.3,
  cardWidth: "180px",
  cardHeight: "220px",
  cardRadius: "16px",
  cardBackground: "linear-gradient(135deg, #1f2937, #374151)",
  cardBorder: "1px solid rgba(59, 130, 246, 0.3)",
  cardPadding: "24px",
  iconSize: "48px",
  iconRadius: "12px",
  iconBackground: "linear-gradient(135deg, #3b82f6, #a855f7)",
  iconGap: "16px",
  labelColor: "white",
  labelFontSize: "1.1rem",
  labelFontWeight: "600" as React.CSSProperties["fontWeight"],
};

export const RotatingCarousel: React.FC<RotatingCarouselProps> = ({
  cards = defaultRotatingCarouselProps.cards,
  rotationSpeed = defaultRotatingCarouselProps.rotationSpeed,
  background = defaultRotatingCarouselProps.background,
  title = defaultRotatingCarouselProps.title,
  titleTop = defaultRotatingCarouselProps.titleTop,
  titleColor = defaultRotatingCarouselProps.titleColor,
  titleFontSize = defaultRotatingCarouselProps.titleFontSize,
  titleFontWeight = defaultRotatingCarouselProps.titleFontWeight,
  fontFamily = defaultRotatingCarouselProps.fontFamily,
  stageWidth = defaultRotatingCarouselProps.stageWidth,
  stageHeight = defaultRotatingCarouselProps.stageHeight,
  radius = defaultRotatingCarouselProps.radius,
  minCardScale = defaultRotatingCarouselProps.minCardScale,
  minCardOpacity = defaultRotatingCarouselProps.minCardOpacity,
  cardWidth = defaultRotatingCarouselProps.cardWidth,
  cardHeight = defaultRotatingCarouselProps.cardHeight,
  cardRadius = defaultRotatingCarouselProps.cardRadius,
  cardBackground = defaultRotatingCarouselProps.cardBackground,
  cardBorder = defaultRotatingCarouselProps.cardBorder,
  cardPadding = defaultRotatingCarouselProps.cardPadding,
  iconSize = defaultRotatingCarouselProps.iconSize,
  iconRadius = defaultRotatingCarouselProps.iconRadius,
  iconBackground = defaultRotatingCarouselProps.iconBackground,
  iconGap = defaultRotatingCarouselProps.iconGap,
  labelColor = defaultRotatingCarouselProps.labelColor,
  labelFontSize = defaultRotatingCarouselProps.labelFontSize,
  labelFontWeight = defaultRotatingCarouselProps.labelFontWeight,
  titleWhiteSpace,
  labelWhiteSpace,
  cardContents,
}) => {
  const frame = useCurrentFrame();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fps } = useVideoConfig();

  const angle = frame * rotationSpeed;

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
        position: "relative",
      }}
    >
      <h2
        style={{
          position: "absolute",
          top: titleTop,
          color: titleColor,
          fontSize: titleFontSize,
          fontWeight: titleFontWeight,
          fontFamily,
          margin: 0,
          ...(titleWhiteSpace ? { whiteSpace: titleWhiteSpace } : null),
        }}
      >
        {title}
      </h2>
      <div
        style={{
          position: "relative",
          width: stageWidth,
          height: stageHeight,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {cards.map((label, i) => {
          const cardAngle = angle + (i * Math.PI * 2) / cards.length;
          const x = Math.sin(cardAngle) * radius;
          const z = Math.cos(cardAngle);
          const normalizedZ = (z + 1) / 2;
          const cardScale = interpolate(normalizedZ, [0, 1], [minCardScale, 1]);
          const cardOpacity = interpolate(normalizedZ, [0, 1], [minCardOpacity, 1]);
          const content = cardContents?.[i];
          const hasContent = content !== undefined && content !== null;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) translateX(${x}px) scale(${cardScale})`,
                opacity: cardOpacity,
                zIndex: Math.round(normalizedZ * 100),
                width: cardWidth,
                height: cardHeight,
                borderRadius: cardRadius,
                background: cardBackground,
                border: cardBorder,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: cardPadding,
              }}
            >
              <div
                style={{
                  width: iconSize,
                  height: iconSize,
                  borderRadius: iconRadius,
                  background: iconBackground,
                  marginBottom: iconGap,
                  ...(hasContent ? { position: "relative" as const, overflow: "hidden" as const } : null),
                }}
              >
                {hasContent ? content : null}
              </div>
              <span
                style={{
                  color: labelColor,
                  fontSize: labelFontSize,
                  fontWeight: labelFontWeight,
                  fontFamily,
                  ...(labelWhiteSpace ? { whiteSpace: labelWhiteSpace } : null),
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RotatingCarousel;
