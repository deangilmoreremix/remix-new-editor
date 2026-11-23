import { Composition } from 'remotion';
import { Film, totalFrames } from './sv/Film';
import { CLIPS, heroA, reelB, socialD } from './sv/Shots';
import { FPS } from './sv/tokens';
import { STUDIO_CLIPS } from './sv/studio-clips';
import { StudioClip } from './sv/StudioClip';

const Hero: React.FC = () => <Film shots={heroA()} lockupLast />;
const Reel: React.FC = () => <Film shots={reelB()} lockupLast />;
const Social: React.FC = () => <Film shots={socialD()} lockupLast />;

export const Root: React.FC = () => (
  <>
    <Composition id="A-hero-loop" component={Hero} durationInFrames={totalFrames(heroA())} fps={FPS} width={1920} height={1080} />
    <Composition id="B-feature-reel" component={Reel} durationInFrames={totalFrames(reelB())} fps={FPS} width={1920} height={1080} />
    {CLIPS.map((c) => {
      const Comp: React.FC = () => <Film shots={c.shots()} sfx={false} bgm={false} />;
      return <Composition key={c.id} id={c.id} component={Comp} durationInFrames={totalFrames(c.shots())} fps={FPS} width={1920} height={1080} />;
    })}
    {STUDIO_CLIPS.map((c) => {
      const Comp: React.FC = () => <StudioClip slug={c.slug} name={c.name} />;
      return <Composition key={c.slug} id={'S-' + c.slug} component={Comp} durationInFrames={c.frames} fps={FPS} width={1920} height={1080} />;
    })}
    <Composition id="D-social-9x16" component={Social} durationInFrames={totalFrames(socialD())} fps={FPS} width={1080} height={1920} />
  </>
);
