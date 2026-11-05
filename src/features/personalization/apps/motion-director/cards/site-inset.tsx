import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { CardDef } from "./types";

/**
 * Site inset — a framed picture of the user's own site (a captured page, card crop or
 * site image) floating in a corner of a shot. Film building adds one to every shot that
 * does not draw captured pages itself, so the site's imagery is on screen in every scene.
 * Pure function of the frame (no randomness): a short slide-and-fade in, then it holds.
 */
const src = (file: string): string => (/^(?:blob:|data:|https?:\/\/)/i.test(file) ? file : staticFile(file));

const SiteInset: React.FC<{ file?: string; side?: string; sizePct?: number; label?: string; accent?: string; focusY?: number }> = ({
  file = "",
  side = "right",
  sizePct = 32,
  label = "",
  accent = "#b5651d",
  focusY = 0,
}) => {
  const frame = useCurrentFrame();
  if (!file) return null;
  const enter = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const from = side === "left" ? -1 : 1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: "7%",
          [side === "left" ? "left" : "right"]: "4%",
          width: `${sizePct}%`,
          aspectRatio: "16 / 10",
          borderRadius: 18,
          overflow: "hidden",
          background: "#fff",
          border: "2px solid rgba(255,255,255,0.35)",
          boxShadow: `0 24px 60px rgba(0,0,0,0.35), 0 0 0 4px ${accent}33`,
          opacity: enter,
          transform: `translateX(${(1 - enter) * from * 60}px) scale(${0.96 + enter * 0.04})`,
        }}
      >
        <Img src={src(file)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `50% ${focusY}%` }} />
        {label ? (
          <div
            style={{
              position: "absolute",
              left: 14,
              bottom: 12,
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              font: "600 32px/1 system-ui, sans-serif",
              maxWidth: "80%",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const siteInsetCard: CardDef = {
  id: "site-inset",
  name: "站点画面",
  nameEn: "Site inset",
  category: "素材",
  categoryEn: "Media",
  durationInFrames: 900,
  accent: "#64d2ff",
  component: SiteInset as React.ComponentType<Record<string, unknown>>,
  summaryEn: "A framed picture of your site (captured page, card or image) floating in a corner of the shot.",
  schema: [
    { type: "text", key: "file", label: "图片地址", default: "" },
    {
      type: "select",
      key: "side",
      label: "位置",
      default: "right",
      options: [
        { value: "right", label: "右上" },
        { value: "left", label: "左上" },
      ],
    },
    { type: "slider", key: "sizePct", label: "宽度", default: 32, min: 18, max: 60, step: 1, unit: "%" },
    { type: "text", key: "label", label: "角标", default: "" },
    { type: "slider", key: "focusY", label: "页面位置", default: 0, min: 0, max: 100, step: 1, unit: "%" },
    { type: "color", key: "accent", label: "强调色", default: "#b5651d" },
  ],
};
