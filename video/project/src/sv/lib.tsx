import React from 'react';
import {
  AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame,
} from 'remotion';

export const FPS = 30;
export const BPM = 123;
export const BEAT = (FPS * 60) / BPM; // 14.634 frames
export const bf = (n: number) => Math.round(n * BEAT);
export const LIME = '#d9ff00';
export const BG = '#05070b';
export const FONT = 'Inter, system-ui, -apple-system, sans-serif';

export type Rect = { x: number; y: number; w: number; h: number };
export type Key = { t: number; cx: number; cy: number; z: number; rx?: number; ry?: number };
export type Hop = { t: number; r: Rect };

export const outQuint = Easing.bezier(0.22, 1, 0.36, 1);
export const smooth = Easing.bezier(0.45, 0, 0.2, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------- claims masks: any on-screen count text is blurred out ----------
export const Mask: React.FC<{ r: Rect; pad?: number }> = ({ r, pad = 10 }) => (
  <div
    style={{
      position: 'absolute', left: r.x - pad, top: r.y - pad, width: r.w + pad * 2, height: r.h + pad * 2,
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', background: 'rgba(5,7,11,0.78)', borderRadius: 6,
    }}
  />
);

// A full capture at its CSS size (1920x1080 or 1080x1920) plus masks.
export const Screen: React.FC<{
  src?: string; video?: { src: string; rate: number; from: number }; W: number; H: number; masks?: Rect[];
}> = ({ src, video, W, H, masks = [] }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, background: BG }}>
    {video ? (
      <OffthreadVideo
        src={staticFile(video.src)} muted playbackRate={video.rate} startFrom={Math.round(video.from * FPS)}
        style={{ position: 'absolute', width: W, height: H }}
      />
    ) : (
      <Img src={staticFile(src!)} style={{ position: 'absolute', width: W, height: H }} />
    )}
    {masks.map((m, i) => <Mask key={i} r={m} />)}
  </div>
);

// ---------- camera over a capture; keys use t in [0,1] of the shot ----------
export const Cam: React.FC<{
  D: number; keys: Key[]; W?: number; H?: number; src?: string; video?: { src: string; rate: number; from: number };
  masks?: Rect[]; hops?: Hop[]; dim?: number; children?: React.ReactNode;
}> = ({ D, keys, W = 1920, H = 1080, src, video, masks, hops, dim = 0, children }) => {
  const f = useCurrentFrame();
  const t = Math.min(1, Math.max(0, f / Math.max(1, D - 1)));
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i].t && t <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
  const k = a.t === b.t ? 1 : smooth((t - a.t) / (b.t - a.t));
  const z = lerp(a.z, b.z, k);
  const clampc = (v: number, half: number, full: number) => Math.min(full - half / z, Math.max(half / z, v));
  const cx = clampc(lerp(a.cx, b.cx, k), W / 2, W), cy = clampc(lerp(a.cy, b.cy, k), H / 2, H);
  const rx = lerp(a.rx ?? 0, b.rx ?? 0, k), ry = lerp(a.ry ?? 0, b.ry ?? 0, k);
  // hop outline
  let hop: Rect | null = null; let hopA = 0;
  if (hops && hops.length) {
    let i = 0; while (i < hops.length - 1 && t >= hops[i + 1].t) i++;
    const cur = hops[i], prev = hops[Math.max(0, i - 1)];
    const local = interpolate(f, [cur.t * D, cur.t * D + 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outQuint });
    if (t >= hops[0].t) {
      const base = i === 0 ? cur.r : prev.r;
      hop = { x: lerp(base.x, cur.r.x, local), y: lerp(base.y, cur.r.y, local), w: lerp(base.w, cur.r.w, local), h: lerp(base.h, cur.r.h, local) };
      hopA = interpolate(f, [hops[0].t * D, hops[0].t * D + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    }
  }
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden', perspective: 2400 }}>
      <div
        style={{
          position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0',
          transform: `translate(${W / 2 - cx * z}px, ${H / 2 - cy * z}px) scale(${z})`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, transformOrigin: `${cx}px ${cy}px`, transform: `rotateX(${rx}deg) rotateY(${ry}deg)` }}>
          <Screen src={src} video={video} W={W} H={H} masks={masks} />
          {hop ? (
            <div
              style={{
                position: 'absolute', left: hop.x - 6, top: hop.y - 6, width: hop.w + 12, height: hop.h + 12, borderRadius: 16,
                border: `4px solid ${LIME}`, boxShadow: `0 0 28px ${LIME}88`, opacity: hopA,
              }}
            />
          ) : null}
          {children}
        </div>
      </div>
      {dim > 0 ? <AbsoluteFill style={{ background: `rgba(5,7,11,${dim})` }} /> : null}
    </AbsoluteFill>
  );
};

// ---------- brand mark (the app's own stack mark) ----------
export const StackMark: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ width: size, height: size, background: '#fff', borderRadius: size * 0.25, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 ${size * 0.1}px ${size * 0.3}px rgba(0,0,0,.5)` }}>
    <svg width={size * 0.75} height={size * 0.75} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="black" />
      <path d="M2 17L12 22L22 17" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12L12 17L22 12" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

// ---------- lower-third studio label ----------
export const Chip: React.FC<{ text: string; D: number; W?: number; H?: number }> = ({ text, D, W = 1920, H = 1080 }) => {
  const f = useCurrentFrame();
  const inn = interpolate(f, [bf(1), bf(1) + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outQuint });
  const out = interpolate(f, [D - 8, D - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const big = W < H ? 52 : 46;
  return (
    <div style={{ position: 'absolute', left: W < H ? 60 : 96, top: H - (W < H ? 290 : 150), opacity: inn * out, transform: `translateY(${(1 - inn) * 24}px)` }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 18, padding: '16px 30px', borderRadius: 999, background: 'rgba(5,7,11,.82)', border: `2px solid ${LIME}`, boxShadow: `0 0 30px ${LIME}44`, backdropFilter: 'blur(10px)' }}>
        <span style={{ width: 14, height: 14, borderRadius: 99, background: LIME }} />
        <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: big, color: '#fff', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{text}</span>
      </div>
    </div>
  );
};

// ---------- brand open: crosshair draw, wordmark letterpress, hold, lift ----------
export const Open: React.FC<{ D: number }> = ({ D }) => {
  const f = useCurrentFrame();
  const txt = 'smartvid.app';
  const draw = interpolate(f, [0, 16], [0, 1], { extrapolateRight: 'clamp', easing: smooth });
  const fadeCross = interpolate(f, [20, 34], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const lift = interpolate(f, [D - 14, D], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: BG, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', left: 960 - 520 * draw, top: 540, width: 1040 * draw, height: 2, background: LIME, opacity: fadeCross * 0.8 }} />
      <div style={{ position: 'absolute', top: 540 - 260 * draw, left: 960, height: 520 * draw, width: 2, background: LIME, opacity: fadeCross * 0.8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 36, transform: `translateY(${-lift * 40}px) scale(${1 - lift * 0.06})`, opacity: 1 - lift }}>
        <div style={{ opacity: interpolate(f, [10, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), transform: `scale(${interpolate(f, [10, 26], [1.5, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outQuint })})` }}>
          <StackMark size={132} />
        </div>
        <div style={{ display: 'flex' }}>
          {txt.split('').map((c, i) => {
            const s = 14 + i * 2;
            const p = interpolate(f, [s, s + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outQuint });
            return <span key={i} style={{ fontFamily: FONT, fontWeight: 900, fontSize: 150, letterSpacing: '-0.03em', color: c === '.' ? LIME : '#fff', opacity: p, transform: `scale(${1.5 - 0.5 * p})`, filter: `blur(${(1 - p) * 10}px)`, display: 'inline-block' }}>{c}</span>;
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- lockup: mark slams in on the beat, wordmark, >=1s hold ----------
export const Lockup: React.FC<{ D: number; sub?: string }> = ({ D, sub }) => {
  const f = useCurrentFrame();
  const slam = interpolate(f, [bf(2), bf(2) + 8], [2.2, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outQuint });
  const a = interpolate(f, [bf(2), bf(2) + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glow = interpolate(f, [bf(2), bf(2) + 20], [1, 0.25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const wm = interpolate(f, [bf(2) + 6, bf(2) + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outQuint });
  const dis = interpolate(f, [D - 10, D], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: BG, alignItems: 'center', justifyContent: 'center', opacity: dis }}>
      <div style={{ position: 'absolute', width: 1100, height: 1100, borderRadius: 999, background: `radial-gradient(circle, ${LIME}${Math.round(glow * 60).toString(16).padStart(2, '0')} 0%, transparent 62%)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <div style={{ opacity: a, transform: `scale(${slam})` }}><StackMark size={132} /></div>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 150, letterSpacing: '-0.03em', color: '#fff', opacity: wm, transform: `translateX(${(1 - wm) * 30}px)` }}>
          smartvid<span style={{ color: LIME }}>.app</span>
        </div>
      </div>
      {sub ? <div style={{ position: 'absolute', top: 700, fontFamily: FONT, fontWeight: 700, fontSize: 40, color: '#fff9', opacity: wm }}>{sub}</div> : null}
    </AbsoluteFill>
  );
};

// ---------- vertical lockup (9:16) ----------
export const LockupV: React.FC<{ D: number }> = ({ D }) => {
  const f = useCurrentFrame();
  const slam = interpolate(f, [bf(3), bf(3) + 8], [2.2, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outQuint });
  const a = interpolate(f, [bf(3), bf(3) + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const wm = interpolate(f, [bf(3) + 6, bf(3) + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outQuint });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', background: `rgba(5,7,11,${interpolate(f, [bf(2), bf(3)], [0, 0.95], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})` }}>
      <div style={{ opacity: a, transform: `scale(${slam})` }}><StackMark size={200} /></div>
      <div style={{ marginTop: 50, fontFamily: FONT, fontWeight: 900, fontSize: 112, letterSpacing: '-0.03em', color: '#fff', opacity: wm }}>
        smartvid<span style={{ color: LIME }}>.app</span>
      </div>
    </AbsoluteFill>
  );
};

// ---------- breathing title card ----------
export const TitleCard: React.FC<{ D: number; words: string[]; accent: number[] }> = ({ D, words, accent }) => {
  const f = useCurrentFrame();
  const out = interpolate(f, [D - 6, D - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: BG, alignItems: 'center', justifyContent: 'center', opacity: out }}>
      <div style={{ display: 'flex', gap: 40 }}>
        {words.map((w, i) => {
          const p = interpolate(f, [i * 5, i * 5 + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: outQuint });
          return <span key={i} style={{ fontFamily: FONT, fontWeight: 900, fontSize: 150, letterSpacing: '-0.03em', color: accent.includes(i) ? LIME : '#fff', opacity: p, transform: `translateY(${(1 - p) * 60}px)` }}>{w}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- spotlight: dark room, light finds a target rect, outline traces it ----------
export const Spotlight: React.FC<{ D: number; target: Rect; W?: number; H?: number }> = ({ D, target, W = 1920, H = 1080 }) => {
  const f = useCurrentFrame();
  const lock = interpolate(f, [bf(1), bf(3)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: smooth });
  const cx = lerp(W * 0.2, target.x + target.w / 2, lock), cy = lerp(H * 0.2, target.y + target.h / 2, lock);
  const rx = lerp(W * 0.5, target.w * 0.62, lock), ry = lerp(H * 0.4, target.h * 1.1, lock);
  const dark = interpolate(f, [0, 8], [0.4, 0.72], { extrapolateRight: 'clamp' });
  const trace = interpolate(f, [bf(3), bf(5)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: smooth });
  const rel = interpolate(f, [D - bf(1), D - 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const per = 2 * (target.w + target.h);
  return (
    <>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, rgba(5,7,11,0) 0%, rgba(5,7,11,${dark * (1 - rel)}) 100%)` }} />
      <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
        <rect x={target.x} y={target.y} width={target.w} height={target.h} rx={22} fill="none" stroke={LIME} strokeWidth={4}
          strokeDasharray={per} strokeDashoffset={per * (1 - trace)} style={{ filter: `drop-shadow(0 0 14px ${LIME})` }} opacity={1 - rel} />
      </svg>
    </>
  );
};

// ---------- wall reveal: cells light up as a wave on the beats ----------
export const WallCells: React.FC<{ D: number; cols?: number; rows?: number; W?: number; H?: number }> = ({ D, cols = 16, rows = 9, W = 1920, H = 1080 }) => {
  const f = useCurrentFrame();
  const cw = W / cols, ch = H / rows;
  const span = D * 0.7;
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const start = bf(1) + ((c + r * 0.6) / (cols + rows * 0.6)) * span;
    const o = interpolate(f, [start, start + 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const edge = interpolate(f, [start, start + 5, start + 12], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    cells.push(<div key={`${r}-${c}`} style={{ position: 'absolute', left: c * cw, top: r * ch, width: cw + 1, height: ch + 1, background: `rgba(5,7,11,${0.97 * o})`, boxShadow: edge > 0.02 ? `inset 0 0 0 1px ${LIME}${Math.round(edge * 110).toString(16).padStart(2, '0')}` : undefined }} />);
  }
  return <AbsoluteFill>{cells}</AbsoluteFill>;
};

// ---------- light sweep ----------
export const LightSweep: React.FC<{ D: number; beats: number[]; W?: number; H?: number }> = ({ D, beats, W = 1920, H = 1080 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen', pointerEvents: 'none' }}>
      {beats.map((b, i) => {
        const p = interpolate(f, [bf(b), bf(b) + 26], [-0.3, 1.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: smooth });
        return <div key={i} style={{ position: 'absolute', top: -H * 0.2, height: H * 1.4, width: W * 0.22, left: p * W, background: `linear-gradient(100deg, transparent, ${LIME}55, transparent)`, transform: 'skewX(-18deg)', filter: 'blur(10px)' }} />;
      })}
    </AbsoluteFill>
  );
};

// ---------- sfx + bgm ----------
export type Sfx = { f: number; src: string; vol?: number };
export const Sound: React.FC<{ sfx: Sfx[]; bgm: boolean; total: number }> = ({ sfx, bgm, total }) => (
  <>
    {bgm ? (
      <Audio src={staticFile('audio/bgm.mp3')} startFrom={3} volume={(fr) => 0.5 * interpolate(fr, [total - 24, total - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
    ) : null}
    {sfx.map((s, i) => (
      <Sequence key={i} from={Math.max(0, s.f)}>
        <Audio src={staticFile(`audio/${s.src}.mp3`)} volume={s.vol ?? 0.6} />
      </Sequence>
    ))}
  </>
);
