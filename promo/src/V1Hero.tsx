import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion';
import { BrandOpen } from './shots/BrandOpen';
import { LockupShot } from './shots/LockupShot';
import { PromptShot } from './shots/PromptShot';
import { WallShot } from './shots/WallShot';
import { BGM_START_FRAME, SFX, SHOTS, V1_TOTAL, dur } from './timeline';

export type V1Props = { bgm: boolean };
export const BGM_VOLUME = 0.30;

export const V1Hero: React.FC<V1Props> = ({ bgm }) => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: '#050505' }}>
      <Sequence from={SHOTS.open.from} durationInFrames={dur(SHOTS.open)}><BrandOpen /></Sequence>
      <Sequence from={SHOTS.prompt.from} durationInFrames={dur(SHOTS.prompt)}><PromptShot /></Sequence>
      <Sequence from={SHOTS.wall.from} durationInFrames={dur(SHOTS.wall)}><WallShot /></Sequence>
      <Sequence from={SHOTS.lockup.from} durationInFrames={dur(SHOTS.lockup)}><LockupShot /></Sequence>
      {bgm && (
        <Audio
          src={staticFile('audio/bgm.mp3')}
          startFrom={BGM_START_FRAME}
          volume={(f) => BGM_VOLUME * interpolate(f, [0, 12, durationInFrames - 30, durationInFrames - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
        />
      )}
      {SFX.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.durationInFrames ?? 120}>
          <Audio src={staticFile(`audio/sfx/${s.src}`)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
export { V1_TOTAL };
