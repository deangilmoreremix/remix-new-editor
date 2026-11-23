/**
 * Draws one Personalization Studio design (see addons/studioDesignAddon.js)
 * inside the timeline composition. Kept in its own module and loaded on demand
 * (TimelineComposition's StudioDesign), so the ~80 design components only
 * reach the page, the published /watch player and the export runner when a
 * video actually uses one.
 *
 * Mirrors the Studio's own renderer (PersonalizationComposition.tsx, design
 * branch): the same props contract, inside a clip-local Sequence so the
 * design's animation starts when the clip does.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
// Importing the index registers the whole design catalog as a side effect.
import { getRemotionDesignTemplate } from '../../../features/personalization/shared/personalization/templates/index';

export function StudioDesignOverlay({ o }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const design = o.designId ? getRemotionDesignTemplate(o.designId) : undefined;
  if (!design) return null;
  const Design = design.component;
  const g = { left: 0, top: 0, width: 100, height: 100, ...(o.geometry || {}) };
  const box = {
    leftPx: Math.round((g.left / 100) * width),
    topPx: Math.round((g.top / 100) * height),
    widthPx: Math.round((g.width / 100) * width),
    heightPx: Math.round((g.height / 100) * height),
  };
  const slots = o.slots || {};
  const declared = Array.isArray(design.textSlots) ? design.textSlots : [];
  const primary = declared.find((s) => s && s.primary) ?? declared[0];
  const colors = o.colors || {};
  const opacity = Math.max(0, Math.min(1, (Number(o.opacity) || 100) / 100));
  return (
    <AbsoluteFill style={{ left: box.leftPx, top: box.topPx, width: box.widthPx, height: box.heightPx, opacity, pointerEvents: 'none' }}>
      <Design
        {...(design.defaultProps || {})}
        text={primary ? (slots[primary.key] ?? '') : ''}
        textSlots={slots}
        colors={{ primary: colors.primary, accent: colors.accent, text: colors.text, backgroundDim: 0.18 }}
        media={o.media || {}}
        box={box}
        width={width}
        height={height}
        frame={frame}
        fps={fps}
        opacity={opacity}
        color={colors.text}
      />
    </AbsoluteFill>
  );
}
