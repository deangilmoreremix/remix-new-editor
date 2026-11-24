// Engine title block used by every V3 clip: the engine name (112px/800) and the landing card's own one-line description (40px).
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { EASE, ramp } from './polish';
import { INTER, T } from './tokens';

export type EngineTitleProps = { name: string; desc: string; pos?: 'tl' | 'bc'; at?: number };
export const EngineTitle: React.FC<EngineTitleProps> = ({ name, desc, pos = 'tl', at = 12 }) => {
  const f = useCurrentFrame();
  const t1 = ramp(f, at, 18, EASE.out), t2 = ramp(f, at + 8, 18, EASE.out);
  const box: React.CSSProperties = pos === 'tl' ? { left: 110, top: 80 } : { left: 0, right: 0, bottom: 52, textAlign: 'center' };
  return (
    <div style={{ position: 'absolute', ...box, fontFamily: INTER, color: '#fff' }}>
      <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.02, opacity: t1, transform: `translateY(${(1 - t1) * 28}px)` }}>
        <span style={{ color: T.accent }}>{name}</span>
      </div>
      <div style={{ marginTop: 10, fontSize: 40, fontWeight: 500, color: T.secondary, opacity: t2, transform: `translateY(${(1 - t2) * 14}px)` }}>{desc}</div>
    </div>
  );
};
