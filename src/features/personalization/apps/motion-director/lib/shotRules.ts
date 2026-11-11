/**
 * What the upstream shot cards say about using a recipe in a film (video-shotcraft
 * references/shots/**, aesthetic-rules P4): which recipes may play only a limited number of
 * times, which never share a film, where a recipe belongs (opening / title / outro), which
 * look it was designed in, and which recipes have text that is part of the technique.
 * Plain data and pure functions: the director route and the browser enforce the same rules.
 */
import { SHOT_FACTS } from '../demosrc/_generated/shotFacts';
import { resolveMotionTemplate } from '../../../data/motionRecipeCatalog';
import type { DirectorScene } from './directorPlan';

export type ShotRole = 'opening' | 'title' | 'outro' | 'transition' | 'feature';
export type Polarity = 'dark' | 'light';

const DARK_LOOKS = ['midnight', 'aurora', 'ember', 'graphite', 'lime'];
const LIGHT_LOOKS = ['paper', 'porcelain', 'sand'];

const names = (s: string) => s.split(/\s+/).filter(Boolean);

/** Cards (by slug) that open a film, name a point on the page, or close it. */
const OPENING = names('brand-ink-open crane-rise-reveal dataviz-landscape-open fracture icon-field-colorize letterspace-materialize magician-card-flourish orbit-ring-title-open spotlight-hero-card stroke-segment-build text-as-mask trailer-grammar-moves lead-word-zoom-assemble assemble-then-type-flyin scanline-assemble-flyin overhead-camera-moves');
const OUTRO = names('logo-shrink-wordmark-lockup outro-group-photo-launch ui-strip-away-outro ui-to-brand-morph neon-triple-marquee grain-dissolve text-column-converge white-flash-logo-simplify-cut');
const TITLE = names('paper-title-card blur-slide brace-expand countdown-arc-scatter gradient-word-sweep outline-word-fill word-relay-geometry word-relay-filmstrip vertical-word-roll-blur-cycle pill-slot-cycle pill-chip-slot-cycle-handled marker-underline-title title-demote-to-label type-assembly-moves type-entrance-moves typewriter-moves flying-words glitch-cycle type-rhythm-sync');
const TRANSITION = names('shot-transitions transition-hidden-cut transition-travel page-turn-transitions wipe-transitions tear-streak-transitions print-texture-transitions line-carry-transition bottom-push-stack-wipe circle-match-iris mosaic-reframe card-flip-reveal card-flock-tumble gradient-transition');

/**
 * Cards whose words are part of the technique (word or character counts, measured widths,
 * hand-drawn glyphs): a rewrite must keep the word count and the length (±15 %).
 */
const STRUCTURAL_TEXT = names('text-as-mask outline-word-fill word-relay-geometry word-relay-filmstrip text-column-converge pill-chip-slot-cycle-handled vertical-word-roll-blur-cycle pill-slot-cycle lead-word-zoom-assemble brace-expand countdown-arc-scatter flying-words glitch-cycle type-rhythm-sync letterspace-materialize stroke-segment-build type-entrance-moves typewriter-moves beat-step-list-theme-cycle chip-grid-single-select-blackout avatar-bracket-carousel doc-park-left-pill-deal hashtag-to-pill-materialize');
/** Of those, the ones drawn from a fixed glyph set or fixed segments: never rewritten. */
const FIXED_TEXT = names('text-as-mask letterspace-materialize stroke-segment-build');

/** Groups of recipes the cards limit together, with how many may play in one film. */
export const GROUP_CAPS: Record<string, number> = {
  light: 2, // light effects in total (light-play, spotlight-sweep, light-leak)
  darkSection: 1, // glow fly-lines and the data-landscape open
  hit: 3, // whole-frame hits (R4): impact frames, riso hit, glitch tear, slams, crash zoom…
  titleEntrance: 2, // kinds of title entrance (P4)
  bigCamera: 2, // large camera moves
  timeWarp: 2, // things that bend time inside a shot
  outroKind: 1, // one kind of outro per film
  reveal: 1, // crane / tilt / drone-dive: two "reveal openers" is no reveal
  spotlight: 1, // spotlight hero card, spotlight sweep, light play sweep
  wordRoll: 1, // word-roll / slot-cycle cards
  wordHit: 1, // outline-word-fill, word-relay-geometry
  neonFrame: 1, // forerun / orbit-drop
  tourCamera: 1, // graze-face-tour, steep-tilt-glide
  letterTunnel: 1, // text-as-mask, transition-travel
  drawOn: 1, // draw-svg-trace, wall-reveal-moves
};

const BY_SLUG: Record<string, string[]> = {
  'light-play-moves': ['light'],
  'spotlight-sweep-moves': ['light', 'spotlight'],
  'transition-hidden-cut': ['light'],
  'glow-flyline-moves': ['light', 'darkSection'],
  'dataviz-landscape-open': ['darkSection'],
  'impact-feedback': ['hit', 'timeWarp'],
  'riso-print-hits': ['hit'],
  'tear-streak-transitions': ['hit'],
  'sakuga-timing-shift': ['hit', 'timeWarp'],
  'crash-zoom-punch': ['hit', 'bigCamera'],
  'slam-entrance-moves': ['hit'],
  'beat-cut-moves': ['hit'],
  'brand-frame-snap': ['hit'],
  'white-flash-logo-simplify-cut': ['hit'],
  'type-assembly-moves': ['titleEntrance'],
  'type-entrance-moves': ['titleEntrance'],
  'typewriter-moves': ['titleEntrance'],
  'document-typewriter-reveal': ['titleEntrance'],
  'space-camera-moves': ['bigCamera'],
  'tension-camera-moves': ['bigCamera'],
  'overhead-camera-moves': ['bigCamera', 'reveal'],
  'crane-rise-reveal': ['bigCamera', 'reveal'],
  'graze-face-tour': ['bigCamera', 'tourCamera'],
  'steep-tilt-glide': ['bigCamera', 'tourCamera'],
  'basic-3d-scene': ['bigCamera'],
  'speed-ramp-freeze': ['timeWarp'],
  'rhythm-interrupt-moves': ['timeWarp'],
  'outro-group-photo-launch': ['outroKind'],
  'ui-strip-away-outro': ['outroKind'],
  'ui-to-brand-morph': ['outroKind'],
  'spotlight-hero-card': ['spotlight'],
  'vertical-word-roll-blur-cycle': ['wordRoll'],
  'pill-chip-slot-cycle-handled': ['wordRoll'],
  'pill-slot-cycle': ['wordRoll'],
  'outline-word-fill': ['wordHit'],
  'word-relay-geometry': ['wordHit'],
  'neon-frame-forerun': ['neonFrame'],
  'neon-frame-orbit-drop': ['neonFrame'],
  'transition-travel': ['letterTunnel'],
  'text-as-mask': ['letterTunnel'],
  'draw-svg-trace': ['drawOn'],
  'wall-reveal-moves': ['drawOn'],
};

/** Individual styles inside a multi-style card that belong to another group. */
const BY_COMPONENT: Record<string, string[]> = {
  DroneDiveLanding: ['reveal'],
  TiltReveal: ['reveal'],
  PullBackIsolation: ['outroKind'],
  BulletTimeFreezeOrbit: ['timeWarp'],
  HitCounter: ['timeWarp'],
  AnimeImpact: ['hit'],
  SpotlightSweepReveal: ['spotlight'],
  LightLeakBurn: ['light'],
};
/** Styles of a card that do not carry the card's own groups. */
const NOT_SLUG_GROUP: Record<string, string[]> = {
  ExplodedView: ['reveal'],
  CornerSpotlightReveal: ['spotlight'],
  SheenSweepRetry: ['spotlight'],
};

export interface ShotRules {
  slug: string;
  role: ShotRole;
  /** Dark / light family of the look the recipe was designed in; null for a palette of its own. */
  polarity: Polarity | null;
  groups: string[];
  /** 'free' text can be rewritten; 'structural' keeps its word count and length; 'fixed' is never rewritten. */
  text: 'free' | 'structural' | 'fixed';
  /** The card needs its sound to read. */
  sound: boolean;
  /** A technique card (no native length of its own). */
  technique: boolean;
  energy: string;
}

const polarityOf = (look: string): Polarity | null => (DARK_LOOKS.includes(look) ? 'dark' : LIGHT_LOOKS.includes(look) ? 'light' : null);

const roleOf = (slug: string): ShotRole => (OPENING.includes(slug) ? 'opening' : OUTRO.includes(slug) ? 'outro' : TITLE.includes(slug) ? 'title' : TRANSITION.includes(slug) ? 'transition' : 'feature');

export function rulesOf(componentName: string): ShotRules | null {
  const facts = SHOT_FACTS[componentName];
  if (!facts) return null;
  const slugGroups = (BY_SLUG[facts.slug] ?? []).filter((g) => !(NOT_SLUG_GROUP[componentName] ?? []).includes(g));
  return {
    slug: facts.slug,
    role: roleOf(facts.slug),
    polarity: polarityOf(facts.look),
    groups: [...new Set([...slugGroups, ...(BY_COMPONENT[componentName] ?? [])])],
    text: FIXED_TEXT.includes(facts.slug) ? 'fixed' : STRUCTURAL_TEXT.includes(facts.slug) ? 'structural' : 'free',
    sound: facts.sound,
    technique: facts.technique,
    energy: facts.energy,
  };
}

/** The rules of the recipe a scene plays (null for title cards, brand scenes and unknown ids). */
export function rulesOfScene(scene: Pick<DirectorScene, 'kind' | 'recipeId'>): ShotRules | null {
  if (scene.kind !== 'shot') return null;
  const template = resolveMotionTemplate(scene.recipeId);
  return template ? rulesOf(template.componentName) : null;
}

/** A compact tag line for the director's catalog: role, look family, limits, fixed text, sound. */
export function ruleTags(componentName: string): string {
  const r = rulesOf(componentName);
  if (!r) return '';
  const tags: string[] = [];
  if (r.role !== 'feature') tags.push(r.role.toUpperCase());
  if (r.polarity) tags.push(r.polarity.toUpperCase());
  const caps = r.groups.map((g) => `${g}≤${GROUP_CAPS[g]}`);
  if (caps.length) tags.push(caps.join(','));
  if (r.text !== 'free') tags.push('TEXT-FIXED');
  if (r.sound) tags.push('NEEDS-SOUND');
  return tags.join(' ');
}

export interface FilmRuleNote {
  index: number;
  recipeId: string;
  reason: string;
}

/**
 * Check a storyboard against the cards' rules and say which scenes break them, in order:
 * a recipe more than once, a group over its cap, an opening / outro recipe in the wrong
 * place, a recipe of the other look family than the film's. `keep` are recipes the person
 * named: they are never reported (they take the place first and the others make way).
 */
export function filmRuleViolations(scenes: readonly Pick<DirectorScene, 'kind' | 'recipeId'>[], keep: ReadonlySet<string> = new Set(), ground?: Polarity | null): FilmRuleNote[] {
  const notes: FilmRuleNote[] = [];
  const shots = scenes.map((s, index) => ({ s, index, rules: rulesOfScene(s) })).filter((x) => x.rules);
  // The film's look family: the person's picks decide, else the majority of the recipes.
  const family = (list: typeof shots): Polarity | null => {
    const count = { dark: 0, light: 0 };
    for (const x of list) if (x.rules!.polarity) count[x.rules!.polarity]++;
    return count.dark === count.light ? null : count.dark > count.light ? 'dark' : 'light';
  };
  // The product's own ground decides when it is known (SKILL principle 2), then the picks, then the majority.
  const film = ground ?? family(shots.filter((x) => keep.has(x.s.recipeId))) ?? family(shots);
  const seen = new Set<string>();
  const used: Record<string, number> = {};
  // Named recipes first, so they take their group slots before the others.
  const order = [...shots].sort((a, b) => Number(keep.has(b.s.recipeId)) - Number(keep.has(a.s.recipeId)) || a.index - b.index);
  const rejected = new Set<number>();
  for (const x of order) {
    const named = keep.has(x.s.recipeId);
    const r = x.rules!;
    let reason = '';
    if (!named) {
      if (seen.has(x.s.recipeId)) reason = 'the same recipe twice (a technique is the lead once)';
      else if (r.role === 'opening' && x.index > 1) reason = 'an opening recipe in the middle of the film';
      else if (r.role === 'outro' && x.index < scenes.length - 2) reason = 'an outro recipe before the end';
      else if (film && r.polarity && r.polarity !== film) reason = `a ${r.polarity} look in a ${film} film`;
      else {
        const over = r.groups.find((g) => (used[g] ?? 0) >= GROUP_CAPS[g]);
        if (over) reason = `too many "${over}" recipes (at most ${GROUP_CAPS[over]})`;
      }
    }
    if (reason) {
      rejected.add(x.index);
      notes.push({ index: x.index, recipeId: x.s.recipeId, reason });
      continue;
    }
    seen.add(x.s.recipeId);
    for (const g of r.groups) used[g] = (used[g] ?? 0) + 1;
  }
  return notes.sort((a, b) => a.index - b.index);
}
