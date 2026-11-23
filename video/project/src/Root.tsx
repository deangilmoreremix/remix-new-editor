import React from 'react';
import { Composition } from 'remotion';
import { CLIPS, Film, HERO, Item, REEL, SOCIAL, totalFrames } from './sv/Film';

type P = { bgm: boolean };
const mk = (items: Item[]): React.FC<P> => ({ bgm }) => <Film items={items} bgm={bgm} />;

export const Root: React.FC = () => (
  <>
    <Composition id="HeroLoop" component={mk(HERO)} defaultProps={{ bgm: true }} durationInFrames={totalFrames(HERO)} fps={30} width={1920} height={1080} />
    <Composition id="FeatureReel" component={mk(REEL)} defaultProps={{ bgm: true }} durationInFrames={totalFrames(REEL)} fps={30} width={1920} height={1080} />
    <Composition id="Social" component={mk(SOCIAL.concat([]))} defaultProps={{ bgm: true }} durationInFrames={totalFrames(SOCIAL)} fps={30} width={1080} height={1920} />
    {CLIPS.map((c) => (
      <Composition key={c.id} id={c.id} component={mk([c.item])} defaultProps={{ bgm: false }} durationInFrames={totalFrames([c.item])} fps={30} width={1920} height={1080} />
    ))}
  </>
);
