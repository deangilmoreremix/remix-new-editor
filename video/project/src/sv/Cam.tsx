import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { bf, C } from './tokens';

export type Key = { b: number; cx: number; cy: number; z: number };
export type Box = { x: number; y: number; w: number; h: number };

const ease = Easing.bezier(0.33, 0, 0.15, 1);

/** 2D camera over a 1920x1080 real capture (still or recorded video). (cx,cy) = source px at window centre, z = scale. */
export const Cam: React.FC<{
  src: string;
  video?: boolean;
  videoStartS?: number;
  keys: Key[];
  box?: Box; // clip window on the canvas (defaults to full canvas)
}> = ({ src, video, videoStartS = 0, keys, box }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const bx = box ?? { x: 0, y: 0, w: width, h: height };
  const fr = keys.map((k) => bf(k.b));
  const cx = interpolate(f, fr, keys.map((k) => k.cx), { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cy = interpolate(f, fr, keys.map((k) => k.cy), { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const z = interpolate(f, fr, keys.map((k) => k.z), { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tf = `translate(${bx.w / 2 - cx * z}px, ${bx.h / 2 - cy * z}px) scale(${z})`;
  const media = video ? (
    <OffthreadVideo src={staticFile(src)} startFrom={Math.round(videoStartS * 30)} muted style={{ width: 1920, height: 1080 }} />
  ) : (
    <Img src={staticFile(src)} style={{ width: 1920, height: 1080 }} />
  );
  return (
    <div style={{ position: 'absolute', left: bx.x, top: bx.y, width: bx.w, height: bx.h, overflow: 'hidden', background: C.bg, borderRadius: box ? 22 : 0 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', transform: tf }}>{media}</div>
      {box && <div style={{ position: 'absolute', inset: 0, borderRadius: 22, boxShadow: `inset 0 0 0 1.5px rgba(217,255,0,0.35)` }} />}
    </div>
  );
};
