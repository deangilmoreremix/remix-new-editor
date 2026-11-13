/**
 * Free Remotion Template Component
 * ---------------------------------
 * This template is free to use in your projects!
 * Credit appreciated but not required.
 *
 * Created by the team at https://www.reactvideoeditor.com
 *
 * (The upstream file itself opens directly with "use client"; the credit
 * above is the repository-wide credit every remotion-templates file carries
 * and is reproduced here so it travels with the copy.)
 */

// ---------------------------------------------------------------------------
// OPENHIGGSBOLT — Phase 4 batch 3g upstream template (repo 2: remotion-templates)
// template id : rve-clock-wipe
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/clock-wipe.tsx
// license     : MIT License (README statement; no LICENSE file, no named
//               copyright holder). The verbatim MIT permission notice ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// Every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal; no props = the upstream design.
//
//   export default function ClockWipe()
//     -> export const ClockWipe: React.FC<ClockWipeProps>
//   root backgroundColor "#111827"            -> backgroundColor
//   Scene B panel (underneath) literals        -> sceneB.*
//   Scene A panel (clipped, on top) literals   -> sceneA.*
//   Scene markup: the icon + h2 + p block is rendered by a local
//     `SceneContent` helper (identical DOM); `scene.content` is a render slot
//     that replaces it when provided.
//   Wipe direction: the upstream polygon is the SWEPT wedge, so Scene A grows
//     clockwise from nothing and vanishes at 360 degrees. That stays the
//     default. `invertWipe` (default false) clips Scene A to the
//     complementary region instead, so Scene A starts full and is wiped
//     away clockwise (the classic clock-wipe reveal). Same angle, same timing.
//
// ADDED: `import React`, prop types, default objects, the `perimeterPoint`
// helper used only by `invertWipe`, and a trailing default export.
//
// NOT TOUCHED: the timing (`totalFrames = fps * 2.5`, angle 0 -> 360, clamped
// right), the upstream polygon expression and the opacity cut at 360.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export type ClockWipeScene = {
  background?: string;
  iconSize?: string;
  iconBorderRadius?: string;
  iconBackground?: string;
  iconMarginBottom?: string;
  title?: string;
  titleColor?: string;
  titleFontSize?: string;
  titleFontWeight?: string;
  titleFontFamily?: string;
  subtitle?: string;
  subtitleColor?: string;
  subtitleFontSize?: string;
  subtitleMarginTop?: string;
  /** Render slot: replaces the icon + title + subtitle block when provided. */
  content?: React.ReactNode;
};

export type ClockWipeProps = {
  /** Root fill. Upstream literal: "#111827". */
  backgroundColor?: string;
  /** Clip Scene A to the un-swept region (wipe it away). Default false. */
  invertWipe?: boolean;
  sceneA?: ClockWipeScene;
  sceneB?: ClockWipeScene;
};

export const defaultClockWipeSceneA: ClockWipeScene = {
  background: "linear-gradient(135deg, #1e3a5f, #111827)",
  iconSize: "80px",
  iconBorderRadius: "50%",
  iconBackground: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  iconMarginBottom: "1rem",
  title: "Scene A",
  titleColor: "white",
  titleFontSize: "2.5rem",
  titleFontWeight: "bold",
  titleFontFamily: "Inter, sans-serif",
  subtitle: "Clock wipe transition",
  subtitleColor: "#93c5fd",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
};

export const defaultClockWipeSceneB: ClockWipeScene = {
  background: "linear-gradient(135deg, #3b1f5e, #111827)",
  iconSize: "80px",
  iconBorderRadius: "12px",
  iconBackground: "linear-gradient(135deg, #a855f7, #7209b7)",
  iconMarginBottom: "1rem",
  title: "Scene B",
  titleColor: "white",
  titleFontSize: "2.5rem",
  titleFontWeight: "bold",
  titleFontFamily: "Inter, sans-serif",
  subtitle: "Revealed by clock wipe",
  subtitleColor: "#c084fc",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
};

export const defaultClockWipeProps = {
  backgroundColor: "#111827",
  invertWipe: false,
  sceneA: defaultClockWipeSceneA,
  sceneB: defaultClockWipeSceneB,
};

const SceneContent: React.FC<{ scene: ClockWipeScene }> = ({ scene }) => {
  if (scene.content !== undefined) return <>{scene.content}</>;
  return (
    <>
      <div
        style={{
          width: scene.iconSize,
          height: scene.iconSize,
          borderRadius: scene.iconBorderRadius,
          background: scene.iconBackground,
          marginBottom: scene.iconMarginBottom,
        }}
      />
      <h2
        style={{
          color: scene.titleColor,
          fontSize: scene.titleFontSize,
          fontWeight: scene.titleFontWeight,
          margin: 0,
          fontFamily: scene.titleFontFamily,
        }}
      >
        {scene.title}
      </h2>
      <p style={{ color: scene.subtitleColor, fontSize: scene.subtitleFontSize, marginTop: scene.subtitleMarginTop }}>
        {scene.subtitle}
      </p>
    </>
  );
};

/**
 * ADDED (invertWipe only): where a ray from the centre, `deg` degrees
 * clockwise from 12 o'clock, leaves the unit square — in percent.
 */
function perimeterPoint(deg: number): string {
  const rad = (deg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const k = 50 / Math.max(Math.abs(dx), Math.abs(dy), 1e-9);
  return `${50 + dx * k}% ${50 + dy * k}%`;
}

function invertedPolygon(angle: number): string {
  const corners: Array<[number, string]> = [
    [45, "100% 0%"],
    [135, "100% 100%"],
    [225, "0% 100%"],
    [315, "0% 0%"],
  ];
  const points = ["50% 50%", perimeterPoint(angle)];
  for (const [cornerAngle, point] of corners) {
    if (cornerAngle > angle) points.push(point);
  }
  points.push("50% 0%");
  return `polygon(${points.join(", ")})`;
}

export const ClockWipe: React.FC<ClockWipeProps> = ({
  backgroundColor = defaultClockWipeProps.backgroundColor,
  invertWipe = defaultClockWipeProps.invertWipe,
  sceneA: sceneAOverride,
  sceneB: sceneBOverride,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneA = { ...defaultClockWipeSceneA, ...sceneAOverride };
  const sceneB = { ...defaultClockWipeSceneB, ...sceneBOverride };

  const totalFrames = fps * 2.5;

  const angle = interpolate(frame, [0, totalFrames], [0, 360], {
    extrapolateRight: "clamp",
  });

  const upstreamClip = `polygon(50% 50%, 50% 0%, ${angle <= 90 ? `${50 + 50 * Math.tan((angle * Math.PI) / 180)}% 0%` : "100% 0%"}${angle > 90 ? `, 100% ${angle <= 180 ? `${50 * Math.tan(((angle - 90) * Math.PI) / 180)}%` : "100%"}` : ""}${angle > 180 ? `, ${100 - 50 * Math.tan(((angle - 180) * Math.PI) / 180)}% 100%` : ""}${angle > 270 ? `, 0% ${100 - 50 * Math.tan(((angle - 270) * Math.PI) / 180)}%` : ""}${angle >= 360 ? ", 0% 0%, 50% 0%" : ""})`;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor,
        overflow: "hidden",
      }}
    >
      {/* Scene B (underneath) - Purple */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: sceneB.background,
        }}
      >
        <SceneContent scene={sceneB} />
      </div>

      {/* Scene A (on top, wiped away) - Blue */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: sceneA.background,
          clipPath: invertWipe ? invertedPolygon(angle) : upstreamClip,
          opacity: angle >= 360 ? 0 : 1,
        }}
      >
        <SceneContent scene={sceneA} />
      </div>
    </div>
  );
};

export default ClockWipe;
