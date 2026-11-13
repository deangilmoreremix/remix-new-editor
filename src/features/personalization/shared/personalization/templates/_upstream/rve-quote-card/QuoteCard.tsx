// ---------------------------------------------------------------------------
// OPENHIGGSBOLT — Phase 4 upstream template, batch 3e (repo 2: remotion-templates)
// template id : rve-quote-card
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/quote-card.tsx
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
//   upstream line 5   export default function QuoteCard() {
//                 ->  export const QuoteCard: React.FC<QuoteCardProps> = ({ ... }) => {
//   upstream line 33  backgroundColor: "#111827",        -> backgroundColor  (default "#111827")
//   upstream line 38  padding: "4rem",                   -> padding          (default "4rem")
//   upstream line 44  color: "#3b82f6",                  -> quoteMarkColor   (default "#3b82f6")
//   upstream line 45  fontSize: "6rem",                  -> quoteMarkFontSize (default "6rem")
//   upstream lines 49/65  fontFamily: "Georgia, serif",  -> serifFontFamily  (default identical)
//   upstream line 50  marginBottom: "1rem",              -> quoteMarkGap     (default "1rem")
//   upstream line 53  {"“"}                         -> {quoteMark}      (default "“")
//   upstream line 57  color: "white",                    -> quoteColor       (default "white")
//   upstream line 58  fontSize: "1.8rem",                -> quoteFontSize    (default "1.8rem")
//   upstream line 62  maxWidth: "700px",                 -> maxWidth         (default "700px")
//   upstream line 68  Design is not just what it looks like. Design is how it works.
//                 ->  {quote}
//   upstream line 73  color: "#9ca3af",                  -> attributionColor (default "#9ca3af")
//   upstream line 74  fontSize: "1.1rem",                -> attributionFontSize (default "1.1rem")
//   upstream line 77  marginTop: "2rem",                 -> attributionGap   (default "2rem")
//   upstream line 80  fontFamily: "Inter, sans-serif",   -> fontFamily       (default identical)
//   upstream line 83  — Steve Jobs                       -> {attribution}    (default "— Steve Jobs")
//   upstream line 23  [40, 0]                            -> [attributionTravel, 0] (default 40)
//
// ADDED (not present upstream): `import React from "react";`, the props type,
// the `defaultQuoteCardProps` object and a trailing default export.
//
// NOT TOUCHED: the four opacity / offset interpolations (lines 8-26), the
// weights, the line heights, the italic style and the layout.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

export type QuoteCardProps = {
  /** Upstream literal: "Design is not just what it looks like. Design is how it works.". */
  quote?: string;
  /** Upstream literal: "— Steve Jobs". */
  attribution?: string;
  /** Upstream literal: "“". */
  quoteMark?: string;
  /** Upstream literal: "#111827". */
  backgroundColor?: string;
  /** Upstream literal: "#3b82f6". */
  quoteMarkColor?: string;
  /** Upstream literal: "white". */
  quoteColor?: string;
  /** Upstream literal: "#9ca3af". */
  attributionColor?: string;
  /** Upstream literal: "6rem". */
  quoteMarkFontSize?: string;
  /** Upstream literal: "1.8rem". */
  quoteFontSize?: string;
  /** Upstream literal: "1.1rem". */
  attributionFontSize?: string;
  /** Upstream literal: "1rem". */
  quoteMarkGap?: string;
  /** Upstream literal: "2rem". */
  attributionGap?: string;
  /** Upstream literal: "700px". */
  maxWidth?: string;
  /** Upstream literal: "4rem". */
  padding?: string;
  /** Upstream literal: 40. */
  attributionTravel?: number;
  /** Upstream literal: "Georgia, serif". */
  serifFontFamily?: string;
  /** Upstream literal: "Inter, sans-serif". */
  fontFamily?: string;
};

export const defaultQuoteCardProps: Required<QuoteCardProps> = {
  quote: "Design is not just what it looks like. Design is how it works.",
  attribution: "— Steve Jobs",
  quoteMark: "“",
  backgroundColor: "#111827",
  quoteMarkColor: "#3b82f6",
  quoteColor: "white",
  attributionColor: "#9ca3af",
  quoteMarkFontSize: "6rem",
  quoteFontSize: "1.8rem",
  attributionFontSize: "1.1rem",
  quoteMarkGap: "1rem",
  attributionGap: "2rem",
  maxWidth: "700px",
  padding: "4rem",
  attributionTravel: 40,
  serifFontFamily: "Georgia, serif",
  fontFamily: "Inter, sans-serif",
};

export const QuoteCard: React.FC<QuoteCardProps> = ({
  quote = defaultQuoteCardProps.quote,
  attribution = defaultQuoteCardProps.attribution,
  quoteMark = defaultQuoteCardProps.quoteMark,
  backgroundColor = defaultQuoteCardProps.backgroundColor,
  quoteMarkColor = defaultQuoteCardProps.quoteMarkColor,
  quoteColor = defaultQuoteCardProps.quoteColor,
  attributionColor = defaultQuoteCardProps.attributionColor,
  quoteMarkFontSize = defaultQuoteCardProps.quoteMarkFontSize,
  quoteFontSize = defaultQuoteCardProps.quoteFontSize,
  attributionFontSize = defaultQuoteCardProps.attributionFontSize,
  quoteMarkGap = defaultQuoteCardProps.quoteMarkGap,
  attributionGap = defaultQuoteCardProps.attributionGap,
  maxWidth = defaultQuoteCardProps.maxWidth,
  padding = defaultQuoteCardProps.padding,
  attributionTravel = defaultQuoteCardProps.attributionTravel,
  serifFontFamily = defaultQuoteCardProps.serifFontFamily,
  fontFamily = defaultQuoteCardProps.fontFamily,
}) => {
  const frame = useCurrentFrame();

  const quoteMarkOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const textOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const attributionOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const attributionX = interpolate(frame, [30, 45], [attributionTravel, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          color: quoteMarkColor,
          fontSize: quoteMarkFontSize,
          fontWeight: 700,
          lineHeight: 1,
          opacity: quoteMarkOpacity,
          fontFamily: serifFontFamily,
          marginBottom: quoteMarkGap,
        }}
      >
        {quoteMark}
      </span>
      <p
        style={{
          color: quoteColor,
          fontSize: quoteFontSize,
          fontWeight: 400,
          lineHeight: 1.6,
          textAlign: "center",
          maxWidth,
          margin: 0,
          opacity: textOpacity,
          fontFamily: serifFontFamily,
          fontStyle: "italic",
        }}
      >
        {quote}
      </p>
      <p
        style={{
          color: attributionColor,
          fontSize: attributionFontSize,
          fontWeight: 500,
          margin: 0,
          marginTop: attributionGap,
          opacity: attributionOpacity,
          transform: `translateX(${attributionX}px)`,
          fontFamily,
        }}
      >
        {attribution}
      </p>
    </div>
  );
};

export default QuoteCard;
