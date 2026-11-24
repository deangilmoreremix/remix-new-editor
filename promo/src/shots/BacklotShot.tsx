// timeline-travel (references/shots/data/timeline-travel.md, demo demos/data/timeline-travel/TimelineTravel.tsx).
// Kept from the demo: world only moves in translateX/scale; camera X law eased = interpolate(t,[0,0.15,0.88,1],[0,0.055,0.9,1], inOut quad) over f12-104
// (slow start, sprint, hard brake in the last 12%); the stop at f104 is followed by a 1 -> 1.28 push (10f, out cubic) and >= 30f of stillness;
// each stop pops 6f BEFORE the camera reaches it (found by inverting camXAt, as in the demo) with spring damping 11 / stiffness 160 / mass 0.9 (visible overshoot);
// horizontal SpeedBlur driven by camera speed (0 when slow).
// Changed: the "timeline" is the REAL Backlot board's 8-step pipeline rail (research -> proposal -> script -> scene_plan -> assets -> edit -> compose -> publish)
// from a capture of the local Backlot tool showing a FICTIONAL demo project ("The Last Lighthouse"); stop markers are lime rings on the real nodes
// of the 5 approved stages instead of the demo's drawn milestone cards; the 3 pending stages get no ring; no parallax year labels.
// The fake tool-event feed, placeholder model name and cost figures from the simulator were hidden at capture time.
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame } from 'remotion';
import { INTER, T } from '../lib/tokens';
import { SpeedBlur } from '../lib/polish';

export const BACKLOT_DURATION = 148;
const NODES = [355, 529, 700, 873, 1046, 1218, 1393, 1565]; // node centres in page px (measured on the capture, 1.28 x the 1500px preview)
const NODE_Y = 132;
const APPROVED = 5; // research, proposal, script, scene_plan, assets
const ZOOM = 1.9;
const CX0 = 700, CX1 = 1090, CY = 360;
const TRAVEL_START = 12, TRAVEL_END = 104;
const camXAt = (f: number) => {
  const t = interpolate(f, [TRAVEL_START, TRAVEL_END], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = interpolate(t, [0, 0.15, 0.88, 1], [0, 0.055, 0.9, 1], { easing: Easing.inOut(Easing.quad) });
  return CX0 + eased * (CX1 - CX0);
};
const popFrameOf = (nodeX: number) => {
  for (let f = TRAVEL_START; f <= TRAVEL_END; f++) if (camXAt(f) + 960 / ZOOM >= nodeX - 40) return f;
  return TRAVEL_END;
};

export const BacklotShot: React.FC = () => {
  const frame = useCurrentFrame();
  const camX = camXAt(frame);
  const push = interpolate(frame, [TRAVEL_END, TRAVEL_END + 10], [1, 1.18], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const z = ZOOM * push;
  const vx = (camXAt(frame + 0.5) - camXAt(frame - 0.5)) * ZOOM;
  const intro = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cap = interpolate(frame, [30, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#0b0b0d', overflow: 'hidden' }}>
      <SpeedBlur vx={vx} amount={0.2} max={10}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', opacity: intro, transform: `translate(${(960 - camX * z).toFixed(2)}px, ${(540 - CY * z).toFixed(2)}px) scale(${z.toFixed(5)})` }}>
          <Img src={staticFile('textures/live/backlot-full.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }} />
          {NODES.slice(0, APPROVED).map((x, i) => {
            const pop = popFrameOf(x) - 6;
            const s = spring({ frame: frame - pop, fps: 30, config: { damping: 11, stiffness: 160, mass: 0.9 }, durationInFrames: 26 });
            const on = frame >= pop;
            return on ? <div key={x} style={{ position: 'absolute', left: x - 26, top: NODE_Y - 26, width: 52, height: 52, borderRadius: 26, border: `${3 / z * 2}px solid ${T.accent}`, boxShadow: `0 0 ${14 / z * 2}px rgba(217,255,0,0.5)`, transform: `scale(${(0.4 + 0.6 * s).toFixed(3)})`, opacity: Math.min(1, s * 1.4) }} /> : null;
          })}
        </div>
      </SpeedBlur>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(11,11,13,0) 70%, rgba(11,11,13,0.96) 100%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 58, textAlign: 'center', fontFamily: INTER, fontSize: 68, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', opacity: cap }}>Eight steps, one board.</div>
    </AbsoluteFill>
  );
};
