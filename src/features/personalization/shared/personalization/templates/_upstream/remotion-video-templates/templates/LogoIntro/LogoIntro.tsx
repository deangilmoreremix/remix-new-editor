// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 3 upstream template
// upstream    : https://github.com/deangilmoreremix/remotion-video-templates (main @ 90149464d51a43fcb90e15491bf0d681c1b0fa49)
// upstream src: src/templates/LogoIntro/LogoIntro.tsx
// license     : MIT License — Copyright (c) 2026 Alejandro Brito. The MIT copyright notice and permission notice must be retained in all copies or substantial portions of the software.
// MODIFIED: one line. staticFile(logoSrc) became logoSrc so the customer's logo URL loads (staticFile() throws on URLs).
// ---------------------------------------------------------------------------
import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import { BOUNCE, SNAPPY } from "../../lib/springs";
import { mix, withAlpha } from "../../lib/colors";

export const logoIntroSchema = z.object({
  // File name inside public/. Referenced with staticFile() at render time.
  logoSrc: z.string(),
  brandColor: zColor(),
  accentColor: zColor(),
  backgroundColor: zColor(),
  // Number of particles that burst outward on the reveal.
  particleCount: z.number().int().min(0).max(80),
});

export type LogoIntroProps = z.infer<typeof logoIntroSchema>;

export const logoIntroDefaultProps: LogoIntroProps = {
  logoSrc: "logo.svg",
  brandColor: "#2563EB",
  accentColor: "#0EA5E9",
  backgroundColor: "#FFFFFF",
  particleCount: 28,
};

// Frame the burst kicks off on. The logo settles slightly before this so the
// particles read as "energy released" by the reveal.
const BURST_FRAME = 16;

const Particles: React.FC<{
  count: number;
  brandColor: string;
  accentColor: string;
}> = ({ count, brandColor, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2;

  // A single spring drives every particle's outward travel. Because it is a
  // pure function of `frame`, the burst is identical on every render pass.
  const burst = spring({ frame, fps, config: BOUNCE, delay: BURST_FRAME });

  return (
    <>
      {new Array(count).fill(0).map((_, i) => {
        // Deterministic per-particle randomness. `random(seed)` is Remotion's
        // seeded PRNG — never Math.random(), which would flicker frame to frame.
        const angle = random(`angle-${i}`) * Math.PI * 2;
        const distance = 140 + random(`dist-${i}`) * 360;
        const size = 5 + random(`size-${i}`) * 13;
        const tint = random(`tint-${i}`) > 0.5 ? brandColor : accentColor;

        const x = Math.cos(angle) * distance * burst;
        const y = Math.sin(angle) * distance * burst;
        // Fade each particle in as it launches, then out as it reaches its apex.
        const opacity = interpolate(burst, [0, 0.15, 1], [0, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx + x,
              top: cy + y,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderRadius: "50%",
              backgroundColor: tint,
              opacity,
            }}
          />
        );
      })}
    </>
  );
};

export const LogoIntro: React.FC<LogoIntroProps> = ({
  logoSrc,
  brandColor,
  accentColor,
  backgroundColor,
  particleCount,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Scale overshoot: BOUNCE lets the logo punch past 1 and settle back.
  const pop = spring({ frame, fps, config: BOUNCE });
  const scale = interpolate(pop, [0, 1], [0.4, 1]);

  // Mask wipe: a diagonal clip that uncovers the logo left-to-right.
  const wipe = spring({ frame, fps, config: SNAPPY });
  const clip = `inset(0 ${(1 - wipe) * 100}% 0 0)`;

  // Soft radial glow behind the mark, tied to the brand color.
  const glow = interpolate(pop, [0, 1], [0, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Gentle settle drift and a fade-out on the last 12 frames.
  const settleY = interpolate(pop, [0, 1], [24, 0]);
  const outro = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {/* Faint brand-tinted vignette so the mark sits on more than flat white. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 48%, ${withAlpha(
            mix(brandColor, accentColor, 0.4),
            glow,
          )} 0%, ${withAlpha(backgroundColor, 0)} 55%)`,
        }}
      />

      <Particles
        count={particleCount}
        brandColor={brandColor}
        accentColor={accentColor}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: outro,
        }}
      >
        <div
          style={{
            transform: `translateY(${settleY}px) scale(${scale})`,
            clipPath: clip,
            WebkitClipPath: clip,
            filter: `drop-shadow(0 24px 60px ${withAlpha(brandColor, 0.25)})`,
          }}
        >
          <Img
            src={logoSrc}
            style={{ width: 460, height: 460, objectFit: "contain" }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
