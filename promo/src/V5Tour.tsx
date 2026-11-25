// V5 Guided tour: ONE long demo. Each studio = title card + a REAL screen recording of the real SmartVideo UI (scripts/record-tour.mjs, ?dev, no keys, nothing generated)
// with a virtual camera that follows the cursor, numbered step captions from scripts/tour-steps.mjs and the recorded click ripples.
// Honest by construction: no result is shown as generated; the final caption of each studio says what the real button does, the button is only hovered, never pressed.
import React from 'react';
import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import data from './tour-data.json';
import { EASE, ramp } from './lib/polish';
import { INTER, T, AppMark } from './lib/tokens';
import { BGM_START_FRAME, OUTPUT_AUDIO_OFFSET_F, SFX as V1_SFX, SHOTS as V1_SHOTS, beatF } from './timeline';
import { BrandOpen } from './shots/BrandOpen';
import { LockupShot } from './shots/LockupShot';

const FPS = 30;
const OPEN_F = beatF(8), LOCKUP_F = beatF(12), TITLE_F = beatF(4); // shot-card open / lockup lengths from V1; every studio cut lands on a beat of the 122 BPM grid
export const TOUR_ORDER = ['video','image','cinema','character','commercial','avatar','lipsync','upscale','edit','storyboard','templates','audio','videotools','effects'] as string[];
type Step = { t: number; say: string; sub: string };
type Rec = { key: string; title: string; blurb: string; steps: Step[]; track: number[][]; duration: number; events: { t: number; kind: string; dur?: number }[] };
const REC = data as unknown as Record<string, Rec>;
const recFrames = (k: string) => Math.round(REC[k].duration * FPS);
// recording is padded (last frame held) up to a whole number of beats so the next cut lands on the beat
export const segFrames = (k: string) => TITLE_F + beatF(Math.ceil(recFrames(k) / beatF(1)));
export const tourTotal = (keys: string[]) => OPEN_F + keys.reduce((a, k) => a + segFrames(k), 0) + LOCKUP_F;

const ZOOM = 1.4;
const camAt = (track: number[][], t: number) => {
  // smoothed cursor position: average of samples within +-0.7s, so the camera glides instead of jittering
  let sx = 0, sy = 0, n = 0;
  for (const [tt, x, y] of track) if (Math.abs(tt - t) <= 0.7) { sx += x; sy += y; n++; }
  if (!n) return [960, 420];
  return [sx / n, sy / n];
};

const Segment: React.FC<{ k: string; index: number; total: number; len: number }> = ({ k, index, total, len: segLen }) => {
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
  // crash-zoom-punch exit (recipe: crash-zoom-punch): last 6f push 1 -> 1.12 with a short blur, hard cut on the beat
  const punch = ramp(f, segLen - 6, 6, EASE.snappy);
  const rf = recFrames(k);
  const t1 = ramp(f, 4, 18, EASE.out), t2 = ramp(f, 12, 18, EASE.out);
  return (
    <AbsoluteFill style={{ background: T.bg, overflow: 'hidden', transform: `scale(${1 + 0.12 * punch})`, filter: punch > 0.05 ? `blur(${(punch * 5).toFixed(2)}px)` : undefined }}>
      <AbsoluteFill style={{ opacity: ramp(f, TITLE_F - 8, 10, EASE.out), transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
        {lf >= rf - 1 ? <Freeze frame={Math.max(0, rf - 2)}><OffthreadVideo src={staticFile(`tour/${k}.mp4`)} muted style={{ width: 1920, height: 1080 }} /></Freeze> : <OffthreadVideo src={staticFile(`tour/${k}.mp4`)} muted style={{ width: 1920, height: 1080 }} />}
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
          <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: '-0.03em', color: T.accent, opacity: t1, transform: `translateY(${(1 - t1) * 30}px) scale(${1 + 0.08 * (1 - ramp(f, 4, 10, EASE.snappy))})` }}>{r.title}</div>
          <div style={{ fontSize: 44, fontWeight: 500, color: '#fff', opacity: t2 }}>{r.blurb}</div>
          <div style={{ marginTop: 30, fontSize: 32, fontWeight: 500, color: T.secondary, opacity: t2 }}>Real app walkthrough. Nothing is generated here.</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

const KEY_PEAK = 0, CLICK_PEAK = 5.8, SWOOSH_PEAK = 10.1; // peaks measured in analysis/sfx_peaks.json
const sf = (peakTarget: number, lag: number) => Math.max(0, Math.round(peakTarget - lag - OUTPUT_AUDIO_OFFSET_F));

export const V5Tour: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const { durationInFrames } = useVideoConfig();
  const sfx: { from: number; src: string; volume: number; dur: number }[] = [];
  const segs: { k: string; from: number; d: number }[] = [];
  let at = OPEN_F;
  // open (brand-ink-open): reuse V1's wordmark cue
  sfx.push({ from: V1_SFX[0].from, src: V1_SFX[0].src, volume: V1_SFX[0].volume, dur: 120 });
  for (const k of TOUR_ORDER) {
    const d = segFrames(k);
    segs.push({ k, from: at, d });
    sfx.push({ from: sf(at + 6, SWOOSH_PEAK), src: 'swoosh-quick.mp3', volume: 0.5, dur: 60 }); // title card lands
    for (const e of REC[k].events) {
      const abs = at + TITLE_F + Math.round(e.t * FPS);
      if (e.kind === 'click') sfx.push({ from: sf(abs, CLICK_PEAK), src: 'click-camera.mp3', volume: 0.35, dur: 40 });
      if (e.kind === 'type' && (e as { dur?: number }).dur) sfx.push({ from: sf(abs, KEY_PEAK), src: 'keyboard.mp3', volume: 0.5, dur: Math.min(90, Math.round(((e as { dur: number }).dur) * FPS)) });
    }
    at += d;
  }
  // lockup (logo-shrink-wordmark-lockup): V1's riser / impact / sparkle cues, shifted to this lockup's start
  for (const s2 of V1_SFX.slice(4)) sfx.push({ from: s2.from - V1_SHOTS.lockup.from + at, src: s2.src, volume: s2.volume, dur: s2.durationInFrames ?? 120 });
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <Sequence from={0} durationInFrames={OPEN_F}><BrandOpen /></Sequence>
      {segs.map(({ k, from, d }, i) => <Sequence key={k} from={from} durationInFrames={d}><Segment k={k} index={i} total={TOUR_ORDER.length} len={d} /></Sequence>)}
      <Sequence from={at} durationInFrames={LOCKUP_F}><LockupShot /></Sequence>
      {bgm && <Audio src={staticFile('audio/bgm.mp3')} startFrom={BGM_START_FRAME} endAt={BGM_START_FRAME + beatF(210)} loop volume={(f) => 0.2 * interpolate(f, [0, 12, durationInFrames - 30, durationInFrames - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />}
      {sfx.map((x, i) => <Sequence key={i} from={x.from} durationInFrames={x.dur}><Audio src={staticFile(`audio/sfx/${x.src}`)} volume={x.volume} /></Sequence>)}
    </AbsoluteFill>
  );
};
