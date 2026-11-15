/* global ResizeObserver */
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

export function HeatmapCanvas({ points, blocks = [], aspect = 16 / 9, intensity = 1, visible = true, label = 'Click heatmap', children }) {
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
      {visible && blocks.map((b) => (
        <span key={`${b.left}-${b.top}`} className="sv-heat-block" data-testid="heat-block" aria-hidden="true"
          style={{ left: `${b.left}%`, top: `${b.top}%`, width: `${b.size}%`, height: `${b.size}%` }} />
      ))}
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
    const maxRep = Math.max(1, ...series.replays.map((v) => v ?? 0));
    // Hatch pattern for seconds the server withheld (fewer viewers than the minimum cohort): clearly "not shown", not "zero".
    let hatch = null;
    try {
      const pc = c.ownerDocument.createElement('canvas'); pc.width = 8; pc.height = 8;
      const px = pc.getContext('2d');
      px.fillStyle = 'rgba(148,163,184,0.18)'; px.fillRect(0, 0, 8, 8);
      px.strokeStyle = 'rgba(148,163,184,0.85)'; px.lineWidth = 1.5;
      px.beginPath(); px.moveTo(0, 8); px.lineTo(8, 0); px.stroke();
      hatch = ctx.createPattern(pc, 'repeat');
    } catch { hatch = null; }
    for (let i = 0; i < n; i += 1) {
      if (series.withheld[i]) {
        ctx.fillStyle = hatch || 'rgba(148,163,184,0.5)';
        ctx.fillRect(i * colW, 0, Math.ceil(colW), 70);
        continue;
      }
      const t = Math.min(1, ((series.viewers[i] ?? 0) / series.maxViewers) * intensity);
      const idx = Math.round(t * 255) * 4;
      ctx.fillStyle = `rgba(${pal[idx]},${pal[idx + 1]},${pal[idx + 2]},${0.25 + 0.7 * t})`;
      ctx.fillRect(i * colW, 0, Math.ceil(colW), 70);
      // replays: white bar under the strip, height ~ share of the busiest replay second
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      const rh = ((series.replays[i] ?? 0) / maxRep) * 30;
      ctx.fillRect(i * colW, 100 - rh, Math.ceil(colW), rh);
    }
    if (series.peakDropoffRange) {
      // the busiest drop-off BIN (consecutive seconds holding enough sessions), not a single second
      const [a, b] = series.peakDropoffRange;
      ctx.fillStyle = 'rgba(239,68,68,0.55)';
      ctx.fillRect(a * colW, 100, Math.max(2, (b - a + 1) * colW), 20);
    }
  }, [series, width, intensity]);
  if (!series) return null;
  return (
    <div className="sv-heat-strip" ref={box} role="img" data-testid="engagement-strip"
      aria-label={`Video engagement per second: ${series.seconds} seconds, busiest drop-off ${series.peakDropoffRange ? `seconds ${series.peakDropoffRange[0]} to ${series.peakDropoffRange[1]}` : 'not available'}`}>
      <canvas ref={canvas} hidden={!visible} data-testid="engagement-canvas" />
    </div>
  );
}
