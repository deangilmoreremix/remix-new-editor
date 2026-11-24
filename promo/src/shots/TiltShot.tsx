// tilt-reveal, overhead-camera-moves style A (references/shots/camera/overhead-camera-moves.md, demo demos/camera/overhead-camera-moves/TiltReveal.tsx).
// Kept from the demo: the pose function (rotateX 86deg with a 3deg creep in 0-20f, 40f swift lift with a -2.2deg overshoot, 10f smooth settle;
// scale 2.5 -> settle, hinge y 600 -> settle, eye height and perspective 700 -> 1500 on the same non-overshooting progress p), transformOrigin 50% 100%,
// the Q2 equivalent rotateX'*scaleY layout with CSS zoom, vertical anti-alias pre-blur while the page is flat, SpeedBlur on the fast lift,
// the "horizon" rim light (strongest when flat), a single sheen band sweeping top to bottom, background light pool parallax (-150 -> 0),
// 70f onward slow push 1 -> 1.018.
// Changed: page = the REAL Cinema Studio capture (not the demo's drawn dashboard); lime accent (not electric blue); settle scale 0.78 and hinge
// raised so a 64px caption fits underneath; hold extended to 148f total (demo 120f). Director has no usable capture and is not shown.
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { INTER, T } from '../lib/tokens';
import { EASE, SpeedBlur, mix, ramp } from '../lib/polish';
import { EngineTitle, EngineTitleProps } from '../lib/EngineTitle';

export const TILT_DURATION = 148;
const HOLD = 20, MOVE = 40, SETTLE = 10, FROM = 86;
const CREEP = 3 / 86, OVER = 1 + 2.2 / 86;
const S0 = 2.5, S1 = 0.78, BOT0 = 600, BOT1 = 540 + (1080 * S1) / 2 - 70;
const PAGE_R = 26;
const rgba = (c: string, a: number) => `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},${a})`;

const poseAt = (f: number) => {
  const creep = ramp(f, 0, HOLD, EASE.smooth) * CREEP;
  const lift = ramp(f, HOLD, MOVE, EASE.swift);
  const q = mix(creep, OVER, lift) - (OVER - 1) * ramp(f, HOLD + MOVE, SETTLE, EASE.smooth);
  const p = mix(creep, 1, lift);
  return { p, rotX: FROM * (1 - q), scale: mix(S0, S1, p), bot: mix(BOT0, BOT1, p), eye: mix(BOT0 - 300, 520, p), persp: mix(700, 1500, p) };
};

export const TiltShot: React.FC<{ tex?: string; builderTex?: string | null; title?: EngineTitleProps }> = ({ tex = 'cinema', builderTex = 'cinema-builder', title }) => {
  const f = useCurrentFrame();
  const { p, rotX, scale: s0, bot, eye, persp } = poseAt(f);
  const push = mix(1, 1.018, ramp(f, 70, 78, EASE.smooth));
  const scale = s0 * push;
  const botY = 540 + (bot - 540) * push;
  const topY = botY - 1080 * scale;
  const vRot = poseAt(f + 0.5).rotX - poseAt(f - 0.5).rotX;
  const vy = -vRot * 7;
  const rad = (rotX * Math.PI) / 180;
  const rEq = (Math.atan2(Math.sin(rad), scale * Math.cos(rad)) * 180) / Math.PI;
  const kEq = Math.sqrt(scale * scale * Math.cos(rad) ** 2 + Math.sin(rad) ** 2) / scale;
  const vScale = kEq * Math.abs(Math.cos((rEq * Math.PI) / 180));
  const sigma = vScale > 0.6 ? 0 : (0.55 / Math.max(0.05, vScale)) * 1.6 - 1.2;
  const flat = Math.min(1, Math.abs(rotX) / 86);
  const Hs = 1080 * scale * kEq;
  const zFar = -Hs * Math.sin((rEq * Math.PI) / 180);
  const farY = eye + (botY - Hs * Math.cos((rEq * Math.PI) / 180) - eye) * (persp / (persp - zFar));
  const glowUp = ramp(f, 0, 26, EASE.out);
  const bgShift = mix(-150, 0, p);
  const sheen = ramp(f, 32, 30, EASE.swift);
  const rim = glowUp * Math.pow(flat, 3);
  const cap = ramp(f, 74, 18, EASE.out);
  const builder = ramp(f, 92, 10, EASE.out); // real Cinema Prompt Builder (camera + lens fields) opens
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: T.bg }}>
      <AbsoluteFill style={{ transform: `translateY(${bgShift}px)`, background: `radial-gradient(60% 50% at 50% 38%, ${rgba(T.accent, 0.10 * (0.75 + 0.25 * glowUp))}, rgba(5,5,5,0) 70%)` }} />
      <div style={{ position: 'absolute', left: 60, width: 1800, top: mix(farY - 90, farY - 40, p), height: mix(180, 1000, p), background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${rgba(T.accent, 0.32 * glowUp)} 0%, ${rgba(T.accent, 0)} 70%)`, filter: 'blur(30px)', opacity: 0.9 }} />
      <SpeedBlur vx={0} vy={vy} amount={0.2} max={9}>
        <div style={{ position: 'absolute', inset: 0, perspective: persp, perspectiveOrigin: `50% ${(eye / 1080) * 100}%` }}>
          <div style={{ position: 'absolute', left: 960 - 960 * scale, top: topY, width: 1920 * scale, height: 1080 * scale, transformOrigin: '50% 100%', transform: `rotateX(${rEq}deg) scaleY(${kEq})`, borderRadius: PAGE_R * scale, overflow: 'hidden', boxShadow: `0 ${40 * scale}px ${120 * scale}px rgba(0,0,0,0.7), 0 0 ${60 * scale}px ${rgba(T.accent, 0.12 * (1 - flat))}` }}>
            {sigma > 0.5 && (
              <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
                <filter id="tilt-aa" x="0" y="-5%" width="100%" height="110%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={`0 ${sigma.toFixed(2)}`} /></filter>
              </svg>
            )}
            <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, zoom: scale, filter: sigma > 0.5 ? 'url(#tilt-aa)' : undefined }}>
              <Img src={staticFile(`textures/live/${tex}-full.png`)} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, borderRadius: PAGE_R }} />
              {builderTex && <Img src={staticFile(`textures/live/${builderTex}-full.png`)} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, borderRadius: PAGE_R, opacity: builder }} />}
            </div>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `linear-gradient(0deg, rgba(5,5,5,${0.1 * flat}) 0%, rgba(5,5,5,${0.5 * flat}) 45%, rgba(5,5,5,${0.9 * flat ** 1.5}) 100%)` }} />
            {sheen > 0 && sheen < 1 && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', background: `linear-gradient(180deg, transparent ${(sheen * 130 - 30).toFixed(1)}%, rgba(244,255,176,${(0.14 * Math.sin(sheen * Math.PI)).toFixed(3)}) ${(sheen * 130 - 12).toFixed(1)}%, transparent ${(sheen * 130 + 6).toFixed(1)}%)` }} />
            )}
          </div>
        </div>
      </SpeedBlur>
      {rim > 0.01 && (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: farY - 60, height: 120, opacity: rim, pointerEvents: 'none', background: `radial-gradient(ellipse 46% 50% at 50% 50%, ${rgba(T.accent, 0.5)} 0%, ${rgba(T.accent, 0)} 70%)`, mixBlendMode: 'screen' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: farY - 1.5, height: 3, opacity: rim, pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(244,255,176,0) 4%, #f4ffb0 32%, #ffffff 50%, #f4ffb0 68%, rgba(244,255,176,0) 96%)', boxShadow: `0 0 14px ${rgba(T.accent, 0.9)}, 0 0 40px ${rgba(T.accent, 0.6)}` }} />
        </>
      )}
      {title ? <EngineTitle {...title} /> : <div style={{ position: 'absolute', left: 0, right: 0, bottom: 52, textAlign: 'center', fontFamily: INTER, fontSize: 72, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', opacity: cap, transform: `translateY(${(1 - cap) * 20}px)` }}>Pick the camera and lens.</div>}
    </AbsoluteFill>
  );
};
