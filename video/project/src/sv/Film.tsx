import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  BG, BEAT, Cam, Chip, FONT, Hop, Key, LIME, Lockup, LockupV, Open, Rect, Screen, Sfx, Sound, Spotlight, TitleCard,
  LightSweep, WallCells, bf, outQuint, smooth,
} from './lib';

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

// Every on-screen count in a capture is masked (claims rule: no model/tool counts until confirmed).
const M: Record<string, Rect[]> = {
  s01: [R(121, 219, 364, 20), R(1818, 813, 74, 12), R(60, 925, 1860, 160)],
  s02: [R(150, 722, 1020, 48)],
  s04: [R(121, 219, 244, 20), R(145, 611, 612, 18), R(1818, 813, 74, 12)],
  s05a: [R(1842, 969, 74, 12)],
  s05b: [R(109, 123, 435, 20), R(190, 208, 167, 16)],
  s06: [],
  s07: [R(129, 219, 501, 20)],
  s08a: [], s08b: [],
  s09a: [R(1802, 1042, 74, 12)], s09b: [],
  s10a: [R(386, 589, 414, 34)],
  s10b: [R(129, 270, 423, 20), R(1053, 496, 684, 18)],
  s11: [R(78, 733, 214, 70)],
  s12: [R(153, 481, 665, 18)],
  s13: [], s15: [],
  s01v: [R(121, 165, 271, 40), R(978, 761, 74, 12), R(0, 790, 1080, 1130)],
  s06v: [R(129, 165, 266, 40)],
  s07v: [R(129, 165, 266, 40)],
  s09av: [R(962, 990, 74, 12)], s09bv: [],
};

const flat = (cx: number, cy: number, z: number, t = 0, rx = 0, ry = 0): Key => ({ t, cx, cy, z, rx, ry });

type ShotFn = (D: number) => React.ReactNode;
type Half = (D: number) => React.ReactNode;

const halves = (a: Half, b: Half): ShotFn => (D) => {
  const h = Math.round(D / 2);
  return (
    <>
      <Sequence from={0} durationInFrames={h}>{a(h)}</Sequence>
      <Sequence from={h}>{b(D - h)}</Sequence>
    </>
  );
};

const cam = (src: string, key: string, label: string, keys: Key[], hops?: Hop[], extra?: (D: number) => React.ReactNode): Half => (D) => (
  <Cam D={D} src={src} keys={keys} masks={M[key]} hops={hops}>{extra?.(D)}</Cam>
);
const withChip = (h: Half, label: string): Half => (D) => (<><AbsoluteFill>{h(D)}</AbsoluteFill><Chip text={label} D={D} /></>);

// ---------- 16:9 shots ----------
const spot01: ShotFn = (D) => (
  <>
    <Cam D={D} video={{ src: 'cap/s01-typing.mp4', rate: 1.6, from: 0.5 }} masks={M.s01}
      keys={[flat(960, 540, 1), flat(840, 450, 1.2, 0.55), flat(800, 450, 1.25, 1)]}>
      <Spotlight D={D} target={R(100, 362, 1790, 180)} />
    </Cam>
  </>
);

const wall02: ShotFn = (D) => (
  <>
    <Cam D={D} src="cap/s02.png" masks={M.s02} keys={[flat(960, 540, 1), flat(960, 500, 1.1)]}><WallCells D={D} /></Cam>
    <Chip text="Every creative tool, one place." D={D} />
  </>
);

const picker03: ShotFn = (D) => (
  <Cam D={D} video={{ src: 'cap/s03-picker.mp4', rate: 5, from: 1.2 }} masks={M.s01}
    keys={[flat(960, 540, 1), flat(340, 270, 1.5, 0.35), flat(340, 300, 1.55, 1)]} />
);

const img04: ShotFn = (D) => (
  <>
    <Cam D={D} video={{ src: 'cap/s04-typing.mp4', rate: 1.1, from: 0.4 }} masks={M.s04}
      keys={[flat(960, 540, 1), flat(840, 470, 1.22, 0.5), flat(800, 480, 1.2, 1)]} />
    <Chip text="Image" D={D} />
  </>
);

const cin05 = halves(
  withChip(cam('cap/s05a.png', 's05a', '', [flat(960, 540, 1, 0, 3, -5), flat(760, 600, 1.4, 1, 0, 0)]), 'Cinema'),
  withChip(cam('cap/s05b.png', 's05b', '', [flat(960, 540, 1), flat(1300, 520, 1.4, 1)]), 'Director'),
);

const sb06: ShotFn = (D) => (
  <>
    <Cam D={D} src="cap/s06.png" masks={M.s06} keys={[flat(960, 540, 1, 0, 4, 0), flat(800, 640, 1.2, 0.5), flat(800, 450, 1.2, 1)]} />
    <Chip text="Storyboard" D={D} />
  </>
);

const edit07: ShotFn = (D) => (
  <>
    <Cam D={D} src="cap/s07.png" masks={M.s07} keys={[flat(960, 560, 1), flat(900, 640, 1.14, 1)]}
      hops={[
        { t: 0.16, r: R(552, 365, 433, 244) }, { t: 0.34, r: R(1454, 689, 433, 244) },
        { t: 0.52, r: R(1003, 689, 433, 244) }, { t: 0.7, r: R(530, 675, 477, 269) }, { t: 0.86, r: R(101, 365, 433, 244) },
      ]} />
    <Chip text="Edit" D={D} />
  </>
);

const char08 = halves(
  withChip(cam('cap/s08a.png', 's08a', '', [flat(960, 540, 1, 0, 4, -6), flat(800, 480, 1.2, 1, 0, 0)]), 'Character'),
  withChip(cam('cap/s08b.png', 's08b', '', [flat(960, 540, 1, 0, 4, 6), flat(800, 480, 1.2, 1, 0, 0)]), 'Influencer'),
);

const QuadPane: React.FC<{ src: string; masks: Rect[]; x: number; y: number; from: number; dx: number; dy: number; D: number }> = ({ src, masks, x, y, from, dx, dy, D }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [from, from + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outQuint });
  const out = interpolate(f, [D - 8, D - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const s = 880 / 1920;
  return (
    <div style={{ position: 'absolute', left: x + (1 - p) * dx, top: y + (1 - p) * dy, width: 880, height: 495, borderRadius: 20, overflow: 'hidden', opacity: p * out, border: `2px solid ${LIME}66`, boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
      <div style={{ transform: `scale(${s})`, transformOrigin: '0 0', width: 1920, height: 1080 }}><Screen src={src} W={1920} H={1080} masks={masks} /></div>
    </div>
  );
};
const quad09: ShotFn = (D) => (
  <AbsoluteFill style={{ background: BG }}>
    <QuadPane src="cap/s09a.png" masks={M.s09a} x={60} y={30} from={bf(1)} dx={-900} dy={0} D={D} />
    <QuadPane src="cap/s09b.png" masks={M.s09b} x={980} y={30} from={bf(2)} dx={900} dy={0} D={D} />
    <QuadPane src="cap/s08b.png" masks={M.s08b} x={60} y={555} from={bf(3)} dx={-900} dy={0} D={D} />
    <QuadPane src="cap/s08a.png" masks={M.s08a} x={980} y={555} from={bf(4)} dx={900} dy={0} D={D} />
    <Chip text="Avatar. Lip sync." D={D} />
  </AbsoluteFill>
);

const vfx10 = halves(
  withChip(cam('cap/s10a.png', 's10a', '', [flat(960, 540, 1), flat(790, 760, 1.2, 1)], undefined, (D) => <LightSweep D={D} beats={[2, 4]} />), 'AI-VFX'),
  withChip(cam('cap/s10b.png', 's10b', '', [flat(960, 540, 1), flat(790, 700, 1.2, 1)], undefined, (D) => <LightSweep D={D} beats={[2, 4]} />), 'Effects'),
);

const wb11: ShotFn = (D) => (
  <>
    <Cam D={D} src="cap/s11.png" masks={M.s11} keys={[flat(960, 540, 1), flat(700, 900, 1.38, 0.5), flat(800, 540, 1.2, 1)]} />
    <Chip text="Workbench" D={D} />
  </>
);

const Carousel: React.FC<{ D: number }> = ({ D }) => {
  const f = useCurrentFrame();
  const tiles = [R(100, 702, 347, 211), R(460, 702, 347, 211), R(820, 702, 347, 211), R(1180, 702, 347, 211), R(1540, 702, 347, 211)];
  let rot = 0;
  for (let k = 0; k < 6; k++) rot += 72 * interpolate(f, [bf(1 + 2 * k), bf(1 + 2 * k) + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outQuint });
  const S = 2.1, w = 347 * S, h = 211 * S, Rr = 640;
  const out = interpolate(f, [D - 8, D - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: BG, perspective: 2200, perspectiveOrigin: '960px 500px', opacity: out }}>
      <div style={{ position: 'absolute', left: 960, top: 500, transformStyle: 'preserve-3d', transform: `translateZ(${-Rr}px) rotateY(${-rot}deg)` }}>
        {tiles.map((t, i) => (
          <div key={i} style={{ position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: 22, overflow: 'hidden', backfaceVisibility: 'hidden', transform: `rotateY(${i * 72}deg) translateZ(${Rr}px)`, boxShadow: '0 30px 80px rgba(0,0,0,.6)', border: `2px solid ${LIME}55` }}>
            <Img src={staticFile('cap/s12.png')} style={{ position: 'absolute', left: -t.x * S, top: -t.y * S, width: 1920 * S, height: 1080 * S }} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
const tpl12: ShotFn = (D) => (<><Carousel D={D} /><Chip text="Templates" D={D} /></>);

const va13: ShotFn = (D) => (
  <>
    <Cam D={D} src="cap/s13.png" masks={M.s13} keys={[flat(960, 540, 1, 0, 3, 0), flat(800, 560, 1.2, 1)]} />
    <Chip text="Video Agent" D={D} />
  </>
);

const com15: ShotFn = (D) => (
  <>
    <Cam D={D} src="cap/s15.png" masks={M.s15} keys={[flat(960, 540, 1), flat(960, 520, 1.1)]}><WallCells D={D} /></Cam>
    <Chip text="Community" D={D} />
  </>
);

// ---------- 9:16 shots ----------
const V = { W: 1080, H: 1920 };
const v01: ShotFn = (D) => (
  <Cam D={D} src="cap/s01v.png" W={V.W} H={V.H} masks={M.s01v}
    keys={[flat(540, 960, 1), flat(540, 520, 1.18, 0.55), flat(540, 480, 1.25, 1)]}>
    <Spotlight D={D} target={R(100, 262, 880, 165)} W={V.W} H={V.H} />
  </Cam>
);
const v07: ShotFn = (D) => (
  <>
    <Cam D={D} src="cap/s07v.png" W={V.W} H={V.H} masks={M.s07v}
      keys={[flat(540, 700, 1.0), flat(540, 860, 1.25, 1)]}
      hops={[
        { t: 0.14, r: R(422, 277, 303, 171) }, { t: 0.34, r: R(422, 779, 303, 171) }, { t: 0.54, r: R(422, 1030, 303, 171) },
        { t: 0.7, r: R(101, 1030, 303, 171) }, { t: 0.85, r: R(744, 1030, 303, 171) },
      ]} />
    <Chip text="Edit" D={D} W={V.W} H={V.H} />
  </>
);
const VQuad: React.FC<{ D: number }> = ({ D }) => {
  const f = useCurrentFrame();
  const mk = (src: string, masks: Rect[], y: number, from: number, dx: number) => {
    const p = interpolate(f, [from, from + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outQuint });
    const out = interpolate(f, [D - 8, D - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const s = 960 / 1080;
    return (
      <div style={{ position: 'absolute', left: 60 + (1 - p) * dx, top: y, width: 960, height: 760, borderRadius: 24, overflow: 'hidden', opacity: p * out, border: `2px solid ${LIME}66`, boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
        <div style={{ transform: `scale(${s})`, transformOrigin: '0 0', width: 1080, height: 1920 }}><Screen src={src} W={1080} H={1920} masks={masks} /></div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ background: BG }}>
      {mk('cap/s09av.png', M.s09av, 130, bf(1), -1100)}
      {mk('cap/s09bv.png', M.s09bv, 960, bf(3), 1100)}
      <Chip text="Avatar. Lip sync." D={D} W={V.W} H={V.H} />
    </AbsoluteFill>
  );
};
const v09: ShotFn = (D) => <VQuad D={D} />;
const v06: ShotFn = (D) => (
  <>
    <Cam D={D} src="cap/s06v.png" W={V.W} H={V.H} masks={M.s06v} keys={[flat(540, 960, 1, 0, 3, 0), flat(540, 620, 1.22, 1)]} />
    <Chip text="Storyboard" D={D} W={V.W} H={V.H} />
  </>
);

export const SHOTS: Record<string, ShotFn> = {
  open: (D) => <Open D={D} />, lockup: (D) => <Lockup D={D} />, lockupV: (D) => <LockupV D={D} />,
  title1: (D) => <TitleCard D={D} words={['Edit.', 'Animate.', 'Finish.']} accent={[2]} />,
  title2: (D) => <TitleCard D={D} words={['From', 'idea', 'to', 'timeline.']} accent={[3]} />,
  spot01, wall02, picker03, img04, cin05, sb06, edit07, char08, quad09, vfx10, wb11, tpl12, va13, com15, v01, v07, v09, v06,
};

// frames at which a shot wants extra one-shot sounds (relative to shot start)
const shotSfx = (name: string, D: number): Sfx[] => {
  switch (name) {
    case 'open': return [{ f: bf(0.5), src: 'whoosh-fast', vol: 0.4 }, { f: 22, src: 'click-camera', vol: 0.45 }];
    case 'lockup': case 'lockupV': return [{ f: bf(0) , src: 'riser-cine', vol: 0.45 }, { f: bf(name === 'lockup' ? 2 : 3), src: 'impact-cine', vol: 0.8 }, { f: bf(name === 'lockup' ? 2 : 3) + 10, src: 'sparkle', vol: 0.5 }];
    case 'spot01': return [{ f: bf(1), src: 'keyboard', vol: 0.35 }, { f: bf(3), src: 'pop', vol: 0.5 }];
    case 'img04': return [{ f: bf(1), src: 'keyboard', vol: 0.3 }];
    case 'edit07': case 'v07': return [0.16, 0.34, 0.52, 0.7, 0.86].map((t) => ({ f: Math.round(t * D), src: 'pop', vol: 0.5 }));
    case 'wall02': case 'com15': return [{ f: bf(1), src: 'whoosh-big', vol: 0.4 }];
    case 'quad09': return [1, 2, 3, 4].map((b) => ({ f: bf(b), src: 'whoosh-fast', vol: 0.35 }));
    case 'v09': return [1, 3].map((b) => ({ f: bf(b), src: 'whoosh-fast', vol: 0.35 }));
    case 'tpl12': return [1, 3, 5, 7].map((b) => ({ f: bf(b), src: 'whoosh-fast', vol: 0.3 }));
    case 'vfx10': return [{ f: bf(2), src: 'whoosh-big', vol: 0.35 }, { f: Math.round(D / 2) + bf(2), src: 'whoosh-big', vol: 0.35 }];
    default: return [];
  }
};

export type Item = { shot: string; beats: number };
export const totalFrames = (items: Item[]) => bf(items.reduce((a, i) => a + i.beats, 0));

export const Film: React.FC<{ items: Item[]; bgm?: boolean }> = ({ items, bgm = true }) => {
  let beat = 0; const seqs: React.ReactNode[] = []; const sfx: Sfx[] = [];
  const total = totalFrames(items);
  items.forEach((it, i) => {
    const start = bf(beat), end = bf(beat + it.beats), D = end - start;
    seqs.push(<Sequence key={i} from={start} durationInFrames={D}>{SHOTS[it.shot](D)}</Sequence>);
    if (i > 0 && it.shot !== 'lockup' && it.shot !== 'lockupV') sfx.push({ f: start - 2, src: 'transition-snap', vol: 0.4 });
    shotSfx(it.shot, D).forEach((s) => sfx.push({ ...s, f: s.f + start }));
    beat += it.beats;
  });
  return (
    <AbsoluteFill style={{ background: BG }}>
      {seqs}
      <Sound sfx={sfx} bgm={bgm} total={total} />
    </AbsoluteFill>
  );
};

// ---------- deliverables (whole beats at 123 BPM) ----------
export const HERO: Item[] = [{ shot: 'open', beats: 6 }, { shot: 'spot01', beats: 9 }, { shot: 'wall02', beats: 8 }, { shot: 'picker03', beats: 7 }, { shot: 'lockup', beats: 6 }];
export const REEL: Item[] = [
  { shot: 'img04', beats: 10 }, { shot: 'cin05', beats: 11 }, { shot: 'sb06', beats: 10 }, { shot: 'title1', beats: 4 },
  { shot: 'edit07', beats: 12 }, { shot: 'char08', beats: 10 }, { shot: 'quad09', beats: 10 }, { shot: 'vfx10', beats: 10 },
  { shot: 'title2', beats: 4 }, { shot: 'wb11', beats: 12 }, { shot: 'tpl12', beats: 9 }, { shot: 'va13', beats: 9 }, { shot: 'lockup', beats: 9 },
];
export const SOCIAL: Item[] = [{ shot: 'v01', beats: 9 }, { shot: 'v07', beats: 10 }, { shot: 'v09', beats: 9 }, { shot: 'v06', beats: 6 }, { shot: 'lockupV', beats: 6 }];
// per-feature clips: 14 beats (6.8s) each
export const CLIPS: { id: string; item: Item }[] = [
  { id: 'c01-video', item: { shot: 'spot01', beats: 14 } }, { id: 'c02-apps', item: { shot: 'wall02', beats: 14 } },
  { id: 'c03-models', item: { shot: 'picker03', beats: 14 } }, { id: 'c04-image', item: { shot: 'img04', beats: 14 } },
  { id: 'c05-cinema-director', item: { shot: 'cin05', beats: 14 } }, { id: 'c06-storyboard', item: { shot: 'sb06', beats: 14 } },
  { id: 'c07-edit', item: { shot: 'edit07', beats: 14 } }, { id: 'c08-character-influencer', item: { shot: 'char08', beats: 14 } },
  { id: 'c09-avatar-lipsync', item: { shot: 'quad09', beats: 14 } }, { id: 'c10-vfx-effects', item: { shot: 'vfx10', beats: 14 } },
  { id: 'c11-workbench', item: { shot: 'wb11', beats: 14 } }, { id: 'c12-templates', item: { shot: 'tpl12', beats: 14 } },
  { id: 'c13-video-agent', item: { shot: 'va13', beats: 14 } }, { id: 'c15-community', item: { shot: 'com15', beats: 14 } },
];
