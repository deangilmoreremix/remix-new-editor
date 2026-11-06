/**
 * Motion Studio film chat — what a chat message asks for, and the Ink Press
 * storyboard built without a model.
 *
 * The chat is the way into the director: "make a promo for my product" starts
 * a film, "use the deck-deal-flyin and row-embed shot cards" picks the shots by
 * name (names copied straight from the Gallery), "design a product close-up
 * inspired by spotlight-hero-card" builds one shot, and "with the Ink Press
 * template" takes the validated template path. Plain data, no React, so the
 * same rules hold in the entry composer, the studio's Agent panel and tests.
 */
import {
  MOTION_TEMPLATES,
  MOTION_TEMPLATE_CARDS,
  getMotionTemplateCardShot,
  motionTemplateTitle,
  resolveMotionTemplate,
  type MotionCategoryKey,
  type MotionTemplate,
} from '../../../data/motionRecipeCatalog';
import type { MotionPreset } from './motionPreset';
import { PLAN_LIMITS, isBrandScene, validatePlan, type DirectorPalette, type DirectorPlan, type DirectorScene, type MappingRow, type SceneTransition } from './directorPlan';
import { filmRuleViolations } from './shotRules';
import { SHOT_FACTS } from '../demosrc/_generated/shotFacts';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Shots of the Ink Press template, in film order: real pages throughout, launch outro. */
export const INK_PRESS_SHOTS: readonly string[] = [
  'opening/spotlight-hero-card/SpotlightHeroCard',
  'ui-entrance/deck-deal-flyin/DeckDealFlyin',
  'ui-entrance/row-embed/RowEmbed',
  'camera/crash-zoom-punch/CrashZoomReal',
  'ui-entrance/page-waterfall-wall/PageWaterfallWall',
  'outro/outro-group-photo-launch/OutroGroupPhotoLaunch',
];

/* findSiteUrl lives here (not in directorClient) so this module stays free of the browser store. */
/** First web address in a prompt (`https://…`, `www.…`, or `name.tld`). */
export function findSiteUrl(prompt: string): string | null {
  const m = prompt.match(/\bhttps?:\/\/[^\s)'"<>]+|\bwww\.[^\s)'"<>]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|io|app|ai|co|dev|net|org|so|xyz|tech)(?![a-z0-9-])(?:\/[^\s)'"<>]*)?/i);
  return m ? m[0].replace(/[.,;:!?]+$/, '') : null;
}

/** Most shots a film can be asked to include: a storyboard holds PLAN_LIMITS.maxScenes, two go to the title cards. */
export const MAX_PICKED_SHOTS = PLAN_LIMITS.maxScenes - 2;

export const INK_PRESS_PALETTE: DirectorPalette = { background: '#f7f4ee', text: '#1c1a17', accent: '#b5651d' };

export const INK_PRESS_INTRO =
  'I can build this with the Ink Press template — a validated launch film: a bold paper-and-ink title card, ' +
  'your real pages in product shots (spotlight-hero-card → deck-deal-flyin → row-embed → crash-zoom → ' +
  'page-waterfall-wall), caption strips, flash cuts on the beat, whoosh and impact sound design, and a launch outro. ' +
  'It is the fastest path: your screenshots, copy and logo dropped into a template that is already tuned.\n\n' +
  'Use Ink Press? Or I can let the director pick shots from the whole library — or name the shot cards you want ' +
  '(e.g. “use deck-deal-flyin and row-embed”). Or choose “Work it out together”: I read your site, propose the product ' +
  'check, a visual direction and a shot plan, and you confirm each step before I write the storyboard.';

export type FilmTemplateChoice = 'inkpress' | 'director';

export interface FilmRequest {
  /** The message as the user wrote it. */
  prompt: string;
  /** Shots named in the message, in the order they were named. */
  recipes: MotionTemplate[];
  /** "inspired by <shot>" / "a close-up …": build only this shot. */
  single: MotionTemplate | null;
  /** Ink Press named (or explicitly declined); undefined when not mentioned. */
  template: FilmTemplateChoice | undefined;
  /** Length stated in the message, seconds. */
  durationSec: number | null;
  /** Product URL in the message, if any. */
  siteUrl: string | null;
  /** Frame size stated in the message ("vertical", "9:16", "square", "for TikTok"…); null = the size picker's. */
  aspectRatio?: '16:9' | '9:16' | '1:1' | null;
  /** The feature → shot map already confirmed (co-creation); autonomous films have the director write one. */
  mapping?: MappingRow[];
}

/** The frame size a message asks for, if it names one. */
export function aspectFromText(text: string): '16:9' | '9:16' | '1:1' | null {
  if (/\b9\s*[:x×/]\s*16\b|\bvertical\b|\bportrait\b|\b(?:tik\s?tok|reels?|shorts|stor(?:y|ies))\b/i.test(text)) return '9:16';
  if (/\b1\s*[:x×/]\s*1\b|\bsquare\b/i.test(text)) return '1:1';
  if (/\b16\s*[:x×/]\s*9\b|\blandscape\b|\bhorizontal\b|\bwidescreen\b|\byoutube\b/i.test(text)) return '16:9';
  return null;
}

const INK_PRESS_RE = /\bink[\s-]?press\b/i;
const FILM_NOUN_RE =
  /\b(?:promo|promotional|teaser|trailer|walkthrough|walk-through|reel|commercial|explainer|showcase|sizzle|launch\s+(?:film|video)|product\s+(?:film|video)|close-?up)\b/i;
const NEW_FILM_RE = /\b(?:a|an|new|another)\s+(?:[\w-]+\s+){0,3}(?:video|film|movie)\b/i;
/** "make a promo …", "create a new launch video …": a creation verb straight into a film noun. */
const CREATE_FILM_RE =
  /\b(?:make|create|build|produce|generate|design|direct)\s+(?:me\s+|us\s+)?(?:a|an|new|another)\s+(?:[\w-]+\s+){0,3}(?:film|video|movie|promo|teaser|trailer|commercial|explainer|showcase|sizzle|reel|walkthrough|close-?up)\b/i;
const VERB_RE = /\b(?:make|create|build|produce|design|generate|cut|present|turn|use|start|direct|film|shoot|want|need)\b/i;
const SHOTCRAFT_RE = /\bvideo[\s-]?shotcraft\b/i;
const SINGLE_RE = /\b(?:inspired\s+by|in\s+the\s+style\s+of|based\s+on|like)\b/i;
const SINGLE_NOUN_RE = /\b(?:close-?up|single\s+shot|one\s+shot|a\s+shot)\b/i;
const DURATION_RE = /\b(\d{1,3})\s*-?\s*(?:s|sec|secs|second|seconds)\b/i;
const MINUTE_RE = /\b(\d)\s*-?\s*(?:min|minute)s?\b/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every name a shot can be called by in chat, longest first so "crash-zoom-punch" wins over "crash-zoom". */
const NAME_INDEX: Array<{ re: RegExp; shot: MotionTemplate }> = (() => {
  const entries: Array<{ name: string; shot: MotionTemplate }> = [];
  for (const shot of MOTION_TEMPLATES) {
    entries.push({ name: shot.componentName, shot });
    if (shot.nameEn.includes('-')) entries.push({ name: shot.nameEn, shot });
  }
  for (const card of MOTION_TEMPLATE_CARDS) {
    const shot = getMotionTemplateCardShot(card);
    if (shot && card.slug.includes('-')) entries.push({ name: card.slug, shot });
  }
  const seen = new Set<string>();
  return entries
    .filter((e) => {
      const key = e.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.name.length - a.name.length)
    .map((e) => ({ re: new RegExp(`(?<![\\w-])${escapeRe(e.name)}(?![\\w-])`, 'i'), shot: e.shot }));
})();

/** Shots named in a message (slug, Gallery name or component name, or a full catalog id), in order of mention. */
export function findNamedRecipes(text: string): MotionTemplate[] {
  const hits: Array<{ at: number; shot: MotionTemplate }> = [];
  let rest = text;
  for (const id of text.match(/\b[a-z-]+\/[a-z0-9-]+(?:\/[A-Za-z0-9]+)?\b/g) ?? []) {
    const t = resolveMotionTemplate(id);
    const shot = t && (MOTION_TEMPLATES.includes(t) ? t : getMotionTemplateCardShot(t));
    if (shot) {
      hits.push({ at: text.indexOf(id), shot });
      rest = rest.replace(id, ' '.repeat(id.length));
    }
  }
  for (const { re, shot } of NAME_INDEX) {
    const m = re.exec(rest);
    if (!m) continue;
    hits.push({ at: m.index, shot });
    // Blank the match so a shorter name inside it ("crash-zoom" in "crash-zoom-punch") cannot match again.
    rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length);
  }
  const out: MotionTemplate[] = [];
  for (const { shot } of hits.sort((a, b) => a.at - b.at)) if (!out.includes(shot)) out.push(shot);
  return out;
}

/** Read a chat message as a film request. */
export function parseFilmRequest(text: string): FilmRequest {
  const prompt = text.trim();
  const recipes = findNamedRecipes(prompt);
  const minutes = prompt.match(MINUTE_RE);
  const seconds = prompt.match(DURATION_RE);
  const durationSec = minutes ? Number(minutes[1]) * 60 : seconds ? Number(seconds[1]) : null;
  const single =
    recipes.length === 1 && (SINGLE_RE.test(prompt) || SINGLE_NOUN_RE.test(prompt)) && !FILM_NOUN_RE.test(prompt.replace(/close-?up/gi, ''))
      ? recipes[0]
      : null;
  let template: FilmTemplateChoice | undefined;
  if (INK_PRESS_RE.test(prompt)) template = /\b(?:no|not|without|skip|don'?t)\b[^.]{0,20}ink[\s-]?press/i.test(prompt) ? 'director' : 'inkpress';
  return { prompt, recipes, single, template, durationSec, siteUrl: findSiteUrl(prompt), aspectRatio: aspectFromText(prompt.replace(/https?:\/\/\S+/g, '')) };
}

/** A question about the storyboard ("why this shot?", "what will the opening say?") rather than a change to it. */
export function isQuestion(text: string): boolean {
  const t = text.trim();
  if (!t || findNamedRecipes(t).length) return false;
  return /\?\s*$/.test(t) || /^(?:why|how|what|which|who|where|when|explain|tell me|walk me through)\b/i.test(t);
}

/** True when a message asks for a new film or shot rather than an edit to the current one. */
export function isFilmRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (SHOTCRAFT_RE.test(t) || INK_PRESS_RE.test(t)) return true;
  if (!VERB_RE.test(t)) return false;
  if (FILM_NOUN_RE.test(t) || NEW_FILM_RE.test(t)) return true;
  // "use the deck-deal-flyin and row-embed shot cards to present this feature"
  return findNamedRecipes(t).length > 0 && /\b(?:use|present|design|make|create|build|show)\b/i.test(t);
}

/**
 * The stricter test for a chat that is already editing a film: only an
 * explicit ask for a new film counts ("make a promo for …", video-shotcraft,
 * Ink Press, or named shot cards), so edits like "make my video shorter" or
 * "make the intro a close-up" stay edits.
 */
export function isNewFilmRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (SHOTCRAFT_RE.test(t) || INK_PRESS_RE.test(t) || CREATE_FILM_RE.test(t)) return true;
  return findNamedRecipes(t).length > 0 && /\bshot[\s-]*cards?\b|\binspired\s+by\b/i.test(t);
}

const bareHost = (u: string) => u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/[/?#].*$/, '').toLowerCase();

/**
 * While a storyboard is on the table every message revises it — unless it plainly starts a
 * different film: a "new / another film", a different site's URL, or "make a promo for <subject>".
 * "make a video shorter" stays a revision.
 */
export function startsDifferentFilm(text: string, current: { siteUrl?: string | null }): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\b(?:new|another|different|separate)\s+(?:[\w-]+\s+)?(?:film|video|promo|teaser|trailer|shot)\b/i.test(t)) return true;
  const url = findSiteUrl(t);
  if (url && current.siteUrl && bareHost(url) !== bareHost(current.siteUrl)) return true;
  return CREATE_FILM_RE.test(t) && (Boolean(url) || /\b(?:for|about|of|called|named)\s+\S+/i.test(t));
}

/** Answer to the Ink Press question: yes / no / not an answer. */
export function readTemplateAnswer(text: string): FilmTemplateChoice | null {
  const t = text.trim().toLowerCase();
  if (INK_PRESS_RE.test(t) && !/\b(?:no|not|without|skip)\b/.test(t)) return 'inkpress';
  if (/^(?:y|yes|yep|yeah|sure|ok|okay|please|do it|go|go ahead|use it|sounds good|perfect|great)\b/.test(t)) return 'inkpress';
  if (/\b(?:no|nope|director|library|other shots|pick (?:the )?shots|choose (?:the )?shots|your choice|you choose|surprise)\b/.test(t)) return 'director';
  return null;
}

// ── Ink Press storyboard without a model ───────────────────────────────────

const SCENE_COPY: Record<MotionCategoryKey, [string, string]> = {
  opening: ['Front and *centre*.', 'Your product, the way customers see it'],
  typography: ['Say it *loud*.', 'The message, set in motion'],
  'ui-entrance': ['Every page, *live*.', 'Real screens, not mock-ups'],
  camera: ['Up close on the *details*.', 'Every pixel, sharp'],
  data: ['The numbers that *matter*.', 'Results you can see'],
  interaction: ['Built to be *used*.', 'Click, type, done'],
  transition: ['And *then*…', ''],
  rhythm: ['On the *beat*.', 'Fast, focused, yours'],
  effects: ['A little *magic*.', 'Polish where it counts'],
  outro: ['Ready when *you* are.', 'Launching now'],
};

/** Product name for on-screen copy: captured page title, brand kit, or "for <Name>" in the prompt. */
/**
 * The company's name: the title segment that contains the domain's label
 * ("South Florida's Premier Managed IT | Connections for Business" on connections.com
 * -> "Connections for Business"), else the label itself ("Connections").
 */
export function siteNameOf(title: string, url: string): string {
  let label = '';
  try {
    const parts = new URL(url).hostname.replace(/^www\./, '').split('.');
    label = (parts.length > 1 ? parts[parts.length - 2] : parts[0]) ?? '';
  } catch {
    /* no host */
  }
  const squash = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  const segs = title.split(/\s[|\u2013\u2014-]\s|:\s/).map((v) => v.trim()).filter(Boolean);
  const hit = label ? segs.find((v) => squash(v).includes(squash(label))) : undefined;
  const name = hit ?? (label ? label.charAt(0).toUpperCase() + label.slice(1) : segs[0] ?? '');
  return name.slice(0, 40);
}

export function productNameFrom(prompt: string, hints: { siteTitle?: string | null; siteUrl?: string | null; businessName?: string | null } = {}): string {
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 28);
  if (hints.businessName?.trim()) return clean(hints.businessName);
  if (hints.siteTitle?.trim()) return clean(hints.siteUrl ? siteNameOf(hints.siteTitle, hints.siteUrl) : hints.siteTitle.split(/\s[|–—:-]\s/)[0]);
  const m = prompt.match(/\b(?:for|of|called|named)\s+([A-Z][\w.-]*(?:\s+[A-Z][\w.-]*){0,2})/);
  if (m) return clean(m[1]);
  const url = findSiteUrl(prompt);
  if (url) {
    const host = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/.]/)[0];
    if (host) return clean(host.charAt(0).toUpperCase() + host.slice(1));
  }
  return 'your product';
}

/** What a captured site says about itself (the capture's product check). */
export interface SiteContent {
  description?: string;
  headline?: string;
  headings?: string[];
  ctas?: string[];
  nav?: string[];
}

const sceneFor = (shot: MotionTemplate, durationSec: number, transition: DirectorScene['transition']): DirectorScene => {
  const [headline, caption] = SCENE_COPY[shot.category] ?? ['', ''];
  return { kind: 'shot', recipeId: shot.id, durationSec, headline: headline.replace(/\*/g, ''), caption, transition };
};

/**
 * A storyboard built from the Ink Press template (or from the shots the user
 * named) with no model call: title card, the shots, a call-to-action card.
 * Fitted to the requested length by the same validation the director's plans go through.
 */
export function inkPressPlan(opts: {
  prompt: string;
  durationSec: number;
  recipes?: readonly MotionTemplate[];
  productName?: string;
  palette?: Partial<DirectorPalette> | null;
  /** What the captured site says about itself: its headline under the title, section headings as shot captions, its call to action at the end. */
  content?: SiteContent | null;
  /** The site was captured with pictures: tell its story with the URL scan and hub scenes, then close on its logo. */
  siteScenes?: boolean;
  /** How many of the site's own pictures (crops, people, products) were captured. */
  pictures?: number;
}): DirectorPlan {
  const name = opts.productName || productNameFrom(opts.prompt);
  const site = opts.content ?? null;
  const fit = (line: string | undefined, max: number) => (line ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const shots = (opts.recipes?.length ? opts.recipes : INK_PRESS_SHOTS.map((id) => resolveMotionTemplate(id)!).filter(Boolean)).slice();
  const target = Math.max(PLAN_LIMITS.minFilmSec, Math.min(PLAN_LIMITS.maxFilmSec, opts.durationSec));
  // Keep every scene ≥ ~2s: drop template shots (never named ones) until they fit.
  const maxScenes = Math.max(PLAN_LIMITS.minScenes, Math.floor(target / 2));
  const named = Boolean(opts.recipes?.length);
  while (!named && shots.length + 2 > maxScenes && shots.length > 1) shots.splice(shots.length - 2, 1);
  // Titles only when they fit, in time and in the storyboard's scene limit (a shot is never dropped for a title).
  const withTitles = target >= (shots.length + 2) * PLAN_LIMITS.minSceneSec && shots.length + 2 <= PLAN_LIMITS.maxScenes;
  const scenes: DirectorScene[] = [];
  if (withTitles) {
    scenes.push({ kind: 'title', recipeId: '', durationSec: 2.5, headline: `Meet *${name}*.`, caption: fit(site?.headline || site?.description, PLAN_LIMITS.captionChars), transition: 'cut' });
  }
  // The template's own arc for a captured site: the address scanned, then the product as a hub of its features.
  const story = Boolean(opts.siteScenes) && withTitles && target >= (shots.length + 4) * PLAN_LIMITS.minSceneSec && shots.length + 4 <= PLAN_LIMITS.maxScenes;
  if (story) {
    scenes.push({ kind: 'shot', recipeId: 'brand/url-scan', durationSec: 3.5, headline: '', caption: '', transition: 'cut', feature: 'We read your site', action: 'address typed, page scanned', asset: 'your page' });
    scenes.push({ kind: 'shot', recipeId: 'brand/hub', durationSec: 3.5, headline: fit(site?.headline || site?.description, PLAN_LIMITS.headlineChars), caption: '', transition: 'cut', feature: 'Everything in one place', action: 'features as nodes around your page', asset: 'your page + menu' });
  }
  if (story && (opts.pictures ?? 0) >= 2 && shots.length + 5 <= PLAN_LIMITS.maxScenes && target >= (shots.length + 5) * PLAN_LIMITS.minSceneSec) {
    scenes.push({ kind: 'shot', recipeId: 'brand/people-gallery', durationSec: 4, headline: fit(site?.headings?.[0], PLAN_LIMITS.headlineChars), caption: '', transition: 'cut', feature: 'The people and pictures', action: 'the site\'s own pictures, one after another', asset: 'your images' });
  }
  shots.forEach((shot, i) => {
    const scene = sceneFor(shot, shot.durationSec || 4, i === 0 || i === shots.length - 1 ? 'flash' : 'cut');
    const heading = fit(site?.headings?.[i], PLAN_LIMITS.captionChars);
    scenes.push(heading ? { ...scene, caption: heading } : scene);
  });
  if (withTitles) {
    scenes.push({ kind: 'title', recipeId: '', durationSec: 2.5, headline: `Try *${name}* today.`, caption: fit(site?.ctas?.[0], PLAN_LIMITS.captionChars), transition: 'cut' });
  }
  if (scenes.length < PLAN_LIMITS.minScenes) {
    scenes.push({ kind: 'title', recipeId: '', durationSec: 2, headline: `*${name}*.`, caption: '', transition: 'cut' });
  }
  const palette = { ...INK_PRESS_PALETTE, ...Object.fromEntries(Object.entries(opts.palette ?? {}).filter(([, v]) => Boolean(v))) };
  const plan = validatePlan(
    {
      title: `${name === 'your product' ? 'Product' : name} — ${named ? 'shot film' : 'Ink Press'}`,
      summary: named
        ? `Your chosen shots (${shots.map(motionTemplateTitle).join(', ')}) between an Ink Press title and call to action.`
        : 'Ink Press template: title card, real-page product shots, caption strips, flash cuts and a launch outro.',
      palette,
      scenes,
    },
    { targetSec: target },
  );
  return plan;
}

/** One shot, adapted to the product: the shot plus its caption, at its native length. */
export function singleShotPlan(
  shot: MotionTemplate,
  opts: { prompt: string; productName?: string; palette?: Partial<DirectorPalette> | null; /** A length the user asked for; else the shot's native length. */ durationSec?: number | null },
): DirectorPlan {
  const name = opts.productName || productNameFrom(opts.prompt);
  const durationSec = Math.max(PLAN_LIMITS.minSceneSec, Math.min(PLAN_LIMITS.maxSceneSec, opts.durationSec || shot.durationSec || 5));
  const palette = { ...INK_PRESS_PALETTE, ...Object.fromEntries(Object.entries(opts.palette ?? {}).filter(([, v]) => Boolean(v))) };
  return {
    title: `${name === 'your product' ? 'Product' : name} — ${motionTemplateTitle(shot)}`,
    summary: `One ${motionTemplateTitle(shot)} shot adapted to ${name}.`,
    palette: palette as DirectorPalette,
    scenes: [{ ...sceneFor(shot, durationSec, 'cut'), headline: name === 'your product' ? '' : name }],
  };
}

const REMOVE_RE = /\b(?:remove|drop|without|lose)\b/i;

/**
 * The required shots after a storyboard revision. Named shots are added, but a
 * replacement replaces: "use X instead of Y", "replace Y with X", "swap Y for
 * X", "remove Y", and a bare "use X instead" (which drops the earlier picks, so
 * the director is free to cut them).
 */
export function reviseRecipes(prev: readonly MotionTemplate[], text: string): MotionTemplate[] {
  const named = (part: string) => findNamedRecipes(part);
  const merge = (keep: readonly MotionTemplate[], add: readonly MotionTemplate[]) => [...keep, ...add.filter((r) => !keep.includes(r))];
  const drop = (gone: readonly MotionTemplate[]) => prev.filter((r) => !gone.includes(r));
  let m = text.match(/^([\s\S]*)\binstead\s+of\b([\s\S]*)$/i);
  if (m) {
    const removed = named(m[2]);
    const added = named(m[1]);
    // Put each new shot where the shot it replaces was.
    if (removed.length === 1 && added.length === 1 && prev.includes(removed[0])) {
      return merge(prev.map((r) => (r === removed[0] ? added[0] : r)), []);
    }
    return merge(drop(removed), added);
  }
  m = text.match(/\breplace\b([\s\S]*)\bwith\b([\s\S]*)$/i) ?? text.match(/\bswap\b([\s\S]*)\b(?:for|with)\b([\s\S]*)$/i);
  if (m) {
    const removed = named(m[1]);
    const added = named(m[2]);
    if (removed.length === 1 && added.length === 1 && prev.includes(removed[0])) {
      return merge(prev.map((r) => (r === removed[0] ? added[0] : r)), []);
    }
    return merge(drop(removed), added);
  }
  const names = named(text);
  if (/\binstead\b/i.test(text)) return names.length ? names : prev.slice();
  if (REMOVE_RE.test(text)) return drop(names);
  return merge(prev, names);
}

/**
 * Make sure every shot the user named is in the plan, in their order, then
 * re-fit the length. The director is asked to use them, but its output is
 * checked rather than trusted.
 */
export function ensureRecipes(plan: DirectorPlan, recipes: readonly MotionTemplate[], targetSec: number): DirectorPlan {
  if (!recipes.length) return plan;
  const named = (s: DirectorScene) => s.kind === 'shot' && recipes.some((r) => r.id === s.recipeId);
  const missing = recipes.filter((r) => !plan.scenes.some((s) => s.recipeId === r.id));
  const scenes = plan.scenes.slice();
  // Insert before a closing title / outro so the call to action stays last.
  const last = scenes[scenes.length - 1];
  const closing = last && (last.kind === 'title' || resolveMotionTemplate(last.recipeId)?.category === 'outro') ? 1 : 0;
  if (missing.length) scenes.splice(scenes.length - closing, 0, ...missing.map((r) => sceneFor(r, r.durationSec || 4, 'cut')));
  // The named shots play in the order they were named: the slots they hold keep
  // their places in the film, and the shots are dealt into those slots in order.
  // (A pick that plays more than once keeps the story's own order: the scenes are not re-dealt.)
  const slots = scenes.map((s, i) => (named(s) ? i : -1)).filter((i) => i >= 0);
  if (new Set(slots.map((i) => scenes[i].recipeId)).size === slots.length) {
    const inOrder = slots
      .map((i) => scenes[i])
      .sort((a, b) => recipes.findIndex((r) => r.id === a.recipeId) - recipes.findIndex((r) => r.id === b.recipeId));
    slots.forEach((slot, k) => {
      scenes[slot] = inOrder[k];
    });
  }
  const unchanged = !missing.length && scenes.every((s, i) => s === plan.scenes[i]);
  if (unchanged) return plan;
  // Drop unnamed shots first if the plan is now too long.
  while (scenes.length > PLAN_LIMITS.maxScenes) {
    // Unnamed shots go first, then title cards: validation keeps only the first maxScenes,
    // so anything left over would cut named shots off the end.
    let idx = scenes.findIndex((s) => s.kind === 'shot' && !recipes.some((r) => r.id === s.recipeId));
    if (idx < 0) idx = scenes.findIndex((s) => s.kind === 'title');
    if (idx < 0) break;
    scenes.splice(idx, 1);
  }
  return validatePlan({ ...plan, scenes }, { targetSec });
}

/**
 * Put the site's own words on the storyboard: its headline under the opening title card, its
 * section headings as the shots' captions, its call to action under the closing card. The
 * framing cards always take the site's words; a shot keeps a caption the director wrote.
 */
export function applySiteContent(plan: DirectorPlan, content: SiteContent | null | undefined): DirectorPlan {
  if (!content) return plan;
  const fit = (line: string | undefined) => (line ?? '').replace(/\s+/g, ' ').trim().slice(0, PLAN_LIMITS.captionChars);
  let heading = 0;
  const last = plan.scenes.length - 1;
  const scenes = plan.scenes.map((scene, i) => {
    // The site's own headline and call to action win the framing cards, even over generic copy the director wrote.
    if (scene.kind === 'title') {
      const line = fit(i === 0 ? content.headline || content.description : i === last ? content.ctas?.[0] : undefined);
      return line ? { ...scene, caption: line } : scene;
    }
    const heading_ = content.headings?.[heading++];
    if (scene.caption) return scene;
    const line = fit(heading_);
    return line ? { ...scene, caption: line } : scene;
  });
  return { ...plan, scenes };
}

/**
 * Shapes the director's scenes by the upstream method: a technique is the protagonist once (a repeated recipe is
 * the "same shot twice" the final review rejects), and picked shots are the film's only catalog recipes.
 *  - Every pick plays once, in the model's order; a scene whose recipe was not picked takes the next unplayed
 *    pick (keeping that scene's copy). A scene that would repeat a recipe, or has no pick left, becomes one of
 *    the site's own scenes (hub once, then push-ins on real sections) with the same copy — when the site was
 *    captured; without a site the repeat is dropped and the remaining shots hold longer.
 *  - The first and last scene may frame the film (title or brand scene); breathing title cards in the middle
 *    stay (at most three) while every scene keeps its minimum time.
 * Lengths are re-fitted.
 */
/**
 * Keep a storyboard to the shot cards' rules (lib/shotRules): a recipe once, groups within their
 * caps, opening / outro recipes where they belong, one look family. A scene that breaks a rule gives
 * way to one of the site's own scenes with the same copy (a captured site) or is dropped; recipes
 * the person named stay. Says what it changed.
 */
export function applyFilmRules(plan: DirectorPlan, opts: { keep?: ReadonlySet<string>; siteScenes?: boolean; ground?: 'dark' | 'light' | null } = {}): { plan: DirectorPlan; notes: string[] } {
  const found = filmRuleViolations(plan.scenes, opts.keep, opts.ground);
  if (!found.length) return { plan, notes: [] };
  const bad = new Map(found.map((f) => [f.index, f]));
  let zooms = 0;
  const scenes: DirectorScene[] = [];
  plan.scenes.forEach((scene, i) => {
    if (!bad.has(i)) {
      scenes.push(scene);
      return;
    }
    if (opts.siteScenes) scenes.push({ ...scene, recipeId: zooms++ === 0 && !plan.scenes.some((x) => x.recipeId === 'brand/hub') ? 'brand/hub' : 'brand/feature-zoom', asset: scene.asset || 'your page' });
  });
  if (scenes.length < PLAN_LIMITS.minScenes) return { plan, notes: [] };
  const title = (id: string) => {
    const t = resolveMotionTemplate(id);
    return t ? motionTemplateTitle(t) : id;
  };
  const kept = validatePlan({ ...plan, scenes }, { targetSec: plan.scenes.reduce((sum, s) => sum + s.durationSec, 0), maxSceneSec: 12 });
  return { plan: kept, notes: found.map((f) => `${title(f.recipeId)}: ${f.reason}`) };
}

/** Document / report shots: the most information on screen (promo-energy-arc: placed just before the finale). */
const DOCUMENT_SLUGS = new Set(['document-typewriter-reveal', 'research-card-stack-scroll', 'doc-park-left-pill-deal']);
const DOCUMENT_STEMS = new Set(['ChangelogScrollBrake']);
const isDocumentShot = (s: DirectorScene): boolean => {
  const t = s.kind === 'shot' && !isBrandScene(s.recipeId) ? resolveMotionTemplate(s.recipeId) : undefined;
  return Boolean(t && (DOCUMENT_STEMS.has(t.componentName) || DOCUMENT_SLUGS.has(SHOT_FACTS[t.componentName]?.slug ?? '')));
};

/**
 * Order the feature climb the way promo-energy-arc step 3 does it: high-energy shots and steady ones
 * (reading, interaction) alternate — consecutive high energy reads as noise — and the shot with the most
 * information (document / report type) sits just before the finale, 2nd–3rd from last. Only the feature
 * shots move, among their own places: the opening, the protagonist, title cards, site scenes and the
 * finale keep theirs. A film of shots the person named keeps the order they asked for.
 */
export function arrangeArc(plan: DirectorPlan, keep: ReadonlySet<string> = new Set()): DirectorPlan {
  if (keep.size) return plan;
  const scenes = plan.scenes;
  const recipeAt = scenes.map((s, i) => (s.kind === 'shot' && !isBrandScene(s.recipeId) ? i : -1)).filter((i) => i >= 0);
  if (recipeAt.length < 3) return plan;
  // The protagonist (first recipe shot) and an outro recipe at the end keep their places.
  const outro = (i: number) => {
    const t = resolveMotionTemplate(scenes[i].recipeId);
    return i >= scenes.length - 2 && Boolean(t && ['outro-group-photo-launch', 'ui-strip-away-outro', 'ui-to-brand-morph', 'pull-back-isolation'].includes(SHOT_FACTS[t.componentName]?.slug ?? ''));
  };
  const slots = recipeAt.slice(1).filter((i) => !outro(i));
  if (slots.length < 2) return plan;
  const pool = slots.map((i) => scenes[i]);
  const docs = pool.filter(isDocumentShot);
  const rest = pool.filter((s) => !isDocumentShot(s));
  const high = rest.filter((s) => sceneEnergy(s) >= 3);
  const steady = rest.filter((s) => sceneEnergy(s) < 3);
  // Alternate, starting with whichever kind there is more of, so the leftovers do not bunch at the end.
  const order: DirectorScene[] = [];
  let takeHigh = high.length >= steady.length;
  while (high.length || steady.length) {
    const from = (takeHigh && high.length) || !steady.length ? high : steady;
    order.push(from.shift()!);
    takeHigh = !takeHigh;
  }
  // The document shot takes the last feature place (just before the finale).
  order.push(...docs);
  const out = scenes.slice();
  slots.forEach((i, k) => {
    out[i] = { ...order[k], transition: scenes[i].transition };
  });
  return { ...plan, scenes: out };
}

/** Caps from the transition cards: wipes / barn-doors ≤ 2, dips ≤ 2, flash cuts ≤ 3 (R4) in one film. */
const SEAM_CAPS = { panel: 2, dip: 2, flash: 3, light: 1, whip: 2, ring: 2, window: 2, push: 2 } as const;
const seamGroup = (t: SceneTransition | undefined): keyof typeof SEAM_CAPS | null =>
  t === 'wipe' || t === 'barn' || t === 'ink' ? 'panel' : t === 'dip' || t === 'iris' ? 'dip' : t === 'flash' || t === 'glitch' ? 'flash' : t === 'portal' || t === 'line' ? 'ring' : t === 'leak' ? 'light' : t === 'whip' ? 'whip' : t === 'window' ? 'window' : t === 'push' ? 'push' : null;

/** A scene's energy on the cards' scale (0 low … 4 high); site scenes by what they do. */
const ENERGY_RANK = { low: 0, 'low-mid': 1, mid: 2, 'mid-high': 3, high: 4, 'n/a': 2 } as const;
const BRAND_ENERGY: Record<string, number> = { 'brand/url-scan': 2, 'brand/hub': 2, 'brand/feature-zoom': 2, 'brand/people-gallery': 1, 'brand/logo-reveal': 1 };
export function sceneEnergy(scene: DirectorScene): number {
  if (scene.kind === 'title') return 1;
  if (isBrandScene(scene.recipeId)) return BRAND_ENERGY[scene.recipeId] ?? 2;
  const t = resolveMotionTemplate(scene.recipeId);
  const e = t ? SHOT_FACTS[t.componentName]?.energy : undefined;
  return e ? ENERGY_RANK[e] : 2;
}

const featureWords = (s: DirectorScene) => new Set(`${s.feature ?? ''} ${s.headline ?? ''}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
/** Overview → that feature's detail: the seam the window (style C) is for. */
function opensDetail(a: DirectorScene, b: DirectorScene): boolean {
  if (b.kind !== 'shot' || b.recipeId === 'brand/logo-reveal') return false;
  if (a.recipeId === 'brand/hub' || a.recipeId === 'brand/url-scan' || b.recipeId === 'brand/feature-zoom') return true;
  const wa = featureWords(a);
  return [...featureWords(b)].some((w) => wa.has(w));
}

/**
 * Pick the seam for each scene change, the way the shot-transitions card does it: a seam is never a bare
 * cut between two shots ("launch films never once use a bare cut"); the style follows the energy drop and
 * what the seam means — overview into a feature's detail goes through the window (C), high energy into
 * high energy whips (B), shots of similar energy push in through a white flash (A), a big drop dips or
 * closes, a rise pushes or wipes. Title cards cut in and out plainly; the closing logo is dipped into.
 * Each style keeps its cap, the film's motion voice decides which are in character, and the director's
 * own pick stays when it fits. A seam with every fitting style used up stays a cut.
 */
export function chooseSeams(plan: DirectorPlan, preset?: MotionPreset): DirectorPlan {
  const fits = (t: SceneTransition) => !preset || t === 'cut' || preset.seams.includes(t);
  const used = { panel: 0, dip: 0, flash: 0, light: 0, whip: 0, ring: 0, window: 0, push: 0 };
  const last = plan.scenes.length - 1;
  const take = (t: SceneTransition): boolean => {
    const g = seamGroup(t);
    if (!g || !fits(t) || used[g] >= SEAM_CAPS[g]) return false;
    used[g]++;
    return true;
  };
  const seams: SceneTransition[] = plan.scenes.map(() => 'cut');
  // The director's own picks first, then the rule for the rest.
  plan.scenes.forEach((scene, i) => {
    if (i === last || !scene.transition || scene.transition === 'cut') return;
    if (scene.kind === 'title' || plan.scenes[i + 1].kind === 'title') return;
    if (take(scene.transition)) seams[i] = scene.transition;
  });
  plan.scenes.forEach((scene, i) => {
    if (i === last || seams[i] !== 'cut') return;
    const next = plan.scenes[i + 1];
    if (scene.kind === 'title' || next.kind === 'title') return;
    const e1 = sceneEnergy(scene);
    const e2 = sceneEnergy(next);
    const wants: SceneTransition[] = [];
    if (i + 1 === last && next.recipeId === 'brand/logo-reveal') wants.push('dip', 'iris');
    if (opensDetail(scene, next)) wants.push('window', 'portal');
    if (e1 >= 3 && e2 >= 3) wants.push('whip', 'flash');
    if (e1 - e2 >= 2) wants.push('dip', 'iris', 'ink');
    if (e2 - e1 >= 2) wants.push('push', 'wipe', 'whip');
    if (Math.abs(e1 - e2) <= 1) wants.push('flash', 'push', 'wipe');
    wants.push('wipe', 'push', 'barn', 'line', 'ink', 'iris', 'portal', 'window', 'whip', 'flash', 'dip', 'leak', 'glitch');
    for (const t of wants) {
      if (take(t)) {
        seams[i] = t;
        return;
      }
    }
  });
  return { ...plan, scenes: plan.scenes.map((scene, i) => ({ ...scene, transition: seams[i] })) };
}

/** Native length of the site scenes (frames of their cards at 30 fps). */
const BRAND_NATIVE_SEC: Record<string, number> = { 'brand/url-scan': 4.3, 'brand/hub': 4, 'brand/feature-zoom': 3, 'brand/logo-reveal': 3 };

/**
 * Scene lengths from the recipes' native lengths (the cards' tuned timings are the quality, so a
 * recipe is never sped up to fit): every catalog shot plays its whole motion, title cards keep a
 * reading time, site scenes their own length. Over the requested length, fillers make way (middle
 * site scenes, extra title cards, then recipes nobody named, from the end); under it, holds grow
 * (recipes up to +30 %, cards to 3 s) and the film simply ends a little short of the request.
 */
export function fitNativeLengths(plan: DirectorPlan, targetSec: number, keep: ReadonlySet<string> = new Set(), holdGrowth = 1.3): DirectorPlan {
  const nativeOf = (s: DirectorScene): number => {
    if (s.kind === 'title') return clamp(s.durationSec, 1.8, 3);
    if (isBrandScene(s.recipeId)) return BRAND_NATIVE_SEC[s.recipeId] ?? 3;
    const t = resolveMotionTemplate(s.recipeId);
    return t ? Math.max(PLAN_LIMITS.minSceneSec, t.durationSec) : s.durationSec;
  };
  const target = clamp(targetSec, PLAN_LIMITS.minFilmSec, PLAN_LIMITS.maxFilmSec);
  const scenes = plan.scenes.map((s) => ({ ...s, durationSec: nativeOf(s) }));
  const sum = () => scenes.reduce((n, s) => n + s.durationSec, 0);
  // Make way, least important first, never the first / last scene and never a named recipe.
  // Extra title cards go first, then site scenes, then recipes nobody named; the site's pictures (the gallery) stay longest.
  const rank = (s: DirectorScene) => (keep.has(s.recipeId) ? 9 : s.recipeId === 'brand/people-gallery' ? 3 : s.kind === 'title' ? 0 : isBrandScene(s.recipeId) ? 1 : 2);
  while (sum() > target + 1 && scenes.length > PLAN_LIMITS.minScenes) {
    let drop = -1;
    for (let i = scenes.length - 2; i >= 1; i--) if (rank(scenes[i]) < 9 && (drop < 0 || rank(scenes[i]) < rank(scenes[drop]))) drop = i;
    if (drop < 0) break;
    scenes.splice(drop, 1);
  }
  const spare = target - sum();
  if (spare > 0.5) {
    // Longer holds, shared in proportion to what each can still take.
    const room = scenes.map((s) => (s.kind === 'title' ? Math.max(0, 3 - s.durationSec) : s.durationSec * Math.max(0, holdGrowth - 1)));
    const total = room.reduce((n, r) => n + r, 0) || 1;
    scenes.forEach((s, i) => {
      s.durationSec += Math.min(room[i], (spare * room[i]) / total);
    });
  }
  return validatePlan({ ...plan, scenes }, { targetSec: sum(), maxSceneSec: 14 });
}

const isFraming = (s: DirectorScene | undefined): boolean => Boolean(s && (s.kind === 'title' || isBrandScene(s.recipeId)));

export function restrictToRecipes(plan: DirectorPlan, recipes: readonly MotionTemplate[], targetSec: number, opts: { siteScenes?: boolean } = {}): DirectorPlan {
  const site = Boolean(opts.siteScenes);
  const picked = recipes.length > 0;
  if (!picked && !site) return plan;
  const wanted = new Set(recipes.map((r) => r.id));
  const used = new Set<string>();
  const brandSeen = new Set<string>();
  const last = plan.scenes.length - 1;
  const kept: DirectorScene[] = [];
  let titles = 0;
  const brandScene = (from: DirectorScene, id: string): DirectorScene => {
    // The hub and the scan play once; further site scenes are push-ins on a real section.
    const use = (id === 'brand/hub' || id === 'brand/url-scan') && brandSeen.has(id) ? 'brand/feature-zoom' : id;
    brandSeen.add(use);
    return { ...from, kind: 'shot', recipeId: use, caption: from.caption, asset: from.asset || 'your page' };
  };
  plan.scenes.forEach((scene, i) => {
    const edge = i === 0 || i === last;
    if (scene.kind === 'title') {
      if (edge) kept.push(scene);
      else if (titles < 3) {
        titles++;
        kept.push(scene);
      }
      return;
    }
    if (isBrandScene(scene.recipeId)) {
      if (edge) {
        brandSeen.add(scene.recipeId);
        kept.push(scene);
      } else if (site && scene.recipeId !== 'brand/logo-reveal') kept.push(brandScene(scene, scene.recipeId));
      return;
    }
    if (picked) {
      if (wanted.has(scene.recipeId) && !used.has(scene.recipeId)) {
        used.add(scene.recipeId);
        kept.push(scene);
        return;
      }
      const free = recipes.find((r) => !used.has(r.id));
      if (free) {
        used.add(free.id);
        kept.push({ ...scene, recipeId: free.id });
        return;
      }
    } else if (!used.has(scene.recipeId)) {
      used.add(scene.recipeId);
      kept.push(scene);
      return;
    }
    if (site) kept.push(brandScene(scene, brandSeen.has('brand/hub') ? 'brand/feature-zoom' : 'brand/hub'));
  });
  // A picked shot the plan lost (e.g. the model skipped it) still plays.
  const missing = recipes.filter((r) => !used.has(r.id));
  if (missing.length) {
    const lastKept = kept[kept.length - 1];
    const at = lastKept && isFraming(lastKept) && kept.length > 1 ? kept.length - 1 : kept.length;
    kept.splice(at, 0, ...missing.map((r) => sceneFor(r, r.durationSec || 4, 'cut')));
  }
  // Every scene needs its minimum time in the requested length: drop fillers (middle title cards, then site scenes), latest first.
  const filmSec = Math.min(PLAN_LIMITS.maxFilmSec, Math.max(PLAN_LIMITS.minFilmSec, targetSec));
  const slots = Math.floor(filmSec / PLAN_LIMITS.minSceneSec);
  const filler = (k: number) => k > 0 && k < kept.length - 1 && (kept[k].kind === 'title' || isBrandScene(kept[k].recipeId));
  for (const pass of ['title', 'brand']) {
    for (let k = kept.length - 1; k >= 0 && kept.length > slots; k--) {
      if (filler(k) && (pass === 'title' ? kept[k].kind === 'title' : true)) kept.splice(k, 1);
    }
  }
  // Framing cards are optional: keep one only while every scene still gets its minimum time.
  while (kept.length > slots && kept.length > 1 && isFraming(kept[kept.length - 1]) ) kept.pop();
  while (kept.length > slots && kept.length > 1 && isFraming(kept[0])) kept.shift();
  const scenes = kept.length ? kept : plan.scenes.slice(0, 1);
  if (scenes.length < PLAN_LIMITS.minScenes) {
    scenes.push({ kind: 'title', recipeId: '', durationSec: 2, headline: plan.title.split(/\s[—–-]\s/)[0] || 'Watch now', caption: '', transition: 'cut' });
  }
  // Few scenes stretch to the requested length instead of stopping at the usual per-scene cap.
  return validatePlan({ ...plan, scenes }, { targetSec, maxSceneSec: Math.ceil(filmSec / scenes.length) });
}

/** The person asked for the site's own pictures or people. */
export const wantsSitePictures = (prompt: string): boolean => /\b(?:images?|photos?|pictures?|people|team|faces?|staff|screenshots?)\b/i.test(prompt);

/**
 * A film of a site that has pictures shows them: when the person asked for images or people (or the
 * site gave four or more), a gallery scene goes in after the hub / first scene unless the plan has one.
 */
export function addGalleryScene(plan: DirectorPlan, opts: { pictures: number; prompt: string; headline?: string }): DirectorPlan {
  if (opts.pictures < 2 || plan.scenes.some((s) => s.recipeId === 'brand/people-gallery')) return plan;
  if (!wantsSitePictures(opts.prompt) && opts.pictures < 4) return plan;
  if (plan.scenes.length + 1 > PLAN_LIMITS.maxScenes) return plan;
  const scenes = plan.scenes.slice();
  const hub = scenes.findIndex((s) => s.recipeId === 'brand/hub');
  const at = hub >= 0 ? hub + 1 : Math.min(1, scenes.length);
  scenes.splice(at, 0, { kind: 'shot', recipeId: 'brand/people-gallery', durationSec: 4, headline: (opts.headline ?? '').slice(0, PLAN_LIMITS.headlineChars), caption: '', transition: 'cut', feature: 'The people and pictures', action: "the site's own pictures, one after another", asset: 'your images' });
  return { ...plan, scenes };
}
