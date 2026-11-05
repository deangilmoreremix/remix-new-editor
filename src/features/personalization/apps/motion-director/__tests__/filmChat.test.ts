// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import {
  INK_PRESS_SHOTS,
  ensureRecipes,
  reviseRecipes,
  MAX_PICKED_SHOTS,
  findNamedRecipes,
  inkPressPlan,
  isFilmRequest,
  isNewFilmRequest,
  findSiteUrl,
  parseFilmRequest,
  readTemplateAnswer,
  applySiteContent,
  restrictToRecipes,
  isQuestion,
  singleShotPlan,
  startsDifferentFilm,
  addGalleryScene,
  wantsSitePictures,
} from '../lib/filmChat';
import { planToProject } from '../lib/buildFilm';
import { checkFilmStructure } from '../lib/filmPipeline';
import { CARDS } from '../cards/registry';

const byComponent = (name: string) => MOTION_TEMPLATES.find((t) => t.componentName === name)!;

describe('film chat requests', () => {
  it('recognises the four README prompts as film requests', () => {
    expect(isFilmRequest('Use video-shotcraft to make a promo for my product.')).toBe(true);
    expect(isFilmRequest('Make a launch film for this repo with the Ink Press template.')).toBe(true);
    expect(isFilmRequest('Use the deck-deal-flyin and row-embed shot cards to present this feature.')).toBe(true);
    expect(isFilmRequest('Design a product close-up inspired by spotlight-hero-card.')).toBe(true);
  });

  it('leaves edit commands to the edit agent', () => {
    for (const edit of ['make the text bigger', 'set the duration to 8s', 'make the video 8s long', 'change the background to red', 'add a caption clip', 'make my video shorter', 'make a caption clip bigger', 'turn a clip red']) {
      expect(isFilmRequest(edit)).toBe(false);
    }
  });

  it('once a film exists, only an explicit ask starts a new one', () => {
    for (const edit of ['make my video shorter', 'make the intro a close-up', 'make the promo faster', 'turn the reel red', 'use a bigger font']) {
      expect(isNewFilmRequest(edit)).toBe(false);
    }
    for (const ask of [
      'Use video-shotcraft to make a promo for my product.',
      'Make a launch film for this repo with the Ink Press template.',
      'Use the deck-deal-flyin and row-embed shot cards to present this feature.',
      'Design a product close-up inspired by spotlight-hero-card.',
      'create a new 30-second video for acme.io',
    ]) {
      expect(isNewFilmRequest(ask)).toBe(true);
    }
  });

  it('reads the product URL without cutting longer TLDs short', () => {
    expect(findSiteUrl('a promo for acme.company please')).toBeNull();
    expect(findSiteUrl('a promo for acme.software')).toBeNull();
    expect(findSiteUrl('a promo for acme.co/pricing')).toBe('acme.co/pricing');
    expect(findSiteUrl('see https://acme.example.com/app.')).toBe('https://acme.example.com/app');
    expect(findSiteUrl('make a promo for acme.io')).toBe('acme.io');
  });

  it('finds shots named by slug, in the order they were named', () => {
    expect(findNamedRecipes('use row-embed then deck-deal-flyin').map((t) => t.componentName)).toEqual(['RowEmbed', 'DeckDealFlyin']);
    expect(findNamedRecipes('a CrashZoomReal moment').map((t) => t.componentName)).toEqual(['CrashZoomReal']);
    expect(findNamedRecipes('make a promo')).toEqual([]);
  });

  it('reads template, single-shot, length and URL from the message', () => {
    expect(parseFilmRequest('Make a launch film with the Ink Press template').template).toBe('inkpress');
    expect(parseFilmRequest('make a promo without ink press').template).toBe('director');
    const single = parseFilmRequest('Design a product close-up inspired by spotlight-hero-card.');
    expect(single.single?.componentName).toBe('SpotlightHeroCard');
    const r = parseFilmRequest('a 30-second promo for https://acme.io');
    expect(r.durationSec).toBe(30);
    expect(r.siteUrl).toBe('https://acme.io');
    expect(r.single).toBeNull();
  });

  it('reads the answer to the Ink Press question', () => {
    expect(readTemplateAnswer('yes')).toBe('inkpress');
    expect(readTemplateAnswer('use ink press')).toBe('inkpress');
    expect(readTemplateAnswer('no, let the director pick')).toBe('director');
    expect(readTemplateAnswer('hmm what about colours')).toBeNull();
  });
});

describe('Ink Press storyboard', () => {
  it('builds the template film: title, product shots, call to action, fitted to length', () => {
    const plan = inkPressPlan({ prompt: 'promo for Acme', durationSec: 30 });
    expect(plan.scenes[0].kind).toBe('title');
    expect(plan.scenes[plan.scenes.length - 1].kind).toBe('title');
    expect(plan.scenes.filter((s) => s.kind === 'shot').map((s) => s.recipeId)).toEqual([...INK_PRESS_SHOTS]);
    expect(plan.scenes[0].headline).toContain('Acme');
    const total = plan.scenes.reduce((sum, s) => sum + s.durationSec, 0);
    expect(Math.abs(total - 30)).toBeLessThan(1);
  });

  it("writes the copy from the captured site's own words", () => {
    const plan = inkPressPlan({
      prompt: 'promo for Acme',
      durationSec: 30,
      content: { headline: 'Ship faster with Acme', headings: ['Plan in minutes', 'Build together'], ctas: ['Start free'] },
    });
    expect(plan.scenes[0].caption).toBe('Ship faster with Acme');
    const shots = plan.scenes.filter((s) => s.kind === 'shot');
    expect(shots.slice(0, 2).map((s) => s.caption)).toEqual(['Plan in minutes', 'Build together']);
    expect(plan.scenes[plan.scenes.length - 1].caption).toBe('Start free');
  });

  it('uses exactly the named shots when the user picks them', () => {
    const picked = [byComponent('DeckDealFlyin'), byComponent('RowEmbed')];
    const plan = inkPressPlan({ prompt: 'present this feature', durationSec: 12, recipes: picked });
    expect(plan.scenes.filter((s) => s.kind === 'shot').map((s) => s.recipeId)).toEqual(picked.map((p) => p.id));
  });

  it('puts missing named shots back into a director plan before the closing card', () => {
    const plan = inkPressPlan({ prompt: 'x', durationSec: 20 });
    const named = byComponent('HitCounter');
    const fixed = ensureRecipes(plan, [named], 20);
    expect(fixed.scenes.some((s) => s.recipeId === named.id)).toBe(true);
    expect(fixed.scenes[fixed.scenes.length - 1].kind).toBe('title');
  });

  it('puts the named shots in the order they were named, even when the director swapped them', () => {
    const deck = byComponent('DeckDealFlyin');
    const row = byComponent('RowEmbed');
    const plan = inkPressPlan({ prompt: 'x', durationSec: 16, recipes: [row, deck] });
    expect(plan.scenes.filter((s) => s.kind === 'shot').map((s) => s.recipeId)).toEqual([row.id, deck.id]);
    const fixed = ensureRecipes(plan, [deck, row], 16);
    expect(fixed.scenes.filter((s) => s.kind === 'shot').map((s) => s.recipeId)).toEqual([deck.id, row.id]);
    // Titles stay where they were.
    expect(fixed.scenes[0].kind).toBe('title');
    expect(fixed.scenes[fixed.scenes.length - 1].kind).toBe('title');
    // Already in order: the plan comes back untouched.
    expect(ensureRecipes(fixed, [deck, row], 16)).toBe(fixed);
  });

  it('never drops a named shot for a title card when the storyboard is full', () => {
    const shots = MOTION_TEMPLATES.slice(0, 14);
    const ids = (p: { scenes: { kind: string; recipeId: string }[] }) => p.scenes.filter((s) => s.kind === 'shot').map((s) => s.recipeId);
    const twelve = inkPressPlan({ prompt: 'x', durationSec: 60, recipes: shots.slice(0, MAX_PICKED_SHOTS) });
    expect(ids(twelve)).toEqual(shots.slice(0, 12).map((t) => t.id));
    expect(twelve.scenes[0].kind).toBe('title');
    const fourteen = inkPressPlan({ prompt: 'x', durationSec: 60, recipes: shots });
    expect(ids(fourteen)).toEqual(shots.map((t) => t.id));
    // ensureRecipes on a plan with titles makes room by dropping the titles, not the named shots.
    const repaired = ensureRecipes(twelve, shots, 60);
    expect(ids(repaired)).toEqual(shots.map((t) => t.id));
  });

  it('revisions replace shots when asked to, and add them otherwise', () => {
    const deck = byComponent('DeckDealFlyin');
    const row = byComponent('RowEmbed');
    const crash = byComponent('CrashZoomReal');
    expect(reviseRecipes([deck, row], 'use CrashZoomReal instead of row-embed')).toEqual([deck, crash]);
    expect(reviseRecipes([deck, row], 'replace deck-deal-flyin with CrashZoomReal')).toEqual([crash, row]);
    expect(reviseRecipes([deck, row], 'swap row-embed for CrashZoomReal')).toEqual([deck, crash]);
    expect(reviseRecipes([deck, row], 'use CrashZoomReal instead')).toEqual([crash]);
    expect(reviseRecipes([deck, row], 'remove row-embed')).toEqual([deck]);
    expect(reviseRecipes([deck], 'also add row-embed at the end')).toEqual([deck, row]);
    expect(reviseRecipes([deck, row], 'make it 20 seconds')).toEqual([deck, row]);
  });

  it('builds a single adapted shot and a clean full-HD project from a storyboard', () => {
    const single = singleShotPlan(byComponent('SpotlightHeroCard'), { prompt: 'close-up for Acme' });
    expect(single.scenes).toHaveLength(1);
    // A length the user asked for wins over the shot's native length (within the scene limits).
    expect(singleShotPlan(byComponent('SpotlightHeroCard'), { prompt: 'x', durationSec: 10 }).scenes[0].durationSec).toBe(10);
    expect(singleShotPlan(byComponent('SpotlightHeroCard'), { prompt: 'x', durationSec: 99 }).scenes[0].durationSec).toBe(12);
    const project = planToProject(inkPressPlan({ prompt: 'promo for Acme', durationSec: 20 }), { aspectRatio: '16:9' });
    expect([project.width, project.height, project.fps]).toEqual([1920, 1080, 30]);
    for (const clip of project.tracks.flatMap((t) => t.clips)) expect(CARDS[clip.cardId]).toBeDefined();
    const qa = checkFilmStructure(project, { hasProductImages: false });
    expect(qa.issues).toEqual([]);
    expect(qa.warnings.length).toBe(1);
  });
});

describe('Brand Kit logo and attached videos', () => {
  const plan = () => inkPressPlan({ prompt: 'promo for Acme', durationSec: 20 });
  const clips = (p: ReturnType<typeof planToProject>) => p.tracks.flatMap((t) => t.clips);

  it('stamps the logo on every title card', () => {
    const project = planToProject(plan(), { aspectRatio: '16:9', logo: 'https://cdn.example.com/logo.png' });
    const titles = clips(project).filter((c) => c.cardId === 'inkpress-title-card');
    expect(titles.length).toBe(2);
    for (const t of titles) expect(t.props.logo).toBe('https://cdn.example.com/logo.png');
  });

  it('plays attached videos before the closing card, back to back with the shots', () => {
    const project = planToProject(plan(), {
      aspectRatio: '16:9',
      videos: [{ url: 'blob:demo-1', name: 'demo.mp4', durationSec: 3 }, { url: 'blob:demo-2', name: 'long.mp4', durationSec: 40 }],
    });
    const shots = project.tracks.find((t) => t.clips.some((c) => c.cardId === 'video-clip'))!.clips.slice().sort((a, b) => a.start - b.start);
    const ids = shots.map((c) => c.cardId);
    expect(ids.slice(-3)).toEqual(['video-clip', 'video-clip', 'inkpress-title-card']);
    const [v1, v2] = shots.filter((c) => c.cardId === 'video-clip');
    expect(v1.duration).toBe(90); // 3 s
    expect(v2.duration).toBe(240); // clamped to 8 s
    expect(v1.props.file).toBe('blob:demo-1');
    expect(checkFilmStructure(project).issues).toEqual([]);
  });
});

describe('a film made of picked shots', () => {
  const deck = byComponent('DeckDealFlyin');
  const row = byComponent('RowEmbed');
  // Catalog shots only: brand scenes (hub, push-in) may sit between the repeats of a pick.
  const shotIds = (p: { scenes: { kind: string; recipeId: string }[] }) => p.scenes.filter((s) => s.kind === 'shot' && !s.recipeId.startsWith('brand/')).map((s) => s.recipeId);

  it('plays each picked shot once, in order, never another recipe; the site\'s own scenes carry the repeated scenes\' copy', () => {
    // The model added other shots, repeated one, and put a title card in the middle.
    const noisy = inkPressPlan({ prompt: 'x', durationSec: 30 });
    const other = noisy.scenes.filter((s) => s.kind === 'shot').map((s) => s.recipeId);
    expect(other.length).toBeGreaterThan(2);
    const plan = { ...noisy, scenes: [noisy.scenes[0], ...noisy.scenes.filter((s) => s.kind === 'shot').map((s, i) => ({ ...s, headline: `Scene ${i}` })), { ...noisy.scenes[0], headline: 'Middle' }, noisy.scenes[noisy.scenes.length - 1]] };

    const withSite = restrictToRecipes(plan, [row, deck], 20, { siteScenes: true });
    const ids = shotIds(withSite);
    expect(ids).toEqual([row.id, deck.id]);
    expect(withSite.scenes[0].kind).toBe('title');
    expect(withSite.scenes[withSite.scenes.length - 1].kind).toBe('title');
    const brand = withSite.scenes.filter((s) => s.recipeId.startsWith('brand/'));
    expect(brand.length).toBe(other.length - 2);
    expect(brand.filter((s) => s.recipeId === 'brand/hub')).toHaveLength(1);
    expect(brand.every((s) => /^Scene \d+$/.test(s.headline))).toBe(true);
    expect(Math.round(withSite.scenes.reduce((sum, s) => sum + s.durationSec, 0))).toBe(20);

    // With no site there is nothing to fill with: the repeats are dropped and the picks hold longer.
    const noSite = restrictToRecipes(plan, [row, deck], 20);
    expect(noSite.scenes.filter((s) => s.recipeId.startsWith('brand/'))).toHaveLength(0);
    expect(shotIds(noSite)).toEqual([row.id, deck.id]);
    expect(Math.round(noSite.scenes.reduce((sum, s) => sum + s.durationSec, 0))).toBe(20);
  });

  it('plays a recipe the director repeated only once when no recipes were picked (site film)', () => {
    const noisy = inkPressPlan({ prompt: 'x', durationSec: 30 });
    const shot = noisy.scenes.find((s) => s.kind === 'shot')!;
    const plan = { ...noisy, scenes: [noisy.scenes[0], shot, { ...shot, headline: 'again' }, { ...shot, headline: 'and again' }, noisy.scenes[noisy.scenes.length - 1]] };
    const fitted = restrictToRecipes(plan, [], 20, { siteScenes: true });
    expect(shotIds(fitted)).toEqual([shot.recipeId]);
    expect(fitted.scenes.filter((s) => s.recipeId.startsWith('brand/')).map((s) => s.headline)).toEqual(['again', 'and again']);
    expect(restrictToRecipes(plan, [], 20)).toBe(plan);
  });

  it('puts back a picked shot the model skipped, and does nothing when none are picked', () => {
    const plan = inkPressPlan({ prompt: 'x', durationSec: 20 });
    const ids = shotIds(restrictToRecipes(plan, [byComponent('HitCounter')], 20));
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids)).toEqual(new Set([byComponent('HitCounter').id]));
    expect(restrictToRecipes(plan, [], 20)).toBe(plan);
  });

  it('stretches a few picked shots to the requested length', () => {
    const plan = inkPressPlan({ prompt: 'x', durationSec: 60 });
    const fitted = restrictToRecipes(plan, [row, deck], 60);
    expect(fitted.scenes.reduce((sum, s) => sum + s.durationSec, 0)).toBeGreaterThan(54);
  });

  it('a single picked shot is still a valid storyboard', () => {
    const plan = { ...inkPressPlan({ prompt: 'x', durationSec: 20 }), title: 'Acme — shot film' };
    const fitted = restrictToRecipes({ ...plan, scenes: plan.scenes.filter((s) => s.kind === 'shot') }, [deck], 8);
    expect(new Set(shotIds(fitted))).toEqual(new Set([deck.id]));
    // 8 s holds at most 5 scenes at 1.5 s: the repeats beyond that are dropped.
    expect(fitted.scenes.length).toBeLessThanOrEqual(5);
    expect(fitted.scenes.length).toBeGreaterThanOrEqual(2);
  });
});

describe('framing cards and site copy on a picked-shot film', () => {
  const deck = byComponent('DeckDealFlyin');
  const row = byComponent('RowEmbed');
  it('drops optional title cards the requested length cannot fit', () => {
    const plan = inkPressPlan({ prompt: 'x', durationSec: 20 });
    // 5 s allows 3 scenes at 1.5 s: two shots + one framing card, not four scenes.
    const five = restrictToRecipes(plan, [deck, row], 5);
    expect(five.scenes.length).toBeLessThanOrEqual(3);
    expect(Math.round(five.scenes.reduce((sum, s) => sum + s.durationSec, 0))).toBeLessThanOrEqual(5);
    // Plenty of time keeps both framing cards.
    expect(restrictToRecipes(plan, [deck, row], 20).scenes.filter((s) => s.kind === 'title')).toHaveLength(2);
  });
  it("the site's headline and call to action win the title cards over the director's captions", () => {
    const plan = inkPressPlan({ prompt: 'x', durationSec: 20, recipes: [deck, row] });
    const generic = { ...plan, scenes: plan.scenes.map((s) => (s.kind === 'title' ? { ...s, caption: 'The new way to ship' } : { ...s, caption: 'Director caption' })) };
    const out = applySiteContent(generic, { headline: 'Build faster with Globex', ctas: ['Start free'], headings: ['Plan it'] });
    expect(out.scenes[0].caption).toBe('Build faster with Globex');
    expect(out.scenes[out.scenes.length - 1].caption).toBe('Start free');
    expect(out.scenes[1].caption).toBe('Director caption');
  });
});

describe('a message while a storyboard is on the table', () => {
  const current = { siteUrl: 'acme.io' };
  it('starts a different film for a new site, a "new film" ask or "make a promo for …"', () => {
    expect(startsDifferentFilm('make a promo for https://other.com', current)).toBe(true);
    expect(startsDifferentFilm('now beta.dev', current)).toBe(true);
    expect(startsDifferentFilm('make me a new video', current)).toBe(true);
    expect(startsDifferentFilm('create a promo for Globex', current)).toBe(true);
  });
  it('revises for everything else', () => {
    for (const edit of ['use crash-zoom-punch instead', 'make it 20 seconds', 'make a video shorter', 'swap row-embed for deck-deal-flyin', 'also look at acme.io/pricing']) {
      expect(startsDifferentFilm(edit, current)).toBe(false);
    }
  });
});

describe('questions about the storyboard', () => {
  it('tells a question from a change request', () => {
    expect(isQuestion('why did you pick that opening?')).toBe(true);
    expect(isQuestion('What will the closing card say')).toBe(true);
    expect(isQuestion('make the ending shorter')).toBe(false);
    expect(isQuestion('use deck-deal-flyin instead?')).toBe(false);
  });
});

describe('a named shot on a captured site', () => {
  it('keeps the site story scenes around the picked shot', () => {
    const shot = MOTION_TEMPLATES.find((t) => t.componentName === 'DatavizLandscapeOpen')!;
    const plan = inkPressPlan({ prompt: 'film for acme.com', durationSec: 30, recipes: [shot], productName: 'Acme', siteScenes: true });
    const ids = plan.scenes.map((s) => s.recipeId);
    expect(ids).toContain('brand/url-scan');
    expect(ids).toContain('brand/hub');
    expect(ids).toContain(shot.id);
  });
});

describe('the site\'s own pictures', () => {
  it('adds a gallery scene when images or people are asked for, once, and not without pictures', () => {
    const base = inkPressPlan({ prompt: 'film for acme.com', durationSec: 30, productName: 'Acme', siteScenes: true });
    expect(wantsSitePictures('using its images and people in the screenshots')).toBe(true);
    const out = addGalleryScene(base, { pictures: 3, prompt: 'use its images and people' });
    const ids = out.scenes.map((s) => s.recipeId);
    expect(ids.filter((i) => i === 'brand/people-gallery')).toHaveLength(1);
    expect(addGalleryScene(out, { pictures: 3, prompt: 'images' }).scenes).toHaveLength(out.scenes.length);
    expect(addGalleryScene(base, { pictures: 1, prompt: 'images' }).scenes).toHaveLength(base.scenes.length);
    expect(addGalleryScene(base, { pictures: 3, prompt: 'a calm film' }).scenes).toHaveLength(base.scenes.length);
  });

  it('the template story includes the gallery when the site gave pictures', () => {
    const plan = inkPressPlan({ prompt: 'film for acme.com', durationSec: 30, productName: 'Acme', siteScenes: true, pictures: 5 });
    expect(plan.scenes.map((s) => s.recipeId)).toContain('brand/people-gallery');
  });
});
