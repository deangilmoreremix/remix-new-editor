import { describe, it, expect } from 'vitest';
import { CARDS } from '../cards/registry';
import {
  MOTION_CATEGORIES,
  MOTION_TEMPLATE_CARDS,
  MOTION_TEMPLATES,
  motionCardId,
  motionCardIdFor,
  motionTemplateVariants,
  resolveMotionTemplate,
} from '../../../data/motionRecipeCatalog';

/**
 * The catalog ids (`<category>/<slug>/<Component>`) and the card registry ids
 * (`demo:<Stem>`) used to be two unrelated namespaces: indexing CARDS with a
 * catalog id always missed, so every library preview rendered a gradient
 * placeholder and every entry-page clip produced an empty composition.
 *
 * `motionCardId` is the single bridge — these tests pin it down.
 */
describe('catalog ↔ card-registry bridge', () => {
  it('resolves every catalog shot to a registered card', () => {
    const missing = MOTION_TEMPLATES.filter((t) => !CARDS[motionCardId(t)]);
    expect(missing.map((t) => t.id)).toEqual([]);
    expect(MOTION_TEMPLATES.length).toBeGreaterThanOrEqual(150);
  });

  it('resolves every grouped card to a registered card', () => {
    const missing = MOTION_TEMPLATE_CARDS.filter((c) => !CARDS[motionCardId(c)]);
    expect(missing.map((c) => c.id)).toEqual([]);
    expect(MOTION_TEMPLATE_CARDS.length).toBe(124);
  });

  it('uses the demo:<Stem> registry key format', () => {
    for (const t of MOTION_TEMPLATES) {
      expect(motionCardId(t)).toBe(`demo:${t.componentName}`);
      expect(CARDS[motionCardId(t)].id).toBe(motionCardId(t));
      expect(CARDS[motionCardId(t)].component).toBeTruthy();
    }
  });

  it('never resolves a raw catalog id against the registry', () => {
    // The old (broken) behaviour: CARDS[t.id] misses for every shot.
    const collisions = MOTION_TEMPLATES.filter((t) => CARDS[t.id]);
    expect(collisions).toEqual([]);
  });

  it('resolves identifiers by shot id, grouped id, slug and component name', () => {
    const t = MOTION_TEMPLATES.find((x) => x.slug === 'crash-zoom-punch' && x.componentName === 'CrashZoomReal')!;
    expect(resolveMotionTemplate(t.id)?.id).toBe(t.id);
    expect(resolveMotionTemplate('camera/crash-zoom-punch')?.slug).toBe('crash-zoom-punch');
    expect(resolveMotionTemplate('crash-zoom-punch')?.slug).toBe('crash-zoom-punch');
    expect(resolveMotionTemplate('CrashZoomReal')?.componentName).toBe('CrashZoomReal');
    expect(resolveMotionTemplate('nope-not-a-shot')).toBeUndefined();
    expect(motionCardIdFor(t.id)).toBe('demo:CrashZoomReal');
    expect(motionCardIdFor('nope-not-a-shot')).toBeUndefined();
  });

  it('exposes both crash-zoom-punch variants as individually selectable shots', () => {
    const card = MOTION_TEMPLATE_CARDS.find((c) => c.slug === 'crash-zoom-punch')!;
    const variants = motionTemplateVariants(card);
    expect(variants.map((v) => v.componentName)).toEqual(
      expect.arrayContaining(['CrashImpactReal', 'CrashZoomReal']),
    );
    for (const v of variants) expect(CARDS[motionCardId(v)]).toBeTruthy();
  });

  it('groups the 20 multi-variant cards', () => {
    const multi = MOTION_TEMPLATE_CARDS.filter(
      (c) => motionTemplateVariants(c).length > 1,
    );
    expect(multi.length).toBe(20);
    for (const c of multi) {
      for (const v of motionTemplateVariants(c)) {
        expect(CARDS[motionCardId(v)]).toBeTruthy();
      }
    }
  });

  it('keeps the category counts in sync with the catalog', () => {
    const counts = new Map<string, number>();
    for (const t of MOTION_TEMPLATES) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    for (const c of MOTION_CATEGORIES) {
      expect(counts.get(c.key) ?? 0).toBe(c.count);
    }
    expect(
      MOTION_CATEGORIES.reduce((sum, c) => sum + c.count, 0),
    ).toBe(MOTION_TEMPLATES.length);
  });

  it('registers every demo module of the index as a card', () => {
    for (const c of Object.values(CARDS)) {
      if (!c.id.startsWith('demo:')) continue;
      expect(c.component).toBeTruthy();
      expect(c.durationInFrames).toBeGreaterThanOrEqual(2);
    }
  });
});
