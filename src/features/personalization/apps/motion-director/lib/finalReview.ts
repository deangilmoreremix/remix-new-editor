/**
 * Stage 7 of the method (pipeline.md): an independent reviewer that did not make the film is given
 * everything it needs — the design spec (brief, direction, tokens, feature → shot map, release check,
 * storyboard), each shot's card name and known pitfalls, the card's reference frames next to the film's
 * frames at the same moments, the middle of every seam — and the two English checklists
 * (final-review.md, aesthetic-rules.md, carried by the server). It answers check by check, ✓ / ✗, with
 * the seconds it saw it in. Failures point back to the stage that fixes them (3 storyboard / seams,
 * 5 the shot, 6 sound); a seam it fails is turned back into a plain cut here, the rest are reported.
 */
import { motionTemplateTitle, resolveMotionTemplate } from '../../../data/motionRecipeCatalog';
import type { ClipData, ProjectData } from '../types';
import { SHOT_FACTS } from '../demosrc/_generated/shotFacts';
import { BRAND_SCENES } from './directorPlan';

export interface FinalReviewItem {
  id: string;
  ok: boolean;
  seconds: number[];
  text: string;
  stage: '3' | '5' | '6' | 'none';
}

export interface ReviewShot {
  name: string;
  from: number;
  to: number;
  pitfalls: string[];
  reference: string[];
  rendered: Array<{ second: number; image: string }>;
}

export interface FinalReviewDeps {
  /** A frame of the film as a JPEG data URL (small: the reviewer gets many). */
  frame: (project: ProjectData, frame: number, signal: AbortSignal) => Promise<string>;
  /** The recipe's reference frames as designed (entering / peak / settled), data URLs. */
  reference: (stem: string) => Promise<string[]>;
  /** One review call. */
  request: (body: { part: 'shots' | 'film'; spec: unknown; shots?: ReviewShot[]; seams?: Array<{ second: number; kind: string; image: string }>; frames?: Array<{ second: number; image: string }> }) => Promise<{ items: FinalReviewItem[]; summary: string }>;
}

/** Where the reference / film frames are taken in a shot: entering, peak, settled (the previews' moments). */
export const REVIEW_MOMENTS = [0.22, 0.55, 0.92] as const;

const isShot = (c: ClipData) => c.cardId.startsWith('demo:') || c.cardId.startsWith('brand-') || c.cardId === 'inkpress-title-card';

/** The film's shots in order, each with its name and card facts. */
export function reviewShots(project: ProjectData): Array<{ clip: ClipData; name: string; stem: string | null; pitfalls: string[] }> {
  const track = project.tracks.find((t) => t.clips.some(isShot));
  return (track?.clips ?? [])
    .filter(isShot)
    .sort((a, b) => a.start - b.start)
    .map((clip) => {
      if (clip.cardId.startsWith('demo:')) {
        const stem = clip.cardId.slice(5);
        const t = resolveMotionTemplate(stem);
        return { clip, name: t ? motionTemplateTitle(t) : stem, stem, pitfalls: SHOT_FACTS[stem]?.pitfalls ?? [] };
      }
      const brand = Object.values(BRAND_SCENES).find((b) => b.cardId === clip.cardId);
      return { clip, name: brand?.title ?? 'Title card', stem: null, pitfalls: [] };
    });
}

export async function runFinalReview(project: ProjectData, deps: FinalReviewDeps, budgetMs = 120_000): Promise<{ items: FinalReviewItem[]; summary: string; shots: number; seams: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  const fps = project.fps;
  const sec = (f: number) => Math.round((f / fps) * 10) / 10;
  try {
    const shots: ReviewShot[] = [];
    const filmFrames: Array<{ second: number; image: string }> = [];
    for (const s of reviewShots(project).slice(0, 12)) {
      if (controller.signal.aborted) break;
      const rendered: ReviewShot['rendered'] = [];
      for (const m of REVIEW_MOMENTS) {
        const f = s.clip.start + Math.min(s.clip.duration - 1, Math.round(s.clip.duration * m));
        try {
          rendered.push({ second: sec(f), image: await deps.frame(project, f, controller.signal) });
        } catch {
          /* a frame that fails to render is the frame check's finding, not the reviewer's */
        }
      }
      if (rendered[1]) filmFrames.push(rendered[1]);
      const reference = s.stem ? await deps.reference(s.stem).catch(() => []) : [];
      shots.push({ name: s.name, from: sec(s.clip.start), to: sec(s.clip.start + s.clip.duration), pitfalls: s.pitfalls, reference, rendered });
    }
    const seams: Array<{ second: number; kind: string; image: string }> = [];
    for (const c of project.tracks.flatMap((t) => t.clips).filter((x) => x.cardId === 'connected-seam').sort((a, b) => a.start - b.start)) {
      if (controller.signal.aborted) break;
      const f = c.start + Math.floor(c.duration / 2);
      try {
        seams.push({ second: sec(f), kind: String(c.props.kind ?? ''), image: await deps.frame(project, f, controller.signal) });
      } catch {
        /* skipped */
      }
    }
    const spec = project.spec ?? {};
    const groups: ReviewShot[][] = [];
    for (let i = 0; i < shots.length; i += 3) groups.push(shots.slice(i, i + 3));
    const answers = await Promise.all([
      ...groups.map((g) => deps.request({ part: 'shots', spec, shots: g }).catch(() => null)),
      deps.request({ part: 'film', spec, seams, frames: filmFrames.slice(0, 10) }).catch(() => null),
    ]);
    const seen = new Set<string>();
    const items: FinalReviewItem[] = [];
    for (const a of answers) {
      for (const it of a?.items ?? []) {
        const key = `${it.id}|${it.ok}|${it.text.slice(0, 60)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(it);
      }
    }
    items.sort((a, b) => Number(a.ok) - Number(b.ok));
    const summary = answers.map((a) => a?.summary).filter(Boolean)[answers.length - 1] ?? answers.map((a) => a?.summary).find(Boolean) ?? '';
    return { items, summary, shots: shots.length, seams: seams.length };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The fixes stage 7 can make without asking (pipeline: failures go back to stage 3 / 5 / 6): a seam the
 * reviewer failed (seconds inside it) becomes a plain cut again — the incoming shot starts at its own
 * first frame. Shot and sound failures are reported for the person (and the shot step) to act on.
 */
export function applyReviewFixes(project: ProjectData, items: readonly FinalReviewItem[]): { project: ProjectData; fixed: string[] } {
  const fps = project.fps;
  const failedAt = items.filter((i) => !i.ok && i.stage === '3').flatMap((i) => i.seconds.map((s) => Math.round(s * fps)));
  if (!failedAt.length) return { project, fixed: [] };
  const clips = project.tracks.flatMap((t) => t.clips);
  const seams = clips.filter((c) => c.cardId === 'connected-seam' && failedAt.some((f) => f >= c.start - 2 && f <= c.start + c.duration + 2));
  if (!seams.length) return { project, fixed: [] };
  const drop = new Set(seams.map((s) => s.id));
  const restore = new Map(seams.map((s) => [String(s.props.inId), Number(s.props.half) || 0]));
  const tracks = project.tracks.map((t) => ({
    ...t,
    clips: t.clips.filter((c) => !drop.has(c.id)).map((c) => (restore.has(c.id) ? { ...c, inOffset: Math.max(0, c.inOffset - restore.get(c.id)! * c.speed) } : c)),
  }));
  return { project: { ...project, tracks }, fixed: seams.map((s) => `The ${String(s.props.kind)} seam at ${((s.start + s.duration / 2) / fps).toFixed(1)}s is a plain cut now (the reviewer failed it).`) };
}

/**
 * A review arrives after the film is shown. Its fix may replace the film only while the film on screen is
 * still the one reviewed: the same film installed here (`installed` is `reviewed`) and, where the caller
 * keeps its own copy (the workbench), that copy is still the reviewed project. Otherwise edits made in the
 * meantime would be thrown away.
 */
export function reviewStillApplies(opts: { installed: unknown; reviewed: unknown; current?: () => unknown; project: unknown }): boolean {
  return opts.installed === opts.reviewed && (!opts.current || opts.current() === opts.project);
}

/** The report in the chat: failures first with their seconds and the stage that fixes them, then the passes. */
export function finalReviewLines(r: { items: FinalReviewItem[]; summary: string; shots: number; seams: number }): string[] {
  const fails = r.items.filter((i) => !i.ok);
  const passes = r.items.filter((i) => i.ok);
  const at = (i: FinalReviewItem) => (i.seconds.length ? ` (${i.seconds.map((s) => `${s.toFixed(1)}s`).join(', ')})` : '');
  const where = { '3': ' → storyboard / seams', '5': ' → the shot', '6': ' → sound', none: '' } as const;
  return [
    `Independent review (stage 7): ${r.shots} shot${r.shots === 1 ? '' : 's'} compared with their cards' reference frames, ${r.seams} seam${r.seams === 1 ? '' : 's'}, against final-review and the aesthetic rules — ${passes.length} ✓, ${fails.length} ✗.`,
    ...fails.map((i) => `✗ ${i.id}${at(i)}: ${i.text}${where[i.stage]}`),
    ...passes.map((i) => `✓ ${i.id}${at(i)}: ${i.text}`),
    ...(r.summary ? [`Not judged from stills: ${r.summary}`] : []),
  ];
}
