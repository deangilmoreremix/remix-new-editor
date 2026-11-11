// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 1 upstream template
// template id : logo-stroke-draw
// upstream    : https://github.com/deangilmoreremix/free-remotion-templates (main @ f648980e528defb7594e24c6447055f0540f340b)
// upstream src: src/components/logo-stroke-draw/LogoStrokeDraw.tsx
// license     : MIT License — Copyright (c) 2026 Trimora Inc. (RenderComp). The MIT copyright notice and permission notice must be retained in all copies or substantial portions of the software.
// Upstream code is reproduced verbatim apart from this header comment.
// DEVIATION (Phase 2, A11):
//   1. the module-level font stack now comes from the bundled deterministic
//      typeface (`../../designs/fonts`) instead of the hard-coded system
//      stack, so the export does not depend on the OS;
//   2. the badge monogram is drawn as an HTML element instead of an SVG
//      `<text>` element. The in-browser web renderer rasterises every `<svg>`
//      by serialising it into a `data:image/svg+xml` document, and such an
//      isolated document cannot load a document-level `@font-face` — so the
//      monogram fell back to a system face inside the raster. The HTML
//      monogram keeps the same position, size, weight, colour and opacity,
//      and the shine sweep moved into a second `<svg>` so it still paints
//      OVER the monogram (the original z-order).
// ---------------------------------------------------------------------------
// SPDX-FileCopyrightText: 2026 Trimora Inc.
// SPDX-License-Identifier: MIT
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DESIGN_FONT_STACK } from "../../designs/fonts";

export const FPS = 30;
export const DURATION_FRAMES = 110;

export type LogoStrokeDrawProps = {
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  monogram: string;
  brandText: string;
};

export const defaultLogoStrokeDrawProps: LogoStrokeDrawProps = {
  backgroundColor: "#0a0800",
  accentColor: "#eab308",
  textColor: "#fefce8",
  monogram: "A",
  brandText: "ACME INC.",
};

const FONT = DESIGN_FONT_STACK;

export const LogoStrokeDraw: React.FC<LogoStrokeDrawProps> = ({
  backgroundColor,
  accentColor,
  textColor,
  monogram,
  brandText,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const cx = width / 2;
  const cy = height * 0.42;
  const R = height * 0.2; // monogram ring radius

  // --- Phase timing ---
  // 0-50: stroke draws on. 44-66: fill fades in. 58-80: shine sweep. brand text 60-78.
  const drawProgress = interpolate(frame, [0, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fillIn = interpolate(frame, [44, 66], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shine = interpolate(frame, [58, 84], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textIn = interpolate(frame, [60, 78], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Gentle settle scale on the whole lockup
  const settle = spring({
    frame: frame - 44,
    fps,
    config: { damping: 14, stiffness: 90, mass: 0.8 },
    durationInFrames: 30,
  });
  const lockupScale = interpolate(settle, [0, 1], [0.94, 1]);

  // Hold opacity at end (no blank frames) — keep a soft tail
  const exitOpacity = interpolate(frame, [100, 109], [1, 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- Ring path (the monogram badge outline) ---
  const ringLen = 2 * Math.PI * R;
  const ringDrawn = ringLen * drawProgress;

  // Pen-tip leading dot along the ring (starts top, clockwise)
  const tipAngle = -Math.PI / 2 + drawProgress * 2 * Math.PI;
  const tipX = cx + R * Math.cos(tipAngle);
  const tipY = cy + R * Math.sin(tipAngle);

  const strokeW = height * 0.011;

  // Shine sweep position (a bright diagonal band crossing the badge)
  const sweepX = interpolate(shine, [0, 1], [cx - R * 1.6, cx + R * 1.6]);
  const sweepW = R * 0.5;
  const sweepActive = shine > 0.02 && shine < 0.98;

  // The lockup's own scale, applied about the badge centre.
  const lockupTransform = `translate(${cx} ${cy}) scale(${lockupScale}) translate(${-cx} ${-cy})`;

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      {/* Faint backdrop vignette glow behind logo */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${cx}px ${cy}px, ${accentColor}22 0%, transparent ${R * 2.2}px)`,
          opacity: fillIn,
        }}
      />

      <AbsoluteFill style={{ opacity: exitOpacity }}>
        {/* The badge: the filled disc, the drawn ring and the pen-tip glow. */}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <g transform={lockupTransform}>
            {/* Filled badge (fades in after the outline is mostly drawn) */}
            <circle
              cx={cx}
              cy={cy}
              r={R - strokeW / 2}
              fill={accentColor}
              opacity={fillIn * 0.16}
            />

            {/* Ring outline — drawn stroke-by-stroke */}
            <circle
              cx={cx}
              cy={cy}
              r={R}
              fill="none"
              stroke={accentColor}
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeDasharray={`${ringLen}`}
              strokeDashoffset={ringLen - ringDrawn}
              transform={`rotate(-90 ${cx} ${cy})`}
            />

            {/* Leading pen-tip glow while drawing */}
            {drawProgress > 0.01 && drawProgress < 0.99 && (
              <circle
                cx={tipX}
                cy={tipY}
                r={strokeW * 1.3}
                fill={textColor}
                opacity={0.9}
              />
            )}
          </g>
        </svg>

        {/* Monogram letter inside the badge.
            It is an HTML element, not SVG `<text>`: the in-browser web
            renderer rasterises an `<svg>` into an isolated
            `data:image/svg+xml` document, which cannot load a document-level
            `@font-face`, so an SVG glyph would fall back to a system face
            while every other glyph in the design uses the bundled
            typeface. Same position, size, weight, colour and opacity as the
            original SVG text. */}
        <div
          data-lsd-monogram
          style={{
            position: "absolute",
            left: cx,
            top: cy,
            transform: `translate(-50%, -50%) scale(${lockupScale})`,
            transformOrigin: "center center",
            fontFamily: FONT,
            fontSize: R * 1.15,
            fontWeight: 800,
            lineHeight: 1,
            color: accentColor,
            opacity: fillIn,
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {monogram}
        </div>

        {/* Shine sweep band, clipped to the badge.
            It lives in its own `<svg>` so it still paints OVER the monogram,
            exactly as it did when the monogram was SVG text. */}
        {sweepActive && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <defs>
              <clipPath id="lsd-shine-clip">
                <circle cx={cx} cy={cy} r={R - strokeW / 2} />
              </clipPath>
            </defs>

            <g transform={lockupTransform}>
              <g clipPath="url(#lsd-shine-clip)">
                <rect
                  x={sweepX - sweepW / 2}
                  y={cy - R * 1.4}
                  width={sweepW}
                  height={R * 2.8}
                  fill={textColor}
                  opacity={0.28}
                  transform={`rotate(18 ${sweepX} ${cy})`}
                />
              </g>
            </g>
          </svg>
        )}

        {/* Brand wordmark */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: cy + R + height * 0.07,
            textAlign: "center",
            fontFamily: FONT,
            fontSize: height * 0.05,
            fontWeight: 700,
            color: textColor,
            opacity: textIn,
            transform: `translateY(${(1 - textIn) * height * 0.025}px)`,
            letterSpacing: "0.22em",
          }}
        >
          {brandText}
        </div>

        {/* Underline accent under wordmark */}
        <div
          style={{
            position: "absolute",
            left: cx - (width * 0.12) / 2,
            top: cy + R + height * 0.155,
            width: width * 0.12 * textIn,
            height: height * 0.004,
            backgroundColor: accentColor,
            opacity: textIn,
            borderRadius: height * 0.004,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default LogoStrokeDraw;
