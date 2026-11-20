import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, continueRender, delayRender } from 'remotion';
import { lookOverlays, vignetteStops, type LookSettings } from './effects';

/**
 * The parts of a look that are drawn OVER the footage rather than applied to it: flat color overlays (temperature, tint, an
 * overlay color) and the vignette. The vignette is painted on a canvas because the browser exporter draws canvas pixels but
 * not radial CSS gradients. Sits above the footage and below the brand overlays, so text and logos are never tinted.
 */
export const LookLayers: React.FC<{ look: LookSettings | undefined }> = ({ look }) => {
  if (!look) return null;
  const overlays = lookOverlays(look);
  if (overlays.length === 0 && look.vignette <= 0) return null;
  return (
    <>
      {overlays.map((o) => (
        <AbsoluteFill key={o.key} data-testid={`look-layer-${o.key}`} style={{ background: o.color, pointerEvents: 'none' }} />
      ))}
      {look.vignette > 0 ? <Vignette strength={look.vignette} /> : null}
    </>
  );
};

const Vignette: React.FC<{ strength: number }> = ({ strength }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const handle = delayRender('vignette');
    try {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
      for (const stop of vignetteStops(strength)) g.addColorStop(stop.at, `rgba(0,0,0,${stop.alpha})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } finally {
      continueRender(handle);
    }
  }, [strength]);
  return (
    <AbsoluteFill data-testid="look-layer-vignette" style={{ pointerEvents: 'none' }}>
      <canvas ref={ref} width={640} height={360} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
};
