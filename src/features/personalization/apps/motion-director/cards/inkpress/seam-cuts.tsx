import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { CardDef } from "../types";
import { SEAM_WIPE_SCHEMA, SEAM_BARN_SCHEMA, SEAM_DIP_SCHEMA, SEAM_LEAK_SCHEMA } from "../cardSchemas";

// Seam transitions placed on the cut between two scenes. The seam is the middle frame:
// the first half covers the outgoing scene, the second half uncovers the incoming one,
// so the real cut happens while the frame is fully covered.

const ease = Easing.inOut(Easing.cubic);
/** 0 → 1 over the first half, 1 → 0 over the second (1 = fully covered at the cut). */
const cover = (frame: number, duration: number) =>
  interpolate(frame, [0, duration / 2, duration], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

type Dir = "left" | "right" | "up" | "down";

interface WipeProps {
  color?: string;
  dir?: Dir;
  duration?: number;
}

const SeamWipe: React.FC<WipeProps> = ({ color = "#14110f", dir = "right", duration = 16 }) => {
  const frame = useCurrentFrame();
  const half = duration / 2;
  // Enter from `dir`'s opposite edge to cover, leave through `dir`'s edge.
  const t = frame < half
    ? interpolate(frame, [0, half], [-100, 0], { extrapolateRight: "clamp", easing: ease })
    : interpolate(frame, [half, duration], [0, 100], { extrapolateLeft: "clamp", easing: ease });
  const vertical = dir === "up" || dir === "down";
  const sign = dir === "left" || dir === "up" ? -1 : 1;
  const off = t * sign;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: color,
        transform: vertical ? `translateY(${off}%)` : `translateX(${off}%)`,
      }}
    />
  );
};

interface BarnProps {
  color?: string;
  duration?: number;
}

const SeamBarn: React.FC<BarnProps> = ({ color = "#14110f", duration = 16 }) => {
  const frame = useCurrentFrame();
  const c = cover(frame, duration);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50.2%", background: color, transform: `translateX(${(c - 1) * 100}%)` }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50.2%", background: color, transform: `translateX(${(1 - c) * 100}%)` }} />
    </AbsoluteFill>
  );
};

interface DipProps {
  color?: string;
  duration?: number;
}

const SeamDip: React.FC<DipProps> = ({ color = "#14110f", duration = 14 }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ pointerEvents: "none", background: color, opacity: cover(frame, duration) }} />;
};

interface WhipProps {
  color?: string;
  duration?: number;
}

/** Whip-pan: a streak of colour that crosses the frame fast, with soft edges, hiding the cut. */
const SeamWhip: React.FC<WhipProps> = ({ color = "#14110f", duration = 12 }) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, duration], [-120, 120], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "-30%",
          width: "160%",
          transform: `translateX(${x}%) skewX(-14deg)`,
          background: `linear-gradient(90deg, transparent 0%, ${color}cc 28%, ${color} 50%, ${color}cc 72%, transparent 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Ink bleed: a circle of colour grows from the centre over the cut and shrinks away on the next scene. */
const SeamInk: React.FC<WhipProps> = ({ color = "#14110f", duration = 18 }) => {
  const frame = useCurrentFrame();
  const r = cover(frame, duration) * 80;
  return <AbsoluteFill style={{ pointerEvents: "none", background: color, clipPath: `circle(${r}% at 50% 50%)` }} />;
};

interface LeakProps {
  color?: string;
  peak?: number;
  duration?: number;
}

/** Light leak: a warm glow blooms from one corner across the cut (counts as a light effect). */
const SeamLeak: React.FC<LeakProps> = ({ color = "#ffb45a", peak = 0.9, duration = 20 }) => {
  const frame = useCurrentFrame();
  const o = cover(frame, duration) * peak;
  const drift = interpolate(frame, [0, duration], [-8, 8]);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: o,
        background: `radial-gradient(ellipse at ${85 + drift}% 15%, ${color}, ${color}99 35%, transparent 70%), radial-gradient(ellipse at ${15 - drift}% 90%, ${color}88, transparent 60%)`,
      }}
    />
  );
};

/** Portal: a glowing ring opens from the centre across the cut (its disc softly fills the frame at the cut). */
const SeamPortal: React.FC<WhipProps> = ({ color = "#14110f", duration = 20 }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const r = t * 95;
  const fill = cover(frame, duration) * 0.85;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: `radial-gradient(circle at 50% 50%, ${color}${Math.round(fill * 255).toString(16).padStart(2, "0")} 0%, transparent ${Math.max(0, r - 8)}%, ${color} ${r}%, transparent ${r + 7}%)`,
      }}
    />
  );
};

/** Iris: the frame closes to a point in the page colour and opens on the next scene (the cut hides in the dark). */
const SeamIris: React.FC<WhipProps> = ({ color = "#14110f", duration = 18 }) => {
  const frame = useCurrentFrame();
  const hole = (1 - cover(frame, duration)) * 75;
  return <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(circle at 50% 50%, transparent ${hole}%, ${color} ${hole + 1.5}%)` }} />;
};

/** Line carry: a single line crosses the frame top to bottom with a soft trail; the cut is made as it passes the centre. */
const SeamLine: React.FC<WhipProps> = ({ color = "#f7c948", duration = 14 }) => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, duration], [-6, 106], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: `${y - 14}%`, height: "14%", background: `linear-gradient(180deg, transparent, ${color}33)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: `${y}%`, height: 6, background: color, boxShadow: `0 0 28px 6px ${color}` }} />
    </AbsoluteFill>
  );
};

/** Glitch: horizontal slices jump sideways in cyan / magenta at the cut (a whole-frame hit, so it counts with the flash cuts). */
const SLICES = [0.08, 0.19, 0.31, 0.43, 0.52, 0.64, 0.77, 0.9];
const SeamGlitch: React.FC<{ duration?: number }> = ({ duration = 10 }) => {
  const frame = useCurrentFrame();
  const o = cover(frame, duration);
  if (o <= 0.02) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: o }}>
      {SLICES.map((y, i) => {
        const dir = i % 2 ? 1 : -1;
        const dx = dir * (40 + ((i * 53 + frame * 37) % 160));
        return (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: `${y * 100}%`, height: `${4 + ((i * 7) % 6)}%`, transform: `translateX(${dx}px)`, background: i % 3 === 0 ? "#00e5ff" : i % 3 === 1 ? "#ff2bd6" : "#ffffff", mixBlendMode: "screen", opacity: 0.55 }} />
        );
      })}
    </AbsoluteFill>
  );
};

const base = { category: "内置卡", categoryEn: "Built-in cards", accent: "#f7c948", durationProp: "duration" } as const;

export const seamWipeCard: CardDef = {
  ...base,
  id: "inkpress-seam-wipe",
  name: "擦除转场",
  nameEn: "Wipe seam",
  durationInFrames: 16,
  component: SeamWipe as React.ComponentType<Record<string, unknown>>,
  summary: "A colour panel sweeps across the cut; the scene changes while it covers the frame.",
  schema: SEAM_WIPE_SCHEMA,
};

export const seamBarnCard: CardDef = {
  ...base,
  id: "inkpress-seam-barn",
  name: "对开门转场",
  nameEn: "Barn-door seam",
  durationInFrames: 16,
  component: SeamBarn as React.ComponentType<Record<string, unknown>>,
  summary: "Two panels close from the sides and open on the next scene.",
  schema: SEAM_BARN_SCHEMA,
};

export const seamDipCard: CardDef = {
  ...base,
  id: "inkpress-seam-dip",
  name: "渐隐转场",
  nameEn: "Dip seam",
  durationInFrames: 14,
  component: SeamDip as React.ComponentType<Record<string, unknown>>,
  summary: "The frame dips into the page colour and comes back on the next scene.",
  schema: SEAM_DIP_SCHEMA,
};

export const seamWhipCard: CardDef = {
  ...base,
  id: "inkpress-seam-whip",
  name: "快摇转场",
  nameEn: "Whip-pan seam",
  durationInFrames: 12,
  component: SeamWhip as React.ComponentType<Record<string, unknown>>,
  summary: "A fast streak of colour crosses the frame and hides the cut.",
  schema: SEAM_DIP_SCHEMA,
};

export const seamInkCard: CardDef = {
  ...base,
  id: "inkpress-seam-ink",
  name: "墨晕转场",
  nameEn: "Ink-bleed seam",
  durationInFrames: 18,
  component: SeamInk as React.ComponentType<Record<string, unknown>>,
  summary: "A circle of colour grows from the centre over the cut and shrinks away.",
  schema: SEAM_DIP_SCHEMA,
};

export const seamLeakCard: CardDef = {
  ...base,
  id: "inkpress-seam-leak",
  name: "漏光转场",
  nameEn: "Light-leak seam",
  durationInFrames: 20,
  component: SeamLeak as React.ComponentType<Record<string, unknown>>,
  summary: "A warm glow blooms across the cut (a light effect: at most one per film).",
  schema: SEAM_LEAK_SCHEMA,
};

export const seamPortalCard: CardDef = {
  ...base,
  id: "inkpress-seam-portal",
  name: "传送门转场",
  nameEn: "Portal seam",
  durationInFrames: 20,
  component: SeamPortal as React.ComponentType<Record<string, unknown>>,
  summary: "A ring opens from the centre across the cut.",
  schema: SEAM_DIP_SCHEMA,
};

export const seamIrisCard: CardDef = {
  ...base,
  id: "inkpress-seam-iris",
  name: "光圈转场",
  nameEn: "Iris seam",
  durationInFrames: 18,
  component: SeamIris as React.ComponentType<Record<string, unknown>>,
  summary: "The frame closes to a point and opens on the next scene; the cut hides in the dark.",
  schema: SEAM_DIP_SCHEMA,
};

export const seamLineCard: CardDef = {
  ...base,
  id: "inkpress-seam-line",
  name: "线条转场",
  nameEn: "Line-carry seam",
  durationInFrames: 14,
  component: SeamLine as React.ComponentType<Record<string, unknown>>,
  summary: "A single line crosses the frame and carries the eye into the next scene.",
  schema: SEAM_DIP_SCHEMA,
};

export const seamGlitchCard: CardDef = {
  ...base,
  id: "inkpress-seam-glitch",
  name: "故障转场",
  nameEn: "Glitch seam",
  durationInFrames: 10,
  component: SeamGlitch as React.ComponentType<Record<string, unknown>>,
  summary: "Colour slices jump sideways at the cut (a whole-frame hit: counts with the flash cuts).",
  schema: [],
};
