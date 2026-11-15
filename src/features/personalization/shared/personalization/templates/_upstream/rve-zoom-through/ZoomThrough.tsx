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
// template id : rve-zoom-through
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/zoom-through.tsx
// license     : MIT License (README statement; no LICENSE file, no named
//               copyright holder). The verbatim MIT permission notice ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// Every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal; no props = the upstream design.
//
//   export default function ZoomThrough()
//     -> export const ZoomThrough: React.FC<ZoomThroughProps>
//   root backgroundColor "#111827"            -> backgroundColor
//   Scene A literals (icon, h2 "Zooming In...") -> sceneA.*
//   Scene B literals (icon, h2 "Arriving...")   -> sceneB.*
//   ADDED scene.background (default undefined = no background, the upstream
//     DOM) and scene.subtitle (default undefined = no <p>; the upstream
//     scenes have no subtitle line).
//   Scene markup: rendered by a local `SceneContent` helper (identical DOM);
//     `scene.content` is a render slot that replaces it when provided.
//
// ADDED: `import React`, prop types, default objects, trailing default export.
//
// NOT TOUCHED: the timing (midPoint fps * 1.25, total fps * 2.5; A scale
// 1 -> 3 and fade out to the midpoint, B scale 3 -> 1 and fade in after it)
// and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export type ZoomThroughScene = {
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
  /** Render slot: replaces the icon + title block when provided. */
  content?: React.ReactNode;
};

export type ZoomThroughProps = {
  /** Root fill. Upstream literal: "#111827". */
  backgroundColor?: string;
  sceneA?: ZoomThroughScene;
  sceneB?: ZoomThroughScene;
};

export const defaultZoomSceneA: ZoomThroughScene = {
  background: undefined,
  iconSize: "80px",
  iconBorderRadius: "50%",
  iconBackground: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  iconMarginBottom: "1rem",
  title: "Zooming In...",
  titleColor: "white",
  titleFontSize: "2.5rem",
  titleFontWeight: "bold",
  titleFontFamily: "Inter, sans-serif",
  subtitle: undefined,
};

export const defaultZoomSceneB: ZoomThroughScene = {
  background: undefined,
  iconSize: "80px",
  iconBorderRadius: "12px",
  iconBackground: "linear-gradient(135deg, #a855f7, #7209b7)",
  iconMarginBottom: "1rem",
  title: "Arriving...",
  titleColor: "white",
  titleFontSize: "2.5rem",
  titleFontWeight: "bold",
  titleFontFamily: "Inter, sans-serif",
  subtitle: undefined,
};

export const defaultZoomThroughProps = {
  backgroundColor: "#111827",
  sceneA: defaultZoomSceneA,
  sceneB: defaultZoomSceneB,
};

const SceneContent: React.FC<{ scene: ZoomThroughScene }> = ({ scene }) => {
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
      {scene.subtitle !== undefined && (
        <p style={{ color: scene.subtitleColor, fontSize: scene.subtitleFontSize, marginTop: scene.subtitleMarginTop }}>
          {scene.subtitle}
        </p>
      )}
    </>
  );
};

export const ZoomThrough: React.FC<ZoomThroughProps> = ({
  backgroundColor = defaultZoomThroughProps.backgroundColor,
  sceneA: sceneAOverride,
  sceneB: sceneBOverride,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneA = { ...defaultZoomSceneA, ...sceneAOverride };
  const sceneB = { ...defaultZoomSceneB, ...sceneBOverride };

  const midPoint = fps * 1.25;
  const totalFrames = fps * 2.5;

  // Scene A: scale 1→3, opacity 1→0
  const scaleA = interpolate(frame, [0, midPoint], [1, 3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacityA = interpolate(frame, [0, midPoint], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scene B: scale 3→1, opacity 0→1
  const scaleB = interpolate(frame, [midPoint, totalFrames], [3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacityB = interpolate(frame, [midPoint, totalFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
      {/* Scene A */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: sceneA.background,
          opacity: opacityA,
          transform: `scale(${scaleA})`,
        }}
      >
        <SceneContent scene={sceneA} />
      </div>

      {/* Scene B */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: sceneB.background,
          opacity: opacityB,
          transform: `scale(${scaleB})`,
        }}
      >
        <SceneContent scene={sceneB} />
      </div>
    </div>
  );
};

export default ZoomThrough;
