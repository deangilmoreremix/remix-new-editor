// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 upstream template (repo 2: remotion-templates)
// template id : rve-logo-scale-rotate
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/logo-scale-rotate.tsx
// license     : MIT License. The upstream repository ships NO LICENSE file and
//               names NO copyright holder; its README states "All templates in
//               this repository are available under the MIT License. You can
//               use them in personal and commercial projects, but attribution
//               is appreciated where applicable." The verbatim MIT permission
//               notice (WITHOUT a copyright line, because no holder is named)
//               ships with the design credit in
//               `templates/designs/rveSharedDesign.tsx` (RVE_LICENSE_NOTICE).
//               (This upstream file carries no in-file credit header of its
//               own, unlike most files of the repository.)
//
// DEVIATION RECORD (contract addition C8 of docs/phase2/handoffs/A6.md)
// ----------------------------------------------------------------------
// This file is EDITED. The upstream template has NO props surface at all, so
// every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal exactly. Rendering this component
// with no props reproduces the upstream design verbatim.
//
//   upstream line 5   export default function LogoScaleRotate() {
//                 ->  export const LogoScaleRotate: React.FC<LogoScaleRotateProps> = ({ ... }) => {
//   upstream line 36  backgroundColor: "#111827"            -> backgroundColor
//   upstream line 51  width: "100px"                         -> logoSize
//   upstream line 52  height: "100px"                        -> logoSize
//   upstream line 53  borderRadius: "50%"                    -> logoBorderRadius
//   upstream line 54  background: "linear-gradient(135deg, #4361ee, #7209b7)" -> logoBackground
//   upstream line 58  `0 0 ${glowIntensity}px ${glowIntensity / 2}px rgba(67, 97, 238, 0.6)`
//                 ->  `0 0 ${glowIntensity}px ${glowIntensity / 2}px ${glowColor}`
//                     (glowColor default "rgba(67, 97, 238, 0.6)")
//   upstream line 63  color: "white"                         -> logoTextColor
//   upstream line 64  fontSize: "1.2rem"                     -> logoFontSize
//   upstream line 65  fontWeight: "bold"                     -> logoFontWeight
//   upstream lines 66, 78  fontFamily: "Inter, sans-serif"   -> fontFamily
//   upstream line 69  LOGO                                   -> {logoText}
//   upstream line 75  color: "white"                         -> companyNameColor
//   upstream line 76  fontSize: "1.8rem"                     -> companyNameFontSize
//   upstream line 77  fontWeight: "bold"                     -> companyNameFontWeight
//   upstream line 79  marginTop: "1.5rem"                    -> companyNameMarginTop
//   upstream line 84  Company Name                           -> {companyName}
//
// ADDED (not present upstream): `import React from "react";`, `import { Img }`
// from remotion, the `LogoScaleRotateProps` type, the
// `defaultLogoScaleRotateProps` object (the upstream literals), a trailing
// `export default LogoScaleRotate;`, and ONE optional prop with no upstream
// counterpart: `logoImageSrc`. When it is set, the badge shows that image
// (contained, 72 % of the badge) instead of the `logoText` span. Default:
// undefined — the upstream text badge is rendered.
//
// NOT TOUCHED: the entrance spring, the 0 → 360° spin, the sine glow pulse
// (`8 + Math.sin(frame * 0.15) * 4` after frame 20), the name spring and its
// 30 px rise (upstream lines 10-29), and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { Img, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

export type LogoScaleRotateProps = {
  /** Canvas fill. Upstream literal: "#111827". */
  backgroundColor?: string;
  /** Badge width and height. Upstream literal: "100px". */
  logoSize?: string;
  /** Badge corner radius. Upstream literal: "50%". */
  logoBorderRadius?: string;
  /** Badge fill. Upstream literal: "linear-gradient(135deg, #4361ee, #7209b7)". */
  logoBackground?: string;
  /** Badge glow colour. Upstream literal: "rgba(67, 97, 238, 0.6)". */
  glowColor?: string;
  /** Badge label. Upstream literal: "LOGO". */
  logoText?: string;
  /** Badge label colour. Upstream literal: "white". */
  logoTextColor?: string;
  /** Badge label size. Upstream literal: "1.2rem". */
  logoFontSize?: string;
  /** Badge label weight. Upstream literal: "bold". */
  logoFontWeight?: string;
  /** ADDED — image shown in the badge instead of the label. Default: none. */
  logoImageSrc?: string;
  /** Font family of every text. Upstream literal: "Inter, sans-serif". */
  fontFamily?: string;
  /** Company name. Upstream literal: "Company Name". */
  companyName?: string;
  /** Company name colour. Upstream literal: "white". */
  companyNameColor?: string;
  /** Company name size. Upstream literal: "1.8rem". */
  companyNameFontSize?: string;
  /** Company name weight. Upstream literal: "bold". */
  companyNameFontWeight?: string;
  /** Gap above the company name. Upstream literal: "1.5rem". */
  companyNameMarginTop?: string;
};

export const defaultLogoScaleRotateProps: Required<Omit<LogoScaleRotateProps, "logoImageSrc">> = {
  backgroundColor: "#111827",
  logoSize: "100px",
  logoBorderRadius: "50%",
  logoBackground: "linear-gradient(135deg, #4361ee, #7209b7)",
  glowColor: "rgba(67, 97, 238, 0.6)",
  logoText: "LOGO",
  logoTextColor: "white",
  logoFontSize: "1.2rem",
  logoFontWeight: "bold",
  fontFamily: "Inter, sans-serif",
  companyName: "Company Name",
  companyNameColor: "white",
  companyNameFontSize: "1.8rem",
  companyNameFontWeight: "bold",
  companyNameMarginTop: "1.5rem",
};

const d = defaultLogoScaleRotateProps;

export const LogoScaleRotate: React.FC<LogoScaleRotateProps> = ({
  backgroundColor = d.backgroundColor,
  logoSize = d.logoSize,
  logoBorderRadius = d.logoBorderRadius,
  logoBackground = d.logoBackground,
  glowColor = d.glowColor,
  logoText = d.logoText,
  logoTextColor = d.logoTextColor,
  logoFontSize = d.logoFontSize,
  logoFontWeight = d.logoFontWeight,
  logoImageSrc,
  fontFamily = d.fontFamily,
  companyName = d.companyName,
  companyNameColor = d.companyNameColor,
  companyNameFontSize = d.companyNameFontSize,
  companyNameFontWeight = d.companyNameFontWeight,
  companyNameMarginTop = d.companyNameMarginTop,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scale and rotate entrance with spring
  const entrance = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 100, mass: 0.8 },
  });

  const scale = interpolate(entrance, [0, 1], [0, 1]);
  const rotation = interpolate(entrance, [0, 1], [0, 360]);

  // Subtle glow pulse after settling
  const glowIntensity = frame > 20 ? 8 + Math.sin(frame * 0.15) * 4 : 0;

  // Company name slides up
  const nameProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const nameOpacity = interpolate(nameProgress, [0, 1], [0, 1]);
  const nameTranslateY = interpolate(nameProgress, [0, 1], [30, 0]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          transform: `scale(${scale}) rotate(${rotation}deg)`,
        }}
      >
        <div
          style={{
            width: logoSize,
            height: logoSize,
            borderRadius: logoBorderRadius,
            background: logoBackground,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            boxShadow: `0 0 ${glowIntensity}px ${glowIntensity / 2}px ${glowColor}`,
          }}
        >
          {logoImageSrc ? (
            <Img
              src={logoImageSrc}
              style={{ width: "72%", height: "72%", objectFit: "contain" }}
            />
          ) : (
            <span
              style={{
                color: logoTextColor,
                fontSize: logoFontSize,
                fontWeight: logoFontWeight,
                fontFamily,
              }}
            >
              {logoText}
            </span>
          )}
        </div>
      </div>
      <p
        style={{
          color: companyNameColor,
          fontSize: companyNameFontSize,
          fontWeight: companyNameFontWeight,
          fontFamily,
          marginTop: companyNameMarginTop,
          opacity: nameOpacity,
          transform: `translateY(${nameTranslateY}px)`,
        }}
      >
        {companyName}
      </p>
    </div>
  );
};

export default LogoScaleRotate;
