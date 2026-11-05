import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { CardDef } from "./types";
import { TEXT_BASIC_SCHEMA } from "./cardSchemas";
import { FONT_STACK, lerp, power2Out, power3Out, power4Out, tw } from "./shared";

// text-basic · 通用文字卡 —— 工作台原生卡：内容/字号/颜色/入场动画全部属性化
const FPS = 30;

interface Props {
  content?: string;
  fontSize?: number;
  color?: string;
  bg?: string;
  transparentBg?: boolean;
  fontWeight?: string;
  letterSpacing?: number;
  align?: string;
  anim?: string;
  delay?: number;
  animDur?: number;
}

const TextBasic: React.FC<Props> = ({
  content = "Type your text here",
  fontSize = 64,
  color = "#1d1d1f",
  bg = "#ffffff",
  transparentBg = false,
  fontWeight = "700",
  letterSpacing = 0,
  align = "center",
  anim = "fade-up",
  delay = 0.3,
  animDur = 0.4,
}) => {
  const t = useCurrentFrame() / FPS;
  const lines = String(content).split("\n");

  let opacity = 1;
  let transform = "";
  let clipPath: string | undefined;
  if (anim === "fade-up") {
    const p = tw(t, delay, animDur, power3Out);
    opacity = p;
    transform = `translateY(${lerp(24, 0, p)}px)`;
  } else if (anim === "slam") {
    const p = tw(t, delay, animDur, power4Out);
    opacity = p;
    transform = `scale(${lerp(1.12, 1, p)})`;
  } else if (anim === "mask") {
    const p = tw(t, delay, animDur, power3Out);
    clipPath = `inset(0 ${lerp(100, 0, p)}% 0 0)`;
  } else if (anim === "typewriter") {
    const total = String(content).length || 1;
    const shown = Math.floor(tw(t, delay, animDur, (x) => x) * total);
    const remain = String(content).slice(0, shown);
    const tLines = remain.split("\n");
    return (
      <AbsoluteFill
        style={{
          background: transparentBg ? "transparent" : bg,
          display: "flex",
          alignItems: "center",
          justifyContent:
            align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
          padding: "0 72px",
          fontFamily: FONT_STACK,
        }}
      >
        <div
          style={{
            fontSize,
            fontWeight: Number(fontWeight),
            color,
            letterSpacing,
            lineHeight: 1.3,
            textAlign: align as React.CSSProperties["textAlign"],
            whiteSpace: "pre-wrap",
          }}
        >
          {tLines.join("\n")}
        </div>
      </AbsoluteFill>
    );
  } else if (anim === "fade") {
    opacity = tw(t, delay, animDur, power2Out);
  }

  return (
    <AbsoluteFill
      style={{
        background: transparentBg ? "transparent" : bg,
        display: "flex",
        alignItems: "center",
        justifyContent:
          align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
        padding: "0 72px",
        fontFamily: FONT_STACK,
      }}
    >
      <div
        style={{
          fontSize,
          fontWeight: Number(fontWeight),
          color,
          letterSpacing,
          lineHeight: 1.3,
          opacity,
          transform,
          clipPath,
          textAlign: align as React.CSSProperties["textAlign"],
          whiteSpace: "pre-wrap",
        }}
      >
        {lines.join("\n")}
      </div>
    </AbsoluteFill>
  );
};

export const textBasicCard: CardDef = {
  id: "text-basic",
  name: "通用文字",
  category: "内置卡",
  categoryEn: "Built-in cards",
  durationInFrames: 120,
  accent: "#0a84ff",
  component: TextBasic as React.ComponentType<Record<string, unknown>>,
  schema: TEXT_BASIC_SCHEMA,
};
