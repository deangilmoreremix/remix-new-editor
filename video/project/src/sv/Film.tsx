import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { BGM_START_S, C, bf } from './tokens';

export type Shot = { beats: number; el: React.ReactNode };
export const totalBeats = (shots: Shot[]) => shots.reduce((a, s) => a + s.beats, 0);
export const totalFrames = (shots: Shot[]) => bf(totalBeats(shots));

const Flash: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 2, 8], [0, 0.22, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: C.accent, opacity: o, mixBlendMode: 'screen', pointerEvents: 'none' }} />;
};

/** Cuts land on the beat grid; SFX pinned to every cut; BGM trimmed so frame 0 = a fitted beat. */
export const Film: React.FC<{ shots: Shot[]; sfx?: boolean; lockupLast?: boolean; bgm?: boolean }> = ({ shots, sfx = true, lockupLast = false, bgm = true }) => {
  const frame = useCurrentFrame();
  const total = totalFrames(shots);
  let acc = 0;
  const seqs = shots.map((s, i) => {
    const from = bf(acc);
    const dur = bf(acc + s.beats) - from;
    acc += s.beats;
    return { from, dur, i, el: s.el };
  });
  const vol = interpolate(frame, [0, 10, total - 30, total], [0, 0.85, 0.85, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {seqs.map((s) => (
        <Sequence key={s.i} from={s.from} durationInFrames={s.dur}>
          <AbsoluteFill>{s.el}</AbsoluteFill>
          {s.i > 0 && <Flash />}
        </Sequence>
      ))}
      {bgm && <Audio src={staticFile('audio/bgm-tech-house.mp3')} startFrom={Math.round(BGM_START_S * 30)} volume={() => vol} />}
      {sfx &&
        seqs.slice(1).map((s) => (
          <Sequence key={'sfx' + s.i} from={Math.max(0, s.from - 2)}>
            <Audio src={staticFile(lockupLast && s.i === seqs.length - 1 ? 'audio/impact-cine.mp3' : 'audio/transition-snap.mp3')} volume={0.45} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};
