// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 1 upstream template
// template id : bounce-in-headline
// upstream    : https://github.com/deangilmoreremix/free-remotion-templates (main @ f648980e528defb7594e24c6447055f0540f340b)
// upstream src: src/components/bounce-in-headline/BounceInHeadline.tsx
// license     : MIT License — Copyright (c) 2026 Trimora Inc. (RenderComp). The MIT copyright notice and permission notice must be retained in all copies or substantial portions of the software.
// Upstream code is reproduced verbatim apart from this header comment.
// DEVIATION (Phase 2, A11): the module-level font stack now comes from the
// bundled deterministic typeface (`../../designs/fonts`) instead of the
// hard-coded system stack, so the export does not depend on the OS. Only the
// value of the constant changed; every use site is untouched.
// ---------------------------------------------------------------------------
// SPDX-FileCopyrightText: 2026 Trimora Inc.
// SPDX-License-Identifier: MIT
/**
 * BounceInHeadline
 * Effect: the headline springs in with a damped abs(sin) bounce.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { DESIGN_FONT_STACK } from "../../designs/fonts";

const FONT_SANS = DESIGN_FONT_STACK;

export const FPS = 30;
export const DURATION_FRAMES = 120;

export type BounceInHeadlineProps = {
  headline: string;
  background: string;
  color: string;
  /** number of bounces */
  bounces: number;
  /** max bounce height (px) */
  height: number;
  /** entrance delay (frames) */
  delay: number;
  /** total effect length (frames) */
  duration: number;
};

export const defaultBounceInHeadlineProps: BounceInHeadlineProps = {
  headline: "Make It Bounce",
  background: "#111827",
  color: "#fbbf24",
  bounces: 3,
  height: 120,
  delay: 8,
  duration: 36,
};

export const BounceInHeadline: React.FC<BounceInHeadlineProps> = ({
  headline,
  background,
  color,
  bounces,
  height,
  delay,
  duration,
}) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(progress, [0, 0.1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // damped abs(sin) for multiple bounces
  const bounceY =
    progress >= 1
      ? 0
      : Math.abs(Math.sin(progress * Math.PI * bounces)) *
        height *
        (1 - progress);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONT_SANS,
          fontSize: 130,
          fontWeight: 900,
          color,
          letterSpacing: 6,
          opacity,
          transform: `translateY(${-bounceY}px)`,
        }}
      >
        {headline}
      </div>
    </AbsoluteFill>
  );
};

export default BounceInHeadline;
