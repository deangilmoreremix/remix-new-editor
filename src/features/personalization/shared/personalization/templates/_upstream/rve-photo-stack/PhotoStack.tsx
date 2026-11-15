// NOTE: the upstream file `templates/photo-stack.tsx` carries NO in-file
// credit header (unlike most files of the repository). The repository-wide
// React Video Editor credit is reproduced here so it travels with the copy:
/**
 * Free Remotion Template Component
 * ---------------------------------
 * This template is free to use in your projects!
 * Credit appreciated but not required.
 *
 * Created by the team at https://www.reactvideoeditor.com
 */

// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 batch 3h upstream template (repo 2: remotion-templates)
// template id : rve-photo-stack
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/photo-stack.tsx
// license     : MIT License (README); no LICENSE file, no named copyright
//               holder. The verbatim MIT permission notice (WITHOUT a
//               copyright line) ships with the design credit in
//               `templates/designs/rveSharedDesign.tsx` (RVE_LICENSE_NOTICE).
//
// DEVIATION RECORD (contract addition C8 — repo-2 edited copies)
// ----------------------------------------------------------------
// (Upstream line numbers refer to the file at the pinned commit and may be
// off by one or two; the quoted upstream literal is authoritative.)
// This file is EDITED. Every hard-coded string, colour and dimension became an
// OPTIONAL prop whose default reproduces the upstream literal exactly.
// Rendering this component with no props reproduces the upstream design.
//
//   upstream line 5   export default function PhotoStack() {
//                 ->  export const PhotoStack: React.FC<PhotoStackProps> = ({ ... }) => {
//   upstream 9-13     const photos = [ "Photo 1/2/3" label/rotation/gradient/delay literals ];
//                 ->  `photos` prop (default: the three upstream literals)
//   upstream line 20  backgroundColor: "#111827", -> background (default "#111827";
//                     longhand → shorthand so a brand gradient can be passed)
//   upstream line 37  const offsetX = (i - 1) * 30;  -> (i - 1) * offsetXStep (default 30)
//   upstream line 38  const offsetY = (i - 1) * -10; -> (i - 1) * offsetYStep (default -10)
//   upstream line 45  width: "200px",       ->  photoWidth   (default "200px")
//   upstream line 46  height: "260px",      ->  photoHeight  (default "260px")
//   upstream line 49  borderRadius: "8px",  ->  photoRadius  (default "8px")
//   upstream line 50  border: "6px solid white", -> photoBorder
//   upstream line 51  boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)", -> photoShadow
//   upstream 62/63    width/height: "50px", ->  iconSize     (default "50px")
//   upstream line 65  backgroundColor: "rgba(255, 255, 255, 0.2)", -> iconColor
//   upstream line 66  marginBottom: "0.75rem", -> iconGap    (default "0.75rem")
//   upstream line 71  color: "white",       ->  labelColor   (default "white")
//   upstream line 72  fontSize: "1.2rem",   ->  labelFontSize (default "1.2rem")
//   upstream line 73  fontWeight: "bold",   ->  labelFontWeight (default "bold")
//
// ADDED (not present upstream): `import React from "react";`, the prop
// types, `defaultPhotoStackProps`, a trailing `export default`, an OPTIONAL
// `labelWhiteSpace` (default undefined = upstream wrapping), and an OPTIONAL
// per-photo `content` node. A photo WITH `content` draws the node filling the
// card (absolute, inset 0) INSTEAD of the upstream icon + label (the adapter
// puts the brand photo or brand placeholder there). A photo without
// `content` renders exactly as upstream.
//
// NOT TOUCHED: the spring (`damping: 12`, `stiffness: 100`), the per-photo
// delays and rotations, and the translate/rotate/scale transform order.
// ---------------------------------------------------------------------------

"use client";

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export type PhotoStackPhoto = {
  label: string;
  rotation: number;
  gradient: string;
  delay: number;
  /** ADDED: node drawn filling the card instead of the icon + label. */
  content?: React.ReactNode;
};

export type PhotoStackProps = {
  photos?: PhotoStackPhoto[];
  background?: string;
  offsetXStep?: number;
  offsetYStep?: number;
  photoWidth?: string;
  photoHeight?: string;
  photoRadius?: string;
  photoBorder?: string;
  photoShadow?: string;
  iconSize?: string;
  iconColor?: string;
  iconGap?: string;
  labelColor?: string;
  labelFontSize?: string;
  labelFontWeight?: React.CSSProperties["fontWeight"];
  /** ADDED. */
  labelWhiteSpace?: React.CSSProperties["whiteSpace"];
};

export const defaultPhotoStackProps = {
  photos: [
    { label: "Photo 1", rotation: -5, gradient: "linear-gradient(135deg, #1d4ed8, #3b82f6)", delay: 0 },
    { label: "Photo 2", rotation: 0, gradient: "linear-gradient(135deg, #7c3aed, #a855f7)", delay: 8 },
    { label: "Photo 3", rotation: 5, gradient: "linear-gradient(135deg, #059669, #34d399)", delay: 16 },
  ] as PhotoStackPhoto[],
  background: "#111827",
  offsetXStep: 30,
  offsetYStep: -10,
  photoWidth: "200px",
  photoHeight: "260px",
  photoRadius: "8px",
  photoBorder: "6px solid white",
  photoShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
  iconSize: "50px",
  iconColor: "rgba(255, 255, 255, 0.2)",
  iconGap: "0.75rem",
  labelColor: "white",
  labelFontSize: "1.2rem",
  labelFontWeight: "bold" as React.CSSProperties["fontWeight"],
};

export const PhotoStack: React.FC<PhotoStackProps> = ({
  photos = defaultPhotoStackProps.photos,
  background = defaultPhotoStackProps.background,
  offsetXStep = defaultPhotoStackProps.offsetXStep,
  offsetYStep = defaultPhotoStackProps.offsetYStep,
  photoWidth = defaultPhotoStackProps.photoWidth,
  photoHeight = defaultPhotoStackProps.photoHeight,
  photoRadius = defaultPhotoStackProps.photoRadius,
  photoBorder = defaultPhotoStackProps.photoBorder,
  photoShadow = defaultPhotoStackProps.photoShadow,
  iconSize = defaultPhotoStackProps.iconSize,
  iconColor = defaultPhotoStackProps.iconColor,
  iconGap = defaultPhotoStackProps.iconGap,
  labelColor = defaultPhotoStackProps.labelColor,
  labelFontSize = defaultPhotoStackProps.labelFontSize,
  labelFontWeight = defaultPhotoStackProps.labelFontWeight,
  labelWhiteSpace,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {photos.map((photo, i) => {
        const appear = spring({
          frame: frame - photo.delay,
          fps,
          config: { damping: 12, stiffness: 100 },
        });

        const scale = appear;
        const opacity = appear;
        const offsetX = (i - 1) * offsetXStep;
        const offsetY = (i - 1) * offsetYStep;
        const hasContent = photo.content !== undefined && photo.content !== null;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: photoWidth,
              height: photoHeight,
              transform: `translate(${offsetX}px, ${offsetY}px) rotate(${photo.rotation}deg) scale(${scale})`,
              opacity,
              borderRadius: photoRadius,
              border: photoBorder,
              boxShadow: photoShadow,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              background: photo.gradient,
            }}
          >
            {hasContent ? (
              photo.content
            ) : (
              <>
                <div
                  style={{
                    width: iconSize,
                    height: iconSize,
                    borderRadius: "50%",
                    backgroundColor: iconColor,
                    marginBottom: iconGap,
                  }}
                />
                <span
                  style={{
                    color: labelColor,
                    fontSize: labelFontSize,
                    fontWeight: labelFontWeight,
                    ...(labelWhiteSpace ? { whiteSpace: labelWhiteSpace } : null),
                  }}
                >
                  {photo.label}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PhotoStack;
