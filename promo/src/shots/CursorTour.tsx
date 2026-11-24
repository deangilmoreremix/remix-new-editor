// cursor-flyover (references/shots/camera/cursor-flyover.md, demo demos/camera/cursor-flyover/CursorFlyover.tsx).
// Kept from the demo: stepped camera table with bezier(0.55,0,0.18,1) flights (20f, camera starts 2f after the cursor), 8% "hop" on
// flights after the first, cursor leads (swift 16f, a perpendicular bow of min(90, 12% of distance)), cursor drawn in screen space at a
// constant 40px (the demo's 1/s counter-scale), 3f press to 0.84 with overshoot, 80px ripple for 18f, SpeedBlur amount 0.09 max 8,
// smooth 24f pull-back to the overview, 1% creeping push in the hold.
// Changed: the "world" is the real Video Studio capture (1920x1080 page, 2x texture) instead of the demo's drawn dashboard;
// 3 stations (prompt: click + typing, model button: click opens the picker, settings chips: point only) instead of 4;
// the typing reveal uses canvas-measured glyph widths of the real text; UI "responses" are texture swaps of REAL captures.
// Typing runs at 2f/char (V1's 3f/char did not fit this beat); recorded as a deviation in DESIGN-SPEC.
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import layout from '../live-layout.json';
import { bezier } from '../lib/motion';
import { Cursor, EASE, SpeedBlur, mix, ramp } from '../lib/polish';
import { T } from '../lib/tokens';

const M = layout['video-typed2'].measure as { x0: number; y: number; h: number; offsets: number[] };
export const PROMPT2 = 'Product shot on a marble pedestal, soft studio light';
export const CURSOR_TOUR_DURATION = 295;
const PER_CHAR = 2;
const CLICK = [42, 182];
const TYPE_START = CLICK[0] + 8;
export const CURSOR_TYPE_END = TYPE_START + PROMPT2.length * PER_CHAR;

const CAMS = [
  { x: 960, y: 540, s: 1.0 },
  { x: 1330, y: 402, s: 1.8 }, // prompt
  { x: 600, y: 330, s: 1.6 }, // model button + picker
  { x: 900, y: 500, s: 1.5 }, // settings chips
];
const TARGETS = [{ x: 1010, y: 402 }, { x: 204, y: 502 }, { x: 1000, y: 502 }];
const LEG = [20, 160, 204];
const BACK = 244;
const CAM_EASE = bezier(0.55, 0, 0.18, 1);

const camAt = (f: number) => {
  let { x, y, s } = CAMS[0];
  s *= mix(0.94, 1, ramp(f, 0, 20, EASE.snappy));
  let hop = 0;
  for (let k = 0; k < 3; k++) {
    const u = ramp(f, LEG[k] + 2, 20, CAM_EASE);
    const to = CAMS[k + 1];
    x = mix(x, to.x, u); y = mix(y, to.y, u); s = mix(s, to.s, u);
    if (k > 0 && u > 0 && u < 1) hop = 0.08 * Math.sin(Math.PI * u);
  }
  const b = ramp(f, BACK, 24, EASE.smooth);
  x = mix(x, CAMS[0].x, b); y = mix(y, CAMS[0].y, b); s = mix(s, CAMS[0].s, b);
  s *= (1 - hop) * (1 + 0.01 * ramp(f, 268, 27, EASE.smooth));
  return { x, y, s };
};
const cursorAt = (f: number) => {
  let x = 1010, y = 640;
  for (let k = 0; k < 3; k++) {
    const u = ramp(f, LEG[k], 16, EASE.swift);
    const to = TARGETS[k];
    const dx = to.x - x, dy = to.y - y, len = Math.max(1, Math.hypot(dx, dy));
    const bow = Math.sin(Math.PI * u) * Math.min(90, len * 0.12);
    const nx = mix(x, to.x, u) + (-dy / len) * bow, ny = mix(y, to.y, u) + (dx / len) * bow;
    x = nx; y = ny;
  }
  return { x, y };
};

const CAPS = [
  { text: 'Type the prompt.', a: 34, b: 162 },
  { text: 'Pick a model.', a: 176, b: 236 },
  { text: 'Tune the settings.', a: 246, b: 295 },
];

export const CursorTour: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = camAt(frame);
  const pos = (f: number) => { const c = camAt(f); return { x: 960 - c.x * c.s, y: 540 - c.y * c.s }; };
  const pa = pos(frame + 0.5), pb = pos(frame - 0.5);
  const cur = cursorAt(frame);
  const cx = 960 + (cur.x - cam.x) * cam.s, cy = 540 + (cur.y - cam.y) * cam.s;
  let press = 0, ripple = -1;
  CLICK.forEach((c) => {
    const pf = frame - c;
    if (pf > -2 && pf < 8) press = Math.max(press, pf < 1 ? ramp(pf, -2, 3, EASE.swift) : 1 - ramp(pf, 1, 6, EASE.overshoot));
    if (pf >= 0 && pf < 18) ripple = pf / 18;
  });
  const intro = ramp(frame, 0, 14, EASE.out);

  const typed = frame < TYPE_START ? 0 : Math.min(PROMPT2.length, Math.floor((frame - TYPE_START) / PER_CHAR) + 1);
  const revealX = typed === 0 ? M.x0 : M.x0 + M.offsets[typed - 1] + 1;
  const caretOn = frame >= CLICK[0] + 2 && frame <= CLICK[1] && (frame <= CURSOR_TYPE_END || Math.floor((frame - CURSOR_TYPE_END) / 8) % 2 === 0);
  const caretX = typed === 0 ? M.x0 : M.x0 + M.offsets[typed - 1] + 2;
  const typedDone = frame >= CURSOR_TYPE_END;
  // picker opens on the model click (cross-fade of two real captures), closes when the cursor leaves for the settings row
  const picker = ramp(frame, CLICK[1] + 2, 6, EASE.out) - ramp(frame, LEG[2] + 2, 6, EASE.out);

  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <SpeedBlur vx={pa.x - pb.x} vy={pa.y - pb.y} amount={0.09} max={8}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', opacity: intro, transform: `translate(${(960 - cam.x * cam.s).toFixed(2)}px, ${(540 - cam.y * cam.s).toFixed(2)}px) scale(${cam.s.toFixed(5)})` }}>
          <Img src={staticFile('textures/live/video-blank-full.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} />
          <div style={{ position: 'absolute', inset: 0, clipPath: typedDone ? undefined : `polygon(${M.x0 - 6}px ${M.y - 4}px, ${revealX}px ${M.y - 4}px, ${revealX}px ${M.y + M.h + 4}px, ${M.x0 - 6}px ${M.y + M.h + 4}px)` }}>
            <Img src={staticFile('textures/live/video-typed2-full.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} />
          </div>
          {caretOn && <div style={{ position: 'absolute', left: caretX, top: M.y + 8, width: 2, height: 26, background: '#fff' }} />}
          <div style={{ position: 'absolute', left: 0, top: 860, width: 1920, height: 220, background: `linear-gradient(180deg, rgba(5,5,5,0) 0%, ${T.bg} 35%)` }} />
          <Img src={staticFile('textures/live/video-typed2-model-full.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: picker }} />
        </div>
      </SpeedBlur>
      {ripple >= 0 && (
        <div style={{ position: 'absolute', left: cx - 40, top: cy - 40, width: 80, height: 80, borderRadius: 40, border: `3px solid rgba(217,255,0,${((1 - ripple) * 0.9).toFixed(3)})`, background: `rgba(217,255,0,${((1 - ripple) * 0.12).toFixed(3)})`, transform: `scale(${(0.3 + EASE.out(ripple) * 1.2).toFixed(3)})` }} />
      )}
      <div style={{ position: 'absolute', left: cx, top: cy, opacity: intro }}><Cursor press={press} /></div>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(5,5,5,0) 78%, rgba(5,5,5,0.92) 100%)' }} />
      {CAPS.map((c) => {
        const o = interpolate(frame, [c.a, c.a + 8, c.b - 8, c.b], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return o > 0 ? <div key={c.text} style={{ position: 'absolute', left: 0, right: 0, bottom: 64, textAlign: 'center', fontFamily: T.font, fontSize: 68, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', opacity: o }}>{c.text}</div> : null;
      })}
    </AbsoluteFill>
  );
};
