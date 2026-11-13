// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 upstream template (repo 3: remotion-video-templates)
// template id : brito-lower-thirds
// upstream    : https://github.com/deangilmoreremix/remotion-video-templates (main @ 90149464d51a43fcb90e15491bf0d681c1b0fa49)
// upstream src: src/templates/LowerThirds/LowerThirds.tsx
// license     : MIT License — Copyright (c) 2026 Alejandro Brito. The MIT copyright notice and permission notice must be retained in all copies or substantial portions of the software (verbatim text: BRITO_LICENSE_NOTICE in templates/designs/batch3d/britoShared.tsx).
// Upstream code is reproduced verbatim apart from this header comment.
// EXCEPTION: the minimal edits listed in the DEVIATION RECORD below.
//
// DEVIATION RECORD (Phase 4 batch 3d porting rules)
// --------------------------------------------------
// D1 import paths: the upstream imports its shared helpers from
//    "../../lib/<name>"; this copy lives in _upstream/<id>/ and the helpers
//    in _upstream/brito-lib/, so the specifiers became "../brito-lib/<name>"
//    (colors, fonts). No imported symbol changed.
// D2 fonts: "../brito-lib/fonts" no longer loads Inter through
//    @remotion/google-fonts (not installed, and it would fetch the face
//    from Google at runtime). INTER now resolves to the app-bundled Inter
//    subset (DESIGN_FONT_STACK) — see _upstream/brito-lib/fonts.ts.
// ---------------------------------------------------------------------------
// SPDX-FileCopyrightText: 2026 Alejandro Brito
// SPDX-License-Identifier: MIT
import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Series,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import { palette } from "../brito-lib/colors";
import { INTER } from "../brito-lib/fonts";
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
