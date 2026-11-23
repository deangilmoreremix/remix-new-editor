// Design tokens pulled from the app itself: tailwind.config.js (colors, radii, glow) and index.html (Inter 400-900).
import React from 'react';
import { loadFont } from '@remotion/google-fonts/Inter';

export const { fontFamily: INTER } = loadFont('normal', { weights: ['400', '500', '600', '700', '800'] });

export const T = {
  bg: '#050505', // app-bg
  panel: '#0a0a0a', // panel-bg
  card: '#141414', // card-bg
  accent: '#d9ff00', // primary
  accentHover: '#c4e600',
  secondary: '#a1a1aa',
  muted: '#52525b',
  text: '#ffffff',
  r: { xl: 16, '2xl': 24, '3xl': 32 },
  glow: '0 0 20px rgba(217,255,0,0.4)',
  font: INTER,
} as const;

/** The in-app header mark (src/components/Header.js): white rounded square with the black layers glyph. */
export const AppMark: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 96, style }) => (
  <div
    style={{
      width: size, height: size, background: '#fff', borderRadius: size * 0.25,
      display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(0,0,0,.5)', ...style,
    }}
  >
    <svg width={size * 0.75} height={size * 0.75} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="black" />
      <path d="M2 17L12 22L22 17" stroke="black" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12L12 17L22 12" stroke="black" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);
