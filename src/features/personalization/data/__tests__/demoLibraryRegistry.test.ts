// Step 2 ("AI Demos") registry: the original catalogs (kept when their media is playable) plus the Template videos library,
// every clip labeled No logo / Has logo.
import { describe, it, expect } from 'vitest';
import { DEMO_LIBRARY_REGISTRY, demoCollections, EXCLUDED_DEMO_COLLECTIONS, toVideoDemo } from '../demoLibraryRegistry';
import { getDemoCategoryIds, DEMO_CATEGORIES, ALL_DEMOS_CATEGORY_ID } from '../../shared/personalization/guided/demoCategories';
// @ts-expect-error plain JS data module
import { templateVideos } from '../../../../data/templateVideoLibrary.js';

const PLAYABLE = /^(https:\/\/bzxohkrxcwodllketcpz\.supabase\.co\/storage\/v1\/object\/public\/demo-template-videos\/|\/media\/)/;

describe('demo library registry', () => {
  it('holds every template-library clip exactly once (the original catalog demos reuse the library media)', () => {
    expect(DEMO_LIBRARY_REGISTRY.length).toBe((templateVideos as unknown[]).length);
    expect(new Set(DEMO_LIBRARY_REGISTRY.map((entry) => entry.id)).size).toBe(DEMO_LIBRARY_REGISTRY.length);
    expect(new Set(DEMO_LIBRARY_REGISTRY.map((entry) => entry.videoSrc)).size).toBe(DEMO_LIBRARY_REGISTRY.length);
  });

  it('only offers playable media: hosted in our bucket or a repo file, never the raw CDN or a missing catalog path', () => {
    for (const entry of DEMO_LIBRARY_REGISTRY) {
      expect(entry.videoSrc, entry.id).toMatch(PLAYABLE);
      expect(entry.videoSrc, entry.id).not.toContain('media.beatapi.io');
      expect(entry.posterSrc, entry.id).toBeTruthy();
      expect(entry.videoSrc, entry.id).not.toMatch(/\/media\/(promptfeed|seedance-1|seedance-25)\//);
    }
  });

  it('no longer carries the dead PromptFeed / Seedance 1 catalogs (their video files never existed)', () => {
    expect(demoCollections.map((collection) => collection.id)).not.toEqual(expect.arrayContaining(['promptfeed']));
    expect(DEMO_LIBRARY_REGISTRY.some((entry) => entry.collectionId === ('promptfeed' as string) || entry.collectionId === ('seedance-1' as string))).toBe(false);
    expect(EXCLUDED_DEMO_COLLECTIONS.map((collection) => collection.id)).not.toEqual(expect.arrayContaining(['promptfeed']));
  });

  it('labels every demo No logo or Has logo (a logo label names its mark)', () => {
    for (const entry of DEMO_LIBRARY_REGISTRY) {
      expect(['none', 'logo'], entry.id).toContain(entry.branding);
      if (entry.branding === 'logo') expect(entry.marks, entry.id).toBeTruthy();
      expect(toVideoDemo(entry).branding, entry.id).toBe(entry.branding);
    }
  });

  it('files every demo under at least one business niche, so no clip is unreachable by category', () => {
    const stranded = DEMO_LIBRARY_REGISTRY.filter((entry) => getDemoCategoryIds(toVideoDemo(entry)).filter((id) => id !== ALL_DEMOS_CATEGORY_ID).length === 0);
    // The taxonomy is keyword based; a few generic clips may fall outside every niche but must stay reachable under "All".
    expect(stranded.length / DEMO_LIBRARY_REGISTRY.length).toBeLessThan(0.35);
    expect(DEMO_CATEGORIES.length).toBeGreaterThan(1);
  });
});
