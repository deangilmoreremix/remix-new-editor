/**
 * Free Remotion Template Component
 * ---------------------------------
 * This template is free to use in your projects!
 * Credit appreciated but not required.
 *
 * Created by the team at https://www.reactvideoeditor.com
 *
 * (The upstream file itself opens directly with "use client"; the credit
 * above is the repository-wide credit every remotion-templates file carries
 * and is reproduced here so it travels with the copy.)
 */

// ---------------------------------------------------------------------------
// OPENHIGGSBOLT — Phase 4 batch 3g upstream template (repo 2: remotion-templates)
// template id : rve-vignette-pulse
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/vignette-pulse.tsx
// license     : MIT License (README statement; no LICENSE file, no named
//               copyright holder). The verbatim MIT permission notice ships
//               with the design credit in `templates/designs/rveSharedDesign.tsx`.
//
// DEVIATION RECORD (contract addition C8 — edited copy)
// ----------------------------------------------------------------------
// Every hard-coded string, colour and dimension became an OPTIONAL prop whose
// default reproduces the upstream literal; no props = the upstream design.
//
//   export default function VignettePulse()
//     -> export const VignettePulse: React.FC<VignettePulseProps>
//   root backgroundColor "#111827"            -> backgroundColor
//   "Your Content Here" / "white" / "2.5rem" / "bold" / "Inter, sans-serif"
//                                             -> title / titleColor / titleFontSize /
//                                                titleFontWeight / titleFontFamily
//   "Vignette pulses around the edges" / "#93c5fd" / "1.1rem" / "0.5rem"
//                                             -> subtitle / subtitleColor /
//                                                subtitleFontSize / subtitleMarginTop
//   ADDED `showSample` (default true): false drops the sample text block.
//   rgba(0, 0, 0, s) channels "0, 0, 0"       -> vignetteRgb
//   "transparent 40%" inner stop               -> innerStop (default "40%")
//
// ADDED: `import React`, prop types, default object, trailing default export.
//
// NOT TOUCHED: the pulse (0.55 + 0.25 * sin(frame / fps * 2 * PI)) and the
// gradient geometry (ellipse at center, outer stop 100 %).
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

export type VignettePulseProps = {
  backgroundColor?: string;
  showSample?: boolean;
  title?: string;
  titleColor?: string;
  titleFontSize?: string;
  titleFontWeight?: string;
  titleFontFamily?: string;
  subtitle?: string;
  subtitleColor?: string;
  subtitleFontSize?: string;
  subtitleMarginTop?: string;
  /** Vignette colour as "r, g, b". Upstream literal: "0, 0, 0". */
  vignetteRgb?: string;
  /** Where the vignette starts. Upstream literal: "40%". */
  innerStop?: string;
};

export const defaultVignettePulseProps = {
  backgroundColor: "#111827",
  showSample: true,
  title: "Your Content Here",
  titleColor: "white",
  titleFontSize: "2.5rem",
  titleFontWeight: "bold",
  titleFontFamily: "Inter, sans-serif",
  subtitle: "Vignette pulses around the edges",
  subtitleColor: "#93c5fd",
  subtitleFontSize: "1.1rem",
  subtitleMarginTop: "0.5rem",
  vignetteRgb: "0, 0, 0",
  innerStop: "40%",
};

export const VignettePulse: React.FC<VignettePulseProps> = ({
  backgroundColor = defaultVignettePulseProps.backgroundColor,
  showSample = defaultVignettePulseProps.showSample,
  title = defaultVignettePulseProps.title,
  titleColor = defaultVignettePulseProps.titleColor,
  titleFontSize = defaultVignettePulseProps.titleFontSize,
  titleFontWeight = defaultVignettePulseProps.titleFontWeight,
  titleFontFamily = defaultVignettePulseProps.titleFontFamily,
  subtitle = defaultVignettePulseProps.subtitle,
  subtitleColor = defaultVignettePulseProps.subtitleColor,
  subtitleFontSize = defaultVignettePulseProps.subtitleFontSize,
  subtitleMarginTop = defaultVignettePulseProps.subtitleMarginTop,
  vignetteRgb = defaultVignettePulseProps.vignetteRgb,
  innerStop = defaultVignettePulseProps.innerStop,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Oscillate vignette intensity between 0.3 and 0.8
  const vignetteStrength = 0.55 + 0.25 * Math.sin((frame / fps) * Math.PI * 2);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor,
        overflow: "hidden",
      }}
    >
      {/* Sample content */}
      {showSample && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              color: titleColor,
              fontSize: titleFontSize,
              fontWeight: titleFontWeight,
              margin: 0,
              fontFamily: titleFontFamily,
            }}
          >
            {title}
          </h2>
          <p style={{ color: subtitleColor, fontSize: subtitleFontSize, marginTop: subtitleMarginTop }}>
            {subtitle}
          </p>
        </div>
      )}

      {/* Vignette overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent ${innerStop}, rgba(${vignetteRgb}, ${vignetteStrength}) 100%)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

export default VignettePulse;
