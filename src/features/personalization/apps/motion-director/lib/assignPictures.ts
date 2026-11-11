import type { DirectorPlan, DirectorScene } from './directorPlan';
import { resolveMotionTemplate } from '../../../data/motionRecipeCatalog';
import { HIDDEN_KINDS, type Picture, type PictureKind } from './pictureCatalogue';

/**
 * Which pictures each scene shows (upstream's feature -> shot map, "page state needed"): the opener the
 * home page, a feature scene the page of that feature and its own cards, the gallery the people,
 * recipes that deal many cards many distinct cards. Nothing repeats until every picture has been used.
 */
export interface ScenePictures {
  /** Whole pages, best first (the recipe's page slots). */
  screens: string[];
  /** Cards / photos / slices, best first (the recipe's card slots). */
  crops: string[];
  /** Picture ids, for the storyboard and the adapter. */
  ids: string[];
}

/** Card slots a recipe draws (from the recipes' sources); unlisted recipes take three. */
export const CARD_SLOTS: Record<string, number> = {
  DeckDealFlyin: 26,
  PageWaterfallWall: 24,
  VerticalTicker: 24,
  CardStack: 9,
  Carousel3D: 8,
  MosaicReframe: 12,
  ResearchCardStackScroll: 13,
  ListStackPress: 5,
  ListReveal: 6,
  OutroGroupPhotoLaunch: 10,
  ProductCardProgressiveAssemble: 4,
  SpotlightHeroCard: 4,
  AvatarBracketCarousel: 4,
  BezierSourceConvergeMerge: 4,
  ClonerDepthEcho: 8,
  DrawSvgTrace: 1,
  ContactShadowLift: 3,
  IntegrationHubMap: 7,
  PanelToCanvasMaterialize: 3,
  CursorCastEnsemble: 6,
  PaletteThemeRipple: 11,
  ThemeSweepToggle: 1,
};

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)));
const STOP = new Set(['your', 'with', 'from', 'that', 'this', 'what', 'more', 'have', 'into', 'page', 'site', 'home', 'services', 'service']);

const overlap = (a: Set<string>, b: Set<string>) => {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
};

export function assignPictures(plan: DirectorPlan, catalogue: readonly Picture[]): ScenePictures[] {
  const pool = catalogue.filter((p) => !HIDDEN_KINDS.has(p.kind) && p.kind !== 'logo');
  const pages = pool.filter((p) => p.kind === 'page');
  const used = new Set<string>();
  const usedPages = new Set<string>();
  let round = 0;
  const take = (list: Picture[], n: number): Picture[] => {
    const fresh = list.filter((p) => !used.has(p.id));
    // Once every picture of these kinds is used, repeats are allowed, never inside one scene, and each
    // scene starts its repeats further along so two scenes do not open on the same picture.
    const again = list.filter((p) => used.has(p.id));
    const shift = again.length ? round % again.length : 0;
    round++;
    const out = [...fresh, ...again.slice(shift), ...again.slice(0, shift)].slice(0, n);
    out.forEach((p) => used.add(p.id));
    return out;
  };
  const ofKinds = (kinds: PictureKind[], route?: string) =>
    kinds.flatMap((k) => pool.filter((p) => p.kind === k && (!route || p.route === route)));
  const pageFor = (scene: DirectorScene, index: number): Picture | undefined => {
    if (index <= 1 || scene.recipeId === 'brand/url-scan' || scene.recipeId === 'brand/hub' || scene.recipeId === 'brand/logo-reveal') return pages[0];
    const want = words([scene.feature, scene.headline, scene.caption, scene.asset].filter(Boolean).join(' '));
    const ranked = pages
      .slice(1)
      .map((p) => ({ p, score: overlap(want, words(`${p.route} ${p.words}`)) }))
      .sort((a, b) => b.score - a.score || Number(usedPages.has(a.p.id)) - Number(usedPages.has(b.p.id)));
    const best = ranked.find((r) => r.score > 0)?.p ?? ranked.find((r) => !usedPages.has(r.p.id))?.p ?? pages[0];
    return best;
  };

  return plan.scenes.map((scene, index) => {
    if (scene.kind === 'title') return { screens: [], crops: [], ids: [] };
    const stem = resolveMotionTemplate(scene.recipeId)?.componentName ?? '';
    const page = pageFor(scene, index);
    if (page) usedPages.add(page.id);
    const route = page?.route;
    let picked: Picture[];
    if (scene.recipeId === 'brand/people-gallery') {
      picked = take(ofKinds(['people', 'photo', 'testimonial']), 6);
    } else if (scene.recipeId === 'brand/logo-reveal') {
      picked = [];
    } else {
      const n = CARD_SLOTS[stem] ?? 3;
      // The scene's own page first (its cards, its hero), then the rest of the site; many-card recipes mix kinds.
      const own = ofKinds(['card', 'photo', 'people', 'testimonial', 'hero', 'section'], route);
      const site = n >= 8 ? ofKinds(['card', 'photo', 'people', 'testimonial', 'hero']) : ofKinds(['card', 'photo', 'hero', 'section', 'testimonial', 'people']);
      picked = take([...own, ...site.filter((p) => !own.includes(p))], n);
    }
    // A feature scene's own page leads; the other pages follow so the recipe's further page slots show the site too.
    const screens = [page, ...pages.filter((p) => p !== page)].filter((p): p is Picture => Boolean(p)).map((p) => p.url);
    return { screens, crops: picked.map((p) => p.url), ids: [...(page ? [page.id] : []), ...picked.map((p) => p.id)] };
  });
}

/** How many distinct pictures the film puts on screen. */
export const picturesShown = (scenes: readonly ScenePictures[]): number => new Set(scenes.flatMap((s) => s.ids)).size;
