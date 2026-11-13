// [remix] Animations are filed by content group (the Animations window's groups), never by source name.
import { describe, it, expect } from 'vitest';
import { mgGroup, buildAnimationCatalog, animationGroups, filterAnimations } from '../lib/occ/animation-catalog';
import type { MgTemplate } from '../lib/occ/mg-templates';
import type { HfItem } from '../lib/hyperframes/overlay';
import { hyperframesItems } from '../lib/hyperframes/overlay';
import { groupOf } from '../components/edit/hyperframes-modal';

const t = (id: string, category: string, usable = true): MgTemplate => ({ id, name: id, category, width: 1920, height: 1080, fps: 30, durationInFrames: 90, props: {}, propSchema: [], code: '', usable });

describe('animation catalogue', () => {
  it('maps template categories onto the window\'s group names', () => {
    expect(mgGroup('lower-thirds')).toBe('Lower thirds');
    expect(mgGroup('data-visualization')).toBe('Data & charts');
    expect(mgGroup('title-cards')).toBe('Titles & text');
    expect(mgGroup('social-shorts')).toBe('Social & UI');
    expect(mgGroup('uncategorized')).toBe('Motion graphics');
  });
  it('merges both sources, drops unusable, counts and filters', () => {
    const hf = hyperframesItems();
    expect(hf.length).toBeGreaterThan(200);
    const items = buildAnimationCatalog({ hf, hfGroup: groupOf, mg: [t('a', 'lower-thirds'), t('d', 'x', false)] });
    expect(items.length).toBe(hf.length + 1);
    const groups = animationGroups(items);
    expect(groups.reduce((n, g) => n + g.count, 0)).toBe(items.length);
    expect(groups[0].group).toBe('Lower thirds');
    expect(filterAnimations(items, 'Lower thirds', '').every((i) => i.group === 'Lower thirds')).toBe(true);
    expect(filterAnimations(items, null, 'zzz-no-match').length).toBe(0);
    expect(items.some((i) => i.kind === 'hf' && i.hf)).toBe(true);
  });
  it('handles an item with no hfGroup', () => {
    const hfOne = hyperframesItems().slice(0, 1) as HfItem[];
    expect(buildAnimationCatalog({ hf: hfOne })[0].group).toBe('More');
  });
});
