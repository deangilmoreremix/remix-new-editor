// wall-reveal-moves / bento-light-up (references/shots/ui-entrance/wall-reveal-moves.md, demo BentoLightUp.tsx).
// Kept from the demo: 3x2 bento with complementary widths (600/420/420 <-> 420/420/600), dark card faces dimmed to 0.18 until lit,
// comet stroke (22% of perimeter, 6px glow + 2.5px core) running the perimeter in 8f, content back-out(0.3,1.4,0.5,1) rise in 8f
// relay-started after the stroke is half way, ring annealing to 0.4, push scale 1 -> 1.04 over 25f, then true stillness.
// Differences: accent is the app's lime #d9ff00, cells are REAL studio captures (cropped), cascade is one cell per BEAT (14.75f)
// instead of 12f (slower, per R3), push placed after the last cell.
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { INTER, T } from '../lib/tokens';
import { CAPTIONS, SHOTS, beatF } from '../timeline';
import { EngineTitle, EngineTitleProps } from '../lib/EngineTitle';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const CELL_H = 330, GUT = 44, U = 480, RADIUS = 16;
const ROW_W = U * 3 + GUT * 2;
const LEFT = (1920 - ROW_W) / 2;
const TOP = (1080 - (CELL_H * 2 + GUT)) / 2 + 72;
const WIDTHS = [[1.25, 0.875, 0.875], [0.875, 0.875, 1.25]];
const CELLS = WIDTHS.flatMap((row, r) => {
  let x = LEFT;
  return row.map((k) => { const w = k * U; const c = { x, y: TOP + r * (CELL_H + GUT), w }; x += w + GUT; return c; });
});
export type WallStudio = { name: string; tex: string };
export const STUDIOS: WallStudio[] = [
  { name: 'Video Studio', tex: 'video-empty' },
  { name: 'Image Studio', tex: 'image' },
  { name: 'Cinema Studio', tex: 'cinema' },
  { name: 'Edit Studio', tex: 'edit' },
  { name: 'Character Studio', tex: 'character' },
  { name: 'Lip Sync Studio', tex: 'lipsync' },
];
const REGION = { right: 1880, y: 70, h: 270 }; // banner art only: no UI fragments inside the cells // page region cropped into each cell (top of the studio: banner + prompt bar)
const START = (i: number) => beatF(i + 1) - 2; // one cell per beat, local to the shot
export const WALL_PUSH_START = START(5) + 24;

const Cell: React.FC<{ i: number; frame: number; studios: WallStudio[] }> = ({ i, frame, studios }) => {
  const start = START(i);
  const { x, y, w } = CELLS[i];
  const draw = interpolate(frame, [start, start + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const strokeFade = interpolate(frame, [start + 12, start + 26], [1, 0.4], { ...clamp, easing: Easing.out(Easing.quad) });
  const ring = interpolate(frame, [start + 2, start + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const lit = interpolate(frame, [start + 6, start + 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const rise = interpolate(frame, [start + 6, start + 14], [0, 1], { ...clamp, easing: Easing.bezier(0.3, 1.4, 0.5, 1) });
  const jitter = Math.abs((Math.sin(i * 127.3) * 43758.5453) % 1);
  const pulse = lit * (1 - lit) * 4;
  const head = 100 * draw, TAIL = 22;
  const scale = CELL_H / REGION.h;
  const ty = 20 * (1 - rise);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: CELL_H }}>
      <div style={{ opacity: 0.18 + 0.82 * lit, transform: `translateY(${ty}px)`, borderRadius: RADIUS, width: w, height: CELL_H, overflow: 'hidden', background: T.card, position: 'relative', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Img src={staticFile(`textures/live/${studios[i].tex}-full.png`)} style={{ position: 'absolute', left: -(REGION.right - w / scale) * scale, top: -REGION.y * scale, width: 1920 * scale, height: 1080 * scale }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,5,5,0) 55%, rgba(5,5,5,0.88) 100%)' }} />
        <div style={{ position: 'absolute', left: 22, bottom: 18, fontFamily: INTER, fontWeight: 700, fontSize: 34, color: '#fff', letterSpacing: '-0.01em' }}>{studios[i].name}</div>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(90% 70% at 50% 0%, rgba(217,255,0,${(0.16 * pulse * (0.8 + jitter * 0.4)).toFixed(3)}), rgba(217,255,0,0) 70%)` }} />
      </div>
      {draw > 0 && (
        <svg width={w} height={CELL_H} viewBox={`0 0 ${w} ${CELL_H}`} style={{ position: 'absolute', left: 0, top: ty, overflow: 'visible' }}>
          <defs>
            <filter id={`g${i}`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={4 + jitter * 2} /></filter>
          </defs>
          <rect x={0.75} y={0.75} width={w - 1.5} height={CELL_H - 1.5} rx={RADIUS} fill="none" stroke={T.accent} strokeWidth={1.5} pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - draw)} opacity={ring * strokeFade} />
          {[0, 1].map((k) => (
            <rect key={k} x={1.5} y={1.5} width={w - 3} height={CELL_H - 3} rx={RADIUS} fill="none" stroke={k ? '#f4ffb0' : T.accent} strokeWidth={k ? 2.5 : 6} strokeLinecap="round" pathLength={100}
              strokeDasharray={`${TAIL} ${100 - TAIL}`} strokeDashoffset={TAIL - head}
              opacity={(1 - interpolate(frame, [start + 8, start + 16], [0, 1], clamp)) * (k ? 1 : 0.8)} filter={k ? undefined : `url(#g${i})`} />
          ))}
        </svg>
      )}
    </div>
  );
};

export const WallShot: React.FC<{ studios?: WallStudio[]; title?: EngineTitleProps }> = ({ studios = STUDIOS, title }) => {
  const frame = useCurrentFrame();
  const push = interpolate(frame, [WALL_PUSH_START, WALL_PUSH_START + 25], [1, 1.04], { ...clamp, easing: Easing.bezier(0.33, 0, 0.2, 1) });
  const cap = CAPTIONS[1];
  const capO = interpolate(frame, [cap.from - SHOTS.wall.from, cap.from - SHOTS.wall.from + 14], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: T.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 12%, rgba(217,255,0,0.07), rgba(217,255,0,0) 70%)' }} />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push.toFixed(5)})`, transformOrigin: '960px 540px' }}>
        {!title && (
          <div style={{ position: 'absolute', left: LEFT, top: TOP - 150, fontFamily: INTER, fontSize: 80, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1, opacity: capO }}>
            {cap.text}
          </div>
        )}
        {CELLS.map((_, i) => <Cell key={i} i={i} frame={frame} studios={studios} />)}
      </div>
      {title && <EngineTitle {...title} />}
    </AbsoluteFill>
  );
};
