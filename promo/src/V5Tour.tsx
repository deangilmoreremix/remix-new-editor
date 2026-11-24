// V5 Guided tour: ONE long demo. Each studio = title card + a REAL screen recording of the real SmartVideo UI (scripts/record-tour.mjs, ?dev, no keys, nothing generated)
// with a virtual camera that follows the cursor, numbered step captions from scripts/tour-steps.mjs and the recorded click ripples.
// Honest by construction: no result is shown as generated; the final caption of each studio says what the real button does, the button is only hovered, never pressed.
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import data from './tour-data.json';
import { EASE, ramp } from './lib/polish';
import { INTER, T, AppMark } from './lib/tokens';
import { BGM_START_FRAME } from './timeline';

const FPS = 30;
const TITLE_F = 54;
export const TOUR_ORDER = ['video','image','cinema','character','commercial','avatar','lipsync','upscale','edit','storyboard','templates','audio','videotools','effects'] as string[];
type Step = { t: number; say: string; sub: string };
type Rec = { key: string; title: string; blurb: string; steps: Step[]; track: number[][]; duration: number };
const REC = data as unknown as Record<string, Rec>;
export const segFrames = (k: string) => TITLE_F + Math.round(REC[k].duration * FPS);
export const tourTotal = (keys: string[]) => keys.reduce((a, k) => a + segFrames(k), 0);

const ZOOM = 1.4;
const camAt = (track: number[][], t: number) => {
  // smoothed cursor position: average of samples within +-0.7s, so the camera glides instead of jittering
  let sx = 0, sy = 0, n = 0;
  for (const [tt, x, y] of track) if (Math.abs(tt - t) <= 0.7) { sx += x; sy += y; n++; }
  if (!n) return [960, 420];
  return [sx / n, sy / n];
};

const Segment: React.FC<{ k: string; index: number; total: number }> = ({ k, index, total }) => {
  const f = useCurrentFrame();
  const r = REC[k];
  const lf = f - TITLE_F;
  const t = Math.max(0, lf) / FPS;
  const [cx, cy] = camAt(r.track, t);
  const vw = 1920 / ZOOM, vh = 1080 / ZOOM;
  const ox = Math.min(1920 - vw, Math.max(0, cx - vw / 2));
  const oy = Math.min(1080 - vh, Math.max(0, cy - vh / 2 - 40));
  const zoomIn = ramp(lf, 0, 20, EASE.out);
  const scale = 1 + (ZOOM - 1) * zoomIn;
  const tx = -ox * ZOOM * zoomIn, ty = -oy * ZOOM * zoomIn;
  const stepIdx = r.steps.reduce((a, s, i) => (t >= s.t - 0.2 ? i : a), 0);
  const step = r.steps[stepIdx];
  const stepStartF = Math.round(step.t * FPS);
  const cap = ramp(lf - stepStartF, 0, 14, EASE.out);
  const titleOut = 1 - ramp(f, TITLE_F - 14, 14, EASE.smooth);
  const t1 = ramp(f, 4, 18, EASE.out), t2 = ramp(f, 12, 18, EASE.out);
  return (
    <AbsoluteFill style={{ background: T.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: ramp(f, TITLE_F - 8, 10, EASE.out), transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
        <OffthreadVideo src={staticFile(`tour/${k}.mp4`)} startFrom={0} muted style={{ width: 1920, height: 1080 }} />
      </AbsoluteFill>
      {lf >= 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 44, display: 'flex', justifyContent: 'center', opacity: cap, transform: `translateY(${(1 - cap) * 24}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '20px 40px', borderRadius: 24, background: 'rgba(5,5,5,0.92)', border: '1px solid rgba(255,255,255,0.16)', fontFamily: INTER, maxWidth: 1700 }}>
            <div style={{ width: 84, height: 84, borderRadius: 42, background: T.accent, color: '#050505', fontSize: 44, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{stepIdx + 1}</div>
            <div>
              <div style={{ fontSize: 58, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.08 }}>{step.say}</div>
              {step.sub ? <div style={{ fontSize: 34, fontWeight: 500, color: T.secondary, marginTop: 6 }}>{step.sub}</div> : null}
            </div>
          </div>
        </div>
      )}
      {lf >= 0 && (
        <div style={{ position: 'absolute', left: 36, top: 30, display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', borderRadius: 40, background: 'rgba(5,5,5,0.88)', border: '1px solid rgba(255,255,255,0.14)', fontFamily: INTER, fontSize: 34, fontWeight: 700, color: '#fff' }}>
          <span style={{ color: T.accent }}>{r.title}</span><span style={{ color: T.secondary, fontWeight: 500 }}>{index + 1} / {total}</span>
        </div>
      )}
      {f < TITLE_F && (
        <AbsoluteFill style={{ background: T.bg, opacity: titleOut, alignItems: 'center', justifyContent: 'center', fontFamily: INTER, textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: 70, left: 90 }}><AppMark size={72} /></div>
          <div style={{ fontSize: 40, fontWeight: 600, color: T.secondary, opacity: t2, letterSpacing: '0.12em' }}>STUDIO {index + 1} OF {total}</div>
          <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: '-0.03em', color: T.accent, opacity: t1, transform: `translateY(${(1 - t1) * 30}px)` }}>{r.title}</div>
          <div style={{ fontSize: 44, fontWeight: 500, color: '#fff', opacity: t2 }}>{r.blurb}</div>
          <div style={{ marginTop: 30, fontSize: 32, fontWeight: 500, color: T.secondary, opacity: t2 }}>Real app walkthrough. Nothing is generated here.</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const V5Tour: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const { durationInFrames } = useVideoConfig();
  let at = 0;
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      {TOUR_ORDER.map((k, i) => {
        const from = at; const d = segFrames(k); at += d;
        return <Sequence key={k} from={from} durationInFrames={d}><Segment k={k} index={i} total={TOUR_ORDER.length} /></Sequence>;
      })}
      {bgm && <Audio src={staticFile('audio/bgm.mp3')} startFrom={BGM_START_FRAME} loop volume={(f) => 0.16 * interpolate(f, [0, 20, durationInFrames - 45, durationInFrames - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />}
    </AbsoluteFill>
  );
};
