import type { ClipData, ProjectData } from '../types';
import { SFX_PEAKS } from '../demosrc/_generated/sfxPeaks';

/**
 * Upstream sends review findings back to the stage that caused them and re-renders. These are the
 * findings the program can repair on its own, safely, once: it changes only what the finding names
 * and says what it did. (Findings that need a different recipe or new words stay in the report.)
 */
export interface FixResult {
  project: ProjectData;
  fixed: string[];
}

const sec = (frame: number, fps: number) => `${(frame / fps).toFixed(1)}s`;
const isVisual = (c: ClipData) => !c.cardId.startsWith('audio') && c.cardId !== 'inkpress-caption' && c.cardId !== 'site-inset' && !c.cardId.startsWith('inkpress-flash-cut') && !c.cardId.startsWith('inkpress-seam-') && c.cardId !== 'connected-seam' && !c.cardId.startsWith('bg-');

export function fixFilm(project: ProjectData): FixResult {
  const fps = project.fps;
  const fixed: string[] = [];
  let tracks = project.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, props: { ...c.props } })) }));
  const all = () => tracks.flatMap((t) => t.clips);

  // A7: synthetic interface sounds go.
  let removed = 0;
  tracks = tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => {
    const bad = c.cardId === 'audio-clip' && /sfxlib\/ui\/ui-/.test(String(c.props.file));
    if (bad) removed++;
    return !bad;
  }) }));
  if (removed) fixed.push(`A7: removed ${removed} interface-alert sound${removed === 1 ? '' : 's'}.`);

  // A5: a long sample is cut to three seconds.
  for (const c of all()) {
    if (c.cardId !== 'audio-clip') continue;
    const name = /sfxlib\/(.+)\.mp3$/.exec(String(c.props.file))?.[1];
    const whole = name ? SFX_PEAKS[name]?.durationMs : undefined;
    if (whole && whole > 5000 && c.duration > fps * 3) {
      fixed.push(`A5: cut a long sound sample at ${sec(c.start, fps)} to 3 s.`);
      c.duration = Math.round(fps * 3);
    }
  }

  // Q11: captions readable on a phone.
  const min = Math.ceil(project.height * 0.052);
  let enlarged = 0;
  for (const c of all()) {
    if (c.cardId === 'inkpress-caption' && Number(c.props.fontSize ?? 22) < project.height * 0.05) {
      c.props.fontSize = min;
      enlarged++;
    }
  }
  if (enlarged) fixed.push(`Q11: enlarged ${enlarged} caption${enlarged === 1 ? '' : 's'} to ${min}px.`);

  // B3: the closing scene holds for at least a second.
  const visual = all().filter(isVisual).sort((a, b) => a.start - b.start);
  const last = visual[visual.length - 1];
  if (last && last.duration < fps) {
    fixed.push(`B3: the closing scene now holds ${sec(fps, fps)} (was ${sec(last.duration, fps)}).`);
    last.duration = fps;
  }

  return { project: fixed.length ? { ...project, tracks } : project, fixed };
}
