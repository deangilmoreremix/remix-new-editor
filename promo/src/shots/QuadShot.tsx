// quad-split-parallel-scenes (references/shots/rhythm/quad-split-parallel-scenes.md, demo demos/rhythm/quad-split-parallel-scenes/QuadSplitParallelScenes.tsx).
// Kept from the demo: hard-cut 2x2 with 8px seams and 20px rounded cells, every quadrant running its own micro-scene with a SHIFTED event table
// (adjacent heavy events >= 3f apart, never in the same frame), inQuad slow push 1 -> 1.1 in every cell as background motion, ONE whip push
// (1 -> 1.85 over 10f with a sin-envelope blur peaking at 5px) as the heaviest beat, overshoot pops, then all four cells rest on their final state for 28f.
// Changed: cell content = REAL studio captures (Character, Avatar, Lip Sync, AI VFX) cropped to the banner/prompt area, not the demo's drawn mini-scenes;
// labels are each studio's name and the app's own hub description (src/components/AppsHub.js); lime/black tokens (demo: ember checkerboard);
// shot is 89f (demo 90f). Dubbing is not shown (no honest capture), see DESIGN-SPEC omissions.
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { EASE, mix, ramp } from '../lib/polish';
import { INTER, T } from '../lib/tokens';
import { EngineTitle, EngineTitleProps } from '../lib/EngineTitle';

export const QUAD_DURATION = 89;
const G = 8, QW = (1920 - 3 * G) / 2, QH = (1080 - 3 * G) / 2;
const QUADS = [{ x: G, y: G }, { x: 2 * G + QW, y: G }, { x: G, y: 2 * G + QH }, { x: 2 * G + QW, y: 2 * G + QH }];
// events (local frames): name pop, description rise, outline pulse. TR also carries the whip.
export type QuadCell = { tex: string; right: number; name: string; desc: string; pop: number; descAt: number; pulse: number; whip?: number };
export const QUAD_CELLS: QuadCell[] = [
  { tex: 'character', right: 1880, name: 'Character Studio', desc: 'Consistent character generation', pop: 6, descAt: 11, pulse: 38 },
  { tex: 'avatar', right: 1880, name: 'Avatar Studio', desc: 'AI avatars and lip sync video', pop: 14, descAt: 19, pulse: 44, whip: 30 },
  { tex: 'lipsync', right: 1880, name: 'Lip Sync Studio', desc: 'Animate portraits or sync lips to audio', pop: 22, descAt: 27, pulse: 50 },
  { tex: 'ai-vfx', right: 1618, name: 'AI VFX Studio', desc: 'Camera moves, VFX and AI effects', pop: 30, descAt: 35, pulse: 56 },
];
const REGION = { y: 70, h: 400 }; // banner/top of the page only: keeps prompt-bar fragments out of the cells
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const Cell: React.FC<{ i: number; f: number; cells: QuadCell[] }> = ({ i, f, cells }) => {
  const c = cells[i];
  const push = mix(1, 1.1, Math.pow(clamp01(Math.min(f, 62) / 89), 2)); // push stops at 62 so the last 27f are a true still
  const whip = c.whip ? ramp(f, c.whip, 10, EASE.smooth) : 0;
  const blur = 5 * Math.sin(Math.PI * whip);
  const scale = push * mix(1, 1.85, whip);
  const k = c.pop;
  const pop = ramp(f, k, 9, EASE.overshoot);
  const d = ramp(f, c.descAt, 10, EASE.out);
  const pulse = Math.max(ramp(f, c.pulse, 6, EASE.snappy) * (1 - ramp(f, c.pulse + 6, 10, EASE.out)), ramp(f, c.pulse + 52, 6, EASE.snappy) * (1 - ramp(f, c.pulse + 58, 10, EASE.out)));
  const s = QH / REGION.h;
  const left = -((c as { right: number }).right - QW / s) * s;
  return (
    <div style={{ position: 'absolute', left: QUADS[i].x, top: QUADS[i].y, width: QW, height: QH, borderRadius: 20, overflow: 'hidden', background: T.card }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${scale})`, transformOrigin: '70% 40%', filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
        <Img src={staticFile(`textures/live/${c.tex}-full.png`)} style={{ position: 'absolute', left, top: -REGION.y * s, width: 1920 * s, height: 1080 * s }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,5,5,0) 45%, rgba(5,5,5,0.92) 100%)' }} />
      <div style={{ position: 'absolute', left: 36, bottom: 80, fontFamily: INTER, fontSize: 52, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', opacity: Math.min(1, pop * 3), transform: `translateY(${((1 - pop) * -50).toFixed(1)}px) scale(${mix(1.1, 1, EASE.snappy(clamp01((f - k) / 8))).toFixed(4)})`, transformOrigin: '0% 100%' }}>{c.name}</div>
      <div style={{ position: 'absolute', left: 38, bottom: 30, fontFamily: INTER, fontSize: 32, fontWeight: 500, color: T.secondary, opacity: d, transform: `translateY(${(1 - d) * 12}px)` }}>{c.desc}</div>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 20, boxShadow: `inset 0 0 0 ${(3 * pulse).toFixed(2)}px rgba(217,255,0,${(0.9 * pulse).toFixed(3)})` }} />
    </div>
  );
};

export const QuadShot: React.FC<{ cells?: QuadCell[]; title?: EngineTitleProps; pill?: boolean }> = ({ cells = QUAD_CELLS, title, pill = true }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: T.bg, overflow: 'hidden' }}>
      {cells.map((_, i) => <Cell key={i} i={i} f={f} cells={cells} />)}
      {pill && <div style={{ position: 'absolute', left: 0, right: 0, top: 40, display: 'flex', justifyContent: 'center', opacity: ramp(f, 52, 10, EASE.out) }}>
        <div style={{ padding: '14px 44px', borderRadius: 56, background: 'rgba(5,5,5,0.9)', border: '1px solid rgba(255,255,255,0.14)', fontFamily: INTER, fontSize: 64, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>People, voices, motion.</div>
      </div>}
      {title && <><div style={{ position: 'absolute', left: 0, top: 0, width: 1100, height: 420, background: 'linear-gradient(90deg, rgba(5,5,5,0.9) 0%, rgba(5,5,5,0.6) 55%, rgba(5,5,5,0) 100%)' }} /><EngineTitle {...title} /></>}
    </AbsoluteFill>
  );
};
