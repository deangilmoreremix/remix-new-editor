// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';

const id = (name: string) => MOTION_TEMPLATES.find((t) => t.componentName === name)!.id;

vi.mock('../lib/directorClient', () => {
  class DirectorError extends Error {
    constructor(message: string, readonly code: string, readonly status: number) {
      super(message);
    }
  }
  return {
    DirectorError,
    captureSite: vi.fn(),
    requestMapping: vi.fn(),
    requestDirections: vi.fn(async () => {
      throw new Error('no directions');
    }),
    fetchRecipeCard: vi.fn(async (stem: string) => `---\nname: ${stem}\n---\n## Intent\nThe whole card of ${stem}.`),
    requestPlan: vi.fn(),
  };
});

import { requestDirections, requestMapping, requestPlan, fetchRecipeCard } from '../lib/directorClient';
import { storyboardFilm } from '../lib/filmPipeline';
import { parseFilmRequest } from '../lib/filmChat';
import { releaseCheck, releaseLine } from '../lib/releaseCheck';
import { buildCatalogBrief, cardLine, type DirectorPlan, type MappingRow } from '../lib/directorPlan';
import { specMarkdown, buildDesignSpec } from '../lib/designSpec';

const shot = (recipeId: string, feature = '', durationSec = 5) => ({ kind: 'shot' as const, recipeId, durationSec, headline: '', caption: '', transition: 'cut' as const, feature });
const title = (durationSec = 2) => ({ kind: 'title' as const, recipeId: '', durationSec, headline: 'Acme', caption: '', transition: 'cut' as const });
const plan = (scenes: DirectorPlan['scenes']): DirectorPlan => ({ title: 'Acme', summary: '', palette: { background: '#fff', text: '#111', accent: '#c00' }, scenes });

describe('stage 2: catalog from the English cards', () => {
  it('every recipe line carries the English card description and when to use it', () => {
    const brief = buildCatalogBrief();
    expect(cardLine('DeckDealFlyin')).toMatch(/^Opens with an orbiting close-up/);
    expect(cardLine('DeckDealFlyin')).toContain('USE WHEN:');
    expect(brief).not.toMatch(/[一-鿿]/);
    for (const t of MOTION_TEMPLATES) expect(cardLine(t.componentName), t.componentName).not.toBe('');
  });
});

describe('stage 2 → 3: fallback cards and the release check', () => {
  const rows: MappingRow[] = [
    { feature: 'Lots of content', firstShot: id('DeckDealFlyin'), altShot: id('PageWaterfallWall'), expresses: 'volume', pageState: 'services page' },
    { feature: 'Proof', firstShot: id('RowEmbed'), altShot: '', expresses: 'trust', pageState: 'testimonials' },
  ];

  it('a feature that lost its first-choice card gets its fallback in a scene that showed no mapped feature', () => {
    const p = plan([title(3), shot(id('ListStackPress')), shot(id('RowEmbed'), 'Proof'), title(2)]);
    const out = releaseCheck(p, rows);
    expect(out.swapped[0]).toMatch(/^Lots of content: first-choice card in scene 2/);
    expect(out.plan.scenes[1].recipeId).toBe(id('DeckDealFlyin'));
    expect(out.plan.scenes[1].asset).toBe('services page');
    expect(out.items.find((i) => i.code === 'F1')!.ok).toBe(true);
  });

  it('reports what is missing, repeats, a short opening and no closing hold', () => {
    const p = plan([shot(id('RowEmbed'), 'Proof', 2), shot(id('RowEmbed'), 'Proof', 2), { ...title(), durationSec: 0.5 }]);
    const items = releaseCheck(p, rows).items;
    const by = Object.fromEntries(items.map((i) => [i.code, i]));
    expect(by.F1.ok).toBe(false);
    expect(by.F1.text).toContain('Lots of content');
    expect(by.P4.ok).toBe(false);
    expect(by.B1.ok).toBe(false);
    expect(by.B3.ok).toBe(false);
    expect(releaseLine(items)).toMatch(/^Release check: \d\/5 ✓ · F1 ✗/);
  });
});

describe('autonomous film: map, full cards, release', () => {
  it('writes the feature → shot map, sends the chosen cards in full and the map to the storyboard, and runs the release check', async () => {
    const rows: MappingRow[] = [
      { feature: 'Lots of content', firstShot: id('DeckDealFlyin'), altShot: id('PageWaterfallWall'), expresses: 'volume', pageState: 'services page' },
      { feature: 'Proof', firstShot: id('RowEmbed'), altShot: id('ListStackPress'), expresses: 'trust', pageState: 'testimonials' },
    ];
    vi.mocked(requestMapping).mockResolvedValueOnce(rows);
    vi.mocked(requestPlan).mockResolvedValueOnce(plan([title(3), shot(id('DeckDealFlyin'), 'Lots of content'), shot(id('RowEmbed'), 'Proof'), title(2)]));
    const lines: string[] = [];
    const result = await storyboardFilm(parseFilmRequest('a 15 second promo for Acme'), { template: 'director', durationSec: 15, aspectRatio: '16:9' }, (l) => lines.push(l));
    const sent = vi.mocked(requestPlan).mock.calls[0][0];
    expect(sent.mapping).toEqual(rows);
    expect(sent.cards!.map((c) => c.id)).toEqual([id('DeckDealFlyin'), id('RowEmbed')]);
    expect(sent.cards![0].text).toContain('The whole card of DeckDealFlyin');
    expect(vi.mocked(fetchRecipeCard)).toHaveBeenCalledWith('DeckDealFlyin');
    expect(lines.some((l) => /^Lots of content → .*\(fallback .*\) · page state: services page$/.test(l))).toBe(true);
    expect(lines.some((l) => l.startsWith('Read 2 shot cards in full'))).toBe(true);
    expect(lines.some((l) => l.startsWith('Release check:'))).toBe(true);
    expect(result.mapping).toEqual(rows);
    expect(result.release!.find((i) => i.code === 'F1')!.ok).toBe(true);
  });

  it('films with picked shots skip the map but still read their cards in full', async () => {
    vi.mocked(requestMapping).mockClear();
    vi.mocked(requestPlan).mockResolvedValueOnce(plan([shot(id('DeckDealFlyin'), '', 5), title(2)]));
    await storyboardFilm(parseFilmRequest('a promo for Acme with DeckDealFlyin'), { template: 'director', durationSec: 10, aspectRatio: '16:9' }, () => {});
    expect(requestMapping).not.toHaveBeenCalled();
    expect(vi.mocked(requestPlan).mock.calls.at(-1)![0].cards!.map((c) => c.id)).toEqual([id('DeckDealFlyin')]);
  });

  it('the design spec download carries the map and the release check', () => {
    const spec = { ...buildDesignSpec(plan([title(3)]), null, 'x'), mapping: [{ feature: 'Proof', firstShot: 'a', altShot: '', expresses: 'trust', pageState: 'testimonials' }], release: [{ code: 'F1', ok: true, text: 'All 1 mapped features have a shot.' }] };
    const md = specMarkdown(spec);
    expect(md).toContain('## Feature → shot map');
    expect(md).toContain('| Proof | a | — | trust | testimonials |');
    expect(md).toContain('- ✓ F1: All 1 mapped features have a shot.');
  });
});

describe('the card as the storyboard reads it', () => {
  it('puts intent, motion core and known pitfalls first and leaves out the reference implementation', async () => {
    const { cardForStoryboard } = await import('../lib/filmPipeline');
    const fs = await import('node:fs');
    const md = fs.readFileSync('scripts/motion-director/shots-en/ui-entrance/deck-deal-flyin.md', 'utf8');
    const out = cardForStoryboard(md);
    expect(out.length).toBeLessThanOrEqual(6_000);
    expect(out.startsWith('---\nname: deck-deal-flyin')).toBe(true);
    const at = (h: string) => out.indexOf(h);
    expect(at('## Intent')).toBeGreaterThan(0);
    expect(at('## Motion core')).toBeGreaterThan(at('## Intent'));
    expect(at('## Known pitfalls')).toBeGreaterThan(at('## Motion core'));
    expect(out).not.toContain('## Reference implementation');
  });
});

describe('stage 1 in an autonomous film', () => {
  it('weighs up to three directions, takes the recommended one, says why and what it gives up, and hands it to the map and the storyboard', async () => {
    const d = (name: string) => ({ name, claim: `${name} claim.`, keywords: [], look: 'dark ground', motion: 'fast pushes', why: 'fits a startup', tradeoff: 'less calm' });
    vi.mocked(requestDirections).mockResolvedValueOnce({ directions: [d('Quiet'), d('Launch'), d('Paper')], recommended: 1 });
    vi.mocked(requestMapping).mockResolvedValueOnce([{ feature: 'Proof', firstShot: id('RowEmbed'), altShot: '', expresses: 'trust', pageState: 'testimonials' }]);
    vi.mocked(requestPlan).mockResolvedValueOnce(plan([title(3), shot(id('RowEmbed'), 'Proof'), title(2)]));
    const lines: string[] = [];
    const result = await storyboardFilm(parseFilmRequest('a 10 second promo for Acme'), { template: 'director', durationSec: 10, aspectRatio: '16:9' }, (l) => lines.push(l));
    expect(result.direction!.chosen.name).toBe('Launch');
    expect(result.direction!.others).toEqual(['Quiet', 'Paper']);
    expect(lines).toContain('Visual direction: Launch — Launch claim. · why: fits a startup · trade-off: less calm (weighed against Quiet, Paper)');
    expect(vi.mocked(requestMapping).mock.calls.at(-1)![0].direction).toContain('Direction: Launch');
    expect(vi.mocked(requestPlan).mock.calls.at(-1)![0].prompt).toContain('Direction: Launch: Launch claim. Look: dark ground. Motion: fast pushes.');
  });

  it('the chosen direction is rendered as three still key frames: the opening, the site, the close', async () => {
    const { styleframeProject } = await import('../lib/styleframes');
    const { project, frames } = styleframeProject({ background: '#101820', text: '#f5f5f5', accent: '#ff6b35' }, 'Acme', null, { opening: true });
    const shots = project.tracks.flatMap((t) => t.clips).filter((c) => c.cardId.startsWith('brand-'));
    expect(shots.map((c) => c.cardId)).toEqual(['brand-url-scan', 'brand-hub', 'brand-logo-reveal']);
    expect(frames).toHaveLength(3);
    frames.forEach((f, i) => {
      expect(f).toBeGreaterThan(shots[i].start);
      expect(f).toBeLessThan(shots[i].start + shots[i].duration);
    });
  });

  it('the six motion presets are the pipeline table, value for value', async () => {
    const { MOTION_PRESETS } = await import('../lib/motionPreset');
    const fs = await import('node:fs');
    const md = fs.readFileSync('scripts/motion-director/pipeline.md', 'utf8');
    const rows = md.split('\n').filter((l) => /^\| (Professional|Refined|Energetic|Playful|Calm|Approachable)/.test(l)).map((l) => l.split('|').map((c) => c.trim()));
    expect(rows).toHaveLength(6);
    const order = ['trust', 'premium', 'bold', 'playful', 'calm', 'friendly'] as const;
    rows.forEach((r, i) => {
      const p = MOTION_PRESETS[order[i]];
      expect(Number(r[2].match(/\d+/)![0]), order[i]).toBe(p.mainFrames);
      if (r[3].startsWith('bezier')) expect(r[3]).toBe(p.easing);
      expect(Number(r[4].match(/[\d.]+/)![0])).toBe(p.overshoot);
      expect(Number(r[5].match(/[\d.]+/)![0])).toBe(p.squash);
    });
  });
});

describe('the director picks cards of the product\'s look family', () => {
  it('sends the site\'s ground to the map and the storyboard', async () => {
    vi.mocked(requestMapping).mockResolvedValueOnce([{ feature: 'Proof', firstShot: id('RowEmbed'), altShot: '', expresses: 'trust', pageState: 'testimonials' }]);
    vi.mocked(requestPlan).mockResolvedValueOnce(plan([title(3), shot(id('ListStackPress'), 'Proof'), title(2)]));
    const capture = { url: 'https://acme.test/', title: 'Acme', page: { url: 'p', width: 3840, height: 3000 }, crops: [], brand: { background: '#ffffff', text: '#111111', accent: '#2563eb', fontFamily: null }, content: null, transient: false } as never;
    await storyboardFilm(parseFilmRequest('a 10 second promo for https://acme.test'), { template: 'director', durationSec: 10, aspectRatio: '16:9', capture }, () => {});
    expect(vi.mocked(requestMapping).mock.calls.at(-1)![0].siteGround).toBe('light');
    expect(vi.mocked(requestPlan).mock.calls.at(-1)![0].siteGround).toBe('light');
  });
});
