// NOTE: the upstream file `templates/zoom-pulse.tsx` carries NO in-file credit
// header (unlike most files of the repository). The repository-wide React
// Video Editor credit is reproduced here so it travels with the copy:
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
// template id : rve-zoom-pulse
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/zoom-pulse.tsx
// license     : MIT License (README); no LICENSE file, no named copyright
//               holder. The verbatim MIT permission notice (WITHOUT a
//               copyright line) ships with the design credit in
//               `templates/designs/rveSharedDesign.tsx` (RVE_LICENSE_NOTICE).
//
// DEVIATION RECORD (contract addition C8 — repo-2 edited copies)
// ----------------------------------------------------------------
// (Upstream line numbers refer to the file at the pinned commit and may be
// off by one or two; the quoted upstream literal is authoritative.)
// One of the three repo-2 templates that already had props (`imageUrl`,
// `duration`, `minScale`, `maxScale`); all four keep their name, type and
// upstream default. Three upstream mechanisms cannot run in a Remotion render
// and were REPLACED:
//
//   upstream line 3   import Image from "next/image";
//   upstream 26-37    <Image src={imageUrl} width={800} height={450}
//                     unoptimized={true} alt="Zoom Pulse" style={…} />
//                 ->  <Img src={imageUrl} width={800} height={450}
//                     alt="Zoom Pulse" style={…} />  — Remotion's <Img> (holds
//                     the render until loaded). `unoptimized` is a next/image
//                     option with no <img> equivalent and was dropped.
//   upstream line 35  animation: `zoomPulse ${duration}s ease-in-out infinite`,
//   upstream 39-49    <style jsx>{`@keyframes zoomPulse { 0%, 100% { transform:
//                     scale(${minScale}) } 50% { transform: scale(${maxScale}) } }`}</style>
//                 ->  the SAME keyframes evaluated per frame: t = position in
//                     the `duration`-second loop; each half (0→50 %, 50→100 %)
//                     is eased with CSS `ease-in-out` = Easing.bezier(0.42, 0,
//                     0.58, 1), exactly as CSS eases between keyframes.
//                     WHY: a CSS animation runs on the wall clock, not on the
//                     Remotion frame; `<style jsx>` is Next.js-only.
//   upstream line 12  imageUrl = "https://images.pexels.com/photos/1726310/…",
//                 ->  UNCHANGED as the documented default (a no-props render
//                     still reproduces the upstream). The product adapter
//                     NEVER relies on it: it always passes a brand image or null.
//   upstream line 22  backgroundColor: "black", -> background (default "black")
//   upstream line 33  objectFit: "cover",       -> objectFit  (default "cover")
//
// ADDED (not present upstream): `imageUrl` additionally accepts `null`
// ("no image"): the component then draws the OPTIONAL `fallback` node (a brand
// placeholder) in the same pulsing layer, so no remote URL is requested. Also
// added: the `ZoomPulseProps` export and `ZOOM_PULSE_UPSTREAM_IMAGE_URL`.
// ---------------------------------------------------------------------------

"use client";
import React from "react";
import { Easing, Img, useCurrentFrame, useVideoConfig } from "remotion";

interface ZoomPulseProps {
  /** Upstream prop. `null` (ADDED) = no image, draw `fallback` instead. */
  imageUrl?: string | null;
  duration?: number;
  minScale?: number;
  maxScale?: number;
  /** Upstream literal "black". */
  background?: string;
  /** Upstream literal "cover". */
  objectFit?: React.CSSProperties["objectFit"];
  /** ADDED: drawn in the pulsing layer when `imageUrl` is null/empty. */
  fallback?: React.ReactNode;
}

export type { ZoomPulseProps };

export const ZOOM_PULSE_UPSTREAM_IMAGE_URL =
  "https://images.pexels.com/photos/1726310/pexels-photo-1726310.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2";

const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);

export const ZoomPulse: React.FC<ZoomPulseProps> = ({
  imageUrl = ZOOM_PULSE_UPSTREAM_IMAGE_URL,
  duration = 4,
  minScale = 1,
  maxScale = 1.1,
  background = "black",
  objectFit = "cover",
  fallback,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // `infinite` loop of the 0% → 50% → 100% keyframes.
  const loopFrames = Math.max(1, duration * fps);
  const t = (((frame % loopFrames) + loopFrames) % loopFrames) / loopFrames;
  const half = t < 0.5 ? t * 2 : (1 - t) * 2;
  const pulseScale = minScale + (maxScale - minScale) * easeInOut(half);
  const transform = `scale(${pulseScale})`;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: background,
        overflow: "hidden",
      }}
    >
      {imageUrl ? (
        <Img
          src={imageUrl}
          width={800}
          height={450}
          alt="Zoom Pulse"
          style={{
            width: "100%",
            height: "100%",
            objectFit,
            transform,
          }}
        />
      ) : (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transform,
          }}
        >
          {fallback ?? null}
        </div>
      )}
    </div>
  );
};

export default ZoomPulse;
