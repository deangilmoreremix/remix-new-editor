// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 3 upstream template
// upstream    : https://github.com/deangilmoreremix/remotion-video-templates (main @ 90149464d51a43fcb90e15491bf0d681c1b0fa49)
// upstream src: src/templates/LowerThirds/styles.tsx
// license     : MIT License — Copyright (c) 2026 Alejandro Brito. The MIT copyright notice and permission notice must be retained in all copies or substantial portions of the software.
// Upstream code is reproduced verbatim apart from this header comment.
// ---------------------------------------------------------------------------
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SafeArea } from "../../lib/layout";
import { SNAPPY } from "../../lib/springs";
import { palette, withAlpha } from "../../lib/colors";
import { INTER } from "../../lib/fonts";

// Props shared by all three lower-third styles. Timing is expressed in frames
// and split into three phases so the caller controls the whole envelope:
//   enter → hold → exit.
export type LowerThirdStyleProps = {
  name: string;
  role: string;
  accentColor: string;
  enterDurationInFrames: number;
  holdDurationInFrames: number;
  exitDurationInFrames: number;
};

// Total frames one style occupies on the timeline.
export const lowerThirdTotalFrames = (p: {
  enterDurationInFrames: number;
  holdDurationInFrames: number;
  exitDurationInFrames: number;
}): number =>
  p.enterDurationInFrames + p.holdDurationInFrames + p.exitDurationInFrames;

// Small hook shared by every style: returns a 0→1 enter value (spring) and a
// 0→1 exit value (linear), plus a combined opacity. Keeps the three phases in
// one place so all styles animate on the same clock.
const useEnvelope = (p: LowerThirdStyleProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: SNAPPY,
    durationInFrames: p.enterDurationInFrames,
  });

  const exitStart = p.enterDurationInFrames + p.holdDurationInFrames;
  const exit = interpolate(
    frame,
    [exitStart, exitStart + p.exitDurationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return { enter, exit, opacity: enter * (1 - exit) };
};

const nameStyle: React.CSSProperties = {
  fontFamily: INTER,
  fontWeight: 700,
  fontSize: 52,
  color: palette.ink,
  lineHeight: 1.05,
  margin: 0,
};

const roleStyle: React.CSSProperties = {
  fontFamily: INTER,
  fontWeight: 500,
  fontSize: 30,
  color: palette.zinc500,
  margin: 0,
};

// Style 1 — a solid accent bar slides in from the left with the text riding
// on top of a white card.
export const SlideInBar: React.FC<LowerThirdStyleProps> = (props) => {
  const { enter, exit, opacity } = useEnvelope(props);
  const x = interpolate(enter, [0, 1], [-90, 0]) + interpolate(exit, [0, 1], [0, -60]);

  return (
    <AbsoluteFill>
      <SafeArea>
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            transform: `translateX(${x}px)`,
            opacity,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: `0 20px 50px ${withAlpha(palette.ink, 0.14)}`,
          }}
        >
          <div style={{ width: 12, backgroundColor: props.accentColor }} />
          <div
            style={{
              backgroundColor: palette.white,
              padding: "22px 40px 22px 28px",
            }}
          >
            <p style={nameStyle}>{props.name}</p>
            <p style={roleStyle}>{props.role}</p>
          </div>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

// Style 2 — a boxed card that fades and scales up, with a tinted accent
// background and a left accent rule.
export const BoxedFade: React.FC<LowerThirdStyleProps> = (props) => {
  const { enter, opacity } = useEnvelope(props);
  const scale = interpolate(enter, [0, 1], [0.92, 1]);

  return (
    <AbsoluteFill>
      <SafeArea>
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "left bottom",
            opacity,
            backgroundColor: withAlpha(props.accentColor, 0.1),
            border: `1px solid ${withAlpha(props.accentColor, 0.35)}`,
            borderLeft: `6px solid ${props.accentColor}`,
            borderRadius: 16,
            padding: "24px 44px",
            backdropFilter: "blur(2px)",
          }}
        >
          <p style={{ ...nameStyle, color: palette.ink }}>{props.name}</p>
          <p style={{ ...roleStyle, color: props.accentColor, fontWeight: 600 }}>
            {props.role}
          </p>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

// Style 3 — minimal: a thin accent rule draws out horizontally and the text
// fades up beneath it. No card, maximum restraint.
export const MinimalLine: React.FC<LowerThirdStyleProps> = (props) => {
  const { enter, opacity } = useEnvelope(props);
  const lineScale = interpolate(enter, [0, 1], [0, 1]);
  const textY = interpolate(enter, [0, 1], [22, 0]);

  return (
    <AbsoluteFill>
      <SafeArea>
        <div style={{ opacity }}>
          <div
            style={{
              width: 340,
              height: 4,
              backgroundColor: props.accentColor,
              borderRadius: 2,
              transform: `scaleX(${lineScale})`,
              transformOrigin: "left center",
              marginBottom: 18,
            }}
          />
          <div style={{ transform: `translateY(${textY}px)` }}>
            <p style={{ ...nameStyle, fontSize: 58 }}>{props.name}</p>
            <p style={roleStyle}>{props.role}</p>
          </div>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};
