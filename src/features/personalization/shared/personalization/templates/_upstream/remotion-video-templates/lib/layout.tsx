// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 3 upstream template
// upstream    : https://github.com/deangilmoreremix/remotion-video-templates (main @ 90149464d51a43fcb90e15491bf0d681c1b0fa49)
// upstream src: src/lib/layout.tsx
// license     : MIT License — Copyright (c) 2026 Alejandro Brito. The MIT copyright notice and permission notice must be retained in all copies or substantial portions of the software.
// Upstream code is reproduced verbatim apart from this header comment.
// ---------------------------------------------------------------------------
// Layout helpers: safe-area math and a couple of thin AbsoluteFill wrappers.
//
// "Safe area" is the margin broadcast/social platforms may crop or cover with
// UI (the TikTok caption bar, a TV's overscan). Keeping important content
// inside it means nothing critical gets clipped. Values are fractions of the
// frame so they scale with any resolution.
import React from "react";
import { AbsoluteFill } from "remotion";

// Fraction of width/height reserved as an untouchable margin.
export const SAFE_AREA = {
  horizontal: 0.05, // 5% left/right
  vertical: 0.05, // 5% top/bottom
} as const;

// Larger bottom inset for 9:16 shorts, where the platform UI lives at the
// bottom of the screen (progress bar, username, caption).
export const SHORT_SAFE_AREA = {
  horizontal: 0.06,
  top: 0.08,
  bottom: 0.14,
} as const;

// Convert a safe-area fraction into a concrete pixel inset for a given size.
export const safeInsetPx = (
  width: number,
  height: number,
): { x: number; y: number } => ({
  x: Math.round(width * SAFE_AREA.horizontal),
  y: Math.round(height * SAFE_AREA.vertical),
});

// Full-frame flex layer that centers its children on both axes.
export const Center: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <AbsoluteFill
    style={{
      justifyContent: "center",
      alignItems: "center",
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);

// Full-frame layer whose children are padded in by the safe-area margin.
// `align` positions the padded box (defaults to bottom-left, the natural home
// for lower-thirds and captions).
export const SafeArea: React.FC<{
  children: React.ReactNode;
  justify?: React.CSSProperties["justifyContent"];
  align?: React.CSSProperties["alignItems"];
  style?: React.CSSProperties;
}> = ({ children, justify = "flex-end", align = "flex-start", style }) => (
  <AbsoluteFill
    style={{
      paddingLeft: `${SAFE_AREA.horizontal * 100}%`,
      paddingRight: `${SAFE_AREA.horizontal * 100}%`,
      paddingTop: `${SAFE_AREA.vertical * 100}%`,
      paddingBottom: `${SAFE_AREA.vertical * 100}%`,
      justifyContent: justify,
      alignItems: align,
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);
