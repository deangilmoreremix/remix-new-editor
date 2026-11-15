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
// template id : rve-logo-glitch-reveal
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/logo-glitch-reveal.tsx
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
//   upstream line 16  export default function LogoGlitchReveal() {
//                 ->  export const LogoGlitchReveal: React.FC<LogoGlitchRevealProps> = ({ ... }) => {
//   upstream lines 53-54, 80-81  width/height: "120px"     -> logoSize
//   upstream line 55  borderRadius: "24px"                   -> logoBorderRadius
//   upstream line 68  backgroundColor: "#111827"             -> backgroundColor
//   upstream line 88  background: "rgba(239, 68, 68, 0.6)"   -> redChannelColor
//   upstream line 111 background: "rgba(34, 197, 94, 0.6)"   -> greenChannelColor
//   upstream line 134 background: "rgba(59, 130, 246, 0.6)"  -> blueChannelColor
//   upstream lines 96, 119, 142  color: "rgba(255, 255, 255, 0.8)" -> channelTextColor
//   upstream line 157 background: "linear-gradient(135deg, #4361ee, #7209b7)" -> logoBackground
//   upstream line 159 `0 0 ${40 * glowIntensity}px rgba(67, 97, 238, ${0.5 * glowIntensity})`
//                 ->  `0 0 ${40 * glowIntensity}px rgba(${glowRgb}, ${0.5 * glowIntensity})`
//                     (glowRgb default "67, 97, 238"; the 40 px and 0.5
//                     factors are animation constants and are NOT touched)
//   upstream line 164 color: "white"                         -> logoTextColor
//   upstream lines 97, 120, 143, 165  fontSize: "1.8rem"     -> logoFontSize
//   upstream lines 98, 121, 144, 166  fontWeight: "800"      -> logoFontWeight
//   upstream lines 99, 122, 145, 167  letterSpacing: "0.1em" -> logoLetterSpacing
//   upstream lines 100, 123, 146, 168, 184, 196  fontFamily: "Inter, sans-serif" -> fontFamily
//   upstream lines 103, 126, 149, 171  LOGO                  -> {logoText}
//   upstream line 179 color: "white"                         -> companyNameColor
//   upstream line 180 fontSize: "2rem"                       -> companyNameFontSize
//   upstream line 181 fontWeight: "700"                      -> companyNameFontWeight
//   upstream line 182 marginTop: "1.5rem"                    -> companyNameMarginTop
//   upstream line 185 letterSpacing: "0.05em"                -> companyNameLetterSpacing
//   upstream line 189 Company Name                           -> {companyName}
//   upstream line 193 color: "#93c5fd"                       -> taglineColor
//   upstream line 194 fontSize: "1rem"                       -> taglineFontSize
//   upstream line 195 marginTop: "0.5rem"                    -> taglineMarginTop
//   upstream line 200 Your tagline here                      -> {tagline}
//
// ADDED (not present upstream): `import React from "react";` (the upstream
// used the global `React.CSSProperties` type without importing React),
// `import { Img }` from remotion, the `LogoGlitchRevealProps` type, the
// `defaultLogoGlitchRevealProps` object (the upstream literals), a trailing
// `export default LogoGlitchReveal;`, one `channelTextStyle` object (the three
// channel-copy label styles were byte-identical upstream, lines 95-101,
// 118-124 and 141-147, so they share one parameterised object), and ONE
// optional prop with no upstream
// counterpart: `logoImageSrc`. When it is set, the CLEAN badge (the one that
// remains after the glitch settles) shows that image (contained, 72 % of the
// badge) instead of the `logoText` span; the three RGB channel copies keep
// the label. Default: undefined — the upstream text badge is rendered.
//
// NOT TOUCHED: the decay, the sin-based channel offsets (lines 21-31), the
// clean-logo spring, the glow and channel ramps (lines 34-50), the
// `mixBlendMode: "screen"` channels and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { Img, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export type LogoGlitchRevealProps = {
  /** Canvas fill. Upstream literal: "#111827". */
  backgroundColor?: string;
  /** Badge width and height. Upstream literal: "120px". */
  logoSize?: string;
  /** Badge corner radius. Upstream literal: "24px". */
  logoBorderRadius?: string;
  /** Red channel copy fill. Upstream literal: "rgba(239, 68, 68, 0.6)". */
  redChannelColor?: string;
  /** Green channel copy fill. Upstream literal: "rgba(34, 197, 94, 0.6)". */
  greenChannelColor?: string;
  /** Blue channel copy fill. Upstream literal: "rgba(59, 130, 246, 0.6)". */
  blueChannelColor?: string;
  /** Label colour on the channel copies. Upstream literal: "rgba(255, 255, 255, 0.8)". */
  channelTextColor?: string;
  /** Clean badge fill. Upstream literal: "linear-gradient(135deg, #4361ee, #7209b7)". */
  logoBackground?: string;
  /** Clean badge glow, as "r, g, b". Upstream literal: "67, 97, 238". */
  glowRgb?: string;
  /** Badge label. Upstream literal: "LOGO". */
  logoText?: string;
  /** Clean badge label colour. Upstream literal: "white". */
  logoTextColor?: string;
  /** Badge label size. Upstream literal: "1.8rem". */
  logoFontSize?: string;
  /** Badge label weight. Upstream literal: "800". */
  logoFontWeight?: string;
  /** Badge label tracking. Upstream literal: "0.1em". */
  logoLetterSpacing?: string;
  /** ADDED — image shown in the clean badge instead of the label. Default: none. */
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

export const defaultLogoGlitchRevealProps: Required<Omit<LogoGlitchRevealProps, "logoImageSrc">> = {
  backgroundColor: "#111827",
  logoSize: "120px",
  logoBorderRadius: "24px",
  redChannelColor: "rgba(239, 68, 68, 0.6)",
  greenChannelColor: "rgba(34, 197, 94, 0.6)",
  blueChannelColor: "rgba(59, 130, 246, 0.6)",
  channelTextColor: "rgba(255, 255, 255, 0.8)",
  logoBackground: "linear-gradient(135deg, #4361ee, #7209b7)",
  glowRgb: "67, 97, 238",
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

const d = defaultLogoGlitchRevealProps;

export const LogoGlitchReveal: React.FC<LogoGlitchRevealProps> = ({
  backgroundColor = d.backgroundColor,
  logoSize = d.logoSize,
  logoBorderRadius = d.logoBorderRadius,
  redChannelColor = d.redChannelColor,
  greenChannelColor = d.greenChannelColor,
  blueChannelColor = d.blueChannelColor,
  channelTextColor = d.channelTextColor,
  logoBackground = d.logoBackground,
  glowRgb = d.glowRgb,
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

  // Decay factor: starts at 1 and goes to 0 over time
  const decay = interpolate(frame, [0, 30], [1, 0], {
    extrapolateRight: "clamp",
  });

  // Pseudo-random offsets using sin for deterministic rendering
  const redOffsetX = Math.sin(frame * 7.3) * 15 * decay;
  const redOffsetY = Math.sin(frame * 5.1) * 10 * decay;
  const greenOffsetX = Math.sin(frame * 11.7) * 15 * decay;
  const greenOffsetY = Math.sin(frame * 3.9) * 10 * decay;
  const blueOffsetX = Math.sin(frame * 9.2) * 15 * decay;
  const blueOffsetY = Math.sin(frame * 6.4) * 10 * decay;

  // Clean logo appears after glitch settles
  const cleanOpacity = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: { damping: 14, stiffness: 80, mass: 0.6 },
  });

  // Glow intensity increases as glitch settles
  const glowIntensity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Channel separation opacity fades out as clean logo appears
  const channelOpacity = interpolate(frame, [20, 35], [0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoStyle: React.CSSProperties = {
    width: logoSize,
    height: logoSize,
    borderRadius: logoBorderRadius,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
  };

  const channelTextStyle: React.CSSProperties = {
    color: channelTextColor,
    fontSize: logoFontSize,
    fontWeight: logoFontWeight,
    letterSpacing: logoLetterSpacing,
    fontFamily,
  };

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
      {/* RGB Channel Copies */}
      <div
        style={{
          position: "relative",
          width: logoSize,
          height: logoSize,
        }}
      >
        {/* Red channel */}
        <div
          style={{
            ...logoStyle,
            background: redChannelColor,
            transform: `translate(${redOffsetX}px, ${redOffsetY}px)`,
            opacity: channelOpacity,
            mixBlendMode: "screen",
          }}
        >
          <span style={channelTextStyle}>{logoText}</span>
        </div>

        {/* Green channel */}
        <div
          style={{
            ...logoStyle,
            background: greenChannelColor,
            transform: `translate(${greenOffsetX}px, ${greenOffsetY}px)`,
            opacity: channelOpacity,
            mixBlendMode: "screen",
          }}
        >
          <span style={channelTextStyle}>{logoText}</span>
        </div>

        {/* Blue channel */}
        <div
          style={{
            ...logoStyle,
            background: blueChannelColor,
            transform: `translate(${blueOffsetX}px, ${blueOffsetY}px)`,
            opacity: channelOpacity,
            mixBlendMode: "screen",
          }}
        >
          <span style={channelTextStyle}>{logoText}</span>
        </div>

        {/* Clean logo */}
        <div
          style={{
            ...logoStyle,
            background: logoBackground,
            opacity: cleanOpacity,
            boxShadow: `0 0 ${40 * glowIntensity}px rgba(${glowRgb}, ${0.5 * glowIntensity})`,
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
          opacity: cleanOpacity,
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
          opacity: cleanOpacity,
        }}
      >
        {tagline}
      </p>
    </div>
  );
};

export default LogoGlitchReveal;
