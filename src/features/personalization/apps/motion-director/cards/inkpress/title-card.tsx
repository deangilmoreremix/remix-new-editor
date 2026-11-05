import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from "remotion";
import type { CardDef } from "../types";
import { TITLE_CARD_SCHEMA } from "../cardSchemas";
import { DigitRoll } from "./digit-roll";

// 字卡 · Ink Press —— 参数化版（源出 template/src/aifl/PaperTitleCard.tsx，动效逐字同式）
// 开放：文案（*词* 标强调）、副标、数字副标、纸底/墨色/琥珀色、字号、下划线宽。
// 节奏命门 FIXED：逐词 4f 错峰 / 9f 入场、下划线 16–34f、尾 8f 淡出。

const SERIF = 'ui-serif, Georgia, "Times New Roman", serif';
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** 文案 DSL：空格分词，`*词*` 为琥珀斜体强调词 */
export const parseWords = (text: string) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      // `*word*` with punctuation outside the stars ("Meet *Acme*.") still marks the word.
      const m = w.match(/^([^\w*]*)\*(.+?)\*([^\w*]*)$/);
      return m ? { text: `${m[1]}${m[2]}${m[3]}`, accent: true } : { text: w.replace(/\*/g, ""), accent: false };
    });

interface Props {
  text?: string;
  sub?: string;
  subDigits?: string;
  bg?: string;
  ink?: string;
  accent?: string;
  fontSize?: number;
  underlineWidth?: number;
  duration?: number;
  /** Brand logo URL shown above the line (Brand Kit); empty for none. */
  logo?: string;
  logoHeight?: number;
}

const TitleCard: React.FC<Props> = ({
  text = "All your team’s research, *one* place to go.",
  sub = "",
  subDigits = "",
  bg = "#f7f4ee",
  ink = "#1c1a17",
  accent = "#b5651d",
  fontSize = 116,
  underlineWidth = 220,
  duration = 55,
  logo = "",
  logoHeight = 110,
}) => {
  const frame = useCurrentFrame();
  const words = parseWords(text);
  const fadeOut = interpolate(frame, [duration - 8, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const underline = interpolate(frame, [16, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.3, 0, 0.2, 1),
  });
  const subT = interpolate(frame, [10, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // The logo stamps in just ahead of the words.
  const logoT = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.75, 0.3, 1),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
        backgroundImage: "radial-gradient(1100px 750px at 50% 42%, rgba(255,252,244,0.85), transparent 65%)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 1500 }}>
        {logo ? (
          <Img
            src={logo}
            style={{
              height: logoHeight, maxWidth: 520, objectFit: "contain", display: "block", margin: "0 auto 40px",
              opacity: logoT, transform: `scale(${1.12 - 0.12 * logoT})`,
            }}
          />
        ) : null}
        <div
          style={{
            fontFamily: SERIF, fontSize, fontWeight: 600, lineHeight: 1.14,
            color: ink, letterSpacing: "-0.012em",
            display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "0.26em",
          }}
        >
          {words.map((w, i) => {
            const delay = 4 + i * 4;
            const t = interpolate(frame, [delay, delay + 9], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.2, 0.75, 0.3, 1),
            });
            return (
              <span
                key={i}
                style={{
                  opacity: t,
                  transform: `scale(${1.28 - 0.28 * t})`,
                  filter: `blur(${(1 - t) * 7}px)`,
                  display: "inline-block",
                  fontStyle: w.accent ? "italic" : "normal",
                  color: w.accent ? accent : undefined,
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
        <div
          style={{
            height: 6, width: underlineWidth, margin: "38px auto 0", borderRadius: 3,
            background: accent, transform: `scaleX(${underline})`,
          }}
        />
        {sub ? (
          <div style={{ fontFamily: MONO, fontSize: 32, letterSpacing: "0.1em", color: "rgba(28,26,23,0.62)", marginTop: 34, opacity: subT, textTransform: "uppercase", display: "flex", justifyContent: "center", alignItems: "baseline", gap: "0.5em" }}>
            {subDigits ? <DigitRoll value={subDigits} delay={12} fontSize={26} color={accent} /> : null}
            <span>{sub}</span>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const titleCardCard: CardDef = {
  id: "inkpress-title-card",
  name: "字卡 · Ink Press",
  category: "内置卡",
  categoryEn: "Built-in cards",
  durationInFrames: 55,
  accent: "#b5651d",
  durationProp: "duration",
  component: TitleCard as React.ComponentType<Record<string, unknown>>,
  summary: "衬线大字逐词压印入场，*词* 标琥珀斜体强调，下划线生长；尾 8 帧淡出",
  schema: TITLE_CARD_SCHEMA,
};
