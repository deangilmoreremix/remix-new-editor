import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';
import { Title } from './Title';
import { C } from './tokens';

/** A real Playwright screen recording of one studio (safe interactions only, nothing generated), with its name as the caption. */
export const StudioClip: React.FC<{ slug: string; name: string }> = ({ slug, name }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    <OffthreadVideo src={staticFile(`studio/${slug}.mp4`)} muted style={{ width: 1920, height: 1080 }} />
    <Title text={name} inB={0.3} />
  </AbsoluteFill>
);
