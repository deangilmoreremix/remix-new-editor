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
// template id : rve-push-transition
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/push-transition.tsx
// license     : MIT License (README statement; no LICENSE file, no named
//               copyright holder). The verbatim MIT permission notice ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// Every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal; no props = the upstream design.
//
//   export default function PushTransition()
//     -> export const PushTransition: React.FC<PushTransitionProps>
//   root backgroundColor "#111827"            -> backgroundColor
//   Scene A literals (panel, icon, h2, p)      -> sceneA.*
//   Scene B literals (panel, icon, h2, p)      -> sceneB.*
//   Scene markup: rendered by a local `SceneContent` helper (identical DOM);
//     `scene.content` is a render slot that replaces it when provided.
//
// ADDED: `import React`, prop types, default objects, trailing default export.
//
// NOT TOUCHED: the spring (starts at fps * 0.8; damping 15, stiffness 80,
// mass 0.8), the translate expressions and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";

export type PushTransitionScene = {
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

export type PushTransitionProps = {
  /** Root fill. Upstream literal: "#111827". */
  backgroundColor?: string;
  sceneA?: PushTransitionScene;
  sceneB?: PushTransitionScene;
};

export const defaultPushSceneA: PushTransitionScene = {
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
  subtitle: "Being pushed out...",
  subtitleColor: "#93c5fd",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
};

export const defaultPushSceneB: PushTransitionScene = {
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
  subtitle: "Pushing in...",
  subtitleColor: "#c084fc",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
};

export const defaultPushTransitionProps = {
  backgroundColor: "#111827",
  sceneA: defaultPushSceneA,
  sceneB: defaultPushSceneB,
};

const SceneContent: React.FC<{ scene: PushTransitionScene }> = ({ scene }) => {
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

export const PushTransition: React.FC<PushTransitionProps> = ({
  backgroundColor = defaultPushTransitionProps.backgroundColor,
  sceneA: sceneAOverride,
  sceneB: sceneBOverride,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneA = { ...defaultPushSceneA, ...sceneAOverride };
  const sceneB = { ...defaultPushSceneB, ...sceneBOverride };

  const pushProgress = spring({
    frame: frame - fps * 0.8,
    fps,
    config: {
      damping: 15,
      stiffness: 80,
      mass: 0.8,
    },
  });

  const translateA = -pushProgress * 100;
  const translateB = (1 - pushProgress) * 100;

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
      {/* Scene A - Blue */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: sceneA.background,
          transform: `translateX(${translateA}%)`,
        }}
      >
        <SceneContent scene={sceneA} />
      </div>

      {/* Scene B - Purple */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: sceneB.background,
          transform: `translateX(${translateB}%)`,
        }}
      >
        <SceneContent scene={sceneB} />
      </div>
    </div>
  );
};

export default PushTransition;
