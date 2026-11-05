/**
 * The final review of a built film (upstream references/final-review.md), the part a program can
 * check: each item has the checklist's code, passes or fails, and names the second it is about.
 * The rest of the checklist (does the film say what the brief asked, is the picture sharp) needs
 * eyes; this report never says "all fine" for those.
 */
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import type { ProjectData } from '../types';
import { filmRuleViolations, rulesOf } from './shotRules';
import { reviewAgainstSpec } from './designSpec';
import { SFX_PEAKS } from '../demosrc/_generated/sfxPeaks';

export interface ReviewItem {
  code: string;
  ok: boolean;
  text: string;
}

/** "Andrew Garnett President & CEO": a first and last name followed by a job title. */
const NAMED_PERSON = /\b[A-Z][a-z]{1,15}\s+[A-Z][a-z]{1,20}\b[\s,·|-]*(?:President|CEO|CFO|CTO|COO|Founder|Co-?founder|Owner|Director|Manager|Partner|Principal|VP|Vice President|Strategist|Engineer|Specialist)/;
/** A number with a unit, a rank or a guarantee: the kind of claim that goes stale or is not true. */
const CLAIM = /(?:\b\d[\d,.]*\s?(?:%|x\b|\+)|#\s?1\b|\bno\.?\s?1\b|\b(?:best|number one|guaranteed?|award-winning|world'?s (?:first|best|leading))\b)/i;
const TEXT_KEYS = ['text', 'title', 'label', 'sub', 'cta', 'name', 'headline', 'caption'];

/** Every line of words the film draws itself (titles, captions, labels, gallery captions, rewritten recipe words). */
function onScreenWords(clips: ReadonlyArray<{ cardId: string; props: Record<string, unknown> }>): string[] {
  const out: string[] = [];
  for (const c of clips) {
    if (c.cardId.startsWith('audio')) continue;
    for (const k of TEXT_KEYS) {
      const v = c.props[k];
      if (typeof v === 'string' && v.trim()) out.push(v.replace(/\*/g, '').trim());
    }
    const caps = c.props.captions;
    if (typeof caps === 'string') out.push(...caps.split(/\r?\n/).map((x) => x.trim()).filter(Boolean));
    const texts = c.props.texts;
    if (texts && typeof texts === 'object') out.push(...Object.values(texts as Record<string, unknown>).filter((x): x is string => typeof x === 'string'));
  }
  return out;
}

const sec = (frame: number, fps: number) => `${(frame / fps).toFixed(1)}s`;

export function reviewFilm(project: ProjectData): ReviewItem[] {
  const fps = project.fps;
  const clips = project.tracks.filter((t) => !t.hidden).flatMap((t) => t.clips);
  const shots = clips
    .filter((c) => c.cardId.startsWith('demo:'))
    .sort((a, b) => a.start - b.start)
    .map((c) => ({ c, template: MOTION_TEMPLATES.find((t) => t.componentName === c.cardId.slice(5)) }))
    .filter((x) => x.template);
  const items: ReviewItem[] = [];

  // F2: nothing plays twice; the shot cards' caps, exclusions and look family hold.
  const found = filmRuleViolations(shots.map((x) => ({ kind: 'shot' as const, recipeId: x.template!.id })));
  const repeats = found.filter((f) => /twice/.test(f.reason));
  items.push({ code: 'F2', ok: repeats.length === 0, text: repeats.length ? `The same recipe plays again at ${repeats.map((r) => sec(shots[r.index].c.start, fps)).join(', ')}.` : 'No recipe plays twice.' });
  const rest = found.filter((f) => !/twice/.test(f.reason));
  items.push({ code: 'S1', ok: rest.length === 0, text: rest.length ? rest.map((r) => `${sec(shots[r.index].c.start, fps)} ${shots[r.index].template!.nameEn}: ${r.reason}.`).join(' ') : 'The shot cards\' caps, exclusions and look family hold.' });

  // S3: a recipe is played at its tuned length (a slightly shorter scene may speed it up 25 %).
  const cut = shots.filter((x) => x.c.duration * x.c.speed < x.template!.durationInFrames * 0.78 && !rulesOf(x.template!.componentName)?.technique);
  items.push({ code: 'S3', ok: cut.length === 0, text: cut.length ? `Cut short before they finish: ${cut.map((x) => `${x.template!.nameEn} at ${sec(x.c.start, fps)}`).join(', ')}.` : 'Every recipe plays its whole motion.' });

  // B3: the closing scene holds for at least a second.
  const visual = clips.filter((c) => !c.cardId.startsWith('audio') && c.cardId !== 'inkpress-caption' && c.cardId !== 'site-inset' && !c.cardId.startsWith('inkpress-flash-cut') && !c.cardId.startsWith('inkpress-seam-') && c.cardId !== 'connected-seam' && !c.cardId.startsWith('bg-')).sort((a, b) => a.start - b.start);
  const last = visual[visual.length - 1];
  items.push({ code: 'B3', ok: !last || last.duration >= fps, text: last && last.duration < fps ? `The last scene (from ${sec(last.start, fps)}) holds only ${sec(last.duration, fps)}; the name needs at least 1 s.` : 'The film ends on a hold of at least 1 s.' });

  // R4: at most three flash cuts / whole-frame hits.
  const flashes = clips.filter((c) => c.cardId === 'inkpress-flash-cut' || c.cardId === 'inkpress-seam-glitch' || (c.cardId === 'connected-seam' && (c.props.kind === 'flash' || c.props.kind === 'glitch'))).length;
  items.push({ code: 'R4', ok: flashes <= 3, text: flashes > 3 ? `${flashes} flash cuts (at most 3).` : `${flashes} flash cut${flashes === 1 ? '' : 's'} (at most 3).` });

  // Q11: captions are readable on a phone (at least 5 % of the frame height).
  const small = clips.filter((c) => c.cardId === 'inkpress-caption' && Number(c.props.fontSize ?? 22) < project.height * 0.05);
  items.push({ code: 'Q11', ok: small.length === 0, text: small.length ? `${small.length} caption${small.length === 1 ? ' is' : 's are'} too small to read on a phone (from ${sec(small[0].start, fps)}).` : 'Captions are readable on a phone.' });

  // A7: no synthetic interface sounds.
  const synthetic = clips.filter((c) => c.cardId === 'audio-clip' && /sfxlib\/ui\/ui-/.test(String(c.props.file)));
  items.push({ code: 'A7', ok: synthetic.length === 0, text: synthetic.length ? `${synthetic.length} interface-alert sounds (they sound like a game).` : 'Sound effects are real objects and film vocabulary.' });

  // F2 (content self-check): no tagline, caption or title line said twice.
  const norm = (t: unknown) => String(t ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const lines = clips
    .filter((c) => c.cardId === 'inkpress-caption' || c.cardId === 'inkpress-title-card')
    .map((c) => ({ c, t: norm(c.props.text) }))
    .filter((x) => x.t.length >= 6);
  const twice = lines.filter((x, i) => lines.findIndex((y) => y.t === x.t) !== i);
  items.push({ code: 'F2', ok: twice.length === 0, text: twice.length ? `The same line is said again: "${String(twice[0].c.props.text).replace(/\*/g, '')}" at ${twice.map((x) => sec(x.c.start, fps)).join(', ')}.` : 'No tagline or caption is said twice.' });

  // Sound coverage: a stretch of more than 3 s with no sound at all reads as a mute segment.
  const sounds = clips.filter((c) => c.cardId === 'audio-clip' || c.cardId === 'video-clip').map((c) => [c.start, c.start + c.duration] as const).sort((a, b) => a[0] - b[0]);
  const end = Math.max(0, ...clips.map((c) => c.start + c.duration));
  let covered = 0;
  let gap: [number, number] | null = null;
  for (const [a0, a1] of sounds) {
    if (a0 - covered > fps * 3 && !gap) gap = [covered, a0];
    covered = Math.max(covered, a1);
  }
  if (!gap && end - covered > fps * 3) gap = [covered, end];
  items.push({ code: 'A2', ok: !gap, text: gap ? `No sound from ${sec(gap[0], fps)} to ${sec(gap[1], fps)}: a mute stretch.` : 'Sound runs through the whole film.' });

  // A5: a sample longer than 5 s must be cut to its action, not left to ring on.
  const ringing = clips.filter((c) => {
    if (c.cardId !== 'audio-clip') return false;
    const name = /sfxlib\/(.+)\.mp3$/.exec(String(c.props.file))?.[1];
    const whole = name ? SFX_PEAKS[name]?.durationMs : undefined;
    return !!whole && whole > 5000 && c.duration > fps * 3;
  });
  items.push({ code: 'A5', ok: ringing.length === 0, text: ringing.length ? `Long sound sample left to ring for over 3 s at ${ringing.map((c) => sec(c.start, fps)).join(', ')}; give it a shorter duration.` : 'Long sound samples are cut to their action.' });

  // D2 / P3: what the film says about people and about the product, from the words on screen.
  const words = onScreenWords(clips);
  const brief = (project.spec?.brief ?? '').toLowerCase();
  const asked = /\b(?:people|person|team|faces?|staff|photos?|images?|customers?|testimonials?)\b/.test(brief);
  const named = words.filter((w) => NAMED_PERSON.test(w));
  items.push({
    code: 'D2',
    ok: named.length === 0 || asked,
    text: named.length && !asked ? `Names a person on screen ("${named[0].slice(0, 60)}"); they were not asked for, so check it is public and wanted.` : named.length ? 'Shows people by name, as asked.' : 'No named people on screen.',
  });
  const claims = words.filter((w) => CLAIM.test(w) && !brief.includes(w.toLowerCase().slice(0, 30)));
  items.push({ code: 'P3', ok: claims.length === 0, text: claims.length ? `A claim on screen the brief did not give ("${claims[0].slice(0, 60)}"): check the site really says it.` : 'No numbers, rankings or guarantees that the brief did not give.' });

  // A8: with music, deliver it with and without.
  if (clips.some((c) => c.cardId === 'audio-clip' && !/sfxlib/.test(String(c.props.file)))) items.push({ code: 'A8', ok: true, text: 'Render both the version with music and the one without.' });
  return [...items, ...reviewAgainstSpec(project)];
}

/** The lines for the chat: what failed (with the second), and how many passed. */
export function reviewSummary(items: readonly ReviewItem[]): string[] {
  const failed = items.filter((i) => !i.ok);
  return [`Review against the shot cards' checklist: ${items.length - failed.length} passed${failed.length ? `, ${failed.length} to fix` : ''}.`, ...failed.map((i) => `- ${i.code} ✗ ${i.text}`)];
}
