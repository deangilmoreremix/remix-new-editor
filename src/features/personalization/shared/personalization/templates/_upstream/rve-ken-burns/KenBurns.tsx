// NOTE: the upstream file `templates/ken-burns.tsx` carries NO in-file credit
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
// template id : rve-ken-burns
// upstream    : https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)
// upstream src: templates/ken-burns.tsx
// license     : MIT License (README); no LICENSE file, no named copyright
//               holder. The verbatim MIT permission notice (WITHOUT a
//               copyright line) ships with the design credit in
//               `templates/designs/rveSharedDesign.tsx` (RVE_LICENSE_NOTICE).
//
// DEVIATION RECORD (contract addition C8 — repo-2 edited copies)
// ----------------------------------------------------------------
// (Upstream line numbers refer to the file at the pinned commit and may be
// off by one or two; the quoted upstream literal is authoritative.)
// This is one of the three repo-2 templates that already had props
// (`imageUrl`, `duration`, `scale`, `translateX`, `translateY`); all five keep
// their name, type and upstream default. Two upstream mechanisms cannot run in
// a frame-accurate Remotion render and were REPLACED:
//
//   upstream line 32  animation: `kenBurns ${duration}s ease-out forwards`,
//   upstream 34-44    <style jsx>{`@keyframes kenBurns { 0% { transform: scale(1)
//                     translate(0, 0) } 100% { transform: scale(${scale})
//                     translate(${translateX}px, ${translateY}px) } }`}</style>
//                 ->  the SAME keyframes evaluated per frame:
//                     p = interpolate(frame, [0, duration * fps], [0, 1], clamp,
//                         Easing.bezier(0, 0, 0.58, 1))  // CSS `ease-out`
//                     transform: scale(1 + (scale - 1) * p)
//                                translate(translateX * p px, translateY * p px)
//                     WHY: a CSS animation runs on the wall clock, not on the
//                     Remotion frame, so a seek/export renders the wrong
//                     frame; and `<style jsx>` is Next.js styled-jsx, which is
//                     not available outside a Next page.
//   upstream line 26  <img src={imageUrl} … />
//                 ->  <Img src={imageUrl} … />  (Remotion's <Img> holds the
//                     render until the image has loaded)
//   upstream line 14  imageUrl = "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba",
//                 ->  UNCHANGED as the documented default, so a no-props render
//                     still reproduces the upstream. The product adapter NEVER
//                     relies on it: it always passes a brand image or `null`.
//   upstream line 25  backgroundColor: "black", -> background (default "black")
//   upstream line 30  objectFit: "cover",       -> objectFit  (default "cover")
//
// ADDED (not present upstream): `imageUrl` additionally accepts `null`,
// meaning "no image": the component then draws the OPTIONAL `fallback` node
// (a brand placeholder) inside the same moving layer instead of an <img>, so
// no remote URL is ever requested. Also added: the `KenBurnsProps` export
// and `KEN_BURNS_UPSTREAM_IMAGE_URL` (the upstream default, named). The root
// keeps the upstream's `flex: 1` and the image keeps `width/height: 100%`.
// ---------------------------------------------------------------------------

"use client";
import React from "react";
import { Easing, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface KenBurnsProps {
  /** Upstream prop. `null` (ADDED) = no image, draw `fallback` instead. */
  imageUrl?: string | null;
  duration?: number;
  scale?: number;
  translateX?: number;
  translateY?: number;
  /** Upstream literal "black". */
  background?: string;
  /** Upstream literal "cover". */
  objectFit?: React.CSSProperties["objectFit"];
  /** ADDED: drawn in the moving layer when `imageUrl` is null/empty. */
  fallback?: React.ReactNode;
}

export type { KenBurnsProps };

export const KEN_BURNS_UPSTREAM_IMAGE_URL =
  "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba";

export const KenBurns: React.FC<KenBurnsProps> = ({
  imageUrl = KEN_BURNS_UPSTREAM_IMAGE_URL,
  duration = 20,
  scale = 1.5,
  translateX = -50,
  translateY = -30,
  background = "black",
  objectFit = "cover",
  fallback,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // CSS `ease-out` is cubic-bezier(0, 0, 0.58, 1); `forwards` = clamp.
  const p = interpolate(frame, [0, Math.max(1, duration * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0, 0, 0.58, 1),
  });
  const transform = `scale(${1 + (scale - 1) * p}) translate(${translateX * p}px, ${translateY * p}px)`;

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

export default KenBurns;
