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
// template id : rve-blinds-transition
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/blinds-transition.tsx
// license     : MIT License. The upstream repository ships NO LICENSE file and
//               names NO copyright holder; its README states "All templates in
//               this repository are available under the MIT License." The
//               verbatim MIT permission notice (WITHOUT a copyright line) ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// The upstream has NO props. Every hard-coded string, colour and dimension
// became an OPTIONAL prop whose default reproduces the upstream literal;
// rendering with no props reproduces the upstream design.
//
//   export default function BlindsTransition()
//     -> export const BlindsTransition: React.FC<BlindsTransitionProps>
//   root backgroundColor "#111827"            -> backgroundColor
//   blindCount = 8                             -> blindCount        (default 8)
//   perspective(800px)                         -> perspective       (default "800px")
//   Scene B panel (underneath) literals        -> sceneB.*          (defaults below)
//   Scene A panel (in the blinds) literals     -> sceneA.*          (defaults below)
//     background / icon size, radius, gradient, margin / title text, colour,
//     size, weight, family / subtitle text, colour, size, margin.
//   Scene markup: the icon + h2 + p block, written twice upstream, is
//     rendered by a local `SceneContent` helper; the DOM is identical.
//     `scene.content` (render slot) replaces that block when provided, so an
//     adapter can paint its own "before" card and leave the "after" side empty.
//   Slice offset: upstream offsets each blind's inner panel with
//     `marginTop: -i * 100%`. A percentage margin resolves against the WIDTH,
//     so in a landscape canvas only the first blind shows Scene A. That stays
//     the default; `alignSlices` (default false) switches to `top: -i * 100%`
//     (resolved against the blind's height) so every blind shows its slice.
//
// ADDED: `import React`, the prop types, the default objects and a trailing
// `export default BlindsTransition;`.
//
// NOT TOUCHED: the blind timing (`delay = i * 3`, rotation 0 -> 90 between
// fps * 0.5 + delay and fps * 1.5 + delay, clamped), transformOrigin,
// backfaceVisibility and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export type BlindsTransitionScene = {
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

export type BlindsTransitionProps = {
  /** Root fill. Upstream literal: "#111827". */
  backgroundColor?: string;
  /** Number of blinds. Upstream literal: 8. */
  blindCount?: number;
  /** CSS perspective of each blind. Upstream literal: "800px". */
  perspective?: string;
  /** Use a height-relative slice offset (see deviation record). Default false. */
  alignSlices?: boolean;
  /** The "before" scene, drawn on the blinds. */
  sceneA?: BlindsTransitionScene;
  /** The "after" scene, underneath the blinds. */
  sceneB?: BlindsTransitionScene;
};

export const defaultBlindsSceneA: BlindsTransitionScene = {
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
  subtitle: "Blinds opening...",
  subtitleColor: "#93c5fd",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
};

export const defaultBlindsSceneB: BlindsTransitionScene = {
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
  subtitle: "Behind the blinds",
  subtitleColor: "#c084fc",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
};

export const defaultBlindsTransitionProps = {
  backgroundColor: "#111827",
  blindCount: 8,
  perspective: "800px",
  alignSlices: false,
  sceneA: defaultBlindsSceneA,
  sceneB: defaultBlindsSceneB,
};

const SceneContent: React.FC<{ scene: BlindsTransitionScene }> = ({ scene }) => {
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

export const BlindsTransition: React.FC<BlindsTransitionProps> = ({
  backgroundColor = defaultBlindsTransitionProps.backgroundColor,
  blindCount = defaultBlindsTransitionProps.blindCount,
  perspective = defaultBlindsTransitionProps.perspective,
  alignSlices = defaultBlindsTransitionProps.alignSlices,
  sceneA: sceneAOverride,
  sceneB: sceneBOverride,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneA = { ...defaultBlindsSceneA, ...sceneAOverride };
  const sceneB = { ...defaultBlindsSceneB, ...sceneBOverride };

  const blinds = Array.from({ length: blindCount });

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

      {/* Blinds containing Scene A */}
      {blinds.map((_, i) => {
        const delay = i * 3;
        const rotation = interpolate(frame, [fps * 0.5 + delay, fps * 1.5 + delay], [0, 90], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${(i / blindCount) * 100}%`,
              left: 0,
              width: "100%",
              height: `${100 / blindCount}%`,
              overflow: "hidden",
              transformOrigin: "center top",
              transform: `perspective(${perspective}) rotateX(${rotation}deg)`,
              backfaceVisibility: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: alignSlices ? `${-i * 100}%` : 0,
                left: 0,
                width: "100%",
                height: `${blindCount * 100}%`,
                marginTop: alignSlices ? 0 : `${-i * 100}%`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                background: sceneA.background,
              }}
            >
              <SceneContent scene={sceneA} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BlindsTransition;
