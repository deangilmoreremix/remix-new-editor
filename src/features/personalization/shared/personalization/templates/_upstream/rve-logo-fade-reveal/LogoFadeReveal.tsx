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
// template id : rve-logo-fade-reveal
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/logo-fade-reveal.tsx
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
//   upstream line 16  export default function LogoFadeReveal() {
//                 ->  export const LogoFadeReveal: React.FC<LogoFadeRevealProps> = ({ ... }) => {
//   upstream line 46  backgroundColor: "#111827"            -> backgroundColor
//   upstream line 57  width: "120px"                         -> logoSize
//   upstream line 58  height: "120px"                        -> logoSize
//   upstream line 59  borderRadius: "24px"                   -> logoBorderRadius
//   upstream line 60  background: "linear-gradient(135deg, #4361ee, #7209b7)" -> logoBackground
//   upstream line 66  boxShadow: "0 0 40px rgba(67, 97, 238, 0.3)"           -> logoShadow
//   upstream line 71  color: "white"                         -> logoTextColor
//   upstream line 72  fontSize: "1.8rem"                     -> logoFontSize
//   upstream line 73  fontWeight: "800"                      -> logoFontWeight
//   upstream line 74  letterSpacing: "0.1em"                 -> logoLetterSpacing
//   upstream lines 75, 90, 103  fontFamily: "Inter, sans-serif" -> fontFamily
//   upstream line 78  LOGO                                   -> {logoText}
//   upstream line 85  color: "white"                         -> companyNameColor
//   upstream line 86  fontSize: "2rem"                       -> companyNameFontSize
//   upstream line 87  fontWeight: "700"                      -> companyNameFontWeight
//   upstream line 88  marginTop: "1.5rem"                    -> companyNameMarginTop
//   upstream line 91  letterSpacing: "0.05em"                -> companyNameLetterSpacing
//   upstream line 96  Company Name                           -> {companyName}
//   upstream line 100 color: "#93c5fd"                       -> taglineColor
//   upstream line 101 fontSize: "1rem"                       -> taglineFontSize
//   upstream line 102 marginTop: "0.5rem"                    -> taglineMarginTop
//   upstream line 108 Your tagline here                      -> {tagline}
//
// ADDED (not present upstream): `import React from "react";`, `import { Img }`
// from remotion, the `LogoFadeRevealProps` type, the
// `defaultLogoFadeRevealProps` object (the upstream literals), a trailing
// `export default LogoFadeReveal;`, and ONE optional prop with no upstream
// counterpart: `logoImageSrc`. When it is set, the badge shows that image
// (contained, 72 % of the badge) instead of the `logoText` span, so the
// customer's real logo can sit in the badge. Default: undefined — the upstream
// text badge is rendered.
//
// NOT TOUCHED: both springs (upstream lines 21-38 — every damping, stiffness,
// mass, the 15-frame delay, the 0.8 → 1 scale and the 20 px rise are
// byte-identical) and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { Img, useCurrentFrame, spring, useVideoConfig } from "remotion";

export type LogoFadeRevealProps = {
  /** Canvas fill. Upstream literal: "#111827". */
  backgroundColor?: string;
  /** Badge width and height. Upstream literal: "120px". */
  logoSize?: string;
  /** Badge corner radius. Upstream literal: "24px". */
  logoBorderRadius?: string;
  /** Badge fill. Upstream literal: "linear-gradient(135deg, #4361ee, #7209b7)". */
  logoBackground?: string;
  /** Badge glow. Upstream literal: "0 0 40px rgba(67, 97, 238, 0.3)". */
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
  /** Tagline colour. Upstream literal: "#93c5fd". */
  taglineColor?: string;
  /** Tagline size. Upstream literal: "1rem". */
  taglineFontSize?: string;
  /** Gap above the tagline. Upstream literal: "0.5rem". */
  taglineMarginTop?: string;
};

export const defaultLogoFadeRevealProps: Required<Omit<LogoFadeRevealProps, "logoImageSrc">> = {
  backgroundColor: "#111827",
  logoSize: "120px",
  logoBorderRadius: "24px",
  logoBackground: "linear-gradient(135deg, #4361ee, #7209b7)",
  logoShadow: "0 0 40px rgba(67, 97, 238, 0.3)",
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
  taglineColor: "#93c5fd",
  taglineFontSize: "1rem",
  taglineMarginTop: "0.5rem",
};

const d = defaultLogoFadeRevealProps;

export const LogoFadeReveal: React.FC<LogoFadeRevealProps> = ({
  backgroundColor = d.backgroundColor,
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

  // Logo fade + scale using spring
  const logoProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80, mass: 0.8 },
  });

  const logoOpacity = logoProgress;
  const logoScale = 0.8 + 0.2 * logoProgress;

  // Company name fades in with delay
  const textProgress = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 14, stiffness: 60, mass: 0.6 },
  });

  const textOpacity = textProgress;
  const textTranslateY = 20 * (1 - textProgress);

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
      {/* Logo */}
      <div
        style={{
          width: logoSize,
          height: logoSize,
          borderRadius: logoBorderRadius,
          background: logoBackground,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
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

      {/* Company Name */}
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

export default LogoFadeReveal;
