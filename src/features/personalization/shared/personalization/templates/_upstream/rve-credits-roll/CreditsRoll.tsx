// ---------------------------------------------------------------------------
// OPENHIGGSBOLT — Phase 4 upstream template, batch 3e (repo 2: remotion-templates)
// template id : rve-credits-roll
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/credits-roll.tsx
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
//   upstream line 5   export default function CreditsRoll() {
//                 ->  export const CreditsRoll: React.FC<CreditsRollProps> = ({ ... }) => {
//   upstream lines 9-18  const credits = [ { role: "Director", name: "Jane Smith" }, … ];
//                 ->  credits prop                       (default: the same eight entries)
//   upstream line 20  const scrollSpeed = 1.5;           -> scrollSpeed prop (default 1.5)
//   upstream lines 28/40/51  "#111827"                   -> backgroundColor  (default "#111827")
//                     (the two edge fades are `linear-gradient(to …, ${backgroundColor}, transparent)`)
//   upstream lines 39/50  height: "80px",                -> fadeHeight       (default "80px")
//   upstream line 60  gap: "2.5rem",                     -> gap              (default "2.5rem")
//   upstream line 62  paddingTop: "2rem",                -> paddingTop       (default "2rem")
//   upstream line 74  color: "#3b82f6",                  -> roleColor        (default "#3b82f6")
//   upstream line 75  fontSize: "0.9rem",                -> roleFontSize     (default "0.9rem")
//   upstream line 80  marginBottom: "0.4rem",            -> roleGap          (default "0.4rem")
//   upstream lines 81/92  fontFamily: "Inter, sans-serif", -> fontFamily
//   upstream line 88  color: "white",                    -> nameColor        (default "white")
//   upstream line 89  fontSize: "1.5rem",                -> nameFontSize     (default "1.5rem")
//
// ADDED (not present upstream): `import React from "react";`, the
// `CreditsRollEntry` / props types, the `defaultCreditsRollProps` object and
// a trailing default export.
//
// NOT TOUCHED: the scroll formula `height - frame * scrollSpeed` (line 21,
// still reading the composition height from `useVideoConfig()`), the
// z-index of the fades, the weights, the letter spacing and the uppercase
// role labels.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

export type CreditsRollEntry = { role: string; name: string };

export type CreditsRollProps = {
  /** Upstream literal: the eight Director … Colorist entries. */
  credits?: CreditsRollEntry[];
  /** Upstream literal: 1.5 (px per frame). */
  scrollSpeed?: number;
  /** Upstream literal: "#111827". */
  backgroundColor?: string;
  /** Upstream literal: "#3b82f6". */
  roleColor?: string;
  /** Upstream literal: "white". */
  nameColor?: string;
  /** Upstream literal: "0.9rem". */
  roleFontSize?: string;
  /** Upstream literal: "1.5rem". */
  nameFontSize?: string;
  /** Upstream literal: "0.4rem". */
  roleGap?: string;
  /** Upstream literal: "2.5rem". */
  gap?: string;
  /** Upstream literal: "2rem". */
  paddingTop?: string;
  /** Upstream literal: "80px". */
  fadeHeight?: string;
  /** Upstream literal: "Inter, sans-serif". */
  fontFamily?: string;
};

export const defaultCreditsRollProps: Required<CreditsRollProps> = {
  credits: [
    { role: "Director", name: "Jane Smith" },
    { role: "Producer", name: "John Doe" },
    { role: "Cinematographer", name: "Emily Chen" },
    { role: "Editor", name: "Michael Park" },
    { role: "Sound Design", name: "Sarah Johnson" },
    { role: "Music", name: "David Kim" },
    { role: "Visual Effects", name: "Lisa Wang" },
    { role: "Colorist", name: "James Brown" },
  ],
  scrollSpeed: 1.5,
  backgroundColor: "#111827",
  roleColor: "#3b82f6",
  nameColor: "white",
  roleFontSize: "0.9rem",
  nameFontSize: "1.5rem",
  roleGap: "0.4rem",
  gap: "2.5rem",
  paddingTop: "2rem",
  fadeHeight: "80px",
  fontFamily: "Inter, sans-serif",
};

export const CreditsRoll: React.FC<CreditsRollProps> = ({
  credits = defaultCreditsRollProps.credits,
  scrollSpeed = defaultCreditsRollProps.scrollSpeed,
  backgroundColor = defaultCreditsRollProps.backgroundColor,
  roleColor = defaultCreditsRollProps.roleColor,
  nameColor = defaultCreditsRollProps.nameColor,
  roleFontSize = defaultCreditsRollProps.roleFontSize,
  nameFontSize = defaultCreditsRollProps.nameFontSize,
  roleGap = defaultCreditsRollProps.roleGap,
  gap = defaultCreditsRollProps.gap,
  paddingTop = defaultCreditsRollProps.paddingTop,
  fadeHeight = defaultCreditsRollProps.fadeHeight,
  fontFamily = defaultCreditsRollProps.fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const translateY = height - frame * scrollSpeed;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: fadeHeight,
          background: `linear-gradient(to bottom, ${backgroundColor}, transparent)`,
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: fadeHeight,
          background: `linear-gradient(to top, ${backgroundColor}, transparent)`,
          zIndex: 2,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap,
          transform: `translateY(${translateY}px)`,
          paddingTop,
        }}
      >
        {credits.map((credit, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
            }}
          >
            <p
              style={{
                color: roleColor,
                fontSize: roleFontSize,
                fontWeight: 500,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                margin: 0,
                marginBottom: roleGap,
                fontFamily,
              }}
            >
              {credit.role}
            </p>
            <p
              style={{
                color: nameColor,
                fontSize: nameFontSize,
                fontWeight: 600,
                margin: 0,
                fontFamily,
              }}
            >
              {credit.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CreditsRoll;
