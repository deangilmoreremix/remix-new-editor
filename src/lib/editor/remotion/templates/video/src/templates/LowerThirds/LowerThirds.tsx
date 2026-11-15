import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Series,
  useVideoConfig,
} from "../../../../shim";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import { palette } from "../../lib/colors";
import { INTER } from "../../lib/fonts";
import {
  BoxedFade,
  LowerThirdStyleProps,
  MinimalLine,
  SlideInBar,
  lowerThirdTotalFrames,
} from "./styles";

export const lowerThirdsSchema = z.object({
  name: z.string(),
  role: z.string(),
  accentColor: zColor(),
  enterDurationInFrames: z.number().int().min(4).max(60),
  holdDurationInFrames: z.number().int().min(10).max(240),
  exitDurationInFrames: z.number().int().min(4).max(60),
});

export type LowerThirdsProps = z.infer<typeof lowerThirdsSchema>;

export const lowerThirdsDefaultProps: LowerThirdsProps = {
  name: "Alejandro Brito",
  role: "Full-stack + AI Developer",
  accentColor: "#2563EB",
  enterDurationInFrames: 14,
  holdDurationInFrames: 70,
  exitDurationInFrames: 14,
};

// Duration is derived from the timing props: the demo plays all three styles
// back to back, so total = 3 × (enter + hold + exit). Editing the timing in
// Studio automatically relengthens the composition.
export const lowerThirdsCalculateMetadata: CalculateMetadataFunction<
  LowerThirdsProps
> = ({ props }) => {
  const one = lowerThirdTotalFrames(props);
  return { durationInFrames: one * 3 };
};

// A faint label so the preview background isn't pure white — purely cosmetic,
// helps you see the lower-third contrast while editing.
const StageBackground: React.FC = () => {
  const { width } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(120deg, ${palette.zinc100} 0%, ${palette.zinc200} 100%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: width * 0.05,
          fontFamily: INTER,
          fontWeight: 800,
          fontSize: 40,
          color: palette.zinc300,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        Lower Thirds
      </div>
    </AbsoluteFill>
  );
};

export const LowerThirds: React.FC<LowerThirdsProps> = (props) => {
  const one = lowerThirdTotalFrames(props);

  const styleProps: LowerThirdStyleProps = {
    name: props.name,
    role: props.role,
    accentColor: props.accentColor,
    enterDurationInFrames: props.enterDurationInFrames,
    holdDurationInFrames: props.holdDurationInFrames,
    exitDurationInFrames: props.exitDurationInFrames,
  };

  return (
    <AbsoluteFill>
      <StageBackground />
      <Series>
        <Series.Sequence durationInFrames={one} name="Slide-in bar">
          <SlideInBar {...styleProps} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={one} name="Boxed fade">
          <BoxedFade {...styleProps} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={one} name="Minimal line">
          <MinimalLine {...styleProps} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
