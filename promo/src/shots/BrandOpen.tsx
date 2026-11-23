// brand-ink-open (references/shots/opening/brand-ink-open.md, demo demos/typography/brand-ink-open/BrandInkOpen.tsx)
// Structure and timings kept from the demo: crosshair draw-on (v 0-9f, h 8-18f, fade 24-34f), per-glyph letterpress
// (delay 10+3i, 12f, scale 1.6->1 + blur 6->0), kicker typewriter 0.7f/char, full-title hold, short exit.
// Re-skinned to the app: Inter 800 on #050505, lime #d9ff00 accent (demo used serif/amber/paper).
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { T } from '../lib/tokens';

const WORDMARK = 'SmartVideo';
const KICKER = 'AI video & image studio';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const BrandOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const vDraw = interpolate(frame, [0, 9], [100, 0], { ...clamp, easing: Easing.bezier(0.3, 0, 0.2, 1) });
  const hDraw = interpolate(frame, [8, 18], [100, 0], { ...clamp, easing: Easing.linear });
  const crossFade = interpolate(frame, [24, 34], [1, 0], clamp);

  const perChar = 0.7;
  const kickStart = 36;
  const kickChars = Math.floor(Math.max(0, frame - kickStart) / perChar);
  const kickDone = kickStart + KICKER.length * perChar;
  const cursorOn = frame >= kickStart && (frame < kickDone || (frame <= 90 && Math.floor((frame - kickDone) / 2) % 2 === 0));

  // wordmark completes at 10+3*9+12 = 49f; hold the complete title 49 -> 98 (49f > 30f), then exit 98 -> 108
  const out = interpolate(frame, [98, 108], [0, 1], { ...clamp, easing: Easing.bezier(0.4, 0, 0.5, 1) });

  return (
    <AbsoluteFill style={{ backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', opacity: 1 - out, transform: `translateY(${-out * 40}px) scale(${1 - out * 0.12})` }}>
        <svg width={64} height={64} viewBox="0 0 64 64" style={{ display: 'block', margin: '0 auto 34px', opacity: crossFade }}>
          <line x1={32} y1={2} x2={32} y2={62} stroke={T.accent} strokeWidth={5} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={vDraw} />
          <line x1={2} y1={32} x2={62} y2={32} stroke={T.accent} strokeWidth={5} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={hDraw} />
        </svg>
        <div style={{ fontFamily: T.font, fontSize: 168, fontWeight: 800, color: T.text, letterSpacing: '-0.03em', lineHeight: 1, whiteSpace: 'pre', display: 'inline-flex', alignItems: 'flex-end' }}>
          {WORDMARK.split('').map((ch, i) => {
            const delay = 10 + i * 3;
            const t = interpolate(frame, [delay, delay + 12], [0, 1], { ...clamp, easing: Easing.bezier(0.2, 0.7, 0.25, 1) });
            const g = interpolate(frame, [delay + 8, delay + 12, delay + 16], [0, 1, 0], clamp);
            return (
              <span key={i} style={{ position: 'relative', display: 'inline-block', opacity: t, transform: `scale(${1.6 - 0.6 * t})`, transformOrigin: 'center bottom', filter: `blur(${(1 - t) * 6}px)` }}>
                {ch}
                <span style={{ position: 'absolute', left: '50%', bottom: -8, transform: 'translateX(-50%)', width: `${g * 100}%`, height: 3, background: T.accent, opacity: g, borderRadius: 2 }} />
              </span>
            );
          })}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 34, fontWeight: 600, letterSpacing: '0.16em', color: T.secondary, marginTop: 36, textTransform: 'uppercase', height: 40, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ whiteSpace: 'pre' }}>{KICKER.slice(0, kickChars)}</span>
          <span style={{ display: 'inline-block', width: 16, height: 32, marginLeft: 6, background: T.accent, opacity: cursorOn ? 0.9 : 0 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
