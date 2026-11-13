// The Template videos library is generated (scripts/generate-template-video-library.mjs) from the reviewed allowlist.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error plain JS data module
import { templateVideos, TEMPLATE_VIDEO_CATEGORIES, TEMPLATE_VIDEO_SUBCATEGORIES } from '../../data/templateVideoLibrary.js';

type Row = { id: string; slug: string; title: string; sourceTitle: string; category: string; subcategory: string; duration: number | null; aspectRatio: string; videoSrc: string; posterSrc: string | null };
const rows = templateVideos as Row[];
const root = resolve(__dirname, '../../..');
const HOSTED = /^(https:\/\/bzxohkrxcwodllketcpz\.supabase\.co\/storage\/v1\/object\/public\/demo-template-videos\/(clips|posters)\/|\/media\/|\/cdn\/beatapi\/)/;

describe('template video library', () => {
  it('matches the reviewed allowlist exactly (unique ids)', () => {
    const allow = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-allowlist.json'), 'utf8')) as Array<{ set: string; slug: string }>;
    expect(rows).toHaveLength(allow.length);
    expect(rows.length).toBeGreaterThan(150);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.map((r) => r.id)).toEqual(allow.map((a) => `${a.set}:${a.slug}`));
  });

  it('only uses our own hosting (the demo-template-videos bucket, or repo /media in --local mode), never the raw CDN host', () => {
    for (const r of rows) {
      for (const u of [r.videoSrc, r.posterSrc]) {
        expect(u, r.id).toMatch(HOSTED);
        expect(u, r.id).not.toContain('media.beatapi.io');
      }
    }
  });

  it('every local file exists on disk', () => {
    for (const r of rows) {
      for (const u of [r.videoSrc, r.posterSrc]) if (u && u.startsWith('/media/')) expect(existsSync(resolve(root, 'public', u.slice(1))), `${r.id} ${u}`).toBe(true);
    }
  });

  it('every clip has a title, a ratio and a category listed in the tab order', () => {
    for (const r of rows) {
      expect(r.title.length, r.id).toBeGreaterThan(0);
      expect(r.aspectRatio, r.id).toMatch(/^\d+:\d+$/);
      expect(TEMPLATE_VIDEO_CATEGORIES, r.id).toContain(r.category);
    }
  });

  it('has unique, short commercial titles that are not prompt fragments, and a subcategory listed for its category', () => {
    expect(new Set(rows.map((r) => r.title)).size).toBe(rows.length);
    const subs = TEMPLATE_VIDEO_SUBCATEGORIES as Record<string, string[]>;
    for (const r of rows) {
      expect(r.title.length, r.id).toBeLessThanOrEqual(36);
      expect(r.title, r.id).not.toMatch(/minimax|hailuo|seedance|prompt|reference|\bh3\b|@|created with/i);
      expect(r.sourceTitle.length, r.id).toBeGreaterThan(0);
      expect(subs[r.category], r.id).toContain(r.subcategory);
    }
  });
});
