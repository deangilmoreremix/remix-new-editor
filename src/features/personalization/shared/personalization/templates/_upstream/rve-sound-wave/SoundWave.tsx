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
// template id : rve-sound-wave
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/sound-wave.tsx
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
// hard-coded count, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal exactly. Rendering this component
// with no props reproduces the upstream design.
//
//   upstream line 16      export default function SoundWave() {
//                     ->  export const SoundWave: React.FC<SoundWaveProps> = ({ ... }) => {
//   upstream line 20      const BAR_COUNT = 40;                         -> prop `barCount` (`BAR_COUNT = barCount`)
//   upstream line 24      the wave amplitude 100 and jitter 50          -> props `amplitude` / `jitter`
//   upstream line 41      gap: "4px"                                    -> prop `gap`
//   upstream line 42      backdropFilter: "blur(8px)"                   -> prop `backdropFilter`
//   upstream line 43      boxShadow: "inset 0 0 100px rgba(59, 130, 246, 0.2)"
//                     ->  prop `insetGlow`          (same default)
//   upstream line 50      width: "12px"                                 -> prop `barWidth`
//   upstream line 52      background: `white`                           -> prop `barColor`
//   upstream line 53      borderRadius: "6px"                           -> prop `barRadius`
//   upstream line 54      transition: "height 0.1s ease",               -> REMOVED (see below)
//   upstream line 55      boxShadow: `0 0 10px rgba(59, 130, 246, 0.6)` -> prop `barGlow`
//
// REMOVED: the CSS `transition: "height 0.1s ease"` on every bar. Remotion
// renders every frame from scratch and a CSS transition is wall-clock driven,
// so it is non-deterministic in a frame render (contract addition C12). The
// bar heights are already computed per frame, so nothing visible is lost.
//
// ADDED (not present upstream): `import React from "react";`, the
// `SoundWaveProps` type, `defaultSoundWaveProps` (the upstream literals) and a
// trailing `export default SoundWave;`.
//
// NOT TOUCHED: the wave formula (`|sin(frame / 10 + i / 2)|` plus the seeded
// `random(i * 1000)` jitter — deterministic), the unused per-bar `hue`, the
// root's composition-sized box (`useVideoConfig()` width / height) and the
// centred flex layout. This template uses no SVG ids.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { random, useCurrentFrame, useVideoConfig } from "remotion";

export type SoundWaveProps = {
  /** Upstream literal: 40. */
  barCount?: number;
  /** Peak of the sine part of a bar's height, px. Upstream literal: 100. */
  amplitude?: number;
  /** Peak of the seeded random part of a bar's height, px. Upstream literal: 50. */
  jitter?: number;
  /** Upstream literal: "12px". */
  barWidth?: string;
  /** Upstream literal: "4px". */
  gap?: string;
  /** Upstream literal: "6px". */
  barRadius?: string;
  /** Upstream literal: "white". */
  barColor?: string;
  /** Upstream literal: "0 0 10px rgba(59, 130, 246, 0.6)". */
  barGlow?: string;
  /** Upstream literal: "blur(8px)". */
  backdropFilter?: string;
  /** Upstream literal: "inset 0 0 100px rgba(59, 130, 246, 0.2)". */
  insetGlow?: string;
};

export const defaultSoundWaveProps = {
  barCount: 40,
  amplitude: 100,
  jitter: 50,
  barWidth: "12px",
  gap: "4px",
  barRadius: "6px",
  barColor: "white",
  barGlow: "0 0 10px rgba(59, 130, 246, 0.6)",
  backdropFilter: "blur(8px)",
  insetGlow: "inset 0 0 100px rgba(59, 130, 246, 0.2)",
};

export const SoundWave: React.FC<SoundWaveProps> = ({
  barCount = defaultSoundWaveProps.barCount,
  amplitude = defaultSoundWaveProps.amplitude,
  jitter = defaultSoundWaveProps.jitter,
  barWidth = defaultSoundWaveProps.barWidth,
  gap = defaultSoundWaveProps.gap,
  barRadius = defaultSoundWaveProps.barRadius,
  barColor = defaultSoundWaveProps.barColor,
  barGlow = defaultSoundWaveProps.barGlow,
  backdropFilter = defaultSoundWaveProps.backdropFilter,
  insetGlow = defaultSoundWaveProps.insetGlow,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const BAR_COUNT = barCount;
  const bars = Array.from({ length: BAR_COUNT }).map((_, i) => {
    const seed = i * 1000;
    const height =
      Math.abs(Math.sin(frame / 10 + i / 2)) * amplitude + random(seed) * jitter;

    return {
      height,
      hue: (i / BAR_COUNT) * 180 + frame,
    };
  });

  return (
    <div
      style={{
        width,
        height,

        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap,
        backdropFilter,
        boxShadow: insetGlow,
      }}
    >
      {bars.map((bar, i) => (
        <div
          key={i}
          style={{
            width: barWidth,
            height: `${bar.height}px`,
            background: barColor,
            borderRadius: barRadius,
            boxShadow: barGlow,
          }}
        />
      ))}
    </div>
  );
};

export default SoundWave;
