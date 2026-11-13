/**
 * Browser side of the Motion Studio director: calls the capture / director
 * routes, re-validates what comes back, and applies edits to the store through
 * its existing mutators (prop/timing edits share one undo step; adding or
 * removing a clip pushes its own, as in `agentApply.ts`).
 */
import { DEMO_TEXTS } from '../demosrc/_generated/demoTexts';
import { parseTextMap } from './textOverrides';
import { findClip, useStore } from '../store';
import { CARDS } from '../cards/registry';
import type { ProjectData } from '../types';
import { motionCardId, motionTemplateTitle, resolveMotionTemplate } from '../../../data/motionRecipeCatalog';
import {
  validateBrief,
  validateDirections,
  validateEditOps,
  validateMapping,
  validatePlan,
  type DirectionOptions,
  type DirectorBrief,
  type DirectorEditOp,
  type DirectorPlan,
  type MappingRow,
} from './directorPlan';
import type { SiteContent } from './filmChat';

export { DirectorError, captureSite, post } from './captureClient';
export type { SiteCapture, CaptureLayout } from './captureClient';
import { DirectorError, post, type SiteCapture } from './captureClient';
export { findSiteUrl } from './filmChat';

export async function requestPlan(body: {
  prompt: string;
  durationSec: number;
  aspectRatio: string;
  capture?: SiteCapture | null;
  brandKit?: Record<string, unknown> | null;
  /** Catalog shot ids the film must use, in this order (named in chat or picked in Templates). */
  requiredRecipes?: string[];
  /** 'inkpress': follow the Ink Press template structure. */
  template?: 'inkpress' | null;
  /** The feature → shot map (stage 2) the storyboard is written from. */
  mapping?: MappingRow[];
  /** The chosen shots' cards, in full (stage 2: "read the chosen cards in full"). */
  cards?: Array<{ id: string; text: string }>;
  /** The product's ground: cards of the other look family are ruled out. */
  siteGround?: 'dark' | 'light' | null;
}): Promise<DirectorPlan> {
  const { plan } = await post<{ plan: unknown }>('/api/motion-studio/director', {
    mode: 'plan',
    prompt: body.prompt,
    durationSec: body.durationSec,
    aspectRatio: body.aspectRatio,
    capture: body.capture
      ? {
          title: body.capture.title,
          url: body.capture.url,
          brand: body.capture.brand,
          cropCount: body.capture.crops.length,
          pages: (body.capture.pages ?? []).map((p) => p.path),
          content: body.capture.content ?? null,
        }
      : null,
    brandKit: body.brandKit ?? null,
    requiredRecipes: body.requiredRecipes ?? [],
    template: body.template ?? null,
    mapping: body.mapping ?? [],
    cards: body.cards ?? [],
    siteGround: body.siteGround ?? null,
  }, 60_000);
  return validatePlan(plan, { targetSec: body.durationSec });
}

/** What the co-creation steps are asked with: the request, the site, and what the person has confirmed so far. */
export interface GuidedContext {
  prompt: string;
  durationSec: number;
  aspectRatio: string;
  capture?: SiteCapture | null;
  brandKit?: Record<string, unknown> | null;
  /** The person's answers and corrections, in order. */
  notes?: string[];
  /** The confirmed brief and chosen direction, as plain text. */
  brief?: string;
  direction?: string;
  /** Shots that must lead the mapping (named in chat or picked in Templates). */
  requiredRecipes?: string[];
  /** The product's ground ('dark' / 'light'): cards of the other look family are ruled out of the film. */
  siteGround?: 'dark' | 'light' | null;
}

const guidedBody = (mode: 'brief' | 'direction' | 'mapping', c: GuidedContext) => ({
  mode,
  prompt: c.prompt,
  durationSec: c.durationSec,
  aspectRatio: c.aspectRatio,
  capture: c.capture
    ? { title: c.capture.title, url: c.capture.url, brand: c.capture.brand, pages: (c.capture.pages ?? []).map((p) => p.path), content: c.capture.content ?? null }
    : null,
  brandKit: c.brandKit ?? null,
  notes: c.notes ?? [],
  siteGround: c.siteGround ?? null,
  brief: c.brief ?? '',
  direction: c.direction ?? '',
  requiredRecipes: c.requiredRecipes ?? [],
});

export const requestBrief = async (c: GuidedContext): Promise<DirectorBrief> =>
  validateBrief((await post<{ brief: unknown }>('/api/motion-studio/director', guidedBody('brief', c), 45_000)).brief);
export const requestDirections = async (c: GuidedContext): Promise<DirectionOptions> =>
  validateDirections((await post<{ options: unknown }>('/api/motion-studio/director', guidedBody('direction', c), 45_000)).options);
export const requestMapping = async (c: GuidedContext): Promise<MappingRow[]> =>
  validateMapping({ rows: (await post<{ mapping: unknown }>('/api/motion-studio/director', guidedBody('mapping', c), 45_000)).mapping });

/** Ask the director about the storyboard on the table. `revise` is true when the message asks for a change. */
export async function askDirector(body: { message: string; plan: DirectorPlan; capture?: SiteCapture | null }): Promise<{ reply: string; revise: boolean }> {
  const res = await post<{ reply?: unknown; revise?: unknown }>('/api/motion-studio/director', {
    mode: 'chat',
    message: body.message,
    plan: body.plan,
    capture: body.capture ? { title: body.capture.title, url: body.capture.url, content: body.capture.content ?? null } : null,
  }, 30_000);
  return { reply: typeof res.reply === 'string' ? res.reply : '', revise: res.revise === true };
}

/** Ask the director to rewrite the template words of each shot scene from the site and the storyboard. */
export async function requestRetext(body: { plan: DirectorPlan; product: string; capture?: SiteCapture | null }): Promise<Record<number, Record<string, string>>> {
  const scenes = body.plan.scenes.map((sc, index) => ({ index, recipeId: sc.kind === 'shot' ? sc.recipeId : '', headline: sc.headline, feature: sc.feature ?? sc.caption }));
  const res = await post<{ texts?: Record<string, Record<string, unknown>> }>('/api/motion-studio/director', {
    mode: 'retext',
    product: body.product,
    title: body.plan.title,
    scenes,
    capture: body.capture ? { title: body.capture.title, url: body.capture.url, content: body.capture.content ?? null } : null,
  }, 45_000);
  const out: Record<number, Record<string, string>> = {};
  for (const [k, pairs] of Object.entries(res.texts ?? {})) {
    for (const [from, to] of Object.entries(pairs ?? {})) if (typeof to === 'string' && to) (out[Number(k)] ??= {})[from] = to;
  }
  return out;
}

export interface FrameFinding {
  second: number;
  severity: 'fix' | 'check';
  text: string;
}

/** An independent model review of a few rendered frames against the design spec (needs the person's key). */
export async function requestFrameReview(body: { frames: Array<{ second: number; image: string }>; spec: unknown }): Promise<{ findings: FrameFinding[]; summary: string }> {
  const res = await post<{ findings?: FrameFinding[]; summary?: string }>('/api/motion-studio/director', { mode: 'review', frames: body.frames, spec: body.spec }, 50_000);
  return { findings: Array.isArray(res.findings) ? res.findings : [], summary: typeof res.summary === 'string' ? res.summary : '' };
}

/** One part of the stage 7 review (a group of shots, or the whole film): checklist answers ✓ / ✗ with seconds. */
export async function requestFinalReview(body: Record<string, unknown>): Promise<{ items: import('./finalReview').FinalReviewItem[]; summary: string }> {
  const res = await post<{ items?: unknown[]; summary?: string }>('/api/motion-studio/director', { mode: 'final-review', ...body }, 70_000);
  const items = (Array.isArray(res.items) ? res.items : []).filter((i): i is import('./finalReview').FinalReviewItem => Boolean(i && typeof i === 'object' && typeof (i as { id?: unknown }).id === 'string'));
  return { items, summary: typeof res.summary === 'string' ? res.summary : '' };
}

export interface AdaptRequest {
  recipe: string;
  source: string;
  layout?: unknown;
  screens?: number;
  crops?: number;
  brand?: { name?: string; accent?: string; background?: string; text?: string; font?: string };
  content?: unknown;
  /** What was wrong with the previous try (render errors, reviewer findings). */
  problems?: string[];
  /** The recipe's shot card in full (upstream's agent reads it before editing). */
  card?: string;
  /** The recipe as designed: entering / peak / settled frames (data URLs). */
  reference?: string[];
  /** The previous try as rendered, same three moments (data URLs), to compare with the reference. */
  stills?: string[];
}

/** The agent's rewrite of one recipe for the person's site (needs their key). The caller must still check the code. */
export async function requestAdapt(body: AdaptRequest): Promise<{ code: string; notes: string }> {
  const res = await post<{ code?: string; notes?: string }>('/api/motion-studio/director', { mode: 'adapt', ...body }, 55_000);
  if (typeof res.code !== 'string' || !res.code) throw new DirectorError('The agent returned no code', 'BAD_OUTPUT', 502);
  return { code: res.code, notes: typeof res.notes === 'string' ? res.notes : '' };
}

/** A recipe's shot card (markdown), as published by scripts/gen-demo-sources.mjs. */
export async function fetchRecipeCard(stem: string): Promise<string | null> {
  try {
    const res = await fetch(`/motion-studio/sources/${encodeURIComponent(stem)}.card.md`);
    return res.ok ? (await res.text()).slice(0, 30_000) : null;
  } catch {
    return null;
  }
}

/** The recipe's reference frames as designed (public/motion-studio/previews, entering / peak / settled), as data URLs. */
export async function fetchReferenceFrames(stem: string): Promise<string[]> {
  const out: string[] = [];
  for (const k of ['a', 'b', 'c']) {
    try {
      const res = await fetch(`/motion-studio/previews/${encodeURIComponent(stem)}-${k}.jpg`);
      if (!res.ok) continue;
      const blob = await res.blob();
      out.push(await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      }));
    } catch {
      /* a missing frame is fine */
    }
  }
  return out;
}

/** A recipe's source text, as published by scripts/gen-demo-sources.mjs. */
export async function fetchRecipeSource(stem: string): Promise<string | null> {
  try {
    const res = await fetch(`/motion-studio/sources/${encodeURIComponent(stem)}.tsx.txt`);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** The editable text prop of a card, if it has one. */
const textKey = (cardId: string): string | null => {
  if (cardId === 'inkpress-title-card' || cardId === 'inkpress-caption') return 'text';
  if (cardId === 'text-basic') return 'content';
  if (cardId.startsWith('demo:')) return 'title';
  return null;
};

/** Compact clip list sent to the director for an edit. */
export function clipsForDirector(project: ProjectData) {
  return project.tracks.flatMap((track) =>
    track.clips.map((c) => {
      const key = textKey(c.cardId);
      const card = CARDS[c.cardId];
      return {
        id: c.id,
        recipe: `${c.cardId}${card?.nameEn ? ` (${card.nameEn})` : ''} on ${track.name}`,
        label: c.label ?? '',
        text: key ? String(c.props?.[key] ?? '') : '',
        seconds: Math.round((c.duration / project.fps) * 10) / 10,
        // The words this shot draws, so the director can rewrite them with set_texts.
        strings: c.cardId.startsWith('demo:') ? (DEMO_TEXTS[c.cardId.slice(5)] ?? []).slice(0, 40) : [],
      };
    }),
  );
}

export async function requestEdit(instruction: string, project: ProjectData): Promise<{ reply: string; ops: DirectorEditOp[] }> {
  const clips = clipsForDirector(project);
  const raw = await post<unknown>('/api/motion-studio/director', { mode: 'edit', instruction, clips });
  return validateEditOps(raw, new Set(clips.map((c) => c.id)));
}

/** Apply validated director ops to the store. Returns the number applied. */
export function applyDirectorOps(ops: DirectorEditOp[]): number {
  if (!ops.length) return 0;
  const store = useStore.getState();
  store.commit();
  let applied = 0;
  for (const op of ops) {
    const s = useStore.getState();
    const fps = s.project.fps;
    if (op.op === 'set_palette') {
      if (op.background) s.setBackground(op.background);
      for (const track of s.project.tracks) {
        for (const c of track.clips) {
          if (c.cardId === 'inkpress-title-card') s.updateClipProps(c.id, { ...(op.background && { bg: op.background }), ...(op.text && { ink: op.text }), ...(op.accent && { accent: op.accent }) });
          else if (c.cardId === 'bg-paper' && op.background) s.updateClipProps(c.id, { color: op.background });
          else if ((c.cardId.startsWith('demo:') || c.cardId === 'inkpress-caption') && op.accent) s.updateClipProps(c.id, { accent: op.accent });
        }
      }
      applied++;
      continue;
    }
    if (op.op === 'add_shot') {
      const template = resolveMotionTemplate(op.recipeId);
      const cardId = template ? motionCardId(template) : '';
      if (!CARDS[cardId]) continue;
      const after = op.afterClipId ? findClip(s.project, op.afterClipId) : null;
      const shotsTrack = after?.track ?? s.project.tracks.find((t) => t.clips.some((c) => c.cardId.startsWith('demo:'))) ?? s.project.tracks[0];
      const at = after ? after.clip.start + after.clip.duration : shotsTrack ? Math.max(0, ...shotsTrack.clips.map((c) => c.start + c.duration)) : 0;
      // Ripple later clips on that track so the new shot does not overlap them.
      const frames = Math.round(op.seconds * fps);
      if (shotsTrack) for (const c of shotsTrack.clips) if (c.start >= at) s.updateClip(c.id, { start: c.start + frames });
      s.addClip(cardId, shotsTrack?.id, at, { props: { title: op.text }, label: template ? motionTemplateTitle(template).slice(0, 24) : undefined });
      const added = useStore.getState().selectedClipId;
      if (added) useStore.getState().updateClip(added, { duration: frames });
      applied++;
      continue;
    }
    const hit = findClip(s.project, op.clipId);
    if (!hit) continue;
    if (op.op === 'set_text') {
      const key = textKey(hit.clip.cardId);
      if (!key) continue;
      s.updateClipProps(op.clipId, { [key]: op.text });
    } else if (op.op === 'set_texts') {
      if (!hit.clip.cardId.startsWith('demo:')) continue;
      s.updateClipProps(op.clipId, { texts: { ...parseTextMap(hit.clip.props.texts), [op.from]: op.to } });
    } else if (op.op === 'set_duration') {
      s.updateClip(op.clipId, { duration: Math.max(2, Math.round(op.seconds * fps)) });
    } else if (op.op === 'remove') {
      s.removeClip(op.clipId);
    } else if (op.op === 'replace_recipe') {
      const template = resolveMotionTemplate(op.recipeId);
      const cardId = template ? motionCardId(template) : '';
      if (!CARDS[cardId]) continue;
      s.updateClip(op.clipId, { cardId, inOffset: 0 });
    }
    applied++;
  }
  return applied;
}
