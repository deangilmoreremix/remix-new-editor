/**
 * Motion Studio AI director — plan contract.
 *
 * The director (server route `/api/motion-studio/director`) asks a model for a
 * storyboard that uses only the existing ShotCraft recipes and cards. It never
 * produces code: every scene is a catalog recipe id plus copy and timing, and
 * every edit is one of a few data operations. This module holds the JSON
 * schemas sent to the model and the validation applied to what comes back, so
 * the server and the browser enforce the same rules. Plain data, no React.
 */
import { MOTION_CATEGORIES, MOTION_TEMPLATES, motionTemplateTitle, resolveMotionTemplate } from '../../../data/motionRecipeCatalog';
import { drawsSampleScreen, isProductTextureShot } from './productShots';
import { isSlowToExport } from './exportCost';
import { ruleTags } from './shotRules';
import { SHOT_FACTS } from '../demosrc/_generated/shotFacts';

/** Scene cards that tell a product's story from its captured site (no catalog recipe behind them). */
export const BRAND_SCENES = {
  'brand/url-scan': { cardId: 'brand-url-scan', title: 'URL scan' },
  'brand/hub': { cardId: 'brand-hub', title: 'Brand hub' },
  'brand/feature-zoom': { cardId: 'brand-feature-zoom', title: 'Feature zoom' },
  'brand/people-gallery': { cardId: 'brand-gallery', title: 'People & pictures' },
  'brand/logo-reveal': { cardId: 'brand-logo-reveal', title: 'Logo reveal' },
} as const;
export const isBrandScene = (id: string): id is keyof typeof BRAND_SCENES => id in BRAND_SCENES;

export type SceneKind = 'shot' | 'title';
/** How a scene hands over to the next: a plain cut, or one of the cards' seam transitions. */
/** `window`: shot-transitions style C (the next scene grows out of a card of this one); `push`: bottom-push (the next scene pushes this one up). */
export type SceneTransition = 'cut' | 'flash' | 'wipe' | 'barn' | 'dip' | 'whip' | 'ink' | 'leak' | 'portal' | 'iris' | 'line' | 'glitch' | 'window' | 'push';
export const SCENE_TRANSITIONS: readonly SceneTransition[] = ['cut', 'flash', 'wipe', 'barn', 'dip', 'whip', 'ink', 'leak', 'portal', 'iris', 'line', 'glitch', 'window', 'push'];

export interface DirectorScene {
  kind: SceneKind;
  /** Catalog shot id for `shot` scenes; empty for `title` scenes. */
  recipeId: string;
  durationSec: number;
  /** Big on-screen line (title card text, or the shot's title overlay). */
  headline: string;
  /** Small caption strip under the scene; empty for none. */
  caption: string;
  transition: SceneTransition;
  /** Storyboard table: the message this scene carries, its main motion, the picture of the site it shows, its sound cue. */
  feature?: string;
  action?: string;
  asset?: string;
  sfx?: string;
}

export interface DirectorPalette {
  background: string;
  text: string;
  accent: string;
}

export interface DirectorPlan {
  title: string;
  summary: string;
  palette: DirectorPalette;
  scenes: DirectorScene[];
}

export const PLAN_LIMITS = {
  minScenes: 2,
  maxScenes: 14,
  minSceneSec: 1.5,
  maxSceneSec: 12,
  minFilmSec: 5,
  maxFilmSec: 90,
  headlineChars: 70,
  captionChars: 90,
} as const;

/** The scenes a film of this length needs: about one every 4 s, at least 3, at most the plan limit. */
export const targetSceneCount = (durationSec: number): number =>
  Math.min(PLAN_LIMITS.maxScenes, Math.max(3, Math.round(clamp(durationSec, PLAN_LIMITS.minFilmSec, PLAN_LIMITS.maxFilmSec) / 4)));

const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_PALETTE: DirectorPalette = { background: '#f7f4ee', text: '#1c1a17', accent: '#b5651d' };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : fallback);

/** One line per recipe the model may use. Product-page shots are flagged. */
const BRAND_SCENE_NOTES: Record<string, string> = {
  'brand/url-scan': 'the address typed into a bar, then the captured page scanned and tagged (use it to open a film of a captured site)',
  'brand/hub': 'the captured page in the middle with the site\'s own menu / feature names as glowing nodes (headline = the promise)',
  'brand/feature-zoom': 'slow push-in on one real section of the captured page with a label (one per feature)',
  'brand/people-gallery': 'the site\'s own pictures (people, products, cards) shown one after another with the site\'s captions — use it when the person asks for the site\'s images or people',
  'brand/logo-reveal': 'the site\'s logo and name with sparks, then its call to action and address (use it to close a film of a captured site)',
};

/** The English card's own words for a recipe: what it looks like, then when to use it (stage 2 picks from these). */
export function cardLine(componentName: string): string {
  const f = SHOT_FACTS[componentName];
  if (!f?.oneLiner) return '';
  return `${f.oneLiner}${f.useWhen ? ` USE WHEN: ${f.useWhen}` : ''}`;
}

export function buildCatalogBrief(): string {
  const label = Object.fromEntries(MOTION_CATEGORIES.map((c) => [c.key, c.labelEn]));
  const brand = Object.entries(BRAND_SCENES).map(([id, b]) => `${id} | ${b.title} | Brand scenes | 3-5s | BRAND-SCENE | ${BRAND_SCENE_NOTES[id]}`);
  return [...MOTION_TEMPLATES.map(
    (t) =>
      `${t.id} | ${motionTemplateTitle(t)} | ${label[t.category] ?? t.category} | ${t.durationSec}s${
        (isProductTextureShot(t.componentName) ? ' | PRODUCT-PAGE' : drawsSampleScreen(t) ? ' | SAMPLE-UI' : '') + (isSlowToExport(t.componentName) ? ' | SLOW-EXPORT' : '') + (ruleTags(t.componentName) ? ` | ${ruleTags(t.componentName)}` : '')
      } | ${cardLine(t.componentName) || t.summaryEn}`,
  ), ...brand].join('\n');
}

const sceneSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'recipeId', 'durationSec', 'headline', 'caption', 'transition', 'feature', 'action', 'asset', 'sfx'],
  properties: {
    feature: { type: 'string' },
    action: { type: 'string' },
    asset: { type: 'string' },
    sfx: { type: 'string' },
    kind: { type: 'string', enum: ['shot', 'title'] },
    recipeId: { type: 'string' },
    durationSec: { type: 'number' },
    headline: { type: 'string' },
    caption: { type: 'string' },
    transition: { type: 'string', enum: ['cut', 'flash', 'wipe', 'barn', 'dip', 'whip', 'ink', 'leak', 'portal', 'iris', 'line', 'glitch', 'window', 'push'] },
  },
} as const;

export const PLAN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'palette', 'scenes'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    palette: {
      type: 'object',
      additionalProperties: false,
      required: ['background', 'text', 'accent'],
      properties: { background: { type: 'string' }, text: { type: 'string' }, accent: { type: 'string' } },
    },
    scenes: { type: 'array', items: sceneSchema },
  },
} as const;

/**
 * Validate a model plan: unknown recipes are dropped, copy is trimmed, colours
 * must be hex, and scene durations are clamped then scaled so the film lands on
 * the requested length. Throws when nothing usable is left.
 */
export function validatePlan(raw: unknown, opts: { targetSec: number; maxSceneSec?: number }): DirectorPlan {
  const maxScene = Math.max(PLAN_LIMITS.maxSceneSec, opts.maxSceneSec ?? 0);
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const palIn = (input.palette && typeof input.palette === 'object' ? input.palette : {}) as Record<string, unknown>;
  const scenesIn = Array.isArray(input.scenes) ? input.scenes : [];

  const scenes: DirectorScene[] = [];
  for (const entry of scenesIn) {
    if (scenes.length >= PLAN_LIMITS.maxScenes) break;
    const s = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    const kind: SceneKind = s.kind === 'title' ? 'title' : 'shot';
    const headline = text(s.headline, PLAN_LIMITS.headlineChars);
    let recipeId = '';
    if (kind === 'shot' && typeof s.recipeId === 'string' && isBrandScene(s.recipeId)) {
      recipeId = s.recipeId;
    } else if (kind === 'shot') {
      const template = typeof s.recipeId === 'string' ? resolveMotionTemplate(s.recipeId) : undefined;
      // Only individual shots are playable; a grouped card id resolves to its card, not a shot.
      if (!template || !MOTION_TEMPLATES.includes(template)) continue;
      recipeId = template.id;
    } else if (!headline) {
      continue;
    }
    const dur = typeof s.durationSec === 'number' && Number.isFinite(s.durationSec) ? s.durationSec : 3;
    scenes.push({
      kind,
      recipeId,
      durationSec: clamp(dur, PLAN_LIMITS.minSceneSec, maxScene),
      headline,
      caption: text(s.caption, PLAN_LIMITS.captionChars),
      transition: SCENE_TRANSITIONS.includes(s.transition as SceneTransition) ? (s.transition as SceneTransition) : 'cut',
      ...(text(s.feature, 120) ? { feature: text(s.feature, 120) } : {}),
      ...(text(s.action, 120) ? { action: text(s.action, 120) } : {}),
      ...(text(s.asset, 100) ? { asset: text(s.asset, 100) } : {}),
      ...(text(s.sfx, 80) ? { sfx: text(s.sfx, 80) } : {}),
    });
  }
  if (scenes.length < PLAN_LIMITS.minScenes) throw new Error('The director returned too few usable scenes');

  // Fit to the requested length without breaking the per-scene bounds.
  const target = clamp(opts.targetSec, PLAN_LIMITS.minFilmSec, PLAN_LIMITS.maxFilmSec);
  for (let pass = 0; pass < 3; pass++) {
    const total = scenes.reduce((sum, s) => sum + s.durationSec, 0);
    if (Math.abs(total - target) < 0.05) break;
    const factor = target / total;
    for (const s of scenes) s.durationSec = clamp(s.durationSec * factor, PLAN_LIMITS.minSceneSec, maxScene);
  }
  for (const s of scenes) s.durationSec = Math.round(s.durationSec * 10) / 10;

  return {
    title: text(input.title, 80) || 'Motion Studio film',
    summary: text(input.summary, 400),
    palette: {
      background: hex(palIn.background, DEFAULT_PALETTE.background),
      text: hex(palIn.text, DEFAULT_PALETTE.text),
      accent: hex(palIn.accent, DEFAULT_PALETTE.accent),
    },
    scenes,
  };
}

// ── Edit operations ────────────────────────────────────────────────────────

export type DirectorEditOp =
  | { op: 'set_text'; clipId: string; text: string }
  | { op: 'set_duration'; clipId: string; seconds: number }
  | { op: 'remove'; clipId: string }
  | { op: 'replace_recipe'; clipId: string; recipeId: string }
  | { op: 'add_shot'; afterClipId: string; recipeId: string; seconds: number; text: string }
  | { op: 'set_texts'; clipId: string; from: string; to: string }
  | { op: 'set_palette'; background: string; text: string; accent: string };

export const EDIT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'ops'],
  properties: {
    reply: { type: 'string' },
    ops: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['op', 'clipId', 'recipeId', 'seconds', 'text', 'background', 'accent', 'from', 'to'],
        properties: {
          op: { type: 'string', enum: ['set_text', 'set_duration', 'remove', 'replace_recipe', 'add_shot', 'set_palette', 'set_texts'] },
          from: { type: 'string' },
          to: { type: 'string' },
          clipId: { type: 'string' },
          recipeId: { type: 'string' },
          seconds: { type: 'number' },
          text: { type: 'string' },
          background: { type: 'string' },
          accent: { type: 'string' },
        },
      },
    },
  },
} as const;

/** Keep only well-formed ops that reference clips that exist and recipes that exist. */
export function validateEditOps(raw: unknown, clipIds: ReadonlySet<string>): { reply: string; ops: DirectorEditOp[] } {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ops: DirectorEditOp[] = [];
  const shotId = (v: unknown) => {
    const t = typeof v === 'string' ? resolveMotionTemplate(v) : undefined;
    return t && MOTION_TEMPLATES.includes(t) ? t.id : null;
  };
  for (const entry of Array.isArray(input.ops) ? input.ops.slice(0, 20) : []) {
    const o = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    const clipId = typeof o.clipId === 'string' ? o.clipId : '';
    const seconds = typeof o.seconds === 'number' && Number.isFinite(o.seconds) ? clamp(o.seconds, PLAN_LIMITS.minSceneSec, PLAN_LIMITS.maxSceneSec) : 3;
    switch (o.op) {
      case 'set_text':
        if (clipIds.has(clipId)) ops.push({ op: 'set_text', clipId, text: text(o.text, PLAN_LIMITS.headlineChars) });
        break;
      case 'set_duration':
        if (clipIds.has(clipId)) ops.push({ op: 'set_duration', clipId, seconds });
        break;
      case 'remove':
        if (clipIds.has(clipId)) ops.push({ op: 'remove', clipId });
        break;
      case 'replace_recipe': {
        const recipeId = shotId(o.recipeId);
        if (clipIds.has(clipId) && recipeId) ops.push({ op: 'replace_recipe', clipId, recipeId });
        break;
      }
      case 'add_shot': {
        const recipeId = shotId(o.recipeId);
        if (recipeId) ops.push({ op: 'add_shot', afterClipId: clipIds.has(clipId) ? clipId : '', recipeId, seconds, text: text(o.text, PLAN_LIMITS.headlineChars) });
        break;
      }
      case 'set_texts': {
        const from = text(o.from, 120);
        const to = text(o.to, RETEXT_MAX_CHARS).replace(/[*<>{}]/g, '');
        if (clipIds.has(clipId) && from && to) ops.push({ op: 'set_texts', clipId, from, to });
        break;
      }
      case 'set_palette':
        if ([o.background, o.text, o.accent].some((v) => typeof v === 'string' && HEX.test(v))) {
          ops.push({
            op: 'set_palette',
            background: hex(o.background, ''),
            text: hex(o.text, ''),
            accent: hex(o.accent, ''),
          });
        }
        break;
    }
  }
  return { reply: text(input.reply, 600) || (ops.length ? 'Done.' : 'I could not turn that into a change.'), ops };
}

// ── Rewriting the words a recipe draws ─────────────────────────────────────

export const RETEXT_MAX_CHARS = 80;

export const RETEXT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['scenes'],
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'pairs'],
        properties: {
          index: { type: 'number' },
          pairs: {
            type: 'array',
            items: { type: 'object', additionalProperties: false, required: ['from', 'to'], properties: { from: { type: 'string' }, to: { type: 'string' } } },
          },
        },
      },
    },
  },
} as const;

/** A recipe's layout is drawn for its own words: keep a rewrite within about a third more characters, cut at a word. */
export function fitToLayout(to: string, from: string): string {
  const limit = Math.max(18, Math.ceil(from.length * 1.35));
  if (to.length <= limit) return to;
  const cut = to.slice(0, limit);
  const at = cut.lastIndexOf(' ');
  return (at > limit * 0.5 ? cut.slice(0, at) : cut).replace(/[,;:\s-]+$/, '');
}

/** scene index -> (template words -> new words). Keys must be words the recipe really draws. */
const wordCount = (v: string) => v.trim().split(/\s+/).filter(Boolean).length;

/**
 * A line whose text is part of the recipe's technique (word or character counts, measured widths)
 * keeps its word count and its length (±15 %): the effect was built for words of that size.
 */
export const keepsShape = (to: string, from: string): boolean => wordCount(to) === wordCount(from) && to.length >= from.length * 0.85 - 1 && to.length <= from.length * 1.15 + 1;

export function validateRetext(raw: unknown, allowed: ReadonlyMap<number, ReadonlySet<string>>, structural: ReadonlySet<number> = new Set()): Record<number, Record<string, string>> {
  const out: Record<number, Record<string, string>> = {};
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  for (const entry of Array.isArray(input.scenes) ? input.scenes.slice(0, 40) : []) {
    const sc = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    const index = typeof sc.index === 'number' ? Math.round(sc.index) : -1;
    const ok = allowed.get(index);
    if (!ok) continue;
    for (const pair of Array.isArray(sc.pairs) ? sc.pairs.slice(0, 60) : []) {
      const pr = (pair && typeof pair === 'object' ? pair : {}) as Record<string, unknown>;
      const from = typeof pr.from === 'string' ? pr.from : '';
      const to = fitToLayout(text(pr.to, RETEXT_MAX_CHARS).replace(/[*<>{}]/g, ''), from);
      if (structural.has(index) && !keepsShape(text(pr.to, RETEXT_MAX_CHARS).replace(/[*<>{}]/g, ''), from)) continue;
      if (ok.has(from) && to && to.toLowerCase() !== from.toLowerCase()) (out[index] ??= {})[from] = to;
    }
  }
  return out;
}

// ── Co-creation steps (upstream's guided flow) ─────────────────────────────

export interface BriefRow { item: string; judgment: string; evidence: string }
export interface DirectorBrief { rows: BriefRow[]; questions: string[] }
export interface VisualDirection {
  name: string;
  claim: string;
  keywords: string[];
  look: string;
  motion: string;
  why: string;
  tradeoff: string;
  /** The direction's colours (hex), used for its styleframe stills. */
  palette?: DirectorPalette;
}
export interface DirectionOptions { directions: VisualDirection[]; recommended: number }
export interface MappingRow { feature: string; firstShot: string; altShot: string; expresses: string; pageState: string }

export const BRIEF_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rows', 'questions'],
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['item', 'judgment', 'evidence'],
        properties: { item: { type: 'string' }, judgment: { type: 'string' }, evidence: { type: 'string' } },
      },
    },
    questions: { type: 'array', items: { type: 'string' } },
  },
} as const;

export const DIRECTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['directions', 'recommended'],
  properties: {
    directions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'claim', 'keywords', 'look', 'motion', 'why', 'tradeoff', 'palette'],
        properties: {
          palette: {
            type: 'object',
            additionalProperties: false,
            required: ['background', 'text', 'accent'],
            properties: { background: { type: 'string' }, text: { type: 'string' }, accent: { type: 'string' } },
          },
          name: { type: 'string' },
          claim: { type: 'string' },
          keywords: { type: 'array', items: { type: 'string' } },
          look: { type: 'string' },
          motion: { type: 'string' },
          why: { type: 'string' },
          tradeoff: { type: 'string' },
        },
      },
    },
    recommended: { type: 'number' },
  },
} as const;

export const MAPPING_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rows'],
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['feature', 'firstShot', 'altShot', 'expresses', 'pageState'],
        properties: {
          feature: { type: 'string' },
          firstShot: { type: 'string' },
          altShot: { type: 'string' },
          expresses: { type: 'string' },
          pageState: { type: 'string' },
        },
      },
    },
  },
} as const;

const list = (v: unknown, max: number, len: number): string[] =>
  (Array.isArray(v) ? v : []).slice(0, max).map((x) => text(x, len)).filter(Boolean);

/** Trim a model brief: a handful of rows and at most three questions. */
export function validateBrief(raw: unknown): DirectorBrief {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rows = (Array.isArray(input.rows) ? input.rows : []).slice(0, 12).flatMap((r) => {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const item = text(o.item, 60);
    const judgment = text(o.judgment, 240);
    return item && judgment ? [{ item, judgment, evidence: text(o.evidence, 200) }] : [];
  });
  if (!rows.length) throw new Error('The director returned an empty brief');
  return { rows, questions: list(input.questions, 3, 260) };
}

/** A direction's colours when all three are 6-digit hex; otherwise none (its stills use the site's own colours). */
function directionPalette(raw: unknown): DirectorPalette | undefined {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const [background, textColor, accent] = [o.background, o.text, o.accent].map((v) => (typeof v === 'string' ? v.trim() : ''));
  return HEX.test(background) && HEX.test(textColor) && HEX.test(accent) ? { background, text: textColor, accent } : undefined;
}

/** At most three directions; `recommended` always points at one of them. */
export function validateDirections(raw: unknown): DirectionOptions {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const directions = (Array.isArray(input.directions) ? input.directions : []).slice(0, 3).flatMap((d) => {
    const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
    const name = text(o.name, 50);
    const claim = text(o.claim, 200);
    return name && claim
      ? [{ name, claim, keywords: list(o.keywords, 5, 24), look: text(o.look, 220), motion: text(o.motion, 200), why: text(o.why, 220), tradeoff: text(o.tradeoff, 200), ...(directionPalette(o.palette) ? { palette: directionPalette(o.palette)! } : {}) }]
      : [];
  });
  if (!directions.length) throw new Error('The director returned no visual directions');
  const rec = typeof input.recommended === 'number' ? Math.round(input.recommended) : 0;
  return { directions, recommended: rec >= 0 && rec < directions.length ? rec : 0 };
}

/** Rows whose shots exist in the catalog; the first choice is required, the alternate dropped when unknown. */
export function validateMapping(raw: unknown): MappingRow[] {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const shot = (v: unknown): string => {
    const t = typeof v === 'string' ? resolveMotionTemplate(v.trim()) : undefined;
    return t && MOTION_TEMPLATES.includes(t) ? t.id : '';
  };
  const rows: MappingRow[] = [];
  const used = new Set<string>();
  for (const r of Array.isArray(input.rows) ? input.rows : []) {
    if (rows.length >= 10) break;
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const firstShot = shot(o.firstShot);
    const feature = text(o.feature, 120);
    // One shot leads once: a repeated first choice is a repeated technique.
    if (!firstShot || !feature || used.has(firstShot)) continue;
    used.add(firstShot);
    rows.push({ feature, firstShot, altShot: shot(o.altShot), expresses: text(o.expresses, 200), pageState: text(o.pageState, 140) });
  }
  if (!rows.length) throw new Error('The director returned no usable shot mapping');
  return rows;
}
