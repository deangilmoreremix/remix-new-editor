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
// template id : rve-fade-through-black
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/fade-through-black.tsx
// license     : MIT License (README statement; no LICENSE file, no named
//               copyright holder). The verbatim MIT permission notice ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// Every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal; no props = the upstream design.
//
//   export default function FadeThroughBlack()
//     -> export const FadeThroughBlack: React.FC<FadeThroughBlackProps>
//   root backgroundColor "#111827"            -> backgroundColor
//   overlay backgroundColor "#000000"          -> overlayColor
//   Scene 1 literals (icon, h2, p)             -> scene1.*
//   Scene 2 literals (icon, h2, p)             -> scene2.*
//   ADDED scene.background: the upstream scenes have NO background of their
//     own; the optional prop defaults to undefined (upstream DOM).
//   Scene markup: rendered by a local `SceneContent` helper (identical DOM);
//     `scene.content` is a render slot that replaces it when provided.
//
// ADDED: `import React`, prop types, default objects, trailing default export.
//
// NOT TOUCHED: the timing (`totalFrames = fps * 3`, midpoint, the three
// interpolations and their clamps) and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export type FadeThroughBlackScene = {
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

export type FadeThroughBlackProps = {
  /** Root fill. Upstream literal: "#111827". */
  backgroundColor?: string;
  /** The through-colour overlay. Upstream literal: "#000000". */
  overlayColor?: string;
  scene1?: FadeThroughBlackScene;
  scene2?: FadeThroughBlackScene;
};

export const defaultFadeThroughBlackScene1: FadeThroughBlackScene = {
  background: undefined,
  iconSize: "80px",
  iconBorderRadius: "50%",
  iconBackground: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  iconMarginBottom: "1rem",
  title: "Scene 1",
  titleColor: "white",
  titleFontSize: "2.5rem",
  titleFontWeight: "bold",
  titleFontFamily: undefined,
  subtitle: "Fading out...",
  subtitleColor: "#93c5fd",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
};

export const defaultFadeThroughBlackScene2: FadeThroughBlackScene = {
  background: undefined,
  iconSize: "80px",
  iconBorderRadius: "12px",
  iconBackground: "linear-gradient(135deg, #a855f7, #7c3aed)",
  iconMarginBottom: "1rem",
  title: "Scene 2",
  titleColor: "white",
  titleFontSize: "2.5rem",
  titleFontWeight: "bold",
  titleFontFamily: undefined,
  subtitle: "Fading in...",
  subtitleColor: "#c084fc",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
};

export const defaultFadeThroughBlackProps = {
  backgroundColor: "#111827",
  overlayColor: "#000000",
  scene1: defaultFadeThroughBlackScene1,
  scene2: defaultFadeThroughBlackScene2,
};

const SceneContent: React.FC<{ scene: FadeThroughBlackScene }> = ({ scene }) => {
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

export const FadeThroughBlack: React.FC<FadeThroughBlackProps> = ({
  backgroundColor = defaultFadeThroughBlackProps.backgroundColor,
  overlayColor = defaultFadeThroughBlackProps.overlayColor,
  scene1: scene1Override,
  scene2: scene2Override,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scene1 = { ...defaultFadeThroughBlackScene1, ...scene1Override };
  const scene2 = { ...defaultFadeThroughBlackScene2, ...scene2Override };

  const totalFrames = fps * 3;
  const midpoint = totalFrames / 2;

  // Scene 1 fades out in the first half
  const scene1Opacity = interpolate(frame, [0, midpoint], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scene 2 fades in during the second half
  const scene2Opacity = interpolate(frame, [midpoint, totalFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Black overlay peaks at midpoint
  const blackOpacity = interpolate(
    frame,
    [0, midpoint * 0.7, midpoint, midpoint * 1.3, totalFrames],
    [0, 0.8, 1, 0.8, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

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
      {/* Scene 1 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: scene1.background,
          opacity: scene1Opacity,
        }}
      >
        <SceneContent scene={scene1} />
      </div>

      {/* Scene 2 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: scene2.background,
          opacity: scene2Opacity,
        }}
      >
        <SceneContent scene={scene2} />
      </div>

      {/* Black overlay for the through-black transition */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: overlayColor,
          opacity: blackOpacity,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

export default FadeThroughBlack;
