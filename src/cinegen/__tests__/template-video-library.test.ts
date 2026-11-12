// The Template videos library is generated (scripts/generate-template-video-library.mjs) from the reviewed allowlist.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error plain JS data module
import { templateVideos, TEMPLATE_VIDEO_CATEGORIES } from '../../data/templateVideoLibrary.js';

type Row = { id: string; slug: string; title: string; category: string; duration: number | null; aspectRatio: string; videoSrc: string; posterSrc: string | null };
const rows = templateVideos as Row[];
const root = resolve(__dirname, '../../..');

describe('template video library', () => {
  it('matches the reviewed allowlist exactly (201 clips, unique ids)', () => {
    const allow = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-allowlist.json'), 'utf8')) as Array<{ set: string; slug: string }>;
    expect(rows).toHaveLength(allow.length);
    expect(rows).toHaveLength(201);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.map((r) => r.id)).toEqual(allow.map((a) => `${a.set}:${a.slug}`));
  });

  it('only uses same-origin media URLs (local /media or the /cdn/beatapi proxy), never the raw CDN host', () => {
    for (const r of rows) {
      for (const u of [r.videoSrc, r.posterSrc]) {
        expect(u, r.id).toMatch(/^\/(media|cdn\/beatapi)\//);
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
});
