/**
 * React wrappers around the canvas renderers (Stage 7): <HeatmapCanvas> (2-D, normalized points) and
 * <EngagementStrip> (1-D, per-second playback data). Both size themselves with ResizeObserver and redraw at the
 * device pixel ratio.
 */
import React, { useEffect, useRef, useState } from 'react';
import { renderHeatmap, buildPalette } from './heatmapRenderer.js';

function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setW(Math.round(el.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export function HeatmapCanvas({ points, aspect = 16 / 9, intensity = 1, visible = true, label = 'Click heatmap', children }) {
  const box = useRef(null);
  const canvas = useRef(null);
  const width = useWidth(box);
  const height = Math.round(width / aspect);
  useEffect(() => {
    if (!canvas.current || !width) return;
    renderHeatmap(canvas.current, points, { width, height, intensity, dpr: globalThis.devicePixelRatio || 1 });
  }, [points, width, height, intensity]);
  return (
    <div className="sv-heat-stage" ref={box} style={{ aspectRatio: String(aspect) }} role="img" aria-label={label} data-testid="heat-stage">
      {children}
      <canvas ref={canvas} className="sv-heat-canvas" data-testid="heat-canvas" hidden={!visible} />
    </div>
  );
}

/** 1-D strip: one column per second, colour = viewers (heat palette); drop-off and replays drawn as markers. */
export function EngagementStrip({ series, intensity = 1, visible = true }) {
  const box = useRef(null);
  const canvas = useRef(null);
  const width = useWidth(box);
  const height = 120;
  useEffect(() => {
    const c = canvas.current;
    if (!c || !width || !series) return;
    const dpr = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
    let ctx = null;
    try { ctx = c.getContext('2d'); } catch { ctx = null; }
    if (!ctx) return;
    c.width = Math.round(width * dpr); c.height = Math.round(height * dpr);
    c.style.width = `${width}px`; c.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const pal = buildPalette();
    const n = series.seconds;
    const colW = width / n;
    const maxRep = Math.max(1, ...series.replays);
    for (let i = 0; i < n; i += 1) {
      const t = Math.min(1, (series.viewers[i] / series.maxViewers) * intensity);
      const idx = Math.round(t * 255) * 4;
      ctx.fillStyle = `rgba(${pal[idx]},${pal[idx + 1]},${pal[idx + 2]},${0.25 + 0.7 * t})`;
      ctx.fillRect(i * colW, 0, Math.ceil(colW), 70);
      // replays: white bar under the strip, height ~ share of the busiest replay second
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      const rh = (series.replays[i] / maxRep) * 30;
      ctx.fillRect(i * colW, 100 - rh, Math.ceil(colW), rh);
    }
    if (series.peakDropoffSecond != null) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(series.peakDropoffSecond * colW, 0, Math.max(2, colW), height);
    }
  }, [series, width, intensity]);
  if (!series) return null;
  return (
    <div className="sv-heat-strip" ref={box} role="img" data-testid="engagement-strip"
      aria-label={`Video engagement per second: ${series.seconds} seconds, peak drop-off ${series.peakDropoffSecond == null ? 'none' : `at ${series.peakDropoffSecond}s`}`}>
      <canvas ref={canvas} hidden={!visible} data-testid="engagement-canvas" />
    </div>
  );
}
