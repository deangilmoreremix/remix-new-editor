import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { bf, C, FONT } from './tokens';

/** Wordmark-only lockup (no logo asset: the repo has conflicting marks). */
export const Lockup: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  const f = useCurrentFrame();
  const { width } = useVideoConfig();
  const p = interpolate(f, [0, 14], [0, 1], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line = interpolate(f, [8, bf(3)], [0, 1], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sub = interpolate(f, [bf(1.5), bf(2.5)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fs = (width > 1500 ? 168 : 132) * scale;
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ position: 'absolute', width: 900 * scale, height: 900 * scale, borderRadius: '50%', background: `radial-gradient(circle, rgba(217,255,0,${0.10 * p}) 0%, rgba(217,255,0,0) 65%)` }} />
      <div style={{ fontSize: fs, fontWeight: 700, letterSpacing: -4, color: C.text, transform: `scale(${0.94 + 0.06 * p})`, opacity: p, filter: `blur(${(1 - p) * 10}px)` }}>
        Smart<span style={{ color: C.accent }}>Video</span>
      </div>
      <div style={{ marginTop: 26 * scale, width: 520 * scale * line, height: 3, background: C.accent, borderRadius: 2 }} />
      <div style={{ marginTop: 28 * scale, fontSize: 40 * scale, color: C.muted, opacity: sub, letterSpacing: 1 }}>smartvid.app</div>
    </AbsoluteFill>
  );
};
