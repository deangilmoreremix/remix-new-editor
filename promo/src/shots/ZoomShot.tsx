// crash-zoom-punch, rebound variant (references/shots/camera/crash-zoom-punch.md, demo demos/camera/crash-zoom-punch/CrashZoomReal.tsx).
// Kept from the demo (timings in local frames, identical): 0-34 wide hold with a slow creep, 14-30 four corner brackets close on the target
// from 150px to 14px, 34-40 anticipation (zoom back ~4%), 40-46 crash in LOG space with EASE.exit (strong ease-in, speed peak on the hit frame)
// to PEAK, 46+ damped cosine rebound PEAK -> REST (REST = PEAK/1.06, tail of the 3-6% rule), time-sampled motion blur ONLY on the crash segment,
// exposure flash on the hit frame (8f exponential decay), surroundings dimmed to 86% through a huge box-shadow spread (target keeps native
// contrast), target outline in the accent, 56-78 camera follow (swift 22f) moving the target to the left golden spot, caption column rising
// 68-108, 24f of hold with a 1.5% creep.
// Changed: real Image Studio captures (closed page + the same page with the aspect-ratio menu open, cross-faded on the hit frame) instead of the
// demo's drawn browser window; no browser-window tilt (the page itself is the hero); lime/black app tokens (the demo used ember orange);
// flash is lime-white; shot is 148f (demo 132f) with a longer hold.
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { INTER, T } from '../lib/tokens';
import { EASE, mix, ramp } from '../lib/polish';

export const ZOOM_DURATION = 148;
const R = { x: 285, y: 85, w: 303, h: 390 }; // aspect-ratio menu + its button, page px (measured on the capture)
const TARGET = { cx: R.x + R.w / 2, cy: R.y + R.h / 2 };
const PUSH = 40, HIT = 46, SHIFT = 56;
const PEAK = 2.3, REST = PEAK / 1.06;
const CARD_X_END = 600;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const camAt = (f: number) => {
  const settle = ramp(f, 0, 34, EASE.smooth);
  const wind = ramp(f, 34, 6, EASE.smooth);
  const z0 = mix(0.7, 0.72, settle) * mix(1, 0.96, wind);
  const wideSx = 960 + (TARGET.cx - 960) * z0;
  const wideSy = 540 + (TARGET.cy - 540) * z0;
  let zoom = z0, k = 0;
  if (f >= PUSH && f < HIT) {
    const p = ramp(f, PUSH, HIT - PUSH, EASE.exit);
    zoom = Math.exp(mix(Math.log(z0), Math.log(PEAK), p));
    k = p;
  } else if (f >= HIT) {
    const t = f - HIT;
    zoom = REST + (PEAK - REST) * Math.exp(-t / 2.2) * Math.cos((Math.PI * t) / 5.2);
    zoom *= 1 + 0.015 * ramp(f, 124, 24, EASE.smooth);
    k = 1;
  }
  const shift = ramp(f, SHIFT, 22, EASE.swift);
  return { zoom, sx: mix(wideSx, mix(960, CARD_X_END, shift), k), sy: mix(wideSy, 540, k) };
};

const World: React.FC<{ f: number }> = ({ f }) => {
  const { zoom, sx, sy } = camAt(f);
  const tx = sx - TARGET.cx * zoom, ty = sy - TARGET.cy * zoom;
  const lock = ramp(f, 14, 16, EASE.snappy);
  const breath = ramp(f, 34, 6, EASE.smooth) * (1 - ramp(f, HIT, 2, EASE.snappy));
  const pad = mix(150, 14, lock) + 8 * breath;
  const dim = ramp(f, 47, 17, EASE.out), menu = ramp(f, HIT, 3, EASE.out);
  const arm = 34 / Math.max(1, zoom * 0.7), sw = 3 / zoom;
  const bx = R.x - pad, by = R.y - pad, bw = R.w + pad * 2, bh = R.h + pad * 2;
  const corner = (x: number, y: number, dx: number, dy: number) => `M${x},${y + dy * arm} L${x},${y} L${x + dx * arm},${y}`;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${zoom.toFixed(5)})` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 18, overflow: 'hidden', boxShadow: '0 40px 90px -10px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)' }}>
        <Img src={staticFile('textures/live/image-full.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} />
        <Img src={staticFile('textures/live/image-ar-full.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: menu }} />
        {dim > 0.001 && <div style={{ position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: 18, boxShadow: `0 0 0 4000px rgba(5,5,5,${(0.86 * dim).toFixed(3)})` }} />}
        {dim > 0.001 && <div style={{ position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: 18, boxShadow: `0 0 0 ${(1.4 / zoom).toFixed(3)}px rgba(217,255,0,${(0.85 * dim).toFixed(3)}), 0 0 ${(26 / zoom).toFixed(2)}px rgba(217,255,0,${(0.4 * dim).toFixed(3)})` }} />}
        {lock > 0.001 && (
          <svg width={bw + 40} height={bh + 40} viewBox={`${bx - 20} ${by - 20} ${bw + 40} ${bh + 40}`} style={{ position: 'absolute', left: bx - 20, top: by - 20, overflow: 'visible', opacity: clamp01(lock * 4) * (1 - 0.35 * dim) }}>
            <g fill="none" stroke={T.accent} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
              <path d={corner(bx, by, 1, 1)} /><path d={corner(bx + bw, by, -1, 1)} /><path d={corner(bx, by + bh, 1, -1)} /><path d={corner(bx + bw, by + bh, -1, -1)} />
            </g>
          </svg>
        )}
      </div>
    </div>
  );
};

export const ZoomShot: React.FC = () => {
  const frame = useCurrentFrame();
  // time-sampled motion blur on the crash segment only (~200 degree shutter, equal-weight sub-frame layering, up to 10 layers)
  const crash = frame >= PUSH && frame <= HIT + 1;
  const layers = crash ? 10 : 1;
  const hit = frame - HIT;
  const flash = hit >= 0 ? Math.exp(-hit / 2.6) * (hit < 8 ? 1 : 0) : 0;
  const txt = (a: number, d = 18) => ramp(frame, a, d, EASE.out);
  return (
    <AbsoluteFill style={{ background: T.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(60% 50% at 50% 55%, rgba(217,255,0,0.07), rgba(5,5,5,0) 70%)' }} />
      {Array.from({ length: layers }).map((_, i) => (
        <AbsoluteFill key={i} style={{ opacity: layers === 1 ? 1 : 1 / (i + 1) }}>
          <World f={frame - (layers === 1 ? 0 : i * (0.55 / layers))} />
        </AbsoluteFill>
      ))}
      <AbsoluteFill style={{ background: '#f4ffb0', opacity: 0.35 * flash }} />
      <div style={{ position: 'absolute', left: 1040, top: 330, width: 800 }}>
        <div style={{ fontFamily: INTER, fontSize: 104, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.02, color: '#fff' }}>
          {['Controls that', 'adapt to', 'the model.'].map((l, i) => {
            const t = txt(68 + i * 6);
            return <div key={l} style={{ opacity: t, transform: `translateY(${(1 - t) * 30}px)` }}>{l}</div>;
          })}
        </div>
        <div style={{ marginTop: 28, fontFamily: INTER, fontSize: 40, fontWeight: 500, lineHeight: 1.3, color: T.secondary, opacity: txt(92), transform: `translateY(${(1 - txt(92)) * 14}px)` }}>
          Ratios and resolutions follow<br />the model you pick.
        </div>
      </div>
    </AbsoluteFill>
  );
};
