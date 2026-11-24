import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion';
import { WallShot } from './shots/WallShot';
import { HubShot } from './shots/HubShot';
import { BacklotShot } from './shots/BacklotShot';
import { TiltShot } from './shots/TiltShot';
import { AgentShot } from './shots/AgentShot';
import { DealShot } from './shots/DealShot';
import { QuadShot } from './shots/QuadShot';
import layout from './live-layout.json';
import { BGM_START_FRAME } from './timeline';
import { ENGINES, EngineId, V3_SFX } from './timeline3';

export const BGM_VOLUME3 = 0.22; // lowered from 0.30 so the SFX stay clearly above the music (independent review)
const T = (id: EngineId, pos: 'tl' | 'bc') => ({ ...ENGINES[id], pos });
const tplFiles = layout['cinema-template'].cutouts.filter((c) => c.w < 500 && c.w > 380).slice(0, 9).map((c) => c.file);

const Shot: React.FC<{ id: EngineId }> = ({ id }) => {
  switch (id) {
    case 'create':
      return <WallShot title={T('create', 'tl')} studios={[
        { name: 'Image Studio', tex: 'image' }, { name: 'Video Studio', tex: 'video-empty' }, { name: 'Cinema Studio', tex: 'cinema' },
        { name: 'Character Studio', tex: 'character' }, { name: 'AI Influencer', tex: 'influencer' }, { name: 'Product Shot Studio', tex: 'commercial' },
      ]} dy={74} region={{ right: 1880, y: 82, h: 258 }} />;
    case 'enhance':
      return <HubShot pick={[1, 2, 10, 11]} pillNames={['Upscale Suite', 'Effects Studio', 'Edit Studio', 'AI VFX Studio']} title={T('enhance', 'tl')} />; // Edit, Upscale, Effects, AI VFX (hero)
    case 'produce':
      // the five apps the Produce card lists that have real hub cards (Storyboard, Director, Timeline Editor, Video Tools, Audio): hub order 9, 18, 19, 14, 16
      return <HubShot pick={[9, 18, 19, 14, 16]} pillNames={['Storyboard Studio', 'Audio Studio', 'Timeline Editor', 'Director']} title={T('produce', 'tl')} />;
    case 'localize':
      return <QuadShot pill={false} title={T('localize', 'tl')} cells={[
        { tex: 'lipsync', right: 1880, name: 'Lip Sync Studio', desc: 'Animate portraits or sync lips to audio', pop: 6, descAt: 11, pulse: 44 },
        { tex: 'avatar', right: 1880, name: 'Avatar Studio', desc: 'AI avatars and lip sync video', pop: 14, descAt: 19, pulse: 50, whip: 30 },
        { tex: 'videotools', right: 1880, name: 'Video Tools', desc: 'Upscale, edit, translate, and enhance videos', pop: 22, descAt: 27, pulse: 56 },
        { tex: 'audio', right: 1880, name: 'Audio Studio', desc: 'Generate music, speech, and sound effects', pop: 30, descAt: 35, pulse: 62 },
      ]} />;
    case 'automate':
      return <AgentShot title={T('automate', 'bc')} />;
    case 'scale':
      return <DealShot files={tplFiles} chip="TEMPLATE PREVIEWS" title={T('scale', 'tl')} shiftX={170} />;
  }
};

export const V3Clip: React.FC<{ id: EngineId; bgm: boolean }> = ({ id, bgm }) => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: '#050505' }}>
      <Shot id={id} />
      {bgm && <Audio src={staticFile('audio/bgm.mp3')} startFrom={BGM_START_FRAME} volume={(f) => BGM_VOLUME3 * interpolate(f, [0, 10, durationInFrames - 24, durationInFrames - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />}
      {V3_SFX[id].map((s, i) => <Sequence key={i} from={s.from} durationInFrames={s.durationInFrames ?? 90}><Audio src={staticFile(`audio/sfx/${s.src}`)} volume={s.volume} /></Sequence>)}
    </AbsoluteFill>
  );
};
