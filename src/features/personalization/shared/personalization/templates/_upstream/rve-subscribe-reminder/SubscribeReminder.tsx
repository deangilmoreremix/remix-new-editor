// ---------------------------------------------------------------------------
// OPENHIGGSBOLT — Phase 4 upstream template, batch 3e (repo 2: remotion-templates)
// template id : rve-subscribe-reminder
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/subscribe-reminder.tsx
// credit      : The upstream file carries NO in-file credit header (it starts
//               at `"use client";`). The repository's credit applies: "Free
//               Remotion Template Component — Credit appreciated but not
//               required. Created by the team at https://www.reactvideoeditor.com"
//               (RVE_UPSTREAM_CREDIT in `templates/designs/rveSharedDesign.tsx`).
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
// This file is EDITED. Every hard-coded string, colour and dimension became
// an OPTIONAL prop whose default reproduces the upstream literal exactly.
// Rendering this component with no props reproduces the upstream design.
//
//   upstream line 5   export default function SubscribeReminder() {
//                 ->  export const SubscribeReminder: React.FC<SubscribeReminderProps> = ({ ... }) => {
//   upstream line 15  [100, 0]                           -> [slideDistance, 0] (default 100)
//   upstream line 28  backgroundColor: "#111827",        -> backgroundColor  (default "#111827")
//   upstream line 44  color: "#374151",                  -> placeholderColor (default "#374151")
//   upstream line 45  fontSize: "1.5rem",                -> placeholderFontSize (default "1.5rem")
//   upstream lines 46/88/97  fontFamily: "Inter, sans-serif", -> fontFamily
//   upstream line 49  Your Video Content                 -> {placeholderText}
//   upstream lines 55/56  bottom/right: "24px",          -> offset           (default "24px")
//   upstream line 59  gap: "0.75rem",                    -> gap              (default "0.75rem")
//   upstream line 60  backgroundColor: "rgba(0, 0, 0, 0.75)", -> pillBackground (default identical)
//   upstream line 62  padding: "0.6rem 1.2rem",          -> pillPadding      (default identical)
//   upstream line 65  border: "1px solid rgba(255, 255, 255, 0.1)", -> pillBorder (default identical)
//   upstream lines 70/71  width/height: "28px",          -> iconSize         (default "28px")
//   upstream line 73  backgroundColor: "#3b82f6",        -> iconBackground   (default "#3b82f6")
//   upstream line 80  { color: "white", fontSize: "0.8rem" } -> iconColor / iconFontSize
//   upstream line 80  &#128276;                          -> {icon}           (default "\u{1F514}", the same bell)
//   upstream line 85  color: "white",                    -> titleColor       (default "white")
//   upstream line 86  fontSize: "0.85rem",               -> titleFontSize    (default "0.85rem")
//   upstream line 91  Subscribe                          -> {title}
//   upstream line 95  color: "#9ca3af",                  -> handleColor      (default "#9ca3af")
//   upstream line 96  fontSize: "0.65rem",               -> handleFontSize   (default "0.65rem")
//   upstream line 100 @CreativeStudio                    -> {handle}
//
// ADDED (not present upstream): `import React from "react";`, the props type
// (`icon` accepts any React node, so an adapter can draw the bell as inline
// SVG instead of relying on a system emoji font), the
// `defaultSubscribeReminderProps` object and a trailing default export.
//
// NOT TOUCHED: the slide-in spring (lines 9-13), the sine bell pulse (17-21),
// `backdropFilter: blur(8px)`, `borderRadius: "999px"`, the weights.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export type SubscribeReminderProps = {
  /** Upstream literal: "Subscribe". */
  title?: string;
  /** Upstream literal: "@CreativeStudio". */
  handle?: string;
  /** Upstream literal: the bell emoji (&#128276;). */
  icon?: React.ReactNode;
  /** Upstream literal: "Your Video Content". */
  placeholderText?: string;
  /** Upstream literal: "#111827". */
  backgroundColor?: string;
  /** Upstream literal: "#374151". */
  placeholderColor?: string;
  /** Upstream literal: "1.5rem". */
  placeholderFontSize?: string;
  /** Upstream literal: "24px". */
  offset?: string;
  /** Upstream literal: "0.75rem". */
  gap?: string;
  /** Upstream literal: "rgba(0, 0, 0, 0.75)". */
  pillBackground?: string;
  /** Upstream literal: "0.6rem 1.2rem". */
  pillPadding?: string;
  /** Upstream literal: "1px solid rgba(255, 255, 255, 0.1)". */
  pillBorder?: string;
  /** Upstream literal: "28px". */
  iconSize?: string;
  /** Upstream literal: "#3b82f6". */
  iconBackground?: string;
  /** Upstream literal: "white". */
  iconColor?: string;
  /** Upstream literal: "0.8rem". */
  iconFontSize?: string;
  /** Upstream literal: "white". */
  titleColor?: string;
  /** Upstream literal: "0.85rem". */
  titleFontSize?: string;
  /** Upstream literal: "#9ca3af". */
  handleColor?: string;
  /** Upstream literal: "0.65rem". */
  handleFontSize?: string;
  /** Upstream literal: 100. */
  slideDistance?: number;
  /** Upstream literal: "Inter, sans-serif". */
  fontFamily?: string;
};

export const defaultSubscribeReminderProps: Required<SubscribeReminderProps> = {
  title: "Subscribe",
  handle: "@CreativeStudio",
  icon: "\u{1F514}",
  placeholderText: "Your Video Content",
  backgroundColor: "#111827",
  placeholderColor: "#374151",
  placeholderFontSize: "1.5rem",
  offset: "24px",
  gap: "0.75rem",
  pillBackground: "rgba(0, 0, 0, 0.75)",
  pillPadding: "0.6rem 1.2rem",
  pillBorder: "1px solid rgba(255, 255, 255, 0.1)",
  iconSize: "28px",
  iconBackground: "#3b82f6",
  iconColor: "white",
  iconFontSize: "0.8rem",
  titleColor: "white",
  titleFontSize: "0.85rem",
  handleColor: "#9ca3af",
  handleFontSize: "0.65rem",
  slideDistance: 100,
  fontFamily: "Inter, sans-serif",
};

export const SubscribeReminder: React.FC<SubscribeReminderProps> = ({
  title = defaultSubscribeReminderProps.title,
  handle = defaultSubscribeReminderProps.handle,
  icon = defaultSubscribeReminderProps.icon,
  placeholderText = defaultSubscribeReminderProps.placeholderText,
  backgroundColor = defaultSubscribeReminderProps.backgroundColor,
  placeholderColor = defaultSubscribeReminderProps.placeholderColor,
  placeholderFontSize = defaultSubscribeReminderProps.placeholderFontSize,
  offset = defaultSubscribeReminderProps.offset,
  gap = defaultSubscribeReminderProps.gap,
  pillBackground = defaultSubscribeReminderProps.pillBackground,
  pillPadding = defaultSubscribeReminderProps.pillPadding,
  pillBorder = defaultSubscribeReminderProps.pillBorder,
  iconSize = defaultSubscribeReminderProps.iconSize,
  iconBackground = defaultSubscribeReminderProps.iconBackground,
  iconColor = defaultSubscribeReminderProps.iconColor,
  iconFontSize = defaultSubscribeReminderProps.iconFontSize,
  titleColor = defaultSubscribeReminderProps.titleColor,
  titleFontSize = defaultSubscribeReminderProps.titleFontSize,
  handleColor = defaultSubscribeReminderProps.handleColor,
  handleFontSize = defaultSubscribeReminderProps.handleFontSize,
  slideDistance = defaultSubscribeReminderProps.slideDistance,
  fontFamily = defaultSubscribeReminderProps.fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({
    frame: Math.max(frame - 10, 0),
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  const translateY = interpolate(slideIn, [0, 1], [slideDistance, 0]);

  const bellPulse = interpolate(
    Math.sin(frame * 0.15),
    [-1, 1],
    [1, 1.15],
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: placeholderColor,
            fontSize: placeholderFontSize,
            fontFamily,
          }}
        >
          {placeholderText}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: offset,
          right: offset,
          display: "flex",
          alignItems: "center",
          gap,
          backgroundColor: pillBackground,
          backdropFilter: "blur(8px)",
          padding: pillPadding,
          borderRadius: "999px",
          transform: `translateY(${translateY}px)`,
          border: pillBorder,
        }}
      >
        <div
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: "50%",
            backgroundColor: iconBackground,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `scale(${bellPulse})`,
          }}
        >
          <span style={{ color: iconColor, fontSize: iconFontSize }}>{icon}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              color: titleColor,
              fontSize: titleFontSize,
              fontWeight: 600,
              fontFamily,
            }}
          >
            {title}
          </span>
          <span
            style={{
              color: handleColor,
              fontSize: handleFontSize,
              fontFamily,
            }}
          >
            {handle}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SubscribeReminder;
