/**
 * Motion Studio film pipeline — the steps the chat runs for "make a promo for
 * my product": capture the real pages → storyboard from shot recipes → build
 * the editable project (beat-synced cuts, sound design) → frame QA.
 *
 * The director model is used when the account has it; without it (no OpenAI
 * key, director down) the Ink Press template storyboard is built locally, so a
 * film request always ends in a film.
 */
import { buildCatalogue, catalogueSummary } from './pictureCatalogue';
import { assignPictures, picturesShown } from './assignPictures';
import { AS_DESIGNED, SITE_THEME, luma, paletteFromBrand } from './palette';
import { CARDS } from '../cards/registry';
import { projectEndFrame, type ProjectData } from '../types';
import type { AspectRatio } from '../projectContract';
import type { MediaAttachment } from './mediaUpload';
import { analyzeBeats, syncReport, type DrumMap } from './beatSync';
import { t } from '../i18n';
import { planToProject, type FilmCapture } from './buildFilm';
import { captureSite, fetchRecipeCard, requestDirections, requestFrameReview, requestMapping, requestPlan, requestRetext, DirectorError, type SiteCapture } from './directorClient';
import { releaseCheck, releaseLine, type ReleaseItem } from './releaseCheck';
import { mergeCaptures, neededPages } from './targetedCapture';
import { PLAN_LIMITS, isBrandScene, type DirectorPalette, type DirectorPlan, type MappingRow, type VisualDirection } from './directorPlan';
import { buildDesignSpec } from './designSpec';
import { pickMotionPreset, presetText } from './motionPreset';
import { addGalleryScene, applyFilmRules, arrangeArc, applySiteContent, chooseSeams, fitNativeLengths, siteNameOf, ensureRecipes, inkPressPlan, INK_PRESS_SHOTS, productNameFrom, restrictToRecipes, singleShotPlan, type FilmRequest, type FilmTemplateChoice } from './filmChat';
import { isProductTextureShot } from './productShots';
import type { BrandInput } from '../demosrc/_fixtures/Brand';
import { motionTemplateTitle, resolveMotionTemplate } from '../../../data/motionRecipeCatalog';
import { DEMO_TEXTS } from '../demosrc/_generated/demoTexts';
import { fallbackTexts } from './retext';
import { rulesOfScene } from './shotRules';
import { reviewFilm, type ReviewItem } from './filmReview';
import { adaptFilm } from './adaptLoop';
import { adaptedCodeIsEnabled } from './shotAdapter';
import { defaultTrackFor } from './defaultMusic';

export type ActivityStatus = 'running' | 'done' | 'error';
export type ActivityLog = (label: string, status: ActivityStatus) => void;

export interface FilmBrandKit {
  businessName?: string | null;
  colors?: { primary?: string; secondary?: string; accent?: string; background?: string } | null;
  notes?: string | null;
  /** Logo image URL, stamped on the title / call-to-action cards. */
  logo?: string | null;
}

export interface StoryboardResult {
  plan: DirectorPlan;
  capture: SiteCapture | null;
  /** Who wrote the storyboard. */
  source: 'director' | 'inkpress';
  /** Why the director was not used, when it was asked and failed. */
  note?: string;
  /** Attached videos the film will play as their own scenes before the closing card. */
  videos?: Array<{ name: string; sec: number }>;
  /** The attachments this storyboard was planned with; the build uses exactly these. */
  media?: MediaAttachment[];
  /** Stage 2: the feature → shot map (first-choice + fallback card per feature). */
  mapping?: MappingRow[];
  /** Stage 3: the release check run before the storyboard was shown. */
  release?: ReleaseItem[];
  /** Stage 1: the visual direction the director chose for an autonomous film, and the ones it weighed. */
  direction?: { chosen: VisualDirection; others: string[] };
}

/**
 * A card in the order the storyboard needs it, so the parts that decide a scene come first when a long
 * card is cut to fit the request: front matter, intent, motion core, known pitfalls, sound, then the
 * parameters and the rest (the reference implementation is for the shot's code step, not the storyboard).
 */
export function cardForStoryboard(md: string, max = 6_000): string {
  const m = md.match(/^---\n[\s\S]*?\n---\n?/);
  const head = m ? m[0] : '';
  const sections = (m ? md.slice(head.length) : md).split(/\n(?=## )/).map((s) => s.trim()).filter(Boolean);
  const rank = (s: string) => {
    const h = s.split('\n', 1)[0].toLowerCase();
    if (h.startsWith('## intent')) return 0;
    if (h.startsWith('## motion core') || h.startsWith('## approach') || h.startsWith('## action phases')) return 1;
    if (h.startsWith('## known pitfalls')) return 2;
    if (h.startsWith('## sound')) return 3;
    if (h.startsWith('## variant') || h.startsWith('## choosing')) return 4;
    if (h.startsWith('## parameters')) return 5;
    if (h.startsWith('## reference implementation')) return 9;
    return 6;
  };
  const body = sections.map((s, i) => ({ s, i, r: rank(s) })).filter((x) => x.r < 9).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.s);
  const out = [head.trim(), ...body].filter(Boolean).join('\n\n');
  return out.length > max ? `${out.slice(0, max - 1)}…` : out;
}

/** Stage 2, "read the chosen cards in full": the English cards of the film's chosen shots (at most 8). */
async function chosenCards(ids: readonly string[]): Promise<Array<{ id: string; text: string }>> {
  const stems = [...new Set(ids.filter((id) => id && !isBrandScene(id)))]
    .map((id) => ({ id, stem: resolveMotionTemplate(id)?.componentName }))
    .filter((x): x is { id: string; stem: string } => Boolean(x.stem))
    .slice(0, 8);
  const texts = await Promise.all(stems.map(async ({ id, stem }) => ({ id, text: cardForStoryboard((await fetchRecipeCard(stem)) ?? '') })));
  return texts.filter((c) => c.text);
}

const shotName = (id: string) => {
  const t = id ? resolveMotionTemplate(id) : undefined;
  return t ? motionTemplateTitle(t) : id;
};

const brandPalette = (capture: SiteCapture | null, kit: FilmBrandKit | null | undefined): Partial<DirectorPalette> => ({
  background: capture?.brand.background ?? kit?.colors?.background ?? undefined,
  text: capture?.brand.text ?? undefined,
  accent: capture?.brand.accent ?? kit?.colors?.accent ?? kit?.colors?.primary ?? undefined,
});

/** A film of a captured site draws every recipe in the site's own palette ("Your site"); without one, each recipe keeps its designed look. */
const filmTheme = (capture: SiteCapture | null | undefined): { id: string; colors?: Record<string, string> } => {
  const colors = capture ? paletteFromBrand(capture.brand) : null;
  return colors ? { id: SITE_THEME, colors } : { id: AS_DESIGNED };
};

/** Capture (when the request has a URL) and storyboard the film. */
/** The site's own pictures the film can show: the images found on the page plus its card crops. */
export const pictureCount = (capture: SiteCapture | null | undefined): number => (capture && !capture.partial ? (capture.assets?.length ?? 0) + (capture.images?.length ?? 0) + (capture.crops?.length ?? 0) : 0);

/** The capture without testimonial "Name Title Company" lines in its headings (they feed captions, titles and recipe words; D2). */
/** Accessibility links ("Skip to content", "Skip navigation") are part of a site's menu, not its words. */
export const isSkipLink = (line: string): boolean => /^\s*skip (?:to|navigation)\b/i.test(line);

export const withoutPeopleLines = <T extends SiteCapture | null>(capture: T): T =>
  capture?.content
    ? {
        ...capture,
        content: {
          ...capture.content,
          ...(capture.content.headings ? { headings: capture.content.headings.filter((h) => !looksLikePersonLine(h) && !isSkipLink(h)) } : {}),
          ...(capture.content.nav ? { nav: capture.content.nav.filter((n) => !isSkipLink(n)) } : {}),
          ...(capture.content.ctas ? { ctas: capture.content.ctas.filter((n) => !isSkipLink(n)) } : {}),
        },
      }
    : capture;

/** "Andrew Garnett President & CEO Special Needs Group": a name followed by a job title. */
export const looksLikePersonLine = (line: string): boolean =>
  /^\s*[A-Z][a-z'’-]{1,15}\s+(?:[A-Z]\.\s+)?[A-Z][a-z'’-]{1,20}\b/.test(line) &&
  /\b(?:President|CEO|CFO|CTO|COO|CMO|Founder|Co-?founder|Owner|Director|Manager|Partner|Principal|VP|Vice President|Strategist|Engineer|Specialist|Consultant|Coordinator|Head of|Lead|Officer|Administrator|Analyst|Executive)\b/.test(line);

export async function storyboardFilm(
  req: FilmRequest,
  opts: {
    template: FilmTemplateChoice;
    durationSec: number;
    aspectRatio: AspectRatio;
    brandKit?: FilmBrandKit | null;
    capture?: SiteCapture | null;
    /** Seconds the film already gives to attached videos; the storyboard fills the rest. */
    reservedSec?: number;
    /** Returns true once the person has stopped this storyboard (a capture in progress stops waiting). */
    cancelled?: () => boolean;
  },
  log: ActivityLog,
): Promise<StoryboardResult> {
  const bare = (u: string) => u.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
  let capture = opts.capture && (!req.siteUrl || bare(opts.capture.url).startsWith(bare(req.siteUrl))) ? opts.capture : null;
  if (!capture && req.siteUrl) {
    log(`Capturing ${req.siteUrl}`, 'running');
    try {
      capture = await captureSite(req.siteUrl, {
        cancelled: opts.cancelled,
        onProgress: (sec) => log(`Capturing ${req.siteUrl} · ${sec}s (reading the page and taking screenshots)`, 'running'),
      });
      const pages = capture.pages?.length || 1;
      const pulled = [capture.logo ? 'logo' : '', capture.assets?.length ? `${capture.assets.length} found pictures (${[...new Set(capture.assets.map((a) => a.category.replace(/_/g, ' ')))].slice(0, 4).join(', ')})` : '', capture.images?.length ? `${capture.images.length} site image${capture.images.length === 1 ? '' : 's'}` : ''].filter(Boolean);
      log(
        capture.partial
          ? `Captured ${capture.title || req.siteUrl} · its words only (no screenshots in time)`
          : `Captured ${capture.title || req.siteUrl} · ${pages} page${pages === 1 ? '' : 's'} (${(capture.pages ?? []).map((p) => p.path).join(', ') || '/'}) · ${capture.crops.length} card crops${pulled.length ? ` · ${pulled.join(' · ')}` : ''}`,
        'done',
      );
      const said = capture.content?.headline || capture.content?.description;
      if (said) log(`Read the site: "${said.slice(0, 90)}"${capture.content?.headings?.length ? ` · ${capture.content.headings.length} sections` : ''}`, 'done');
    } catch (error) {
      log(`Could not capture ${req.siteUrl}: ${error instanceof Error ? error.message : 'failed'}`, 'error');
    }
  }
  // Attached videos play as their own scenes; the storyboard gets what is left of the requested length.
  // Section headings become captions and titles: a testimonial's "Name Title Company" line is not a heading.
  capture = withoutPeopleLines(capture);
  const planSec = Math.max(PLAN_LIMITS.minFilmSec, opts.durationSec - (opts.reservedSec ?? 0));
  // The site the user gave wins over a Brand Kit company: the Brand Kit names the film only when there is no site.
  const hasSite = Boolean(capture || req.siteUrl);
  const productName = productNameFrom(req.prompt, { siteTitle: capture?.title, siteUrl: capture?.url, businessName: hasSite ? null : opts.brandKit?.businessName });
  const palette = brandPalette(capture, opts.brandKit);

  if (req.single) {
    log(`Designing one ${req.single.nameEn} shot`, 'done');
    return { plan: singleShotPlan(req.single, { prompt: req.prompt, productName, palette, durationSec: req.durationSec }), capture, source: 'inkpress' };
  }

  const required =
    req.recipes.length > 0
      ? req.recipes
      : opts.template === 'inkpress'
        ? INK_PRESS_SHOTS.map((id) => resolveMotionTemplate(id)!).filter(Boolean)
        : [];
  const autonomous = !req.mapping?.length && opts.template !== 'inkpress' && !req.recipes.length;
  // The product's ground decides the film's look family (SKILL principle 2): the director picks cards of that family.
  const sitePalette = capture ? paletteFromBrand(capture.brand) : null;
  const siteGround: 'dark' | 'light' | null = sitePalette ? (luma(sitePalette.page) < 0.5 ? 'dark' : 'light') : null;
  const guidedAsk = {
    prompt: req.prompt,
    durationSec: planSec,
    aspectRatio: opts.aspectRatio,
    capture,
    brandKit: opts.brandKit ? { ...opts.brandKit, ...(hasSite ? { businessName: null } : {}) } : null,
    siteGround,
  };
  // Stage 1: up to three visual directions grown from the product; an autonomous film takes the director's
  // recommendation and records why and what it gives up (it does not stop to ask).
  let direction: StoryboardResult['direction'];
  if (autonomous) {
    log('Weighing visual directions for the product', 'running');
    const options = await requestDirections(guidedAsk).catch(() => null);
    const chosen = options?.directions[options.recommended] ?? options?.directions[0];
    if (options && chosen) {
      direction = { chosen, others: options.directions.filter((d) => d !== chosen).map((d) => d.name) };
      log(`Visual direction: ${chosen.name} — ${chosen.claim}${chosen.why ? ` · why: ${chosen.why}` : ''}${chosen.tradeoff ? ` · trade-off: ${chosen.tradeoff}` : ''}${direction.others.length ? ` (weighed against ${direction.others.join(', ')})` : ''}`, 'done');
    }
  }
  const directionNote = direction ? `Direction: ${direction.chosen.name}: ${direction.chosen.claim} Look: ${direction.chosen.look}. Motion: ${direction.chosen.motion}.` : '';
  // Stage 2: the feature → shot map. Co-creation brings the confirmed map; an autonomous film has the director write one too.
  let mapping: MappingRow[] | null = req.mapping?.length ? req.mapping : null;
  if (autonomous) {
    log('Mapping each feature to a first-choice and a fallback shot card', 'running');
    mapping = await requestMapping({ ...guidedAsk, direction: directionNote }).catch(() => null);
    if (mapping?.length) {
      log(`Feature → shot map · ${mapping.length} features`, 'done');
      for (const r of mapping) log(`${r.feature} → ${shotName(r.firstShot)}${r.altShot ? ` (fallback ${shotName(r.altShot)})` : ''}${r.pageState ? ` · page state: ${r.pageState}` : ''}`, 'done');
    }
  }
  const cards = await chosenCards(required.length ? required.map((r) => r.id) : (mapping ?? []).flatMap((r) => [r.firstShot]));
  if (cards.length) log(`Read ${cards.length} shot card${cards.length === 1 ? '' : 's'} in full: ${cards.map((c) => shotName(c.id)).join(', ')}`, 'done');
  log(opts.template === 'inkpress' ? 'Storyboarding with the Ink Press template' : 'Directing the storyboard', 'running');
  try {
    const ask = () => requestPlan({
      mapping: mapping ?? undefined,
      cards,
      siteGround,
      prompt: directionNote ? `${req.prompt}\n\n${directionNote}`.slice(0, 3900) : req.prompt,
      durationSec: planSec,
      aspectRatio: opts.aspectRatio,
      capture,
      // The Brand Kit company never names a film of a site the user gave.
      brandKit: opts.brandKit ? { ...opts.brandKit, ...(hasSite ? { businessName: null } : {}) } : null,
      requiredRecipes: required.map((r) => r.id),
      template: opts.template === 'inkpress' ? 'inkpress' : null,
    });
    // One more try when the director is slow or briefly down; a missing key or a refusal is final.
    const plan = await ask().catch(async (error) => {
      if (error instanceof DirectorError && (error.status === 401 || error.status === 403 || error.status === 429)) throw error;
      log('The director did not answer; trying once more', 'running');
      return ask();
    });
    // Picked / named shots are the whole film (plus framing title cards): no other recipes.
    const siteScenes = Boolean(capture && !capture.partial && capture.page?.url);
    const shaped = restrictToRecipes(ensureRecipes(plan, req.recipes, planSec), req.recipes, planSec, { siteScenes });
    // The shot cards' own rules: a recipe once, caps per kind, one look, openers first and outros last.
    const site = capture ? paletteFromBrand(capture.brand) : null;
    const ground = site ? (luma(site.page) < 0.5 ? 'dark' : 'light') : null;
    const keep = new Set(req.recipes.map((r) => r.id));
    const ruled = applyFilmRules(shaped, { keep, siteScenes, ground });
    for (const note of ruled.notes) log(`Shot-card rule: ${note}`, 'done');
    // A feature whose first-choice card a rule ruled out gets its fallback card.
    const covered = releaseCheck(ruled.plan, mapping, { keep, ground });
    for (const s of covered.swapped) log(`Feature map: ${s}`, 'done');
    // One motion voice for the film, from the site's words and accent: it sets how long holds may grow and which seams fit.
    const voice = pickMotionPreset({ text: presetText(capture ?? { title: productName }), accent: ruled.plan.palette?.accent ?? palette.accent });
    log(`Motion voice: ${voice.label}`, 'done');
    // Stage 3 arc order: high and steady shots alternate, the document shot just before the finale.
    const arced = arrangeArc(covered.plan, keep);
    const withPictures = addGalleryScene(arced, { pictures: siteScenes ? pictureCount(capture) : 0, prompt: req.prompt, headline: capture?.content?.headings?.[0] });
    const fitted = fitNativeLengths(withPictures, planSec, new Set(req.recipes.map((r) => r.id)), voice.holdGrowth);
    const final = chooseSeams(applySiteContent(fitted, capture?.content), voice);
    // Stage 3: the consistency check before the storyboard is released.
    const release = releaseCheck(final, mapping, { keep, ground }).items;
    log(releaseLine(release), 'done');
    log(`Storyboard ready · ${fitted.scenes.length} scenes`, 'done');
    return { plan: final, capture, source: 'director', mapping: mapping ?? undefined, release, direction };
  } catch (error) {
    const note =
      error instanceof DirectorError && (error.status === 401 || error.status === 403)
        ? error.message
        : `The AI director could not be reached (${error instanceof Error ? error.message : 'error'}).`;
    const voice = pickMotionPreset({ text: presetText(capture ?? { title: productName }), accent: palette.accent });
    // Same rule as the director's plan: every recipe plays its whole tuned motion (native length), never sped up.
    const plan = fitNativeLengths(
      inkPressPlan({ prompt: req.prompt, durationSec: planSec, recipes: req.recipes, productName, palette, content: capture?.content, siteScenes: Boolean(capture && !capture.partial && capture.page?.url), pictures: pictureCount(capture) }),
      planSec,
      new Set(req.recipes.map((r) => r.id)),
      voice.holdGrowth,
    );
    log(`Storyboard ready from the Ink Press template · ${plan.scenes.length} scenes`, 'done');
    return { plan: chooseSeams(plan, voice), capture, source: 'inkpress', note };
  }
}

/**
 * The company the recipe demos should speak as. Only films of a captured site get one
 * (so the studio's own demos keep SmartVideo GO); the plan's palette and the site's own
 * words and font replace the demo's.
 */
export function brandFor(plan: DirectorPlan, capture: SiteCapture | null): BrandInput | undefined {
  const name = capture ? siteNameOf(capture.title || '', capture.url) : '';
  if (!capture || !name) return undefined;
  const content = capture.content;
  const taglines = [content?.headline, content?.description, ...(content?.headings ?? [])].filter((v): v is string => Boolean(v)).map((v) => v.trim().slice(0, 80));
  return {
    name,
    logo: capture.logo ?? null,
    accent: plan.palette.accent,
    accent2: plan.palette.accent,
    ink: plan.palette.text,
    paper: plan.palette.background,
    ...(capture.brand.fontFamily ? { font: capture.brand.fontFamily } : {}),
    repo: capture.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
    motto: content?.headline || taglines[0],
    taglines: taglines.slice(0, 4),
    features: (content?.headings ?? []).slice(0, 6),
  };
}

/**
 * The words each shot draws, in the person's product's voice. The director rewrites a recipe's
 * template text from the site and the storyboard; with no key, or when it cannot be reached,
 * the site's own headline, headings and menu fill the same lines.
 */
export async function writeShotWords(plan: DirectorPlan, capture: SiteCapture | null, product: string, log: ActivityLog): Promise<Record<number, Record<string, string>>> {
  const stringsOf = (recipeId: string) => {
    const t = recipeId ? resolveMotionTemplate(recipeId) : undefined;
    return t ? DEMO_TEXTS[t.componentName] ?? [] : [];
  };
  const hasWords = plan.scenes.some((sc) => sc.kind === 'shot' && stringsOf(sc.recipeId).length > 0);
  if (!hasWords) return {};
  log('Writing your words into the shots', 'running');
  try {
    const texts = await requestRetext({ plan, product, capture });
    if (Object.keys(texts).length) {
      log('Shots now say your words', 'done');
      return texts;
    }
  } catch {
    /* fall through to the site's own words */
  }
  const out: Record<number, Record<string, string>> = {};
  const used = new Set<string>();
  plan.scenes.forEach((sc, i) => {
    if (sc.kind !== 'shot') return;
    const rules = rulesOfScene(sc);
    if (rules?.text === 'fixed') return;
    const map = fallbackTexts(stringsOf(sc.recipeId), capture?.content, product, { index: i, headline: sc.headline, caption: sc.caption }, used, rules?.text === 'structural');
    if (Object.keys(map).length) out[i] = map;
  });
  log(Object.keys(out).length ? 'Filled the shots with your site’s own words' : 'Kept the template words (no site words to use)', 'done');
  return out;
}

/** Approved storyboard → editable project, with the music's beat grid when a track was attached. */
export async function buildFilmProject(
  plan: DirectorPlan,
  opts: { aspectRatio: AspectRatio; capture: SiteCapture | null; media: MediaAttachment[]; logo?: string | null; prompt?: string; adaptShots?: boolean; music?: boolean; mapping?: MappingRow[]; release?: ReleaseItem[]; direction?: string; targetedCapture?: boolean },
  log: ActivityLog,
): Promise<ProjectData> {
  // Pipeline stage 4: a page a storyboard row needs that the first capture did not reach is captured now, on its own.
  const needed = opts.targetedCapture === false ? [] : neededPages(plan, opts.capture);
  if (opts.capture && needed.length) {
    log(`Capturing the pages the storyboard needs (pipeline stage 4): ${needed.map((n) => n.link.path).join(', ')}`, 'running');
    const got = await Promise.all(
      needed.map((n) => captureSite(n.link.url, { targeted: true, maxWaitMs: 240_000 }).then((c) => ({ n, c })).catch(() => null)),
    );
    let merged = opts.capture;
    for (const g of got) if (g) merged = mergeCaptures(merged, g.c, { name: g.n.link.name, path: g.n.link.path });
    const ok = got.filter(Boolean).length;
    const forScenes = got.filter((g) => g && g.n.scene >= 0).map((g) => g!.n.scene + 1);
    log(ok ? `Captured ${ok} more page${ok === 1 ? '' : 's'} of the site${forScenes.length ? ` (for scene${forScenes.length === 1 ? '' : 's'} ${forScenes.join(', ')})` : ''}` : 'The extra pages could not be captured; those scenes use the nearest captured page', 'done');
    opts = { ...opts, capture: merged };
  }
  opts = { ...opts, capture: withoutPeopleLines(opts.capture) };
  const images = opts.media.filter((m) => m.kind === 'image').map((m) => m.url);
  // The site's own images lead the card slots, then its card crops, then anything attached.
  const film: FilmCapture | null = opts.capture
    ? {
        // Every captured route of the site, the page asked for first.
        screens: [opts.capture.page.url, ...(opts.capture.pages ?? []).slice(1).map((p) => p.url), ...images].filter(Boolean),
        // The asset finder's pictures lead (people and products first), then the images the page showed, then card crops.
        crops: [...(opts.capture.assets ?? []).map((a) => a.url), ...(opts.capture.images ?? []), ...opts.capture.crops, ...images],
        assets: opts.capture.assets ?? [],
        title: opts.capture.title,
        // Where each section of the home page starts, so the insets can show them one at a time.
        sections: (opts.capture.pages?.[0]?.layout?.sections ?? []).map((r) => r.y),
        pageH: opts.capture.pages?.[0]?.layout?.pageH ?? opts.capture.page.height,
        sectionNames: opts.capture.content?.headings ?? [],
        nav: opts.capture.content?.nav ?? [],
        ctas: opts.capture.content?.ctas ?? [],
        address: opts.capture.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
      }
    : images.length
      ? { screens: images, crops: images }
      : null;
  // Every picture the capture brought back, labelled, and the pictures each scene shows (upstream's feature -> shot map).
  if (film && opts.capture) {
    const catalogue = buildCatalogue(opts.capture);
    const perScene = assignPictures(plan, catalogue);
    film.scenes = perScene.map((p) => (p.ids.length ? { screens: p.screens, crops: p.crops } : undefined));
    const summary = catalogueSummary(catalogue);
    if (summary) log(`Sorted the site's pictures: ${summary}`, 'done');
    log(`Each scene gets its own pictures: ${picturesShown(perScene)} different pictures across ${perScene.filter((p) => p.ids.length).length} scenes`, 'done');
  }
  const attached = opts.media.find((m) => m.kind === 'audio');
  // No track attached: the film still gets music, as upstream's finished films do, unless the person asked for none.
  const noMusic = /\b(?:no|without|skip)\s+(?:the\s+)?(?:music|bgm|soundtrack|background music)\b/i.test(opts.prompt ?? '') || opts.music === false;
  const voice = pickMotionPreset({ text: presetText(opts.capture ?? { title: plan.title }), accent: plan.palette?.accent });
  const auto = !attached && !noMusic ? defaultTrackFor(voice.id) : null;
  const track = attached ?? (auto ? { id: 'bgm', kind: 'audio' as const, name: auto.name, url: auto.file, size: 0 } : undefined);
  let beats: number[] = [];
  let drums: Pick<DrumMap, 'downbeats' | 'kicks' | 'snares' | 'hats'> = { downbeats: [], kicks: [], snares: [], hats: [] };
  if (track) {
    log(auto ? `Music: ${auto.name} (${auto.why}, chosen for the ${voice.label.toLowerCase()} feel) · finding its beat` : `Finding the beat in ${track.name}`, 'running');
    // A library track is a file under public/; an attached one is a blob URL.
    const map = await analyzeBeats(auto ? `/${auto.file}` : track.url).catch(() => null);
    beats = map?.beats ?? [];
    if (map) drums = map;
    log(beats.length ? `Cuts snapped to the beat of ${track.name}` : `No clear beat in ${track.name}; kept the planned timing`, 'done');
  }
  const brand = brandFor(plan, opts.capture);
  const product = brand?.name ?? plan.title.split(/\s[—–-]\s/)[0];
  const texts = await writeShotWords(plan, opts.capture, product, log);
  log('Animating the shots and laying in sound design', 'running');
  const videos = opts.media.filter((m) => m.kind === 'video').map((m) => ({ url: m.url, name: m.name, durationSec: m.durationSec }));
  if (videos.length) log(`Cutting in ${videos.length} attached video${videos.length === 1 ? '' : 's'}`, 'done');
  const project = planToProject(plan, {
    aspectRatio: opts.aspectRatio,
    capture: film,
    music: track ? { url: track.url, name: track.name, beats, downbeats: drums.downbeats, kicks: drums.kicks } : null,
    // A film of a captured site shows that site's logo (none if it had none); the Brand Kit logo is for films with no site.
    logo: opts.capture ? opts.capture.logo ?? null : opts.logo ?? null,
    videos,
    brand,
    texts,
    theme: filmTheme(opts.capture),
  });
  if (beats.length) {
    const cuts = (project.tracks.find((tr) => tr.name === t('track.shots'))?.clips ?? []).slice(1).map((c) => c.start / project.fps);
    const sync = syncReport(cuts, beats, project.fps);
    const onKick = syncReport(cuts, [...drums.kicks, ...drums.downbeats], project.fps).within;
    log(`Beat sync measured: ${sync.within} of ${sync.cuts} cuts within 3 frames of a beat (worst ${sync.worstFrames} frames)${drums.kicks.length ? `, ${onKick} on a kick or a downbeat` : ''}`, 'done');
  }
  const spec = { ...buildDesignSpec(plan, opts.capture, opts.prompt), ...(opts.mapping?.length ? { mapping: opts.mapping } : {}), ...(opts.release?.length ? { release: opts.release } : {}), ...(opts.direction ? { direction: opts.direction } : {}) };
  let built: ProjectData = { ...project, spec };
  // Upstream's coding agent edits each shot's source for the product; here the model does, behind the sandbox, one shot at a time.
  if (opts.capture && !opts.capture.partial && opts.adaptShots !== false && adaptedCodeIsEnabled()) {
    const brandTokens = { name: brand?.name, accent: plan.palette?.accent, background: plan.palette?.background, text: plan.palette?.text, font: opts.capture.brand?.fontFamily ?? undefined };
    built = await adaptFilm(
      built,
      { layout: opts.capture.pages?.[0]?.layout ?? null, screens: film?.screens ?? [], crops: film?.crops ?? [], brand: brandTokens, content: opts.capture.content },
      {
        render: async (p, f, signal) => (await import('../webRenderer')).renderStillOnWebExport(p, f, signal, 0.5),
        snapshot: async (r) => (r && typeof r === 'object' && 'blob' in r ? stillToJpeg((r as { blob: Blob }).blob) : null),
        review: async (p, frames, signal) => {
          const render = (await import('../webRenderer')).renderStillOnWebExport;
          const images: Array<{ second: number; image: string }> = [];
          for (const f of frames) images.push({ second: Math.round((f / p.fps) * 10) / 10, image: await stillToJpeg((await render(p, f, signal, 0.5)).blob) });
          const { findings } = await requestFrameReview({ frames: images, spec: p.spec });
          return findings.filter((x) => x.severity === 'fix').map((x) => `${x.text} (seen in the still at ${x.second.toFixed(1)}s)`);
        },
      },
      log,
    ).catch(() => built);
  }
  log(`Film built · ${built.tracks.length} tracks`, 'done');
  return built;
}

export interface FilmQaReport {
  ok: boolean;
  issues: string[];
  warnings: string[];
  /** Frames rendered by the frame check (0 when the browser cannot render stills). */
  framesChecked: number;
  /** The programmatic part of the final review (lib/filmReview). */
  review?: ReviewItem[];
}

/** Structural check of a built film: every clip resolves, shots run back to back, nothing runs past the end. */
export function checkFilmStructure(project: ProjectData, opts: { hasProductImages: boolean } = { hasProductImages: false }): FilmQaReport {
  const issues: string[] = [];
  const warnings: string[] = [];
  const end = projectEndFrame(project);
  if (end <= 0) issues.push('The film is empty.');
  for (const track of project.tracks) {
    const clips = track.clips.slice().sort((a, b) => a.start - b.start);
    for (const c of clips) {
      if (!CARDS[c.cardId]) issues.push(`${track.name}: clip uses an unknown card (${c.cardId}).`);
      if (c.duration <= 0) issues.push(`${track.name}: a clip has no length.`);
    }
    if (clips.some((c) => c.cardId.startsWith('demo:') || c.cardId === 'inkpress-title-card')) {
      for (let i = 1; i < clips.length; i++) {
        const gap = clips[i].start - (clips[i - 1].start + clips[i - 1].duration);
        if (gap > 1) issues.push(`${track.name}: ${gap}-frame black gap at ${(clips[i].start / project.fps).toFixed(1)}s.`);
        if (gap < -1) issues.push(`${track.name}: shots overlap at ${(clips[i].start / project.fps).toFixed(1)}s.`);
      }
    }
  }
  const productShots = project.tracks.flatMap((t) => t.clips).filter((c) => c.cardId.startsWith('demo:') && isProductTextureShot(c.cardId.slice(5)));
  if (productShots.length && !opts.hasProductImages) {
    warnings.push(`${productShots.length} product shot${productShots.length === 1 ? '' : 's'} show sample pages — add your URL or attach screenshots to put your product on screen.`);
  }
  return { ok: issues.length === 0, issues, warnings, framesChecked: 0, review: reviewFilm(project) };
}

/**
 * Frame QA: render the middle frame of every shot and the film's first and
 * last frame (in the browser, with the same composition the export uses) and
 * report the ones that fail. Skipped when the browser cannot render stills; bounded by `budgetMs`.
 */
export async function checkFilmFrames(project: ProjectData, log: ActivityLog, budgetMs = 30_000): Promise<{ checked: number; failed: string[] }> {
  let render: typeof import('../webRenderer').renderStillOnWebExport;
  try {
    render = (await import('../webRenderer')).renderStillOnWebExport;
  } catch {
    return { checked: 0, failed: [] };
  }
  const shotTrack = project.tracks.find((t) => t.clips.some((c) => c.cardId.startsWith('demo:'))) ?? project.tracks[0];
  const frames = new Set<number>();
  // Upstream's three checks per shot: entering, at the peak, settled; plus the film's first and last frame.
  for (const c of shotTrack?.clips ?? []) {
    frames.add(c.start + Math.floor(c.duration * 0.2));
    frames.add(c.start + Math.floor(c.duration / 2));
    frames.add(c.start + Math.max(0, c.duration - 3));
  }
  frames.add(0);
  frames.add(Math.max(0, projectEndFrame(project) - 1));
  const list = [...frames].sort((a, b) => a - b);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  const failed: string[] = [];
  let checked = 0;
  log(`Frame QA · checking ${list.length} frames`, 'running');
  try {
    for (const f of list) {
      if (controller.signal.aborted) break;
      try {
        await render(project, f, controller.signal, 0.5);
        checked++;
      } catch (error) {
        if (controller.signal.aborted) break;
        failed.push(`${(f / project.fps).toFixed(2)}s: ${error instanceof Error ? error.message : 'render failed'}`);
      }
    }
  } finally {
    clearTimeout(timer);
  }
  log(
    failed.length
      ? `Frame QA · ${failed.length} of ${checked + failed.length} frames failed`
      : checked
        ? `Frame QA · ${checked} frames render cleanly${checked < list.length ? ` (time budget reached at ${checked}/${list.length})` : ''}`
        : 'Frame QA · skipped (this browser cannot render stills)',
    failed.length ? 'error' : 'done',
  );
  return { checked, failed };
}

/** A frame as a small JPEG data URL (the reviewer sees 640 px wide, enough for layout and legibility). */
export async function stillToJpeg(blob: Blob, maxW = 800): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxW / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.7);
}

/**
 * Independent review of a built film by a model that sees a few of its frames and the design
 * spec (final-review.md: a reviewer that did not make the film). Best effort: returns [] when
 * there is no key, no spec, the browser cannot render stills, or the model cannot be reached.
 */
export async function reviewFramesWithModel(project: ProjectData, budgetMs = 30_000): Promise<string[]> {
  if (!project.spec) return [];
  let render: typeof import('../webRenderer').renderStillOnWebExport;
  try {
    render = (await import('../webRenderer')).renderStillOnWebExport;
  } catch {
    return [];
  }
  const shotTrack = project.tracks.find((tr) => tr.clips.some((c) => c.cardId.startsWith('demo:') || c.cardId.startsWith('brand-'))) ?? project.tracks[0];
  const clips = (shotTrack?.clips ?? []).slice().sort((a, b) => a.start - b.start);
  const picks = clips.length <= 5 ? clips : [0, 1, 2, 3, 4].map((i) => clips[Math.round((i * (clips.length - 1)) / 4)]);
  const frames = [...new Set(picks.map((c) => c.start + Math.floor(c.duration * 0.6)))].slice(0, 5);
  frames.push(Math.max(0, projectEndFrame(project) - 12));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  try {
    const images: Array<{ second: number; image: string }> = [];
    for (const f of frames) {
      if (controller.signal.aborted) break;
      const still = await render(project, f, controller.signal, 0.5);
      images.push({ second: Math.round((f / project.fps) * 10) / 10, image: await stillToJpeg(still.blob) });
    }
    if (!images.length) return [];
    const { findings, summary } = await requestFrameReview({ frames: images, spec: project.spec });
    return [
      findings.length ? `A second reviewer looked at ${images.length} frames:` : `A second reviewer looked at ${images.length} frames and flagged nothing it could see.`,
      ...findings.map((f) => `- ${f.severity === 'fix' ? '✗' : '?'} ${f.second.toFixed(1)}s ${f.text}`),
      ...(summary ? [summary] : []),
    ];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
