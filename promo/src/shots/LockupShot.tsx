// logo-shrink-wordmark-lockup (references/shots/outro/logo-shrink-wordmark-lockup.md, demo LogoShrinkWordmarkLockup.tsx).
// Curves kept from the demo (design stage 480x270, CSS zoom x4 for crisp glyphs): scale 5.4->1 over t 0.02-0.28 inOutCubic with a
// sin(pi)*0.06 brake over 0.26-0.37, heal 0.10-0.28, mark swap 0.24-0.32, shift-left 0.34-0.47, glyph stagger from 0.46 at
// (0.7-0.46)/n per glyph with 0.10 each (n = 10 here), tagline fade 0.72-0.84, one shockwave at 0.28, ring spins -150deg, mark never rotates.
// Re-skinned: lime ring/tagline, in-app mark (white rounded square + layers glyph) instead of the demo's logo, Inter 700 wordmark.
// The first 132f follow the demo; the remaining frames are a still hold (>= 1s with the full lockup visible).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { E, lerp, seg } from '../lib/motion';
import { AppMark, INTER, T } from '../lib/tokens';

const WORDMARK = 'SmartVideo';
const TAGLINE = 'DESCRIBE IT. DIRECT IT.';
const ICON = 30, MARK = 30, GAP = 9;
const WORD_W = 118; // measured width of the wordmark row at 22px/700 (verified on a still, see out/qa)
const SHIFT = -(ICON + GAP + WORD_W) / 2 + ICON / 2;
const ROW_LEFT = SHIFT + ICON / 2 + GAP;
const STAGGER = (0.7 - 0.46) / WORDMARK.length;
const DUR = 132, DT = 1 / 131;

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
};
const Arcs: React.FC<{ a0: number; a1: number; col: string; w: number; blur: number; opacity: number; stroke?: string }> = ({ a0, a1, col, w, blur, opacity, stroke }) => (
  <g opacity={opacity}>
    {[[a0, a1], [a0 + 180, a1 + 180]].map(([b0, b1], i) => (
      <path key={i} d={arcPath(15, 15, 10.5, b0, b1)} fill="none" stroke={stroke ?? col} strokeWidth={w} strokeLinecap="round" style={blur ? { filter: `blur(${blur}px)` } : undefined} />
    ))}
  </g>
);

const scaleAt = (t: number) => lerp(seg(t, 0.02, 0.28, E.inOutCubic), 5.4, 1) * (1 + Math.sin(seg(t, 0.26, 0.37) * Math.PI) * 0.06);
const spinAt = (t: number) => -150 * seg(t, 0.0, 0.3, E.outCubic);

export const LockupShot: React.FC = () => {
  const frame = useCurrentFrame();
  const t = Math.min(1, frame / (DUR - 1));
  const s = scaleAt(t), spin = spinAt(t);
  const shift = seg(t, 0.34, 0.47, E.inOutCubic) * SHIFT;
  const heal = seg(t, 0.10, 0.28, E.inOutQuad);
  const markIn = seg(t, 0.24, 0.32, E.inOutQuad);
  const wave = seg(t, 0.28, 0.46, E.outCubic);
  const haloR = lerp(seg(t, 0.02, 0.3, E.inOutCubic), 150, 34);
  const haloA = 0.5 - 0.32 * seg(t, 0.3, 0.5, E.outCubic);
  void DT;
  return (
    <AbsoluteFill style={{ background: T.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ zoom: 4 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 480, height: 270, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: `calc(50% + ${shift}px - ${haloR}px)`, top: `calc(50% - ${haloR}px)`, width: haloR * 2, height: haloR * 2, borderRadius: '50%', opacity: haloA, background: 'radial-gradient(circle, rgba(217,255,0,0.30) 0%, rgba(217,255,0,0.08) 38%, rgba(217,255,0,0) 70%)' }} />
          {wave > 0 && wave < 1 && (
            <div style={{ position: 'absolute', left: `calc(50% - ${lerp(wave, 16, 70)}px)`, top: `calc(50% - ${lerp(wave, 16, 70)}px)`, width: lerp(wave, 32, 140), height: lerp(wave, 32, 140), borderRadius: '50%', boxSizing: 'border-box', border: `${lerp(wave, 0.9, 0.25)}px solid rgba(235,255,140,${(0.55 * (1 - wave)).toFixed(3)})`, boxShadow: `0 0 ${lerp(wave, 4, 10)}px rgba(217,255,0,${(0.4 * (1 - wave)).toFixed(3)})` }} />
          )}
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: ICON, height: ICON, margin: `${-ICON / 2}px 0 0 ${-ICON / 2}px`, transform: `translateX(${shift}px) scale(${s})` }}>
            <svg viewBox="0 0 30 30" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', transform: `rotate(${spin}deg)` }}>
              <Arcs a0={-32} a1={122} col="rgba(217,255,0,.6)" w={6.5} blur={2.5} opacity={1 - heal} />
              <Arcs a0={-32} a1={122} col="#f4ffb0" w={3.4} blur={0} opacity={(1 - heal * 0.75) * (1 - markIn)} stroke={heal > 0.5 ? '#fff' : '#f4ffb0'} />
              <circle cx={15} cy={15} r={10.5} fill="none" stroke="#fff" strokeWidth={5.5} opacity={heal * (1 - markIn)} />
            </svg>
            {markIn > 0 && <AppMark size={MARK} style={{ position: 'absolute', left: 0, top: 0, opacity: markIn, boxShadow: 'none' }} />}
          </div>
          <div style={{ position: 'absolute', left: `calc(50% + ${ROW_LEFT}px)`, top: '50%', height: ICON, marginTop: -ICON / 2, display: 'flex', alignItems: 'center' }}>
            {[...WORDMARK].map((ch, i) => {
              const lk = seg(t, 0.46 + i * STAGGER, 0.46 + i * STAGGER + 0.1, E.outCubic);
              return (
                <span key={i} style={{ color: '#fff', font: `700 22px/1 ${INTER}`, letterSpacing: 0.3, whiteSpace: 'pre', opacity: lk, transform: `translateX(${lerp(lk, 8, 0)}px)`, filter: lk < 0.999 ? `blur(${lerp(lk, 2.5, 0).toFixed(2)}px)` : undefined }}>{ch}</span>
              );
            })}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(50% + 34px)', textAlign: 'center', color: T.accent, font: `600 12.5px/1 ${INTER}`, letterSpacing: 2.6, opacity: seg(t, 0.72, 0.84, E.outQuad), transform: `translateY(${lerp(seg(t, 0.72, 0.86, E.outCubic), 3, 0)}px)` }}>
            {TAGLINE}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
