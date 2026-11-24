// cursor-flyover grammar (references/shots/camera/cursor-flyover.md, demo CursorFlyover.tsx), single-station version for the Automate engine clip.
// Kept from the demo: camera flight bezier(0.55,0,0.18,1) 20f starting 2f after the cursor, cursor swift 16f with a perpendicular bow, press 3f to 0.84 with overshoot,
// 80px ripple 18f, SpeedBlur 0.09 (max 8), smooth 24f pull-back, 1% creeping push in the hold, cursor drawn in screen space at a constant 40px.
// Changed: ONE station (the Video Agent prompt input) instead of four; the page is the REAL Video Agent capture (video-agent-blank vs video-agent-typed, the
// typed text is revealed using canvas-measured glyph widths measured inside the app's iframe). Nothing is submitted and no agent output is shown.
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import layout from '../live-layout.json';
import { bezier } from '../lib/motion';
import { Cursor, EASE, SpeedBlur, mix, ramp } from '../lib/polish';
import { EngineTitle, EngineTitleProps } from '../lib/EngineTitle';
import { T } from '../lib/tokens';

const M = layout['video-agent-typed'].measure as { x0: number; y: number; h: number; w: number; offsets: number[] };
const N_CH = M.offsets.length;
const PER_CHAR = 2;
const CLICK = 42, TYPE_START = 50, TYPE_END = TYPE_START + N_CH * PER_CHAR;
const BACK = 164;
const CAM_EASE = bezier(0.55, 0, 0.18, 1);
const IN = { x: 1000, y: 650, s: 1.9 };
const camAt = (f: number) => {
  const u = ramp(f, 22, 20, CAM_EASE);
  const b = ramp(f, BACK, 24, EASE.smooth);
  const x = mix(mix(960, IN.x, u), 960, b), y = mix(mix(540, IN.y, u), 540, b), s0 = mix(mix(1, IN.s, u), 1, b);
  return { x, y, s: s0 * mix(0.94, 1, ramp(f, 0, 18, EASE.snappy)) * (1 + 0.01 * ramp(f, 190, 17, EASE.smooth)) };
};
const cursorAt = (f: number) => {
  const u = ramp(f, 20, 16, EASE.swift);
  const from = { x: 1250, y: 820 }, to = { x: 940, y: 665 };
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy);
  const bow = Math.sin(Math.PI * u) * Math.min(90, len * 0.12);
  return { x: mix(from.x, to.x, u) + (-dy / len) * bow, y: mix(from.y, to.y, u) + (dx / len) * bow };
};

export const AgentShot: React.FC<{ title?: EngineTitleProps }> = ({ title }) => {
  const f = useCurrentFrame();
  const cam = camAt(f);
  const pos = (g: number) => { const c = camAt(g); return { x: 960 - c.x * c.s, y: 540 - c.y * c.s }; };
  const pa = pos(f + 0.5), pb = pos(f - 0.5);
  const cur = cursorAt(f);
  const cx = 960 + (cur.x - cam.x) * cam.s, cy = 540 + (cur.y - cam.y) * cam.s;
  const pf = f - CLICK;
  const press = pf > -2 && pf < 8 ? (pf < 1 ? ramp(pf, -2, 3, EASE.swift) : 1 - ramp(pf, 1, 6, EASE.overshoot)) : 0;
  const ripple = pf >= 0 && pf < 18 ? pf / 18 : -1;
  const intro = ramp(f, 0, 14, EASE.out);
  const typed = f < TYPE_START ? 0 : Math.min(N_CH, Math.floor((f - TYPE_START) / PER_CHAR) + 1);
  const revealX = typed === 0 ? M.x0 : M.x0 + M.offsets[typed - 1] + 1;
  const caretOn = f >= CLICK + 2 && f <= 200 && (f <= TYPE_END || Math.floor((f - TYPE_END) / 8) % 2 === 0);
  const caretX = typed === 0 ? M.x0 : M.x0 + M.offsets[typed - 1] + 2;
  const typedDone = f >= TYPE_END;
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <SpeedBlur vx={pa.x - pb.x} vy={pa.y - pb.y} amount={0.09} max={8}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', opacity: intro, transform: `translate(${(960 - cam.x * cam.s).toFixed(2)}px, ${(540 - cam.y * cam.s).toFixed(2)}px) scale(${cam.s.toFixed(5)})` }}>
          <Img src={staticFile('textures/live/video-agent-blank-full.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} />
          <div style={{ position: 'absolute', inset: 0, clipPath: typedDone ? undefined : `polygon(${M.x0 - 6}px ${M.y - 4}px, ${revealX}px ${M.y - 4}px, ${revealX}px ${M.y + M.h * 0.62}px, ${M.x0 - 6}px ${M.y + M.h * 0.62}px)` }}>
            <Img src={staticFile('textures/live/video-agent-typed-full.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} />
          </div>
          {caretOn && <div style={{ position: 'absolute', left: caretX, top: M.y + 12, width: 2, height: 30, background: '#fff' }} />}
        </div>
      </SpeedBlur>
      {ripple >= 0 && <div style={{ position: 'absolute', left: cx - 40, top: cy - 40, width: 80, height: 80, borderRadius: 40, border: `3px solid rgba(217,255,0,${((1 - ripple) * 0.9).toFixed(3)})`, background: `rgba(217,255,0,${((1 - ripple) * 0.12).toFixed(3)})`, transform: `scale(${(0.3 + EASE.out(ripple) * 1.2).toFixed(3)})` }} />}
      <div style={{ position: 'absolute', left: cx, top: cy, opacity: intro * (1 - ramp(f, BACK + 10, 12, EASE.exit)) }}><Cursor press={press} /></div>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(5,5,5,0) 76%, rgba(5,5,5,0.92) 100%)' }} />
      {title && <EngineTitle {...title} pos="bc" at={150} />}
    </AbsoluteFill>
  );
};
