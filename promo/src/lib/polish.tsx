// Ported from the skill's demos/_fixtures/Polish.tsx (EASE presets, ramp, mix, SpeedBlur) and the cursor-flyover demo (Cursor, ripple).
import React from 'react';
import { bezier } from './motion';

export const EASE = {
  snappy: bezier(0.16, 1, 0.3, 1),
  out: bezier(0.22, 1, 0.36, 1),
  smooth: bezier(0.65, 0, 0.35, 1),
  swift: bezier(0.4, 0, 0.2, 1),
  exit: bezier(0.7, 0, 0.84, 0),
  overshoot: bezier(0.34, 1.45, 0.64, 1),
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const ramp = (frame: number, start: number, dur: number, ease: (t: number) => number = EASE.snappy) => ease(clamp01((frame - start) / Math.max(1e-6, dur)));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Directional motion blur driven by screen velocity (vx, vy in px/frame). Only active in fast segments. */
export const SpeedBlur: React.FC<{ vx: number; vy?: number; amount?: number; max?: number; children: React.ReactNode }> = ({ vx, vy = 0, amount = 0.45, max = 36, children }) => {
  const rid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const sd = Math.min(max, Math.hypot(vx, vy) * amount);
  const fill: React.CSSProperties = { position: 'absolute', inset: 0 };
  if (sd < 0.35) return <div style={fill}>{children}</div>;
  const deg = (Math.atan2(vy, vx) * 180) / Math.PI;
  return (
    <div style={fill}>
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
        <filter id={`sb-${rid}`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={`${sd.toFixed(2)} 0`} edgeMode="none" /></filter>
      </svg>
      <div style={{ ...fill, transform: `rotate(${deg}deg)`, filter: `url(#sb-${rid})` }}>
        <div style={{ ...fill, transform: `rotate(${-deg}deg)` }}>{children}</div>
      </div>
    </div>
  );
};

/** macOS-style pointer, 40px on screen (path from the cursor-flyover demo). `press` 0..1 scales to 0.84. */
export const Cursor: React.FC<{ press?: number }> = ({ press = 0 }) => (
  <svg width={40} height={40} viewBox="0 0 24 24" style={{ position: 'absolute', left: -4, top: -3, transform: `scale(${1 - 0.16 * press})`, transformOrigin: '4px 3px', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))' }}>
    <path d="M4.5 2.5 L4.5 19.2 L8.9 15 L11.9 21.6 L14.9 20.3 L11.9 13.8 L18.2 13.4 Z" fill="#ffffff" stroke="#050505" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
);
