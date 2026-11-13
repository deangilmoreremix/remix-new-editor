/**
 * Free Remotion Template Component
 * ---------------------------------
 * This template is free to use in your projects!
 * Credit appreciated but not required.
 *
 * Created by the team at https://www.reactvideoeditor.com
 *
 * Happy coding and building amazing videos! 🎉
 */

// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 upstream template (repo 2: remotion-templates)
// template id : rve-logo-spin-reveal
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/logo-spin-reveal.tsx
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
// This file is EDITED. The upstream template has NO props surface at all, so
// every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal exactly. Rendering this component
// with no props reproduces the upstream design verbatim.
//
//   upstream line 16  export default function LogoSpinReveal() {
//                 ->  export const LogoSpinReveal: React.FC<LogoSpinRevealProps> = ({ ... }) => {
//   upstream line 46  backgroundColor: "#111827"            -> backgroundColor
//   upstream line 57  perspective: "1000px"                  -> perspective
//   upstream line 63  width: "120px"                         -> logoSize
//   upstream line 64  height: "120px"                        -> logoSize
//   upstream line 65  borderRadius: "50%"                    -> logoBorderRadius
//   upstream line 66  background: "linear-gradient(135deg, #4361ee, #7209b7)" -> logoBackground
//   upstream line 72  boxShadow: "0 0 50px rgba(114, 9, 183, 0.4)"           -> logoShadow
//   upstream line 77  color: "white"                         -> logoTextColor
//   upstream line 78  fontSize: "1.8rem"                     -> logoFontSize
//   upstream line 79  fontWeight: "800"                      -> logoFontWeight
//   upstream line 80  letterSpacing: "0.1em"                 -> logoLetterSpacing
//   upstream lines 81, 97, 110  fontFamily: "Inter, sans-serif" -> fontFamily
//   upstream line 84  LOGO                                   -> {logoText}
//   upstream line 92  color: "white"                         -> companyNameColor
//   upstream line 93  fontSize: "2rem"                       -> companyNameFontSize
//   upstream line 94  fontWeight: "700"                      -> companyNameFontWeight
//   upstream line 95  marginTop: "1.5rem"                    -> companyNameMarginTop
//   upstream line 98  letterSpacing: "0.05em"                -> companyNameLetterSpacing
//   upstream line 103 Company Name                           -> {companyName}
//   upstream line 107 color: "#c084fc"                       -> taglineColor
//   upstream line 108 fontSize: "1rem"                       -> taglineFontSize
//   upstream line 109 marginTop: "0.5rem"                    -> taglineMarginTop
//   upstream line 115 Your tagline here                      -> {tagline}
//
// ADDED (not present upstream): `import React from "react";`, `import { Img }`
// from remotion, the `LogoSpinRevealProps` type, the
// `defaultLogoSpinRevealProps` object (the upstream literals), a trailing
// `export default LogoSpinReveal;`, and ONE optional prop with no upstream
// counterpart: `logoImageSrc`. When it is set, the badge shows that image
// (contained, 72 % of the badge) instead of the `logoText` span. Default:
// undefined — the upstream text badge is rendered.
//
// NOT TOUCHED: both springs (upstream lines 21-35 — every damping, stiffness,
// mass, the 20-frame delay, the 90° rotateY and the 30 px rise are
// byte-identical) and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { Img, useCurrentFrame, spring, useVideoConfig } from "remotion";

export type LogoSpinRevealProps = {
  /** Canvas fill. Upstream literal: "#111827". */
  backgroundColor?: string;
  /** 3D perspective of the badge container. Upstream literal: "1000px". */
  perspective?: string;
  /** Badge width and height. Upstream literal: "120px". */
  logoSize?: string;
  /** Badge corner radius. Upstream literal: "50%". */
  logoBorderRadius?: string;
  /** Badge fill. Upstream literal: "linear-gradient(135deg, #4361ee, #7209b7)". */
  logoBackground?: string;
  /** Badge glow. Upstream literal: "0 0 50px rgba(114, 9, 183, 0.4)". */
  logoShadow?: string;
  /** Badge label. Upstream literal: "LOGO". */
  logoText?: string;
  /** Badge label colour. Upstream literal: "white". */
  logoTextColor?: string;
  /** Badge label size. Upstream literal: "1.8rem". */
  logoFontSize?: string;
  /** Badge label weight. Upstream literal: "800". */
  logoFontWeight?: string;
  /** Badge label tracking. Upstream literal: "0.1em". */
  logoLetterSpacing?: string;
  /** ADDED — image shown in the badge instead of the label. Default: none. */
  logoImageSrc?: string;
  /** Font family of every text. Upstream literal: "Inter, sans-serif". */
  fontFamily?: string;
  /** Company name. Upstream literal: "Company Name". */
  companyName?: string;
  /** Company name colour. Upstream literal: "white". */
  companyNameColor?: string;
  /** Company name size. Upstream literal: "2rem". */
  companyNameFontSize?: string;
  /** Company name weight. Upstream literal: "700". */
  companyNameFontWeight?: string;
  /** Gap above the company name. Upstream literal: "1.5rem". */
  companyNameMarginTop?: string;
  /** Company name tracking. Upstream literal: "0.05em". */
  companyNameLetterSpacing?: string;
  /** Tagline. Upstream literal: "Your tagline here". */
  tagline?: string;
  /** Tagline colour. Upstream literal: "#c084fc". */
  taglineColor?: string;
  /** Tagline size. Upstream literal: "1rem". */
  taglineFontSize?: string;
  /** Gap above the tagline. Upstream literal: "0.5rem". */
  taglineMarginTop?: string;
};

export const defaultLogoSpinRevealProps: Required<Omit<LogoSpinRevealProps, "logoImageSrc">> = {
  backgroundColor: "#111827",
  perspective: "1000px",
  logoSize: "120px",
  logoBorderRadius: "50%",
  logoBackground: "linear-gradient(135deg, #4361ee, #7209b7)",
  logoShadow: "0 0 50px rgba(114, 9, 183, 0.4)",
  logoText: "LOGO",
  logoTextColor: "white",
  logoFontSize: "1.8rem",
  logoFontWeight: "800",
  logoLetterSpacing: "0.1em",
  fontFamily: "Inter, sans-serif",
  companyName: "Company Name",
  companyNameColor: "white",
  companyNameFontSize: "2rem",
  companyNameFontWeight: "700",
  companyNameMarginTop: "1.5rem",
  companyNameLetterSpacing: "0.05em",
  tagline: "Your tagline here",
  taglineColor: "#c084fc",
  taglineFontSize: "1rem",
  taglineMarginTop: "0.5rem",
};

const d = defaultLogoSpinRevealProps;

export const LogoSpinReveal: React.FC<LogoSpinRevealProps> = ({
  backgroundColor = d.backgroundColor,
  perspective = d.perspective,
  logoSize = d.logoSize,
  logoBorderRadius = d.logoBorderRadius,
  logoBackground = d.logoBackground,
  logoShadow = d.logoShadow,
  logoText = d.logoText,
  logoTextColor = d.logoTextColor,
  logoFontSize = d.logoFontSize,
  logoFontWeight = d.logoFontWeight,
  logoLetterSpacing = d.logoLetterSpacing,
  logoImageSrc,
  fontFamily = d.fontFamily,
  companyName = d.companyName,
  companyNameColor = d.companyNameColor,
  companyNameFontSize = d.companyNameFontSize,
  companyNameFontWeight = d.companyNameFontWeight,
  companyNameMarginTop = d.companyNameMarginTop,
  companyNameLetterSpacing = d.companyNameLetterSpacing,
  tagline = d.tagline,
  taglineColor = d.taglineColor,
  taglineFontSize = d.taglineFontSize,
  taglineMarginTop = d.taglineMarginTop,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo 3D rotation using spring
  const spinProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 60, mass: 1 },
  });

  const rotateY = 90 * (1 - spinProgress);
  const logoOpacity = spinProgress;

  // Company name slides up after logo settles
  const textProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 12, stiffness: 70, mass: 0.6 },
  });

  const textOpacity = textProgress;
  const textTranslateY = 30 * (1 - textProgress);

  return (
    <div
      style={{
        position: "relative",
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
      {/* 3D Perspective Container */}
      <div
        style={{
          perspective,
        }}
      >
        {/* Logo - circular with gradient */}
        <div
          style={{
            width: logoSize,
            height: logoSize,
            borderRadius: logoBorderRadius,
            background: logoBackground,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `rotateY(${rotateY}deg)`,
            opacity: logoOpacity,
            boxShadow: logoShadow,
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
                letterSpacing: logoLetterSpacing,
                fontFamily,
              }}
            >
              {logoText}
            </span>
          )}
        </div>
      </div>

      {/* Company Name - slides up */}
      <h2
        style={{
          color: companyNameColor,
          fontSize: companyNameFontSize,
          fontWeight: companyNameFontWeight,
          marginTop: companyNameMarginTop,
          marginBottom: 0,
          fontFamily,
          letterSpacing: companyNameLetterSpacing,
          opacity: textOpacity,
          transform: `translateY(${textTranslateY}px)`,
        }}
      >
        {companyName}
      </h2>
      <p
        style={{
          color: taglineColor,
          fontSize: taglineFontSize,
          marginTop: taglineMarginTop,
          fontFamily,
          opacity: textOpacity,
          transform: `translateY(${textTranslateY}px)`,
        }}
      >
        {tagline}
      </p>
    </div>
  );
};

export default LogoSpinReveal;
