import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion';
import { BrandOpen } from './shots/BrandOpen';
import { LockupShot } from './shots/LockupShot';
import { CursorTour } from './shots/CursorTour';
import { HubShot } from './shots/HubShot';
import { ZoomShot } from './shots/ZoomShot';
import { TiltShot } from './shots/TiltShot';
import { BacklotShot } from './shots/BacklotShot';
import { DealShot } from './shots/DealShot';
import { QuadShot } from './shots/QuadShot';
import { CarouselShot } from './shots/CarouselShot';
import { BGM_START_FRAME } from './timeline';
import { V2_SFX, V2_SHOTS as S, V2_TOTAL } from './timeline2';

export const BGM_VOLUME2 = 0.3;
const dur = (s: { from: number; to: number }) => s.to - s.from;
export const V2Feature: React.FC<{ bgm: boolean }> = ({ bgm }) => {
  const { durationInFrames } = useVideoConfig();
  const seq = (s: { from: number; to: number }, C: React.FC) => <Sequence from={s.from} durationInFrames={dur(s)}><C /></Sequence>;
  return (
    <AbsoluteFill style={{ background: '#050505' }}>
      {seq(S.open, BrandOpen)}{seq(S.tour, CursorTour)}{seq(S.hub, HubShot)}{seq(S.zoom, ZoomShot)}{seq(S.tilt, TiltShot)}
      {seq(S.backlot, BacklotShot)}{seq(S.deal, DealShot)}{seq(S.quad, QuadShot)}{seq(S.carousel, CarouselShot)}{seq(S.lockup, LockupShot)}
      {bgm && <Audio src={staticFile('audio/bgm.mp3')} startFrom={BGM_START_FRAME} volume={(f) => BGM_VOLUME2 * interpolate(f, [0, 12, durationInFrames - 30, durationInFrames - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />}
      {V2_SFX.map((s, i) => <Sequence key={i} from={s.from} durationInFrames={s.durationInFrames ?? 120}><Audio src={staticFile(`audio/sfx/${s.src}`)} volume={s.volume} /></Sequence>)}
    </AbsoluteFill>
  );
};
export { V2_TOTAL };
