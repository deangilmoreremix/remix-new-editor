import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { bf, C, FONT } from './tokens';

/** Short caption: words rise in on the beat, accent on the last word. */
export const Title: React.FC<{ text: string; inB?: number; outB?: number; pos?: 'bl' | 'top'; size?: number; top?: number }> = ({ text, inB = 0.5, outB, pos = 'bl', size = 68, top = 150 }) => {
  const f = useCurrentFrame();
  const { width } = useVideoConfig();
  const words = text.split(' ');
  const t0 = bf(inB);
  const t1 = outB !== undefined ? bf(outB) : Infinity;
  const fadeOut = Number.isFinite(t1) ? interpolate(f, [t1 - 6, t1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;
  const wide = width > 1500;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {pos === 'bl' && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 300, background: 'linear-gradient(to top, rgba(5,5,5,0.88), rgba(5,5,5,0))' }} />}
      <div style={{ position: 'absolute', left: wide ? 96 : 60, right: 60, ...(pos === 'bl' ? { bottom: 84 } : { top }), fontFamily: FONT, fontWeight: 650, fontSize: size, letterSpacing: -1.5, color: C.text, opacity: fadeOut, display: 'flex', flexWrap: 'wrap', gap: `0 ${size * 0.28}px`, lineHeight: 1.08 }}>
        {words.map((w, i) => {
          const s = t0 + i * 4;
          const p = interpolate(f, [s, s + 12], [0, 1], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const last = i === words.length - 1;
          return (
            <span key={i} style={{ display: 'inline-block', transform: `translateY(${(1 - p) * 26}px)`, opacity: p, color: last ? C.accent : C.text }}>
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
