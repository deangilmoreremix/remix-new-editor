// deck-deal-flyin (references/shots/ui-entrance/deck-deal-flyin.md, demo demos/ui-entrance/deck-deal-flyin/DeckDealFlyin.tsx).
// Kept from the demo: physical pile (STACK_STEP 3px, deterministic jitter ((k*7)%9-4)*2, rotZ +-3), anticipation 26-36f (pile down 48px, top card pulled back 30px,
// once per segment, not per card), hard-accelerating cues cue_k = 36 + 4k - 0.0792 k (k-1), per-card flight 8f bezier(0.3,0,0.2,1) with a 110px z arc and 1.06 scale
// peak, 4f settle bezier(0.3,0,0.25,1.15), 2f press 0.996, ghost trail (6% path lag, blur 7px, opacity 0.28(1-t)), lamp-style board light-up from the pile,
// monotone Hermite camera through anchors (orbit on the pile -> pull-back to the board -> runway overview), perspective growing with the tilt,
// landed cards forced to identity, depth fog on the far end, true stillness at the end, title rising word by word.
// Changed: 12 REAL Edit Studio tool cards (cut out of the real Edit page: image + app label) instead of 26 project cards; board is a dark panel with
// slot outlines (3 cols x 4 rows) instead of the demo's paper board; no brushed-graphite table texture (decorative); lime/black tokens; no live counter
// (a count of 12 cards would be a claim-like number).
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import layout from '../live-layout.json';
import { EASE, ramp } from '../lib/polish';
import { INTER, T } from '../lib/tokens';
import { EngineTitle, EngineTitleProps } from '../lib/EngineTitle';

export const DEAL_DURATION = 177;
const N = 9;
const CARD_W = 435, CARD_H = 308;
const COLS = [100, 551, 1002];
const ROWS = [100, 424, 748];
const BOARD = { x: 40, w: 1480, h: 1130 };
const PILE = { x: 1640, y: 300 };
const PILE_CX = PILE.x + CARD_W / 2, PILE_CY = PILE.y + CARD_H / 2;
const DEAL_START = 36, STACK_STEP = 3, HOVER_H = 40;
const SETTLE_EASE = Easing.bezier(0.3, 0, 0.25, 1.15);
const DIVE_EASE = Easing.bezier(0.3, 0, 0.2, 1);
const ANT = { from: 26, to: 36, pileDown: 48, topPull: 30 };
const TBL = 4000;
// 9 of the 12 real tool cards (indices: remove object, remove background, extend, reframe, change dress, skin enhance, colorize, upscale, product shot).
// The face-swap card is left out on purpose: its baked-in example image carries the text "AI Deepfake Technology".
const CUTS = [0, 1, 2, 4, 5, 6, 7, 9, 11].map((i) => layout.edit.cutouts[i]);

export const DEAL_DEFAULT_FILES = CUTS.map((c) => c.file);
const makeGrid = (files: string[]) => files.map((file, k) => ({
  file,
  x: COLS[k % 3], y: ROWS[Math.floor(k / 3)],
  cue: DEAL_START + 4 * k - 0.0792 * k * (k - 1),
  px: PILE.x + (((k * 7) % 9) - 4) * 2, py: PILE.y + (((k * 5) % 7) - 3) * 2,
  protZ: ((k * 11) % 7) - 3, pz: (files.length - k) * STACK_STEP,
}));

type Cam = { cx: number; cy: number; zoom: number; rotX: number; rotY: number; rotZ: number; persp: number; sx: number };
const ANCHORS: (Cam & { frame: number })[] = [
  { frame: 0, cx: PILE_CX - 40, cy: PILE_CY + 60, zoom: 1.7, rotX: 46, rotY: -28, rotZ: 8, persp: 1100, sx: 0 },
  { frame: 30, cx: PILE_CX + 20, cy: PILE_CY + 40, zoom: 1.6, rotX: 40, rotY: 22, rotZ: -6, persp: 1100, sx: 0 },
  { frame: 62, cx: 1000, cy: 480, zoom: 0.78, rotX: 20, rotY: 0, rotZ: 2, persp: 1700, sx: 0 },
  { frame: 86, cx: 980, cy: 600, zoom: 0.64, rotX: 32, rotY: -4, rotZ: -8, persp: 2500, sx: 100 },
  { frame: 110, cx: 960, cy: 640, zoom: 0.82, rotX: 40, rotY: -4, rotZ: -16, persp: 3000, sx: 210 },
  { frame: 177, cx: 960, cy: 640, zoom: 0.828, rotX: 40, rotY: -4, rotZ: -16, persp: 3000, sx: 210 },
];
const PARAMS: (keyof Cam)[] = ['cx', 'cy', 'zoom', 'rotX', 'rotY', 'rotZ', 'persp', 'sx'];
const hermite = (xs: number[], ys: number[]) => {
  const n = xs.length;
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x));
  const m = xs.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? 0 : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
};
const CURVES = Object.fromEntries(PARAMS.map((p) => [p, hermite(ANCHORS.map((k) => k.frame), ANCHORS.map((k) => k[p]))])) as Record<keyof Cam, (x: number) => number>;
const camAt = (f: number): Cam => Object.fromEntries(PARAMS.map((p) => [p, CURVES[p](f)])) as Cam;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const DealShot: React.FC<{ files?: string[]; title?: EngineTitleProps; chip?: string | null }> = ({ files = DEAL_DEFAULT_FILES, title, chip = 'BUILT-IN EXAMPLE IMAGES' }) => {
  const frame = useCurrentFrame();
  const grid = makeGrid(files);
  const cam = camAt(frame);
  const lightUp = interpolate(frame, [34, 64], [0, 1], { ...clamp, easing: Easing.bezier(0.5, 0, 0.6, 1) });
  const holeR = 4200 * lightUp, feather = 600 + 1000 * lightUp;
  const fog = ramp(frame, 80, 34, EASE.smooth);
  const antT = interpolate(frame, [ANT.from, ANT.to], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const persp = cam.persp * cam.zoom;
  const tableBg = [
    `radial-gradient(${1100 + 1400 * lightUp}px ${800 + 1600 * lightUp}px at ${TBL + PILE_CX - 600 * lightUp}px ${TBL + PILE_CY + 900 * lightUp}px, rgba(235,232,224,${0.16 - 0.07 * lightUp}), rgba(220,216,206,0.04) 45%, transparent 70%)`,
    'linear-gradient(115deg, #0d0e10 0%, #131417 30%, #0b0c0e 56%, #101114 80%, #0a0a0b 100%)',
  ].join(', ');
  const t1 = ramp(frame, 100, 18, EASE.out), t2 = ramp(frame, 108, 18, EASE.out);
  return (
    <AbsoluteFill style={{ fontFamily: INTER, overflow: 'hidden', background: T.bg }}>
      <AbsoluteFill style={{ transform: `translateX(${cam.sx.toFixed(2)}px)` }}>
        <div style={{ position: 'absolute', inset: 0, perspective: `${persp.toFixed(2)}px`, perspectiveOrigin: '960px 540px' }}>
          <div style={{ position: 'absolute', width: 1920, height: BOARD.h, zoom: cam.zoom, transform: `translate(${(960 / cam.zoom - cam.cx).toFixed(3)}px, ${(540 / cam.zoom - cam.cy).toFixed(3)}px) rotateY(${cam.rotY.toFixed(3)}deg) rotateX(${cam.rotX.toFixed(3)}deg) rotateZ(${cam.rotZ.toFixed(3)}deg)`, transformOrigin: `${cam.cx.toFixed(2)}px ${cam.cy.toFixed(2)}px`, transformStyle: 'preserve-3d' }}>
            <div style={{ position: 'absolute', left: -TBL, top: -TBL, width: 1920 + 2 * TBL, height: BOARD.h + 2 * TBL, background: tableBg, WebkitMaskImage: `radial-gradient(ellipse 2600px 3600px at ${TBL + 960}px ${TBL + BOARD.h / 2}px, #000 40%, transparent 100%)` }} />
            <div style={{ position: 'absolute', left: BOARD.x, top: 0, width: BOARD.w, height: BOARD.h, overflow: 'hidden', borderRadius: 18, background: T.panel, boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 60px 160px rgba(0,0,0,0.7), 0 12px 40px rgba(0,0,0,0.5)' }}>
              {grid.map((c, i) => <div key={i} style={{ position: 'absolute', left: c.x - BOARD.x, top: c.y, width: CARD_W, height: CARD_H, borderRadius: 16, border: '1.5px dashed rgba(255,255,255,0.07)' }} />)}
              {lightUp < 1 && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,6,0.88)', WebkitMaskImage: lightUp > 0 ? `radial-gradient(circle at ${PILE_CX - BOARD.x}px ${PILE_CY}px, transparent ${holeR.toFixed(0)}px, #000 ${(holeR + feather).toFixed(0)}px)` : undefined }} />
              )}
            </div>
            {grid.map((c, i) => {
              const { cue } = c;
              const diveT = interpolate(frame, [cue, cue + 8], [0, 1], { ...clamp, easing: DIVE_EASE });
              const settleT = interpolate(frame, [cue + 8, cue + 12], [0, 1], { ...clamp, easing: SETTLE_EASE });
              const dx = (c.px - c.x) * (1 - diveT), dy = (c.py - c.y) * (1 - diveT);
              const rotFlight = c.protZ * (1 - diveT);
              const arc = Math.sin(diveT * Math.PI) * 110;
              const zDive = interpolate(diveT, [0, 1], [c.pz, HOVER_H]) + arc;
              const z = frame < cue ? c.pz : zDive * (1 - settleT);
              const dealScale = 1 + Math.sin(diveT * Math.PI) * 0.06;
              const press = interpolate(frame, [cue + 10, cue + 11, cue + 12], [1, 0.996, 1], clamp);
              const scale = dealScale * press;
              const isLanded = frame >= cue + 12, inPile = frame < cue;
              const antDy = inPile ? ANT.pileDown * antT * (frame < ANT.to + 2 ? 1 : 0) : 0;
              const antPull = i === 0 && inPile ? ANT.topPull * antT : 0;
              const transform = isLanded ? 'translate3d(0px, 0px, 0px)' : inPile ? `translate3d(${c.px - c.x - antPull}px, ${c.py - c.y + antDy}px, ${c.pz}px) rotateZ(${c.protZ}deg)` : `translate3d(${dx}px, ${dy}px, ${z}px) rotateZ(${rotFlight}deg) scale(${scale})`;
              const shadowLag = interpolate(frame, [cue + 8, cue + 15], [0, 1], { ...clamp, easing: EASE.out });
              const shadow = isLanded ? `0 ${(2 + 14 * (1 - shadowLag)).toFixed(1)}px ${(6 + 30 * (1 - shadowLag)).toFixed(1)}px rgba(0,0,0,${(0.3 + 0.2 * (1 - shadowLag)).toFixed(3)})` : inPile ? (i === grid.length - 1 ? '0 1px 3px rgba(0,0,0,.4), 0 26px 60px rgba(0,0,0,0.75)' : '0 1px 2px rgba(0,0,0,.35)') : `0 ${36 - 24 * settleT}px ${70 - 50 * settleT}px rgba(0,0,0,${(0.55 - 0.25 * settleT).toFixed(3)})`;
              const showGhost = diveT > 0.02 && diveT < 0.98;
              const gx = (c.px - c.x) * 0.06, gy = (c.py - c.y) * 0.06;
              const src = staticFile(`textures/live/${c.file}`);
              return (
                <div key={c.file} style={{ transformStyle: 'preserve-3d' }}>
                  {showGhost && (
                    <div style={{ position: 'absolute', left: c.x, top: c.y, width: CARD_W, height: CARD_H, transform: `translate3d(${dx + gx}px, ${dy + gy}px, ${z}px) rotateZ(${rotFlight}deg) scale(${scale})`, opacity: 0.28 * (1 - diveT), filter: 'blur(7px)', borderRadius: 16, overflow: 'hidden' }}>
                      <Img src={src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ position: 'absolute', left: c.x, top: c.y, width: CARD_W, height: CARD_H, transform, boxShadow: shadow, borderRadius: 16, overflow: 'hidden' }}>
                    <Img src={src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
              );
            })}
            {fog > 0 && <div style={{ position: 'absolute', left: BOARD.x - 2, top: -2, width: BOARD.w + 4, height: BOARD.h + 4, pointerEvents: 'none', borderRadius: 18, transform: 'translateZ(1px)', background: `linear-gradient(180deg, rgba(5,5,6,${(0.62 * fog).toFixed(3)}) 0%, rgba(5,5,6,${(0.3 * fog).toFixed(3)}) 35%, rgba(5,5,6,0) 70%)` }} />}
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse 75% 75% at 58% 46%, transparent 45%, rgba(5,5,6,0.55) 100%)' }} />
      {chip && <div style={{ position: 'absolute', left: 114, top: 330, padding: '10px 22px', borderRadius: 999, border: `2px solid ${T.accent}`, background: 'rgba(5,5,5,0.85)', color: T.accent, fontFamily: INTER, fontWeight: 700, fontSize: 36, letterSpacing: '0.06em', opacity: t2 }}>{chip}</div>}
      {title ? <EngineTitle {...title} /> : (
      <div style={{ position: 'absolute', left: 110, top: 80, color: '#fff' }}>
        <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.04, opacity: t1, transform: `translateY(${(1 - t1) * 30}px)` }}>Edit tools,</div>
        <div style={{ fontSize: 112, fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1.04, color: T.accent, opacity: t2, transform: `translateY(${(1 - t2) * 30}px)` }}>in one grid.</div>
      </div>
      )}
    </AbsoluteFill>
  );
};
