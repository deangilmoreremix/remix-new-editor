import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { CARDS, CARD_LIST } from '../cards/registry';
import { LEGACY_CARDS } from '../cards/legacyCards';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';

describe('retired recipes kept for old saves', () => {
  it('66 old ids resolve with their original duration and name but are never offered', () => {
    expect(LEGACY_CARDS).toHaveLength(66);
    const manifest = JSON.parse(readFileSync('src/features/personalization/apps/motion-director/demosrc/_legacy/manifest.json', 'utf8')).cards as Array<{ stem: string; duration: number; nameEn: string }>;
    for (const m of manifest) {
      const card = CARDS[`demo:${m.stem}`];
      expect(card, m.stem).toBeTruthy();
      expect(card.durationInFrames).toBe(m.duration);
      expect(card.nameEn).toBe(m.nameEn);
    }
    const listed = new Set(CARD_LIST.map((c) => c.id));
    expect(LEGACY_CARDS.some((c) => listed.has(c.id) && !MOTION_TEMPLATES.some((t) => `demo:${t.componentName}` === c.id))).toBe(false);
  });

  it('a current recipe wins when a retired one shares its id', () => {
    const current = new Set(CARD_LIST.map((c) => c.id));
    for (const c of LEGACY_CARDS) if (current.has(c.id)) expect(CARDS[c.id]).toBe(CARD_LIST.find((x) => x.id === c.id));
  });

  it('its textures are served from the legacy namespace and exist', () => {
    expect(existsSync('public/motion-studio/legacy-textures/projects-full.png')).toBe(true);
    expect(existsSync('public/motion-studio/legacy-textures/agent-stream.jpg')).toBe(true);
  });
});
