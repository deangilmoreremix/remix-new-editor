// [remix] Animations are filed by content group, never by source name.
import { describe, it, expect } from 'vitest';
import { animationGroup, buildAnimationCatalog, animationGroups, filterAnimations } from '../lib/occ/animation-catalog';
import type { MgTemplate } from '../lib/occ/mg-templates';

const t = (id: string, category: string, usable = true): MgTemplate => ({ id, name: id, category, width: 1920, height: 1080, fps: 30, durationInFrames: 90, props: {}, propSchema: [], code: '', usable });

describe('animation catalogue', () => {
  it('maps source categories onto shared groups', () => {
    expect(animationGroup('lower-thirds')).toBe('Lower thirds');
    expect(animationGroup('lower-third')).toBe('Lower thirds');
    expect(animationGroup('data-visualization')).toBe('Data & charts');
    expect(animationGroup('title-cards')).toBe('Titles & text');
    expect(animationGroup('social-shorts')).toBe('Social');
    expect(animationGroup('uncategorized')).toBe('Other');
    expect(animationGroup(undefined)).toBe('Other');
    expect(animationGroup('something-new')).toBe('Other');
  });
  it('drops unusable items, counts groups, filters and searches', () => {
    const items = buildAnimationCatalog({ mg: [t('a', 'lower-thirds'), t('b', 'lower-third'), t('c', 'title-cards'), t('d', 'x', false)] });
    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(animationGroups(items)).toEqual([{ group: 'Lower thirds', count: 2 }, { group: 'Titles & text', count: 1 }]);
    expect(filterAnimations(items, 'Lower thirds', '').length).toBe(2);
    expect(filterAnimations(items, null, 'c').map((i) => i.id)).toEqual(['c']);
  });
});
