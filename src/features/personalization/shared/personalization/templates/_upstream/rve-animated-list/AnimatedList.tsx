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
// OPENHIGGSBOLT — Phase 4 upstream template, batch 3e (repo 2: remotion-templates)
// template id : rve-animated-list
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/animated-list.tsx
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
//   upstream line 16  export default function AnimatedList() {
//                 ->  export const AnimatedList: React.FC<AnimatedListProps> = ({ ... }) => {
//   upstream lines 21-25  const items = [ { name: "Item One", color: "#3b82f6" }, … ];
//                 ->  items prop                         (default: the same three entries)
//   upstream line 35  maxWidth: "600px",                 -> maxWidth         (default "600px")
//   upstream line 36  padding: "2rem",                   -> padding          (default "2rem")
//   upstream line 84  gap: "1rem",                       -> gap              (default "1rem")
//   upstream line 85  marginBottom: "1rem",              -> rowGap           (default "1rem")
//   upstream lines 92/93  width/height: "80px",          -> dotSize          (default "80px")
//   upstream line 99  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", -> dotShadow (default identical)
//   upstream line 104 color: "white",                    -> color            (default "white")
//   upstream line 105 fontSize: "3.5rem",                -> fontSize         (default "3.5rem")
//
// ADDED (not present upstream): `import React from "react";`, the
// `AnimatedListItem` / props types, the `defaultAnimatedListProps` object, a
// trailing default export, and ONE optional style, `textShadow` on each label
// (default `undefined` = not set, exactly as upstream) so a label stays
// legible over a bright video.
//
// NOT TOUCHED: the three springs per row (lines 43-77, 5-frame stagger), the
// transforms, the weights and the layout.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export type AnimatedListItem = { name: string; color: string };

export type AnimatedListProps = {
  /** Upstream literal: "Item One" / "Item Two" / "Item Three" with three blues. */
  items?: AnimatedListItem[];
  /** Upstream literal: "white". */
  color?: string;
  /** Upstream literal: "3.5rem". */
  fontSize?: string;
  /** Upstream literal: "80px". */
  dotSize?: string;
  /** Upstream literal: "0 4px 6px rgba(0, 0, 0, 0.1)". */
  dotShadow?: string;
  /** Upstream literal: "1rem". */
  gap?: string;
  /** Upstream literal: "1rem". */
  rowGap?: string;
  /** Upstream literal: "600px". */
  maxWidth?: string;
  /** Upstream literal: "2rem". */
  padding?: string;
  /** ADDED. Not set upstream. */
  textShadow?: string;
};

export const defaultAnimatedListProps: Required<Omit<AnimatedListProps, "textShadow">> = {
  items: [
    { name: "Item One", color: "#3b82f6" },
    { name: "Item Two", color: "#60a5fa" },
    { name: "Item Three", color: "#93c5fd" },
  ],
  color: "white",
  fontSize: "3.5rem",
  dotSize: "80px",
  dotShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  gap: "1rem",
  rowGap: "1rem",
  maxWidth: "600px",
  padding: "2rem",
};

export const AnimatedList: React.FC<AnimatedListProps> = ({
  items = defaultAnimatedListProps.items,
  color = defaultAnimatedListProps.color,
  fontSize = defaultAnimatedListProps.fontSize,
  dotSize = defaultAnimatedListProps.dotSize,
  dotShadow = defaultAnimatedListProps.dotShadow,
  gap = defaultAnimatedListProps.gap,
  rowGap = defaultAnimatedListProps.rowGap,
  maxWidth = defaultAnimatedListProps.maxWidth,
  padding = defaultAnimatedListProps.padding,
  textShadow,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "100%",
        maxWidth,
        padding,
      }}
    >
      {items.map((item, i) => {
        const delay = i * 5;

        // Slide in from left
        const slideX = spring({
          frame: frame - delay,
          fps,
          from: -100,
          to: 0,
          config: {
            damping: 12,
            mass: 0.5,
          },
        });

        // Fade in
        const opacity = spring({
          frame: frame - delay,
          fps,
          from: 0,
          to: 1,
          config: {
            damping: 12,
            mass: 0.5,
          },
        });

        // Scale up
        const scale = spring({
          frame: frame - delay,
          fps,
          from: 0.3,
          to: 1,
          config: {
            damping: 12,
            mass: 0.5,
          },
        });

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap,
              marginBottom: rowGap,
              transform: `translateX(${slideX}px) scale(${scale})`,
              opacity,
            }}
          >
            <div
              style={{
                width: dotSize,
                height: dotSize,
                borderRadius: "50%",
                backgroundColor: item.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: dotShadow,
              }}
            />
            <span
              style={{
                color,
                fontSize,
                fontWeight: "500",
                ...(textShadow ? { textShadow } : null),
              }}
            >
              {item.name}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default AnimatedList;
