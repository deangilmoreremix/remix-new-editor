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
// template id : rve-cross-dissolve
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/cross-dissolve.tsx
// license     : MIT License (README statement; no LICENSE file, no named
//               copyright holder). The verbatim MIT permission notice ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// Every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal; no props = the upstream design.
//
//   export default function CrossDissolve()
//     -> export const CrossDissolve: React.FC<CrossDissolveProps>
//   root backgroundColor "#111827"            -> backgroundColor
//   Scene A literals (icon, h2, p)             -> sceneA.*
//   Scene B literals (icon, h2, p)             -> sceneB.*
//   ADDED scene.background: the upstream scene panels have NO background of
//     their own (both sit on the root fill). The new optional prop defaults
//     to undefined, i.e. no background — exactly the upstream DOM.
//   Scene markup: rendered by a local `SceneContent` helper (identical DOM);
//     `scene.content` is a render slot that replaces it when provided.
//
// ADDED: `import React`, prop types, default objects, trailing default export.
//
// NOT TOUCHED: the timing (`totalFrames = fps * 2.5`, linear progress, A
// opacity 1 - progress, B opacity progress) and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

export type CrossDissolveScene = {
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

export type CrossDissolveProps = {
  /** Root fill. Upstream literal: "#111827". */
  backgroundColor?: string;
  sceneA?: CrossDissolveScene;
  sceneB?: CrossDissolveScene;
};

export const defaultCrossDissolveSceneA: CrossDissolveScene = {
  background: undefined,
  iconSize: "80px",
  iconBorderRadius: "50%",
  iconBackground: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  iconMarginBottom: "1rem",
  title: "Scene A",
  titleColor: "white",
  titleFontSize: "2.5rem",
  titleFontWeight: "bold",
  titleFontFamily: undefined,
  subtitle: "Dissolving away...",
  subtitleColor: "#93c5fd",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
};

export const defaultCrossDissolveSceneB: CrossDissolveScene = {
  background: undefined,
  iconSize: "80px",
  iconBorderRadius: "12px",
  iconBackground: "linear-gradient(135deg, #a855f7, #7c3aed)",
  iconMarginBottom: "1rem",
  title: "Scene B",
  titleColor: "white",
  titleFontSize: "2.5rem",
  titleFontWeight: "bold",
  titleFontFamily: undefined,
  subtitle: "Appearing...",
  subtitleColor: "#c084fc",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
};

export const defaultCrossDissolveProps = {
  backgroundColor: "#111827",
  sceneA: defaultCrossDissolveSceneA,
  sceneB: defaultCrossDissolveSceneB,
};

const SceneContent: React.FC<{ scene: CrossDissolveScene }> = ({ scene }) => {
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

export const CrossDissolve: React.FC<CrossDissolveProps> = ({
  backgroundColor = defaultCrossDissolveProps.backgroundColor,
  sceneA: sceneAOverride,
  sceneB: sceneBOverride,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneA = { ...defaultCrossDissolveSceneA, ...sceneAOverride };
  const sceneB = { ...defaultCrossDissolveSceneB, ...sceneBOverride };

  const totalFrames = fps * 2.5;
  const progress = Math.min(frame / totalFrames, 1);

  // Scene A fades out while Scene B fades in simultaneously
  const sceneAOpacity = 1 - progress;
  const sceneBOpacity = progress;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor,
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
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
          opacity: sceneAOpacity,
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
          opacity: sceneBOpacity,
        }}
      >
        <SceneContent scene={sceneB} />
      </div>
    </div>
  );
};

export default CrossDissolve;
