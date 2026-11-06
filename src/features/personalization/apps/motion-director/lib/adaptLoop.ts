import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import type { ClipData, ProjectData } from '../types';
import { fetchRecipeCard, fetchRecipeSource, fetchReferenceFrames, requestAdapt, DirectorError, type AdaptRequest } from './directorClient';
import { checkAdaptedSource } from './shotAdapter';
import { prepareAdapted } from './adaptedRuntime';
import { adaptedCodeEnabled } from './adaptedPolicy';
import { rulesOf } from './shotRules';
import { drawsSampleScreen, isProductTextureShot } from './productShots';

/**
 * Upstream's coding agent reads the shot card in full, edits the shot's source for the product,
 * renders stills, compares them with how the shot is meant to look and fixes what it sees. This is
 * the hosted version: the model gets the card, the source and the recipe's reference frames
 * (public/motion-studio/previews) and rewrites the recipe (route mode `adapt`); the sandbox checks
 * and compiles it; three stills are rendered and reviewed; what fails goes back to the model with
 * those stills next to the reference (at most three rounds). A shot keeps its adapted source only
 * when it came out clean; otherwise the plain recipe stays.
 */

/** Every recipe shot of the film is adapted (as upstream builds each shot), three at a time, within the budget. */
export const ADAPT_LIMITS = { shots: 12, rounds: 3, lanes: 3, budgetMs: 240_000 } as const;

export type AdaptLog = (label: string, status: 'running' | 'done' | 'error') => void;

export interface AdaptDeps {
  /** Render a still of the project (the browser renderer); rejects when the frame fails. */
  render: (project: ProjectData, frame: number, signal: AbortSignal) => Promise<unknown>;
  /** Optional: a reviewer's blocking findings for the stills of a project at these frames. */
  review?: (project: ProjectData, frames: number[], signal: AbortSignal) => Promise<string[]>;
  request?: (body: AdaptRequest) => Promise<{ code: string; notes: string }>;
  source?: (stem: string) => Promise<string | null>;
  card?: (stem: string) => Promise<string | null>;
  reference?: (stem: string) => Promise<string[]>;
  /** Turn what `render` returned into an image (data URL) to show the model; omitted = no pictures. */
  snapshot?: (rendered: unknown) => Promise<string | null>;
}

export interface AdaptContext {
  layout?: unknown;
  screens: string[];
  crops: string[];
  brand?: AdaptRequest['brand'];
  content?: unknown;
}

const stemOf = (c: ClipData) => (c.cardId.startsWith('demo:') ? c.cardId.slice(5) : '');

/** Shots worth adapting: recipes that draw sample screens first, then the ones that already read pages; never fixed-text, technique or already adapted ones. */
export function adaptTargets(project: ProjectData): ClipData[] {
  const out: Array<{ clip: ClipData; weight: number }> = [];
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const stem = stemOf(clip);
      if (!stem || clip.props?.adaptedCode) continue;
      const template = MOTION_TEMPLATES.find((t) => t.componentName === stem);
      const rules = rulesOf(stem);
      // Technique cards (seams) have no shot of their own; recipes whose words are the effect are adapted
      // too, with the card's measured-length rule (the route passes rules.text).
      if (!template || !rules || rules.technique) continue;
      out.push({ clip, weight: drawsSampleScreen(template) ? 0 : isProductTextureShot(stem) ? 1 : 2 });
    }
  }
  return out.sort((a, b) => a.weight - b.weight || a.clip.start - b.clip.start).slice(0, ADAPT_LIMITS.shots).map((x) => x.clip);
}

const withClip = (project: ProjectData, id: string, props: Record<string, unknown>): ProjectData => ({
  ...project,
  tracks: project.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, props: { ...c.props, ...props } } : c)) })),
});

/** Entering, peak and settled frames of a clip (upstream's three stills per shot). */
export const stillFrames = (clip: ClipData): number[] => [Math.floor(clip.duration * 0.2), Math.floor(clip.duration / 2), Math.max(0, clip.duration - 3)].map((f) => clip.start + f);

/** Adapt one shot; resolves to the props to add to the clip, or null when nothing clean came out. */
export async function adaptShot(project: ProjectData, clip: ClipData, ctx: AdaptContext, deps: AdaptDeps, signal: AbortSignal): Promise<{ props: Record<string, unknown>; notes: string } | null> {
  // Off unless a deployment opts in (adaptedPolicy.ts): don't spend a model call on code that can't run.
  if (!adaptedCodeEnabled()) return null;
  const stem = stemOf(clip);
  const source = await (deps.source ?? fetchRecipeSource)(stem);
  if (!source) return null;
  const request = deps.request ?? requestAdapt;
  // This scene's own pictures (lib/assignPictures) when it has them, else the film's.
  const own = (clip.props?.scenePictures ?? null) as { screens?: string[]; crops?: string[] } | null;
  const screens = Array.isArray(clip.props?.screens) ? (clip.props!.screens as string[]) : own?.screens?.length ? own.screens : ctx.screens;
  const crops = Array.isArray(clip.props?.crops) ? (clip.props!.crops as string[]) : own?.crops?.length ? own.crops : ctx.crops;
  ctx = { ...ctx, screens, crops };
  const slots = { screens: ctx.screens, crops: ctx.crops, layout: ctx.layout, brand: ctx.brand };
  const [card, reference] = await Promise.all([(deps.card ?? fetchRecipeCard)(stem).catch(() => null), (deps.reference ?? fetchReferenceFrames)(stem).catch(() => [])]);
  let problems: string[] = [];
  let stills: string[] = [];
  for (let round = 0; round < ADAPT_LIMITS.rounds; round++) {
    if (signal.aborted) return null;
    let reply: { code: string; notes: string };
    try {
      reply = await request({
        recipe: stem, source, layout: ctx.layout, screens: ctx.screens.length, crops: ctx.crops.length, brand: ctx.brand, content: ctx.content, problems,
        ...(card ? { card } : {}), ...(reference.length ? { reference } : {}), ...(stills.length ? { stills } : {}),
      });
    } catch (error) {
      // No key, a refusal or a rate limit will not get better on a second round.
      if (error instanceof DirectorError && [401, 403, 429].includes(error.status)) throw error;
      problems = [`the request failed: ${error instanceof Error ? error.message : 'error'}`];
      continue;
    }
    const checked = await checkAdaptedSource(reply.code, stem);
    if (!checked.ok) {
      problems = [`the code was refused: ${checked.error}`];
      continue;
    }
    if (!(await prepareAdapted(reply.code, stem))) {
      problems = ['the code did not compile or run'];
      continue;
    }
    const props = { adaptedCode: reply.code, adaptedStem: stem, ...slots };
    const trial = withClip(project, clip.id, props);
    const failed: string[] = [];
    const shots: string[] = [];
    for (const frame of stillFrames(clip)) {
      try {
        const rendered = await deps.render(trial, frame, signal);
        const image = deps.snapshot ? await deps.snapshot(rendered).catch(() => null) : null;
        if (image) shots.push(image);
      } catch (error) {
        if (signal.aborted) return null;
        failed.push(`frame ${frame - clip.start} of the shot failed to render: ${error instanceof Error ? error.message : 'error'}`);
      }
    }
    if (!failed.length && deps.review) failed.push(...(await deps.review(trial, stillFrames(clip), signal).catch(() => [])));
    if (!failed.length) return { props, notes: reply.notes };
    problems = failed.slice(0, 6);
    stills = shots;
  }
  return null;
}

/** Adapt the film's best shots within the time budget. Never throws except for a missing key / refusal on the first shot. */
export async function adaptFilm(project: ProjectData, ctx: AdaptContext, deps: AdaptDeps, log: AdaptLog, outer?: AbortSignal): Promise<ProjectData> {
  // Disabled by default (adaptedPolicy.ts): no model calls for code that would not run.
  if (!adaptedCodeEnabled()) return project;
  const targets = adaptTargets(project);
  if (!targets.length) return project;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADAPT_LIMITS.budgetMs);
  outer?.addEventListener('abort', () => controller.abort(), { once: true });
  let result = project;
  let adapted = 0;
  let stop = false;
  const queue = [...targets];
  const lane = async () => {
    while (queue.length && !controller.signal.aborted && !stop) {
      const clip = queue.shift()!;
      const name = MOTION_TEMPLATES.find((t) => t.componentName === stemOf(clip))?.nameEn ?? stemOf(clip);
      log(`Adapting ${name} to your site`, 'running');
      try {
        // Each shot is tried against the film as it was (adapting one shot never depends on another).
        const done = await adaptShot(project, clip, ctx, deps, controller.signal);
        if (done) {
          result = withClip(result, clip.id, done.props);
          adapted++;
          log(`Adapted ${name}${done.notes ? ` · ${done.notes}` : ''}`, 'done');
        } else {
          log(`Kept the original ${name} (the adapted version did not pass its checks)`, 'done');
        }
      } catch (error) {
        // No key or refusal: say so once and stop asking.
        if (!stop) log(error instanceof Error ? error.message : 'Shot adaptation is unavailable', 'error');
        stop = true;
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(ADAPT_LIMITS.lanes, targets.length) }, lane));
  } finally {
    clearTimeout(timer);
  }
  if (adapted === 0 && targets.length) log('No shot needed changes beyond words and pictures', 'done');
  return result;
}
