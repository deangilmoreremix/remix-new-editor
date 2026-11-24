// carousel-3d (references/shots/ui-entrance/carousel-3d.md, demo demos/ui-entrance/carousel-3d/Carousel3D.tsx).
// Kept from the demo: ring positioning `rotateY(i*360/N) translateZ(RADIUS + 44*hl)` with cards only ever rotating about Y (always upright),
// whole ring spun by the parent with rotateY(-spin), double-faced cards (back face rotateY(180deg) with the same art, backface-visibility hidden on both),
// turn = 0.5 * f/(N*21) + 0.5 * stepPart (21f per step = 8f dwell + 13f smooth move), front card highlight hl = smooth(1 - |azimuth|/26deg) driving the lime border and push-out,
// fixed camera (perspective 2200px, ring container translateZ(-RADIUS) rotateX(-9deg)), floor glow disc + 96-tick ring turning with the ring,
// reflection ring (scaleY(-1) about the floor, 8% opacity on the leaf layer only, fade mask), air-perspective darkening by azimuth (up to 70% at the back).
// Changed: cards are REAL Cinema Templates preview images cut out of the real page (8 of them) at 660x371 (the demo used 340x460 drawn recipe cards), RADIUS 1150 to keep
// radius/width ~1.8; no per-card numbers/graphics; a single fixed caption instead of rolling per-card names (the template names were not captured); lime/black tokens.
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import layout from '../live-layout.json';
import { EASE, ramp } from '../lib/polish';
import { INTER, T } from '../lib/tokens';

export const CAROUSEL_DURATION = 148;
const N = 8, RADIUS = 1150, CW = 660, CH = 371, RING_Y = 400, FLOOR = CH / 2 + 10, BEAT = 21, DWELL = 8;
const CUTS = layout['cinema-template'].cutouts.filter((c) => c.w < 500 && c.w > 380).slice(0, N); // the 405x228 template thumbnails
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const stepPart = (f: number) => { const k = Math.floor(f / BEAT); const local = f - k * BEAT; return (k + EASE.smooth(clamp01((local - DWELL) / (BEAT - DWELL)))) / N; };
const turnAt = (f: number) => 0.5 * (f / (N * BEAT)) + 0.5 * stepPart(f);
const a = (hex: string, al: number) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${al})`;

export const CarouselShot: React.FC = () => {
  const f = useCurrentFrame();
  const spin = turnAt(f) * 360;
  const azimuth = (i: number) => ((((i * 360) / N - spin) % 360) + 540) % 360 - 180;
  const depthOf = (i: number) => (1 - Math.cos((azimuth(i) * Math.PI) / 180)) / 2;
  const hlOf = (i: number) => EASE.smooth(clamp01(1 - Math.abs(azimuth(i)) / 26));
  const cap = ramp(f, 8, 16, EASE.out);
  const renderCard = (i: number, reflect: boolean) => {
    const d = depthOf(i), hl = reflect ? 0 : hlOf(i);
    const face: React.CSSProperties = {
      position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', boxSizing: 'border-box', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: T.card,
      border: `2px solid ${hl > 0.01 ? a(T.accent, 0.25 + 0.65 * hl) : 'rgba(255,255,255,0.1)'}`,
      ...(reflect ? { opacity: 0.08, WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0) 62%, rgba(0,0,0,0.85) 100%)', maskImage: 'linear-gradient(180deg, rgba(0,0,0,0) 62%, rgba(0,0,0,0.85) 100%)' } : {}),
    };
    const body = (
      <>
        <Img src={staticFile(`textures/live/${CUTS[i].file}`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: T.bg, opacity: 0.7 * d }} />
      </>
    );
    return (
      <div key={i} style={{ position: 'absolute', left: -CW / 2, top: -CH / 2, width: CW, height: CH, transformStyle: 'preserve-3d', transform: `rotateY(${(i * 360) / N}deg) translateZ(${(RADIUS + 44 * hlOf(i)).toFixed(2)}px)` }}>
        <div style={face}>{body}</div>
        <div style={{ ...face, transform: 'rotateY(180deg)' }}>{body}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ background: T.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(60% 50% at 50% 16%, rgba(217,255,0,0.06), rgba(5,5,5,0) 70%)' }} />
      <div style={{ position: 'absolute', left: 960 - 520, top: RING_Y + 120, width: 1040, height: 420, borderRadius: '50%', background: `radial-gradient(ellipse at 50% 40%, ${a(T.accent, 0.16)} 0%, ${a(T.accent, 0)} 65%)` }} />
      <div style={{ position: 'absolute', inset: 0, perspective: '2200px', perspectiveOrigin: `50% ${RING_Y - 60}px` }}>
        <div style={{ position: 'absolute', left: 960, top: RING_Y, width: 0, height: 0, transformStyle: 'preserve-3d', transform: `translateZ(${-RADIUS}px) rotateX(-9deg)` }}>
          <div style={{ position: 'absolute', left: -RADIUS * 1.35, top: FLOOR - RADIUS * 1.35, width: RADIUS * 2.7, height: RADIUS * 2.7, borderRadius: '50%', transform: 'rotateX(90deg)', background: `radial-gradient(circle, ${a(T.accent, 0.1)} 0%, ${a(T.accent, 0.03)} 45%, transparent 66%)` }} />
          <svg width={RADIUS * 2.4} height={RADIUS * 2.4} viewBox={`${-RADIUS * 1.2} ${-RADIUS * 1.2} ${RADIUS * 2.4} ${RADIUS * 2.4}`} style={{ position: 'absolute', left: -RADIUS * 1.2, top: FLOOR - RADIUS * 1.2, transform: `rotateX(90deg) rotateZ(${spin}deg)`, overflow: 'visible' }}>
            <circle r={RADIUS * 1.08} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2} />
            {Array.from({ length: 96 }, (_, t) => {
              const ang = (t / 96) * Math.PI * 2, r0 = RADIUS * (t % 12 === 0 ? 1.02 : 1.05);
              return <line key={t} x1={r0 * Math.cos(ang)} y1={r0 * Math.sin(ang)} x2={RADIUS * 1.08 * Math.cos(ang)} y2={RADIUS * 1.08 * Math.sin(ang)} stroke={t % 12 === 0 ? a(T.accent, 0.5) : 'rgba(255,255,255,0.12)'} strokeWidth={t % 12 === 0 ? 3 : 2} />;
            })}
          </svg>
          <div style={{ position: 'absolute', transformStyle: 'preserve-3d', transform: `translateY(${FLOOR * 2}px) scaleY(-1) rotateY(${-spin}deg)` }}>{CUTS.map((_, i) => renderCard(i, true))}</div>
          <div style={{ position: 'absolute', transformStyle: 'preserve-3d', transform: `rotateY(${-spin}deg)` }}>{CUTS.map((_, i) => renderCard(i, false))}</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 838, textAlign: 'center', fontFamily: INTER, fontSize: 84, fontWeight: 800, letterSpacing: '-0.025em', color: '#fff', opacity: cap, transform: `translateY(${(1 - cap) * 24}px)` }}>Start from a template.</div>
    </AbsoluteFill>
  );
};
