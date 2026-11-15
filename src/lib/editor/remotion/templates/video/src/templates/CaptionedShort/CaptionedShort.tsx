import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "../../../../shim";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import { SNAPPY } from "../../lib/springs";
import { mix, palette, withAlpha } from "../../lib/colors";
import { INTER } from "../../lib/fonts";
import { SHORT_SAFE_AREA } from "../../lib/layout";
// Word-level timings. Generate your own with Whisper (see README) — the shape
// is [{ word, startMs, endMs }]. Bundled at build time to seed defaultProps.
import captionsSample from "../../../assets/captions.sample.json";

const captionWordSchema = z.object({
  word: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
});

export type CaptionWord = z.infer<typeof captionWordSchema>;

export const captionedShortSchema = z.object({
  captions: z.array(captionWordSchema).min(1),
  title: z.string(),
  accentColor: zColor(),
  backgroundColor: zColor(),
  // "single" shows one word at a time; "group" shows N words with the current
  // one highlighted (the classic TikTok/Reels karaoke look).
  mode: z.enum(["single", "group"]),
  wordsPerGroup: z.number().int().min(1).max(6),
});

export type CaptionedShortProps = z.infer<typeof captionedShortSchema>;

export const captionedShortDefaultProps: CaptionedShortProps = {
  captions: captionsSample as CaptionWord[],
  title: "Programmatic captions",
  accentColor: "#FACC15",
  backgroundColor: "#0B1220",
  mode: "group",
  wordsPerGroup: 3,
};

export const captionedShortCalculateMetadata: CalculateMetadataFunction<
  CaptionedShortProps
> = ({ props }) => {
  const fps = 30;
  const lastEnd = props.captions.reduce((m, c) => Math.max(m, c.endMs), 0);
  // Duration = last spoken word + a short tail so the final word can breathe.
  return {
    fps,
    durationInFrames: Math.ceil((lastEnd / 1000) * fps) + 20,
  };
};

// Index of the word being spoken at time `ms`. Falls back to the most recent
// word that has started (so captions hold through short silences), or -1 before
// the first word begins.
const activeWordIndex = (captions: CaptionWord[], ms: number): number => {
  for (let i = 0; i < captions.length; i++) {
    if (ms >= captions[i].startMs && ms < captions[i].endMs) return i;
  }
  let held = -1;
  for (let i = 0; i < captions.length; i++) {
    if (ms >= captions[i].startMs) held = i;
  }
  return held;
};

export const CaptionedShort: React.FC<CaptionedShortProps> = ({
  captions,
  title,
  accentColor,
  backgroundColor,
  mode,
  wordsPerGroup,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const ms = (frame / fps) * 1000;
  const totalMs = captions.reduce((m, c) => Math.max(m, c.endMs), 1);
  const active = activeWordIndex(captions, ms);
  const displayIndex = Math.max(0, active);

  // Pop the active word in from its own start frame.
  const wordStartMs = captions[displayIndex]?.startMs ?? 0;
  const localFrame = Math.max(0, frame - (wordStartMs / 1000) * fps);
  const pop = spring({ frame: localFrame, fps, config: SNAPPY });
  const popScale = interpolate(pop, [0, 1], [0.7, 1]);

  const progress = Math.min(1, ms / totalMs);

  // Which words to show.
  const groupStart =
    mode === "group"
      ? Math.floor(displayIndex / wordsPerGroup) * wordsPerGroup
      : displayIndex;
  const visible =
    mode === "group"
      ? captions.slice(groupStart, groupStart + wordsPerGroup)
      : [captions[displayIndex]];

  const barX = width * SHORT_SAFE_AREA.horizontal;
  const barW = width * (1 - SHORT_SAFE_AREA.horizontal * 2);
  const barY = height * (1 - SHORT_SAFE_AREA.bottom);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${backgroundColor} 0%, ${mix(
          backgroundColor,
          "#000000",
          0.5,
        )} 100%)`,
      }}
    >
      {/* Title chip near the top safe area */}
      <div
        style={{
          position: "absolute",
          top: height * SHORT_SAFE_AREA.top,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: INTER,
          fontWeight: 600,
          fontSize: 40,
          letterSpacing: 1,
          color: withAlpha(palette.white, 0.7),
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>

      {/* Captions, centered */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: `0 ${width * SHORT_SAFE_AREA.horizontal}px`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: 22,
          }}
        >
          {visible.map((word, i) => {
            if (!word) return null;
            const globalIndex = groupStart + i;
            const isActive = globalIndex === active;
            return (
              <span
                key={globalIndex}
                style={{
                  fontFamily: INTER,
                  fontWeight: 800,
                  fontSize: 118,
                  lineHeight: 1.05,
                  color: isActive ? accentColor : palette.white,
                  transform: isActive ? `scale(${popScale})` : "scale(1)",
                  opacity: isActive ? 1 : 0.55,
                  textShadow: `0 6px 30px ${withAlpha("#000000", 0.55)}`,
                  display: "inline-block",
                }}
              >
                {word.word}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Progress bar just above the bottom safe area */}
      <div
        style={{
          position: "absolute",
          left: barX,
          top: barY,
          width: barW,
          height: 10,
          borderRadius: 5,
          backgroundColor: withAlpha(palette.white, 0.18),
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            backgroundColor: accentColor,
            borderRadius: 5,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
