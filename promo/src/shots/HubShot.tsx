// depth-layer-moves (references/shots/camera/depth-layer-moves.md, demo demos/camera/depth-layer-moves/MultiplaneReal.tsx).
// Kept from the demo: one drive displacement multiplied per layer (far 0.35x blurred 5px + desaturated 0.7 + opacity .75 + air haze,
// mid 0.7x sharp real cards with two-level soft shadow, near 1.4x blurred 7px pills with speed smear), drive ending with the hero centred
// (derived the same way: DRIVE = -MID_END/0.7), bezier(0.45,0,0.18,1) drive, hero lift (elevation 6->26, 1.035x, ring) 8f after the drive
// settles, 0x title layer fixed on the frame, far layer creeping 4px in the hold.
// Changed: real SmartVideo app-hub captures (full hub as far layer; 6 real hub card cutouts as the mid row), lime/black app tokens instead
// of the demo's sand look, drive 112f (demo 130f) to fit a 10-beat slot, no "In focus" badge (its 22px text is under the Q11 minimum).
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import layout from '../live-layout.json';
import { bezier } from '../lib/motion';
import { EASE, SpeedBlur, mix, ramp } from '../lib/polish';
import { AppMark, INTER, T } from '../lib/tokens';

export const HUB_DURATION = 148;
const CUTS = layout['apps-tall'].cutouts; // 27 real hub cards (order = DOM order: Image apps, Video apps, ...)
const PICK = [0, 1, 2, 6, 7, 11]; // Image, Edit, Upscale, Video, Cinema, AI VFX (hub order)
const CARDS = PICK.map((i) => CUTS[i]);
const HERO = 3;
const MID_W = 520, GAP = 580, ROW_X = 260, ROW_Y = 440;
const DRIVE_EASE = bezier(0.45, 0, 0.18, 1);
const MID_END = 960 - (ROW_X + HERO * GAP + MID_W / 2);
const DRIVE = -MID_END / 0.7;
const driveAt = (f: number) => DRIVE * ramp(f, 6, 112, DRIVE_EASE) + 4 * ramp(f, 120, 28, EASE.smooth);
const velocity = (f: (x: number) => number, x: number) => f(x + 0.5) - f(x - 0.5);
const PILLS = [
  { t: 'Image Studio', x: 1100, y: 870, tone: 'accent' },
  { t: 'Cinema Studio', x: 1650, y: 790, tone: 'card' },
  { t: 'Lip Sync Studio', x: 2500, y: 880, tone: 'card' },
  { t: 'Character Studio', x: 3500, y: 830, tone: 'accent' },
] as const;
const softShadow = (e: number) => `0 ${e * 0.6}px ${e * 1.6}px rgba(0,0,0,0.55), 0 ${e * 0.2}px ${e * 0.5}px rgba(0,0,0,0.6)`;

export const HubShot: React.FC = () => {
  const frame = useCurrentFrame();
  const drive = driveAt(frame);
  const vFg = -1.4 * velocity(driveAt, frame);
  const lift = ramp(frame, 100, 20, EASE.out);
  const ring = ramp(frame, 106, 14, EASE.snappy);
  const kick = ramp(frame, 4, 20, EASE.snappy);
  return (
    <AbsoluteFill style={{ background: T.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg,#0b0b0b 0%,#050505 70%)' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translateX(${(-drive * 0.35).toFixed(2)}px)`, filter: 'blur(5px) saturate(0.7)', opacity: 0.75 }}>
        <Img src={staticFile('textures/live/apps-tall-full.png')} style={{ position: 'absolute', left: -40, top: -330, width: 2100 }} />
      </div>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(5,5,5,0.86) 0%, rgba(5,5,5,0.66) 50%, rgba(5,5,5,0.6) 100%)' }} />
      <div style={{ position: 'absolute', left: 0, top: ROW_Y, transform: `translateX(${(-drive * 0.7).toFixed(2)}px)` }}>
        {CARDS.map((c, k) => {
          const hero = k === HERO;
          const h = (MID_W * c.h) / c.w;
          const e = hero ? mix(6, 26, lift) : 6;
          return (
            <div key={c.file} style={{ position: 'absolute', left: ROW_X + k * GAP, top: 0, width: MID_W, height: h, borderRadius: T.r.xl, overflow: 'hidden', transform: hero ? `translateY(${(-14 * lift).toFixed(2)}px) scale(${(1 + 0.035 * lift).toFixed(4)})` : undefined, boxShadow: `0 0 0 ${hero ? (3 * ring).toFixed(2) : 0}px ${T.accent}, ${softShadow(e)}` }}>
              <Img src={staticFile(`textures/live/${c.file}`)} style={{ width: '100%', height: '100%' }} />
            </div>
          );
        })}
      </div>
      <SpeedBlur vx={vFg} amount={0.2} max={10}>
        <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(-drive * 1.4).toFixed(2)}px)` }}>
          {PILLS.map((p) => (
            <div key={p.t} style={{ position: 'absolute', left: p.x, top: p.y, height: 128, padding: '0 56px', borderRadius: 64, display: 'flex', alignItems: 'center', background: p.tone === 'accent' ? T.accent : T.card, color: p.tone === 'accent' ? '#050505' : '#fff', fontFamily: INTER, fontSize: 60, fontWeight: 650, whiteSpace: 'nowrap', filter: 'blur(7px)', opacity: 0.92, boxShadow: '0 40px 70px -10px rgba(0,0,0,0.6)' }}>{p.t}</div>
          ))}
        </div>
      </SpeedBlur>
      <div style={{ position: 'absolute', left: 120, top: 96, opacity: kick }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <AppMark size={48} style={{ boxShadow: 'none' }} />
          <span style={{ fontFamily: INTER, fontSize: 36, fontWeight: 700, color: T.secondary }}>SmartVideo</span>
        </div>
        <div style={{ marginTop: 20, fontFamily: INTER, fontSize: 112, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.02, opacity: kick, transform: `translateY(${(1 - kick) * 28}px)` }}>Start at the app hub.</div>
      </div>
    </AbsoluteFill>
  );
};
