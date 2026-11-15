import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "../../../../shim";
import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import { SNAPPY, GENTLE } from "../../lib/springs";
import { palette, withAlpha } from "../../lib/colors";
import { INTER } from "../../lib/fonts";

const promoFeatureSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export const promoTemplateSchema = z.object({
  productName: z.string(),
  tagline: z.string(),
  features: z.array(promoFeatureSchema).min(1).max(3),
  // File names in public/, paired with features by index (wraps if shorter).
  screenshots: z.array(z.string()).min(1),
  cta: z.string(),
  accentColor: zColor(),
});

export type PromoTemplateProps = z.infer<typeof promoTemplateSchema>;

// Scene lengths in frames.
const HOOK = 70;
const FEATURE = 90;
const CTA = 80;
const TRANSITION = 20;

export const promoTemplateDefaultProps: PromoTemplateProps = {
  productName: "Morph",
  tagline: "Database migrations, written by AI.",
  features: [
    { title: "Describe the change", description: "Plain English in, a reviewed migration out." },
    { title: "Safe by default", description: "Dry-run diffs and rollback on every apply." },
    { title: "Ships anywhere", description: "Postgres, MySQL and SQLite from one workflow." },
  ],
  screenshots: ["screenshot-1.svg", "screenshot-2.svg", "screenshot-1.svg"],
  cta: "Try it free at morph.dev",
  accentColor: "#2563EB",
};

// Total timeline = Σ sequence durations − Σ transition durations. With one hook,
// N feature scenes and one CTA there are (N + 1) transitions between them.
export const promoTemplateCalculateMetadata: CalculateMetadataFunction<
  PromoTemplateProps
> = ({ props }) => {
  const n = props.features.length;
  const total = HOOK + n * FEATURE + CTA - (n + 1) * TRANSITION;
  return { durationInFrames: total };
};

const eyebrow: React.CSSProperties = {
  fontFamily: INTER,
  fontWeight: 700,
  fontSize: 30,
  letterSpacing: 6,
  textTransform: "uppercase",
};

const HookScene: React.FC<{ productName: string; tagline: string; accent: string }> = ({
  productName,
  tagline,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: SNAPPY });
  const y = interpolate(enter, [0, 1], [40, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.white,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center", opacity: enter, transform: `translateY(${y}px)` }}>
        <div style={{ ...eyebrow, color: accent, marginBottom: 24 }}>Introducing</div>
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 800,
            fontSize: 170,
            color: palette.ink,
            lineHeight: 1,
          }}
        >
          {productName}
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 500,
            fontSize: 52,
            color: palette.zinc500,
            marginTop: 24,
          }}
        >
          {tagline}
        </div>
        <div
          style={{
            width: 120,
            height: 6,
            backgroundColor: accent,
            borderRadius: 3,
            margin: "40px auto 0",
            transform: `scaleX(${enter})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const FeatureScene: React.FC<{
  index: number;
  title: string;
  description: string;
  screenshot: string;
  accent: string;
}> = ({ index, title, description, screenshot, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Callout slides in from the left.
  const enter = spring({ frame, fps, config: SNAPPY });
  const calloutX = interpolate(enter, [0, 1], [-60, 0]);

  // Ken Burns pan on the screenshot: slow zoom + drift (GENTLE, no bounce).
  const pan = spring({ frame, fps, config: GENTLE, durationInFrames: FEATURE });
  const scale = interpolate(pan, [0, 1], [1.12, 1.02]);
  const drift = interpolate(pan, [0, 1], [-18, 18]);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.zinc50, flexDirection: "row" }}>
      {/* Callout column */}
      <div
        style={{
          width: "42%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          opacity: enter,
          transform: `translateX(${calloutX}px)`,
        }}
      >
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 20,
            backgroundColor: withAlpha(accent, 0.12),
            color: accent,
            fontFamily: INTER,
            fontWeight: 800,
            fontSize: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 34,
          }}
        >
          {index + 1}
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 800,
            fontSize: 76,
            color: palette.ink,
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 500,
            fontSize: 40,
            color: palette.zinc500,
            marginTop: 24,
            lineHeight: 1.35,
          }}
        >
          {description}
        </div>
      </div>

      {/* Screenshot column */}
      <div
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingRight: 90,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "72%",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: `0 40px 90px ${withAlpha(palette.ink, 0.18)}`,
            border: `1px solid ${palette.zinc200}`,
          }}
        >
          <Img
            src={staticFile(screenshot)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${scale}) translateX(${drift}px)`,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CtaScene: React.FC<{ productName: string; cta: string; accent: string }> = ({
  productName,
  cta,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: SNAPPY });
  const scale = interpolate(enter, [0, 1], [0.9, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.ink,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center", opacity: enter, transform: `scale(${scale})` }}>
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 800,
            fontSize: 120,
            color: palette.white,
          }}
        >
          {productName}
        </div>
        <div
          style={{
            display: "inline-block",
            marginTop: 48,
            padding: "26px 60px",
            borderRadius: 999,
            backgroundColor: accent,
            color: palette.white,
            fontFamily: INTER,
            fontWeight: 700,
            fontSize: 46,
          }}
        >
          {cta}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const PromoTemplate: React.FC<PromoTemplateProps> = ({
  productName,
  tagline,
  features,
  screenshots,
  cta,
  accentColor,
}) => {
  const items: React.ReactNode[] = [];

  items.push(
    <TransitionSeries.Sequence key="hook" durationInFrames={HOOK}>
      <HookScene productName={productName} tagline={tagline} accent={accentColor} />
    </TransitionSeries.Sequence>,
  );

  features.forEach((feature, i) => {
    items.push(
      <TransitionSeries.Transition
        key={`t-${i}`}
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />,
    );
    items.push(
      <TransitionSeries.Sequence key={`f-${i}`} durationInFrames={FEATURE}>
        <FeatureScene
          index={i}
          title={feature.title}
          description={feature.description}
          screenshot={screenshots[i % screenshots.length]}
          accent={accentColor}
        />
      </TransitionSeries.Sequence>,
    );
  });

  items.push(
    <TransitionSeries.Transition
      key="t-cta"
      presentation={fade()}
      timing={linearTiming({ durationInFrames: TRANSITION })}
    />,
  );
  items.push(
    <TransitionSeries.Sequence key="cta" durationInFrames={CTA}>
      <CtaScene productName={productName} cta={cta} accent={accentColor} />
    </TransitionSeries.Sequence>,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: palette.white }}>
      <TransitionSeries>{items}</TransitionSeries>
    </AbsoluteFill>
  );
};
