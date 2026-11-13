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
// OPENHIGGSBOLT — Phase 4 batch 3g upstream template (repo 2: remotion-templates)
// template id : rve-card-flip
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/card-flip.tsx
// license     : MIT License (README statement; no LICENSE file, no named
//               copyright holder). The verbatim MIT permission notice ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// Every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal; no props = the upstream design.
//
//   export default function CardFlip()
//     -> export const CardFlip: React.FC<CardFlipProps>
//   perspective "1000px"                       -> perspective
//   width "300px" / height "400px"             -> cardWidth / cardHeight
//   spring `to: 360`                           -> rotateTo      (default 360)
//   ADDED `startFrame` (default 0): the spring reads `frame - startFrame`, so
//     an adapter can hold the front face before the flip. 0 = upstream.
//   front face: background "linear-gradient(45deg, #1e3a8a, #3b82f6)",
//     borderRadius "20px", fontSize "2rem", fontWeight "bold", color "white",
//     text "Remotion 👋"                       -> front.*
//   back face: same literals, text "Back"      -> back.*
//   ADDED face.content: a render slot that replaces the face's text when
//     provided (the face box and its styles are unchanged).
//
// ADDED: `import React`, prop types, default objects, the local `Face`
// helper (identical DOM for both faces) and a trailing default export.
//
// NOT TOUCHED: the spring config (damping 15, mass 0.5, from 0), the
// translate / rotateY transform, preserve-3d and backfaceVisibility.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export type CardFlipFace = {
  text?: string;
  background?: string;
  borderRadius?: string;
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  /** Render slot: replaces the face text when provided. */
  content?: React.ReactNode;
};

export type CardFlipProps = {
  perspective?: string;
  cardWidth?: string;
  cardHeight?: string;
  /** Final rotation of the spring, degrees. Upstream literal: 360. */
  rotateTo?: number;
  /** Frames to hold before the spring starts. Upstream: 0. */
  startFrame?: number;
  front?: CardFlipFace;
  back?: CardFlipFace;
};

export const defaultCardFlipFront: CardFlipFace = {
  text: "Remotion 👋",
  background: "linear-gradient(45deg, #1e3a8a, #3b82f6)",
  borderRadius: "20px",
  fontSize: "2rem",
  fontWeight: "bold",
  color: "white",
};

export const defaultCardFlipBack: CardFlipFace = {
  text: "Back",
  background: "linear-gradient(45deg, #1e3a8a, #3b82f6)",
  borderRadius: "20px",
  fontSize: "2rem",
  fontWeight: "bold",
  color: "white",
};

export const defaultCardFlipProps = {
  perspective: "1000px",
  cardWidth: "300px",
  cardHeight: "400px",
  rotateTo: 360,
  startFrame: 0,
  front: defaultCardFlipFront,
  back: defaultCardFlipBack,
};

const Face: React.FC<{ face: CardFlipFace; isBack: boolean }> = ({ face, isBack }) => (
  <div
    style={{
      position: "absolute",
      width: "100%",
      height: "100%",
      backfaceVisibility: "hidden",
      background: face.background,
      borderRadius: face.borderRadius,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontSize: face.fontSize,
      fontWeight: face.fontWeight,
      color: face.color,
      transform: isBack ? "rotateY(180deg)" : undefined,
    }}
  >
    {face.content !== undefined ? face.content : face.text}
  </div>
);

export const CardFlip: React.FC<CardFlipProps> = ({
  perspective = defaultCardFlipProps.perspective,
  cardWidth = defaultCardFlipProps.cardWidth,
  cardHeight = defaultCardFlipProps.cardHeight,
  rotateTo = defaultCardFlipProps.rotateTo,
  startFrame = defaultCardFlipProps.startFrame,
  front: frontOverride,
  back: backOverride,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const front = { ...defaultCardFlipFront, ...frontOverride };
  const back = { ...defaultCardFlipBack, ...backOverride };

  const rotation = spring({
    frame: frame - startFrame,
    fps,
    from: 0,
    to: rotateTo,
    config: {
      damping: 15,
      mass: 0.5,
    },
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        perspective,
      }}
    >
      <div
        style={{
          width: cardWidth,
          height: cardHeight,
          transform: `translate(-50%, -50%) rotateY(${rotation}deg)`,
          transformStyle: "preserve-3d",
          position: "relative",
        }}
      >
        <Face face={front} isBack={false} />
        <Face face={back} isBack />
      </div>
    </div>
  );
};

export default CardFlip;
