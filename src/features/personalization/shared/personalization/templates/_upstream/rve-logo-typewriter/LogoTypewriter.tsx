// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 upstream template (repo 2: remotion-templates)
// template id : rve-logo-typewriter
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/logo-typewriter.tsx
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
//   upstream line 5   export default function LogoTypewriter() {
//                 ->  export const LogoTypewriter: React.FC<LogoTypewriterProps> = ({ ... }) => {
//   upstream line 9   const text = "ACME STUDIO";            -> `text` prop (default "ACME STUDIO")
//   upstream line 36  backgroundColor: "#111827"            -> backgroundColor
//   upstream line 43  gap: "16px"                            -> gap
//   upstream line 47  width: "50px"                          -> iconSize
//   upstream line 48  height: "50px"                         -> iconSize
//   upstream line 49  borderRadius: "50%"                    -> iconBorderRadius
//   upstream line 50  background: "linear-gradient(135deg, #4361ee, #7209b7)" -> iconBackground
//   upstream line 59  color: "white"                         -> textColor
//   upstream lines 60, 73  fontSize: "2rem"                  -> fontSize
//   upstream lines 61, 74  fontWeight: "bold"                -> fontWeight
//   upstream lines 62, 75  fontFamily: "Inter, sans-serif"   -> fontFamily
//   upstream line 63  letterSpacing: "0.08em"                -> letterSpacing
//   upstream line 72  color: "#3b82f6"                       -> cursorColor
//   upstream line 76  marginLeft: "2px"                      -> cursorMarginLeft
//   upstream line 79  |                                      -> {cursorChar}
//
// ADDED (not present upstream): `import React from "react";`, `import { Img }`
// from remotion, the `LogoTypewriterProps` type, the
// `defaultLogoTypewriterProps` object (the upstream literals), a trailing
// `export default LogoTypewriter;`, and ONE optional prop with no upstream
// counterpart: `logoImageSrc`. When it is set, the icon circle shows that
// image (contained, filling the icon, with `overflow: "hidden"` on the icon
// only while an image is set). Default: undefined — the upstream plain
// gradient icon is rendered, with no overflow rule.
//
// NOT TOUCHED: the icon spring, the 15-frame type start, the 0.15 chars/frame
// rate, the 15-frame cursor blink (upstream lines 12-29) and every layout rule.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { Img, useCurrentFrame, useVideoConfig, spring } from "remotion";

export type LogoTypewriterProps = {
  /** The typed wordmark. Upstream literal: "ACME STUDIO". */
  text?: string;
  /** Canvas fill. Upstream literal: "#111827". */
  backgroundColor?: string;
  /** Gap between icon and wordmark. Upstream literal: "16px". */
  gap?: string;
  /** Icon width and height. Upstream literal: "50px". */
  iconSize?: string;
  /** Icon corner radius. Upstream literal: "50%". */
  iconBorderRadius?: string;
  /** Icon fill. Upstream literal: "linear-gradient(135deg, #4361ee, #7209b7)". */
  iconBackground?: string;
  /** ADDED — image shown inside the icon. Default: none. */
  logoImageSrc?: string;
  /** Wordmark colour. Upstream literal: "white". */
  textColor?: string;
  /** Wordmark and cursor size. Upstream literal: "2rem". */
  fontSize?: string;
  /** Wordmark and cursor weight. Upstream literal: "bold". */
  fontWeight?: string;
  /** Wordmark and cursor family. Upstream literal: "Inter, sans-serif". */
  fontFamily?: string;
  /** Wordmark tracking. Upstream literal: "0.08em". */
  letterSpacing?: string;
  /** Cursor colour. Upstream literal: "#3b82f6". */
  cursorColor?: string;
  /** Gap before the cursor. Upstream literal: "2px". */
  cursorMarginLeft?: string;
  /** Cursor glyph. Upstream literal: "|". */
  cursorChar?: string;
};

export const defaultLogoTypewriterProps: Required<Omit<LogoTypewriterProps, "logoImageSrc">> = {
  text: "ACME STUDIO",
  backgroundColor: "#111827",
  gap: "16px",
  iconSize: "50px",
  iconBorderRadius: "50%",
  iconBackground: "linear-gradient(135deg, #4361ee, #7209b7)",
  textColor: "white",
  fontSize: "2rem",
  fontWeight: "bold",
  fontFamily: "Inter, sans-serif",
  letterSpacing: "0.08em",
  cursorColor: "#3b82f6",
  cursorMarginLeft: "2px",
  cursorChar: "|",
};

const d = defaultLogoTypewriterProps;

export const LogoTypewriter: React.FC<LogoTypewriterProps> = ({
  text = d.text,
  backgroundColor = d.backgroundColor,
  gap = d.gap,
  iconSize = d.iconSize,
  iconBorderRadius = d.iconBorderRadius,
  iconBackground = d.iconBackground,
  logoImageSrc,
  textColor = d.textColor,
  fontSize = d.fontSize,
  fontWeight = d.fontWeight,
  fontFamily = d.fontFamily,
  letterSpacing = d.letterSpacing,
  cursorColor = d.cursorColor,
  cursorMarginLeft = d.cursorMarginLeft,
  cursorChar = d.cursorChar,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Icon appears first via spring scale
  const iconScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.6 },
  });

  // Typewriter starts after icon settles
  const typeStart = 15;
  const charsPerFrame = 0.15;
  const charsVisible = Math.min(
    Math.floor(Math.max(0, frame - typeStart) * charsPerFrame),
    text.length
  );
  const displayedText = text.slice(0, charsVisible);

  // Blinking cursor
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;
  const showCursor = frame > typeStart && (charsVisible < text.length || cursorVisible);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap }}>
        {/* Icon */}
        <div
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: iconBorderRadius,
            background: iconBackground,
            transform: `scale(${iconScale})`,
            flexShrink: 0,
            overflow: logoImageSrc ? "hidden" : undefined,
          }}
        >
          {logoImageSrc ? (
            <Img
              src={logoImageSrc}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : null}
        </div>
        {/* Typewriter text */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span
            style={{
              color: textColor,
              fontSize,
              fontWeight,
              fontFamily,
              letterSpacing,
              whiteSpace: "pre",
            }}
          >
            {displayedText}
          </span>
          {showCursor && (
            <span
              style={{
                color: cursorColor,
                fontSize,
                fontWeight,
                fontFamily,
                marginLeft: cursorMarginLeft,
              }}
            >
              {cursorChar}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogoTypewriter;
