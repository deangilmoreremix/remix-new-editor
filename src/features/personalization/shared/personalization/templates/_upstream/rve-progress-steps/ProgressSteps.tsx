/** Free Remotion Template Component
 * ---------------------------------
 * This template is free to use in your projects!
 * Credit appreciated but not required.
 *
 * Created by the team at https://www.reactvideoeditor.com
 *
 * Happy coding and building amazing videos! 🎉
 */

// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 upstream template, batch 3f (repo 2: remotion-templates)
// template id : rve-progress-steps
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/progress-steps.tsx
// license     : MIT License. The upstream repository ships NO LICENSE file and
//               names NO copyright holder; its README states "All templates in
//               this repository are available under the MIT License. You can
//               use them in personal and commercial projects, but attribution
//               is appreciated where applicable." The verbatim MIT permission
//               notice (WITHOUT a copyright line, because no holder is named)
//               ships with the design credit in
//               `templates/designs/rveSharedDesign.tsx` (RVE_LICENSE_NOTICE).
//
// DEVIATION RECORD (contract addition C8 of docs/phase2/handoffs/A6.md)
// ----------------------------------------------------------------------
// This file is EDITED. The upstream template has NO props surface, so every
// hard-coded string, colour and type size became an OPTIONAL prop whose
// default reproduces the upstream literal exactly. Rendering this component
// with no props reproduces the upstream design.
//
//   upstream line 15      export default function ProgressSteps() {
//                     ->  export const ProgressSteps: React.FC<ProgressStepsProps> = ({ ... }) => {
//   upstream line 19      const steps = ["Research", "Design", "Build", "Launch"];
//                     ->  prop `steps`              (same default)
//   upstream line 27      background: "linear-gradient(180deg, #111827, #1f2937)"
//                     ->  prop `background`         (same default)
//   upstream line 33      fontFamily: "Inter, sans-serif"               -> prop `fontFamily`
//   upstream line 38      color: "white" (title)                        -> prop `titleColor`
//   upstream line 39      fontSize: "2rem"                              -> prop `titleFontSize`
//   upstream line 47      Project Timeline                              -> prop `title`
//   upstream line 110     "#3b82f6" / "#4b5563" (circle border)         -> props `activeBorderColor` / `idleBorderColor`
//   upstream line 113     `linear-gradient(135deg, #3b82f6, #7209b7)`   -> prop `activeFill`
//   upstream line 119     transition: "border-color 0.1s",              -> REMOVED (see below)
//   upstream line 124     "white" / "#6b7280" (step number)             -> props `activeNumberColor` / `idleNumberColor`
//   upstream line 125     fontSize: "1rem"                              -> prop `numberFontSize`
//   upstream line 134     "#93c5fd" / "#6b7280" (step label)            -> props `activeLabelColor` / `idleLabelColor`
//   upstream line 135     fontSize: "0.8rem"                            -> prop `labelFontSize`
//   upstream line 150     background: "#374151" (connector track)       -> prop `connectorColor`
//   upstream line 161     background: "linear-gradient(90deg, #3b82f6, #a855f7)"
//                     ->  prop `connectorFill`      (same default)
//
// REMOVED: the CSS `transition: "border-color 0.1s"` on the step circle.
// Remotion renders every frame from scratch and a CSS transition is
// wall-clock driven, so it is non-deterministic in a frame render
// (contract addition C12). The border colour still switches on the same
// frame; only the 0.1 s browser-side tween is gone.
//
// ADDED (not present upstream): `import React from "react";`, the
// `ProgressStepsProps` type, `defaultProgressStepsProps` (the upstream
// literals), the optional `titleWhiteSpace` prop (default `undefined`,
// upstream style unchanged) and a trailing `export default ProgressSteps;`.
//
// NOT TOUCHED: the step timing (`Math.floor(fps * 0.8)` frames per step), the
// pulse spring, the 80 px columns / connectors, the 48 px circles and every
// other layout rule. This template uses no SVG ids.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export type ProgressStepsProps = {
  /** Upstream literal: ["Research", "Design", "Build", "Launch"]. */
  steps?: string[];
  /** Upstream literal: "Project Timeline". */
  title?: string;
  /** Canvas fill. Upstream literal: "linear-gradient(180deg, #111827, #1f2937)". */
  background?: string;
  /** Upstream literal: "Inter, sans-serif". */
  fontFamily?: string;
  /** Upstream literal: "white". */
  titleColor?: string;
  /** Upstream literal: "2rem". */
  titleFontSize?: string;
  /** Upstream literal: "#3b82f6". */
  activeBorderColor?: string;
  /** Upstream literal: "#4b5563". */
  idleBorderColor?: string;
  /** Upstream literal: "linear-gradient(135deg, #3b82f6, #7209b7)". */
  activeFill?: string;
  /** Upstream literal: "white". */
  activeNumberColor?: string;
  /** Upstream literal: "#6b7280". */
  idleNumberColor?: string;
  /** Upstream literal: "1rem". */
  numberFontSize?: string;
  /** Upstream literal: "#93c5fd". */
  activeLabelColor?: string;
  /** Upstream literal: "#6b7280". */
  idleLabelColor?: string;
  /** Upstream literal: "0.8rem". */
  labelFontSize?: string;
  /** Upstream literal: "#374151". */
  connectorColor?: string;
  /** Upstream literal: "linear-gradient(90deg, #3b82f6, #a855f7)". */
  connectorFill?: string;
  /** ADDED. Default `undefined` (upstream style unchanged). */
  titleWhiteSpace?: React.CSSProperties["whiteSpace"];
};

export const defaultProgressStepsProps = {
  steps: ["Research", "Design", "Build", "Launch"],
  title: "Project Timeline",
  background: "linear-gradient(180deg, #111827, #1f2937)",
  fontFamily: "Inter, sans-serif",
  titleColor: "white",
  titleFontSize: "2rem",
  activeBorderColor: "#3b82f6",
  idleBorderColor: "#4b5563",
  activeFill: "linear-gradient(135deg, #3b82f6, #7209b7)",
  activeNumberColor: "white",
  idleNumberColor: "#6b7280",
  numberFontSize: "1rem",
  activeLabelColor: "#93c5fd",
  idleLabelColor: "#6b7280",
  labelFontSize: "0.8rem",
  connectorColor: "#374151",
  connectorFill: "linear-gradient(90deg, #3b82f6, #a855f7)",
};

export const ProgressSteps: React.FC<ProgressStepsProps> = ({
  steps = defaultProgressStepsProps.steps,
  title = defaultProgressStepsProps.title,
  background = defaultProgressStepsProps.background,
  fontFamily = defaultProgressStepsProps.fontFamily,
  titleColor = defaultProgressStepsProps.titleColor,
  titleFontSize = defaultProgressStepsProps.titleFontSize,
  activeBorderColor = defaultProgressStepsProps.activeBorderColor,
  idleBorderColor = defaultProgressStepsProps.idleBorderColor,
  activeFill = defaultProgressStepsProps.activeFill,
  activeNumberColor = defaultProgressStepsProps.activeNumberColor,
  idleNumberColor = defaultProgressStepsProps.idleNumberColor,
  numberFontSize = defaultProgressStepsProps.numberFontSize,
  activeLabelColor = defaultProgressStepsProps.activeLabelColor,
  idleLabelColor = defaultProgressStepsProps.idleLabelColor,
  labelFontSize = defaultProgressStepsProps.labelFontSize,
  connectorColor = defaultProgressStepsProps.connectorColor,
  connectorFill = defaultProgressStepsProps.connectorFill,
  titleWhiteSpace,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerStep = Math.floor(fps * 0.8);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        fontFamily,
      }}
    >
      <h2
        style={{
          color: titleColor,
          fontSize: titleFontSize,
          fontWeight: "bold",
          marginBottom: "60px",
          margin: 0,
          marginTop: 0,
          paddingBottom: "60px",
          whiteSpace: titleWhiteSpace,
        }}
      >
        {title}
      </h2>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0px",
          position: "relative",
        }}
      >
        {steps.map((label, i) => {
          const stepStart = i * framesPerStep;
          const fillProgress = interpolate(
            frame,
            [stepStart, stepStart + framesPerStep * 0.6],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          const isActive =
            frame >= stepStart && frame < stepStart + framesPerStep;
          const isComplete = frame >= stepStart + framesPerStep * 0.6;

          const pulse = isActive
            ? spring({
                frame: frame - stepStart,
                fps,
                config: { damping: 8, stiffness: 150, mass: 0.4 },
              })
            : 1;

          const circleScale = isActive ? 0.9 + pulse * 0.2 : isComplete ? 1.1 : 1;

          const lineProgress =
            i < steps.length - 1
              ? interpolate(
                  frame,
                  [stepStart + framesPerStep * 0.5, stepStart + framesPerStep],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                )
              : 0;

          return (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center" }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: "80px",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    border: `3px solid ${fillProgress > 0 ? activeBorderColor : idleBorderColor}`,
                    background:
                      fillProgress > 0
                        ? activeFill
                        : "transparent",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    transform: `scale(${circleScale})`,
                  }}
                >
                  <span
                    style={{
                      color: fillProgress > 0 ? activeNumberColor : idleNumberColor,
                      fontSize: numberFontSize,
                      fontWeight: "bold",
                    }}
                  >
                    {i + 1}
                  </span>
                </div>
                <span
                  style={{
                    color: fillProgress > 0 ? activeLabelColor : idleLabelColor,
                    fontSize: labelFontSize,
                    fontWeight: "500",
                    marginTop: "10px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
              </div>

              {i < steps.length - 1 && (
                <div
                  style={{
                    width: "80px",
                    height: "3px",
                    background: connectorColor,
                    borderRadius: "2px",
                    position: "relative",
                    overflow: "hidden",
                    marginBottom: "24px",
                  }}
                >
                  <div
                    style={{
                      width: `${lineProgress * 100}%`,
                      height: "100%",
                      background: connectorFill,
                      borderRadius: "2px",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressSteps;
