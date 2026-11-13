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
// template id : rve-iris-transition
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/iris-transition.tsx
// license     : MIT License (README statement; no LICENSE file, no named
//               copyright holder). The verbatim MIT permission notice ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// Every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal; no props = the upstream design.
//
//   export default function IrisTransition()
//     -> export const IrisTransition: React.FC<IrisTransitionProps>
//   root backgroundColor "#000000"            -> backgroundColor
//   Scene A literals (panel, icon, h2, p)      -> sceneA.*
//   Scene B literals (panel, icon, h2, p)      -> sceneB.*
//   Scene markup: rendered by a local `SceneContent` helper (identical DOM);
//     `scene.content` is a render slot that replaces it when provided.
//   ADDED `irisOutsideColor` (default undefined = not rendered). Upstream the
//     area outside the iris is simply the opaque root fill. An overlay needs a
//     transparent root, so when this prop is set an extra layer paints that
//     colour OUTSIDE the current iris circle (same radius as the clip-path:
//     r % of sqrt((w^2 + h^2) / 2), the CSS reference length for circle()).
//
// ADDED: `import React`, prop types, default objects, trailing default export.
//
// NOT TOUCHED: the timing (midPoint fps * 1.25, total fps * 2.5, radius
// 75 -> 0 -> 75 with the upstream clamps), the scene swap at midPoint and the
// clip-path expression.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export type IrisTransitionScene = {
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

export type IrisTransitionProps = {
  /** Root fill. Upstream literal: "#000000". */
  backgroundColor?: string;
  /** Colour painted outside the iris (overlay use). Upstream: not rendered. */
  irisOutsideColor?: string;
  sceneA?: IrisTransitionScene;
  sceneB?: IrisTransitionScene;
};

export const defaultIrisSceneA: IrisTransitionScene = {
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
  subtitle: "Iris closing...",
  subtitleColor: "#93c5fd",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
};

export const defaultIrisSceneB: IrisTransitionScene = {
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
  subtitle: "Iris opening...",
  subtitleColor: "#c084fc",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
};

export const defaultIrisTransitionProps = {
  backgroundColor: "#000000",
  irisOutsideColor: undefined as string | undefined,
  sceneA: defaultIrisSceneA,
  sceneB: defaultIrisSceneB,
};

const SceneContent: React.FC<{ scene: IrisTransitionScene }> = ({ scene }) => {
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

export const IrisTransition: React.FC<IrisTransitionProps> = ({
  backgroundColor = defaultIrisTransitionProps.backgroundColor,
  irisOutsideColor = defaultIrisTransitionProps.irisOutsideColor,
  sceneA: sceneAOverride,
  sceneB: sceneBOverride,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const sceneA = { ...defaultIrisSceneA, ...sceneAOverride };
  const sceneB = { ...defaultIrisSceneB, ...sceneBOverride };

  const midPoint = fps * 1.25;
  const totalFrames = fps * 2.5;

  // First half: iris closes (75% → 0%)
  // Second half: iris opens (0% → 75%)
  const radius = frame <= midPoint
    ? interpolate(frame, [0, midPoint], [75, 0], {
        extrapolateRight: "clamp",
      })
    : interpolate(frame, [midPoint, totalFrames], [0, 75], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  const showSceneA = frame <= midPoint;

  // ADDED (irisOutsideColor only): the clip-path radius in px.
  const radiusPx = (radius / 100) * Math.sqrt((width * width + height * height) / 2);

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
      {/* Scene underneath (B when closing, A already gone) */}
      {!showSceneA && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: sceneB.background,
            clipPath: `circle(${radius}% at 50% 50%)`,
          }}
        >
          <SceneContent scene={sceneB} />
        </div>
      )}

      {/* Scene A with iris closing */}
      {showSceneA && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: sceneA.background,
            clipPath: `circle(${radius}% at 50% 50%)`,
          }}
        >
          <SceneContent scene={sceneA} />
        </div>
      )}

      {irisOutsideColor !== undefined && (
        <div
          data-iris-outside
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle ${Math.max(1, radiusPx)}px at 50% 50%, transparent ${Math.max(0, radiusPx - 1)}px, ${irisOutsideColor} ${Math.max(0, radiusPx)}px)`,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

export default IrisTransition;
