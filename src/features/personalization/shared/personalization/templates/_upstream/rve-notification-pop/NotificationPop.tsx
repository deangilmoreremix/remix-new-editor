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
// OPENHIGGSBOLT — Phase 4 upstream template, batch 3e (repo 2: remotion-templates)
// template id : rve-notification-pop
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/notification-pop.tsx
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
//   upstream line 15  export default function NotificationPop() {
//                 ->  export const NotificationPop: React.FC<NotificationPopProps> = ({ ... }) => {
//   upstream lines 19-23  const notifications = [ … three entries … ];
//                 ->  notifications prop                 (default: the same three entries)
//   upstream line 30  background: "linear-gradient(180deg, #111827, #1f2937)",
//                 ->  background                         (default identical)
//   upstream line 35  padding: "40px",                   -> padding          (default "40px")
//   upstream lines 43/44  top: "40px", left: "40px",     -> headerOffset     (default "40px")
//   upstream line 45  color: "white",                    -> headerColor      (default "white")
//   upstream line 46  fontSize: "1.8rem",                -> headerFontSize   (default "1.8rem")
//   upstream lines 48/106/116/138  fontFamily: "Inter, sans-serif", -> fontFamily
//   upstream line 52  Notifications                      -> {headerText}
//   upstream line 59  gap: "12px",                       -> gap              (default "12px")
//   upstream line 71  [300, 0]                           -> [slideDistance, 0] (default 300)
//   upstream line 80  width: "320px",                    -> cardWidth        (default "320px")
//   upstream line 81  padding: "16px",                   -> cardPadding      (default "16px")
//   upstream line 82  borderRadius: "12px",              -> cardRadius       (default "12px")
//   upstream line 83  background: "rgba(31, 41, 55, 0.9)", -> cardBackground (default identical)
//   upstream line 84  border: `1px solid rgba(255, 255, 255, 0.1)`, -> cardBorder (default identical)
//   upstream line 87  gap: "12px",                       -> gap
//   upstream lines 93/94  width/height: "40px",          -> dotSize          (default "40px")
//   upstream line 103 color: "white",                    -> titleColor       (default "white")
//   upstream line 104 fontSize: "0.95rem",               -> titleFontSize    (default "0.95rem")
//   upstream line 107 marginBottom: "4px",               -> titleGap         (default "4px")
//   upstream line 114 color: "#9ca3af",                  -> bodyColor        (default "#9ca3af")
//   upstream line 115 fontSize: "0.8rem",                -> bodyFontSize     (default "0.8rem")
//   upstream lines 126/127  top/right: "-6px",           -> badgeOffset      (default "-6px")
//   upstream lines 128/129  width/height: "22px",        -> badgeSize        (default "22px")
//   upstream line 131 background: "#ef4444",             -> badgeColor       (default "#ef4444")
//   upstream line 135 color: "white",                    -> badgeTextColor   (default "white")
//   upstream line 136 fontSize: "0.7rem",                -> badgeFontSize    (default "0.7rem")
//   upstream line 141 3                                  -> {badgeText}      (default "3")
//
// ADDED (not present upstream): `import React from "react";`, the
// `NotificationPopItem` / props types, the `defaultNotificationPopProps`
// object and a trailing default export.
//
// NOT TOUCHED: the per-card spring (damping 14, stiffness 180, mass 0.6), the
// opacity interpolation, the badge only on the first card, the layout.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export type NotificationPopItem = {
  title: string;
  body: string;
  color: string;
  delay: number;
};

export type NotificationPopProps = {
  /** Upstream literal: the three "New Message" / "Task Complete" / "New Follower" cards. */
  notifications?: NotificationPopItem[];
  /** Upstream literal: "linear-gradient(180deg, #111827, #1f2937)". */
  background?: string;
  /** Upstream literal: "40px". */
  padding?: string;
  /** Upstream literal: "Notifications". */
  headerText?: string;
  /** Upstream literal: "white". */
  headerColor?: string;
  /** Upstream literal: "1.8rem". */
  headerFontSize?: string;
  /** Upstream literal: "40px". */
  headerOffset?: string;
  /** Upstream literal: "12px". */
  gap?: string;
  /** Upstream literal: 300. */
  slideDistance?: number;
  /** Upstream literal: "320px". */
  cardWidth?: string;
  /** Upstream literal: "16px". */
  cardPadding?: string;
  /** Upstream literal: "12px". */
  cardRadius?: string;
  /** Upstream literal: "rgba(31, 41, 55, 0.9)". */
  cardBackground?: string;
  /** Upstream literal: "1px solid rgba(255, 255, 255, 0.1)". */
  cardBorder?: string;
  /** Upstream literal: "40px". */
  dotSize?: string;
  /** Upstream literal: "white". */
  titleColor?: string;
  /** Upstream literal: "0.95rem". */
  titleFontSize?: string;
  /** Upstream literal: "4px". */
  titleGap?: string;
  /** Upstream literal: "#9ca3af". */
  bodyColor?: string;
  /** Upstream literal: "0.8rem". */
  bodyFontSize?: string;
  /** Upstream literal: "3". */
  badgeText?: string;
  /** Upstream literal: "#ef4444". */
  badgeColor?: string;
  /** Upstream literal: "white". */
  badgeTextColor?: string;
  /** Upstream literal: "22px". */
  badgeSize?: string;
  /** Upstream literal: "-6px". */
  badgeOffset?: string;
  /** Upstream literal: "0.7rem". */
  badgeFontSize?: string;
  /** Upstream literal: "Inter, sans-serif". */
  fontFamily?: string;
};

export const defaultNotificationPopProps: Required<NotificationPopProps> = {
  notifications: [
    { title: "New Message", body: "Hey! Check out this update.", color: "#3b82f6", delay: 0 },
    { title: "Task Complete", body: "Your render finished successfully.", color: "#a855f7", delay: 20 },
    { title: "New Follower", body: "Someone started following you.", color: "#4361ee", delay: 40 },
  ],
  background: "linear-gradient(180deg, #111827, #1f2937)",
  padding: "40px",
  headerText: "Notifications",
  headerColor: "white",
  headerFontSize: "1.8rem",
  headerOffset: "40px",
  gap: "12px",
  slideDistance: 300,
  cardWidth: "320px",
  cardPadding: "16px",
  cardRadius: "12px",
  cardBackground: "rgba(31, 41, 55, 0.9)",
  cardBorder: "1px solid rgba(255, 255, 255, 0.1)",
  dotSize: "40px",
  titleColor: "white",
  titleFontSize: "0.95rem",
  titleGap: "4px",
  bodyColor: "#9ca3af",
  bodyFontSize: "0.8rem",
  badgeText: "3",
  badgeColor: "#ef4444",
  badgeTextColor: "white",
  badgeSize: "22px",
  badgeOffset: "-6px",
  badgeFontSize: "0.7rem",
  fontFamily: "Inter, sans-serif",
};

export const NotificationPop: React.FC<NotificationPopProps> = ({
  notifications = defaultNotificationPopProps.notifications,
  background = defaultNotificationPopProps.background,
  padding = defaultNotificationPopProps.padding,
  headerText = defaultNotificationPopProps.headerText,
  headerColor = defaultNotificationPopProps.headerColor,
  headerFontSize = defaultNotificationPopProps.headerFontSize,
  headerOffset = defaultNotificationPopProps.headerOffset,
  gap = defaultNotificationPopProps.gap,
  slideDistance = defaultNotificationPopProps.slideDistance,
  cardWidth = defaultNotificationPopProps.cardWidth,
  cardPadding = defaultNotificationPopProps.cardPadding,
  cardRadius = defaultNotificationPopProps.cardRadius,
  cardBackground = defaultNotificationPopProps.cardBackground,
  cardBorder = defaultNotificationPopProps.cardBorder,
  dotSize = defaultNotificationPopProps.dotSize,
  titleColor = defaultNotificationPopProps.titleColor,
  titleFontSize = defaultNotificationPopProps.titleFontSize,
  titleGap = defaultNotificationPopProps.titleGap,
  bodyColor = defaultNotificationPopProps.bodyColor,
  bodyFontSize = defaultNotificationPopProps.bodyFontSize,
  badgeText = defaultNotificationPopProps.badgeText,
  badgeColor = defaultNotificationPopProps.badgeColor,
  badgeTextColor = defaultNotificationPopProps.badgeTextColor,
  badgeSize = defaultNotificationPopProps.badgeSize,
  badgeOffset = defaultNotificationPopProps.badgeOffset,
  badgeFontSize = defaultNotificationPopProps.badgeFontSize,
  fontFamily = defaultNotificationPopProps.fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-end",
        padding,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <h2
        style={{
          position: "absolute",
          top: headerOffset,
          left: headerOffset,
          color: headerColor,
          fontSize: headerFontSize,
          fontWeight: "bold",
          fontFamily,
          margin: 0,
        }}
      >
        {headerText}
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap,
          alignItems: "flex-end",
        }}
      >
        {notifications.map((notif, i) => {
          const delayedFrame = Math.max(0, frame - notif.delay);
          const slideIn = spring({
            frame: delayedFrame,
            fps,
            config: { damping: 14, stiffness: 180, mass: 0.6 },
          });

          const translateX = interpolate(slideIn, [0, 1], [slideDistance, 0]);
          const opacity = interpolate(slideIn, [0, 1], [0, 1]);

          return (
            <div
              key={i}
              style={{
                transform: `translateX(${translateX}px)`,
                opacity,
                width: cardWidth,
                padding: cardPadding,
                borderRadius: cardRadius,
                background: cardBackground,
                border: cardBorder,
                display: "flex",
                alignItems: "flex-start",
                gap,
                position: "relative",
              }}
            >
              <div
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: "50%",
                  background: notif.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: titleColor,
                    fontSize: titleFontSize,
                    fontWeight: "600",
                    fontFamily,
                    marginBottom: titleGap,
                  }}
                >
                  {notif.title}
                </div>
                <div
                  style={{
                    color: bodyColor,
                    fontSize: bodyFontSize,
                    fontFamily,
                  }}
                >
                  {notif.body}
                </div>
              </div>
              {i === 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: badgeOffset,
                    right: badgeOffset,
                    width: badgeSize,
                    height: badgeSize,
                    borderRadius: "50%",
                    background: badgeColor,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    color: badgeTextColor,
                    fontSize: badgeFontSize,
                    fontWeight: "bold",
                    fontFamily,
                  }}
                >
                  {badgeText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NotificationPop;
