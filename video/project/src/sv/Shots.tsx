import { Cam, Key } from './Cam';
import { Title } from './Title';
import { Lockup } from './Lockup';
import { Shot } from './Film';
import { C, FONT } from './tokens';

const S = (n: string) => `s/${n}.png`;
const push = (b: number, a: [number, number, number], z: [number, number, number]): Key[] => [
  { b: 0, cx: a[0], cy: a[1], z: a[2] },
  { b, cx: z[0], cy: z[1], z: z[2] },
];

/** 16:9 shot: real capture + camera move + optional caption. */
export const shot = (beats: number, src: string, keys: Key[], title?: string, inB = 1, opts: { video?: boolean; videoStartS?: number } = {}): Shot => ({
  beats,
  el: (
    <>
      <Cam src={src} keys={keys} video={opts.video} videoStartS={opts.videoStartS} />
      {title && <Title text={title} inB={inB} />}
    </>
  ),
});
const still = (beats: number, n: string, from: [number, number, number], to: [number, number, number], title?: string, inB = 1) => shot(beats, S(n), push(beats, from, to), title, inB);
export const lockup = (beats: number, scale = 1): Shot => ({ beats, el: <Lockup scale={scale} /> });

/** 9:16 shot: sharp 1:1 window onto the capture at native scale, caption on top. */
const WIN = { x: 0, y: 420, w: 1080, h: 1080 };
export const vshot = (beats: number, src: string, keys: Key[], title: string, opts: { video?: boolean; videoStartS?: number } = {}): Shot => ({
  beats,
  el: (
    <>
      <Cam src={src} keys={keys} box={WIN} video={opts.video} videoStartS={opts.videoStartS} />
      <Title text={title} inB={0.5} pos="top" size={88} top={170} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1560, textAlign: 'center', fontFamily: FONT, fontSize: 40, color: C.muted, letterSpacing: 1 }}>
        smartvid<span style={{ color: C.accent }}>.app</span>
      </div>
    </>
  ),
});
const vstill = (beats: number, n: string, from: [number, number, number], to: [number, number, number], title: string) => vshot(beats, S(n), push(beats, from, to), title);

const typing = (beats: number, title: string, inB = 5) =>
  shot(beats, 'c/typing.mp4', [{ b: 0, cx: 960, cy: 540, z: 1 }, { b: 4, cx: 1150, cy: 440, z: 1.35 }, { b: beats, cx: 1150, cy: 440, z: 1.35 }], title, inB, { video: true });
const picker = (beats: number, title: string) =>
  shot(beats, 'c/picker.mp4', [{ b: 0, cx: 960, cy: 540, z: 1 }, { b: 3, cx: 420, cy: 300, z: 1.5 }, { b: beats, cx: 420, cy: 300, z: 1.5 }], title, 3, { video: true });

export const heroA = (): Shot[] => [
  typing(12, 'Describe it.'),
  still(4, 'hub-0', [960, 540, 1], [960, 570, 1.08]),
  still(4, 'hub-1', [960, 540, 1], [960, 600, 1.1]),
  picker(8, 'Pick your model.'),
  lockup(8),
];

export const reelB = (): Shot[] => [
  still(6, 'image-typed', [960, 540, 1], [1150, 430, 1.3], 'Images, tuned.'),
  still(6, 'image-advanced', [960, 540, 1], [960, 700, 1.15]),
  still(4, 'cinema-top', [960, 540, 1], [960, 520, 1.1], 'Real camera. Real lenses.'),
  still(10, 'cinema-builder', [960, 540, 1], [960, 640, 1.2]),
  still(8, 'director-0', [960, 540, 1], [960, 600, 1.2], 'Direct the scene.'),
  still(8, 'edit-0', [960, 540, 1], [700, 760, 1.35], 'Before. After.'),
  still(8, 'edit-1', [960, 540, 1], [1200, 700, 1.25]),
  still(6, 'character-0', [960, 540, 1], [960, 600, 1.15], 'Characters.'),
  still(6, 'character-1', [960, 540, 1], [960, 640, 1.12]),
  still(6, 'avatar-0', [960, 540, 1], [960, 600, 1.15], 'Faces that talk.'),
  still(6, 'lipsync-0', [960, 540, 1], [960, 600, 1.15]),
  still(6, 'aivfx-0', [960, 540, 1], [960, 700, 1.2], 'Effects, applied.'),
  still(6, 'effects-0', [960, 540, 1], [960, 620, 1.15]),
  still(6, 'templates-0', [960, 540, 1], [960, 600, 1.1], 'Start from a template.'),
  still(6, 'templates-1', [960, 540, 1], [960, 640, 1.1]),
  lockup(6),
];

/** Per-feature clips, silent, 14-16 beats. */
export const CLIPS: { id: string; shots: () => Shot[] }[] = [
  { id: 'C01-hero-prompt', shots: () => [typing(14, 'Describe it.')] },
  { id: 'C02-apps-hub', shots: () => [still(8, 'hub-0', [960, 540, 1], [960, 570, 1.08]), still(8, 'hub-1', [960, 540, 1], [960, 600, 1.1])] },
  { id: 'C03-model-picker', shots: () => [picker(16, 'Pick your model.')] },
  { id: 'C04-image-studio', shots: () => [still(8, 'image-typed', [960, 540, 1], [1150, 430, 1.3], 'Images, tuned.'), still(8, 'image-advanced', [960, 540, 1], [960, 700, 1.15])] },
  { id: 'C05-cinema-studio', shots: () => [still(4, 'cinema-top', [960, 540, 1], [960, 520, 1.1], 'Real camera. Real lenses.'), still(12, 'cinema-builder', [960, 540, 1], [960, 640, 1.2])] },
  { id: 'C06-director', shots: () => [still(16, 'director-0', [960, 540, 1], [960, 600, 1.2], 'Direct the scene.')] },
  { id: 'C07-edit-tools', shots: () => [still(8, 'edit-0', [960, 540, 1], [700, 760, 1.35], 'Before. After.'), still(8, 'edit-1', [960, 540, 1], [1200, 700, 1.25])] },
  { id: 'C08-character', shots: () => [still(8, 'character-0', [960, 540, 1], [960, 600, 1.15], 'Characters.'), still(8, 'character-1', [960, 540, 1], [960, 640, 1.12])] },
  { id: 'C09-avatar', shots: () => [still(8, 'avatar-0', [960, 540, 1], [960, 600, 1.15], 'Faces that talk.'), still(8, 'avatar-1', [960, 540, 1], [960, 640, 1.12])] },
  { id: 'C10-lip-sync', shots: () => [still(8, 'lipsync-0', [960, 540, 1], [960, 600, 1.15], 'Lip sync.'), still(8, 'lipsync-1', [960, 540, 1], [960, 640, 1.12])] },
  { id: 'C11-vfx-effects', shots: () => [still(8, 'aivfx-0', [960, 540, 1], [960, 700, 1.2], 'Effects, applied.'), still(8, 'effects-0', [960, 540, 1], [960, 620, 1.15])] },
  { id: 'C12-templates', shots: () => [still(8, 'templates-0', [960, 540, 1], [960, 600, 1.1], 'Start from a template.'), still(8, 'templates-1', [960, 540, 1], [960, 640, 1.1])] },
];

export const socialD = (): Shot[] => [
  vshot(10, 'c/typing.mp4', [{ b: 0, cx: 1180, cy: 540, z: 1 }, { b: 10, cx: 1180, cy: 540, z: 1 }], 'Describe it.', { video: true }),
  vshot(12, S('edit-0'), [{ b: 0, cx: 640, cy: 760, z: 1 }, { b: 6, cx: 640, cy: 760, z: 1 }, { b: 12, cx: 1300, cy: 760, z: 1 }], 'Before. After.'),
  vstill(5, 'avatar-0', [960, 640, 1], [960, 700, 1], 'Faces that talk.'),
  vstill(5, 'lipsync-0', [960, 640, 1], [960, 700, 1], 'Faces that talk.'),
  vstill(4, 'templates-0', [960, 700, 1], [960, 760, 1], 'Start from a template.'),
  lockup(5, 0.8),
];
