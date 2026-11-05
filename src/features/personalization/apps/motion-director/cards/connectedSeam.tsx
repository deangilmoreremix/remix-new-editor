import React, { useContext } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { CardDef } from "./types";
import { ClipBody, FilmContext } from "../preview/clipBody";
import { WINDOW_SOURCES, seamLook, stageRect, type SeamKind } from "../lib/seams";

interface Props {
  kind?: SeamKind;
  /** The clip that ends at the cut and the clip that starts there (ids on the shots track). */
  outId?: string;
  inId?: string;
  /** Frames on each side of the cut. */
  half?: number;
  dir?: 1 | -1;
  accent?: string;
  page?: string;
}

/**
 * A seam built from the two real shots around a cut (upstream shot-transitions card): the outgoing shot
 * runs on into its hold, the incoming one starts its entrance half a seam early, and the style moves, masks
 * or blurs them. The incoming clip on the shots track starts `half` frames into its own motion, so the film
 * continues exactly where the seam leaves it. Without the two clips (deleted in the workbench) it draws nothing.
 */
const ConnectedSeam: React.FC<Props> = ({ kind = "flash", outId, inId, half = 8, dir = 1, accent, page }) => {
  const frame = useCurrentFrame();
  const film = useContext(FilmContext);
  if (!film) return null;
  const clips = film.project.tracks.flatMap((t) => t.clips);
  const out = clips.find((c) => c.id === outId);
  const inc = clips.find((c) => c.id === inId);
  const outCard = out && film.cards[out.cardId];
  const inCard = inc && film.cards[inc.cardId];
  if (!out || !inc || !outCard || !inCard) return null;
  const length = Math.max(2, half * 2);
  const look = seamLook(kind, (frame + 0.5) / length, { dir, accent, page, stage: stageRect(film.project.width, film.project.height), from: WINDOW_SOURCES[out.cardId] });
  const seamStart = inc.start - half;
  return (
    <AbsoluteFill style={{ background: page ?? "#000", overflow: "hidden" }}>
      {look.out.display !== "none" && (
        <ClipBody clip={out} card={outCard} project={film.project} inOffset={out.inOffset + (seamStart - out.start) * out.speed} style={look.out} />
      )}
      {look.in.display !== "none" && (
        <ClipBody clip={inc} card={inCard} project={film.project} inOffset={Math.max(0, inc.inOffset - half * inc.speed)} style={look.in} />
      )}
      {look.over && <div style={{ position: "absolute", inset: 0, pointerEvents: "none", ...look.over }} />}
    </AbsoluteFill>
  );
};

export const connectedSeamCard: CardDef = {
  id: "connected-seam",
  name: "镜头衔接",
  nameEn: "Connected seam",
  category: "内置卡",
  categoryEn: "Built-in cards",
  accent: "#f7c948",
  durationInFrames: 16,
  component: ConnectedSeam as React.ComponentType<Record<string, unknown>>,
  summary: "Joins two shots across the cut: both real shots play through the seam (flash, whip-pan, through-the-window, wipe, push, iris…).",
  summaryEn: "Joins two shots across the cut: both real shots play through the seam (flash, whip-pan, through-the-window, wipe, push, iris…).",
  schema: [
    {
      type: "select", key: "kind", label: "Style", default: "flash",
      options: [
        { value: "flash", label: "Push-in flash" },
        { value: "whip", label: "Whip-pan" },
        { value: "window", label: "Through the window" },
        { value: "wipe", label: "Wipe" },
        { value: "barn", label: "Barn door" },
        { value: "push", label: "Bottom push" },
        { value: "iris", label: "Iris" },
        { value: "ink", label: "Ink bleed" },
        { value: "portal", label: "Portal" },
        { value: "line", label: "Line carry" },
        { value: "dip", label: "Dip" },
        { value: "leak", label: "Light leak" },
        { value: "glitch", label: "Glitch" },
      ],
    },
  ],
};
