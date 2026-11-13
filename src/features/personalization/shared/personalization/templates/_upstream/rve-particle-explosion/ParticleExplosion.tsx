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
// SMARTVIDEO GO AI — Phase 4 batch 3h upstream template (repo 2: remotion-templates)
// template id : rve-particle-explosion
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/particle-explosion.tsx
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
//   upstream line 16  const PARTICLE_COUNT = 150;  -> `particleCount` prop (default 150)
//   upstream line 17  const TEXT = "BOOM!";        -> `text` prop (default "BOOM!")
//   upstream line 19  export default function ParticleExplosion() {
//                 ->  export const ParticleExplosion: React.FC<ParticleExplosionProps> = ({ ... }) => {
//   upstream line 25  const rotationSpeed = 0.02;  -> `rotationSpeed` prop (default 0.02)
//   upstream line 32  to: random(i) * 1.2 + 0.3,   -> random(i) * scaleJitter + scaleBase (1.2, 0.3)
//   upstream line 40  to: 180 + random(i) * 40,    -> distance + random(i) * distanceJitter (180, 40)
//                     (the upstream LOCAL `const distance = spring(…)` is renamed
//                     `dist` so it does not shadow the new `distance` prop)
//   upstream line 46  Math.max(0, 1 - frame / 90)  -> 1 - frame / fadeFrames (default 90)
//   upstream line 59  fontSize: "48px",      ->  textFontSize   (default "48px")
//   upstream line 60  fontWeight: "bold",    ->  textFontWeight (default "bold")
//   upstream line 61  color: "white",        ->  textColor      (default "white")
//   upstream line 62  textShadow: "0 0 10px rgba(255,255,255,0.5)", -> textShadow
//   upstream 77/78    width/height: "12px",  ->  particleSize   (default "12px")
//   upstream 79-81    backgroundColor: `hsl(${200 + (i / PARTICLE_COUNT) * 40}, 85%, 70%)`,
//                 ->  `hsl(${hueStart + (i / particleCount) * hueRange}, ${saturation}, ${lightness})`
//                     (defaults 200, 40, "85%", "70%")
//   upstream line 84  boxShadow: "0 0 5px rgba(255,255,255,0.3)", -> particleShadow
//
// ADDED (not present upstream): `import React from "react";`, the prop
// types, `defaultParticleExplosionProps`, a trailing `export default`, an
// OPTIONAL `particleColors` palette (default undefined = the upstream hsl
// ramp; when set, particle i takes `particleColors[i % length]`) and an
// OPTIONAL `textWhiteSpace` (default undefined = upstream wrapping).
//
// NOT TOUCHED: both springs (`mass: 0.3, damping: 12` scale and
// `mass: 0.4, damping: 10` distance), the rotating orbit, the text's
// `scale(Math.min(1, frame / 10))` pop and the root's transparent canvas.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { random, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type ParticleExplosionProps = {
  text?: string;
  particleCount?: number;
  rotationSpeed?: number;
  scaleBase?: number;
  scaleJitter?: number;
  distance?: number;
  distanceJitter?: number;
  fadeFrames?: number;
  textFontSize?: string;
  textFontWeight?: React.CSSProperties["fontWeight"];
  textColor?: string;
  textShadow?: string;
  particleSize?: string;
  hueStart?: number;
  hueRange?: number;
  saturation?: string;
  lightness?: string;
  particleShadow?: string;
  /** ADDED. */
  particleColors?: string[];
  /** ADDED. */
  textWhiteSpace?: React.CSSProperties["whiteSpace"];
};

export const defaultParticleExplosionProps = {
  text: "BOOM!",
  particleCount: 150,
  rotationSpeed: 0.02,
  scaleBase: 0.3,
  scaleJitter: 1.2,
  distance: 180,
  distanceJitter: 40,
  fadeFrames: 90,
  textFontSize: "48px",
  textFontWeight: "bold" as React.CSSProperties["fontWeight"],
  textColor: "white",
  textShadow: "0 0 10px rgba(255,255,255,0.5)",
  particleSize: "12px",
  hueStart: 200,
  hueRange: 40,
  saturation: "85%",
  lightness: "70%",
  particleShadow: "0 0 5px rgba(255,255,255,0.3)",
};

export const ParticleExplosion: React.FC<ParticleExplosionProps> = ({
  text = defaultParticleExplosionProps.text,
  particleCount = defaultParticleExplosionProps.particleCount,
  rotationSpeed = defaultParticleExplosionProps.rotationSpeed,
  scaleBase = defaultParticleExplosionProps.scaleBase,
  scaleJitter = defaultParticleExplosionProps.scaleJitter,
  distance = defaultParticleExplosionProps.distance,
  distanceJitter = defaultParticleExplosionProps.distanceJitter,
  fadeFrames = defaultParticleExplosionProps.fadeFrames,
  textFontSize = defaultParticleExplosionProps.textFontSize,
  textFontWeight = defaultParticleExplosionProps.textFontWeight,
  textColor = defaultParticleExplosionProps.textColor,
  textShadow = defaultParticleExplosionProps.textShadow,
  particleSize = defaultParticleExplosionProps.particleSize,
  hueStart = defaultParticleExplosionProps.hueStart,
  hueRange = defaultParticleExplosionProps.hueRange,
  saturation = defaultParticleExplosionProps.saturation,
  lightness = defaultParticleExplosionProps.lightness,
  particleShadow = defaultParticleExplosionProps.particleShadow,
  particleColors,
  textWhiteSpace,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const particles = Array.from({ length: particleCount }).map((_, i) => {
    const baseAngle = (i / particleCount) * Math.PI * 2;
    const rotatingAngle = baseAngle + frame * rotationSpeed;

    const scale = spring({
      frame,
      fps,
      from: 0,
      to: random(i) * scaleJitter + scaleBase,
      config: { mass: 0.3, damping: 12 },
    });

    const dist = spring({
      frame,
      fps,
      from: 0,
      to: distance + random(i) * distanceJitter,
      config: { mass: 0.4, damping: 10 },
    });

    const x = Math.cos(rotatingAngle) * dist;
    const y = Math.sin(rotatingAngle) * dist;
    const opacity = Math.max(0, 1 - frame / fadeFrames);

    return { x, y, opacity, scale };
  });

  return (
    <div style={{ width, height, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${Math.min(1, frame / 10)})`,
          fontSize: textFontSize,
          fontWeight: textFontWeight,
          color: textColor,
          textShadow,
          zIndex: 2,
          ...(textWhiteSpace ? { whiteSpace: textWhiteSpace } : null),
        }}
      >
        {text}
      </div>

      {particles.map((particle, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) translate(${particle.x}px, ${particle.y}px) scale(${particle.scale})`,
            width: particleSize,
            height: particleSize,
            backgroundColor:
              particleColors && particleColors.length > 0
                ? particleColors[i % particleColors.length]
                : `hsl(${hueStart + (i / particleCount) * hueRange}, ${saturation}, ${lightness})`,
            borderRadius: "50%",
            opacity: particle.opacity,
            boxShadow: particleShadow,
          }}
        />
      ))}
    </div>
  );
};

export default ParticleExplosion;
