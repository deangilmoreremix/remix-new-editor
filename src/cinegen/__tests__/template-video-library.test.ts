// The Template videos library is generated (scripts/generate-template-video-library.mjs) from the reviewed allowlist (clean clips) plus
// every other landing-page clip, each labeled with a branding verdict (scripts/template-video-branding.json).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error plain JS data module
import { templateVideos, TEMPLATE_VIDEO_CATEGORIES, TEMPLATE_VIDEO_SUBCATEGORIES } from '../../data/templateVideoLibrary.js';

type Row = { id: string; slug: string; title: string; sourceTitle: string; category: string; subcategory: string; duration: number | null; aspectRatio: string; videoSrc: string; posterSrc: string | null; branding: 'none' | 'logo'; marks?: string };
const rows = templateVideos as Row[];
const root = resolve(__dirname, '../../..');
const HOSTED = /^(https:\/\/bzxohkrxcwodllketcpz\.supabase\.co\/storage\/v1\/object\/public\/demo-template-videos\/(clips|posters)\/|\/media\/|\/cdn\/beatapi\/)/;

describe('template video library', () => {
  it('starts with the reviewed allowlist (in order), then every other usable clip, with unique ids', () => {
    const allow = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-allowlist.json'), 'utf8')) as Array<{ set: string; slug: string }>;
    const brand = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-branding.json'), 'utf8')).entries as Record<string, { branding: string }>;
    const usable = Object.keys(brand).filter((id) => brand[id].branding !== 'exclude');
    // A few clips are listed by two source sets with the same file; the library keeps one.
    expect(rows.length).toBeLessThanOrEqual(usable.length);
    expect(usable.length - rows.length).toBeLessThan(8);
    expect(new Set(rows.map((r) => r.videoSrc)).size).toBe(rows.length);
    expect(rows.length).toBeGreaterThan(500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.slice(0, allow.length).map((r) => r.id)).toEqual(allow.map((a) => `${a.set}:${a.slug}`));
  });

  it('labels every clip No logo or Has logo, the allowlisted ones as No logo, and matches the branding file', () => {
    const allow = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-allowlist.json'), 'utf8')) as Array<{ set: string; slug: string }>;
    const brand = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-branding.json'), 'utf8')).entries as Record<string, { branding: string; marks?: string }>;
    for (const r of rows) {
      expect(['none', 'logo'], r.id).toContain(r.branding);
      expect(r.branding, r.id).toBe(brand[r.id].branding);
      if (r.branding === 'logo') expect(r.marks, r.id).toBeTruthy();
    }
    for (const a of allow) expect(rows.find((r) => r.id === `${a.set}:${a.slug}`)?.branding).toBe('none');
    expect(rows.filter((r) => r.branding === 'none').length).toBeGreaterThan(250);
    expect(rows.filter((r) => r.branding === 'logo').length).toBeGreaterThan(200);
  });

  it('only uses our own hosting (the demo-template-videos bucket, or repo /media in --local mode), never the raw CDN host', () => {
    for (const r of rows) {
      for (const u of [r.videoSrc, r.posterSrc]) {
        if (u === null) continue;
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

  it('every clip carries descriptive metadata: topics, orientation, duration, aspect ratio, poster and credit', () => {
    const cat = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-catalog.json'), 'utf8')) as { clips: Array<{ id: string; topics: string[]; orientation: string; credit: { author: string | null; url: string | null } }> };
    for (const [i, r] of (rows as Array<Row & { topics: string[]; orientation: string }>).entries()) {
      expect(r.topics.length, r.id).toBeGreaterThanOrEqual(3);
      expect(r.topics, r.id).toContain(r.category.toLowerCase());
      expect(['landscape', 'portrait', 'square'], r.id).toContain(r.orientation);
      expect(r.duration, r.id).toBeGreaterThan(0);
      expect(r.posterSrc, r.id).toBeTruthy();
      expect(cat.clips[i].topics, r.id).toEqual(r.topics);
      expect(cat.clips[i].credit?.url, r.id).toBeTruthy();
    }
  });

  it('every clip has a playable video (hosted or a repo file)', () => {
    for (const r of rows) expect(r.videoSrc, r.id).toMatch(HOSTED);
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

  it('has a generated catalog.json that matches the library (so other apps see the same clips, names and URLs)', () => {
    const cat = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-catalog.json'), 'utf8')) as { count: number; categories: Record<string, string[]>; clips: Array<{ id: string; title: string; category: string; subcategory: string; videoUrl: string; posterUrl: string | null; branding: string }> };
    expect(cat.count).toBe(rows.length);
    expect(cat.clips.map((c) => c.id)).toEqual(rows.map((r) => r.id));
    for (const [i, c] of cat.clips.entries()) {
      const r = rows[i];
      expect([c.title, c.category, c.subcategory, c.videoUrl, c.posterUrl, c.branding]).toEqual([r.title, r.category, r.subcategory, r.videoSrc, r.posterSrc, r.branding]);
    }
    expect(cat.categories).toEqual(TEMPLATE_VIDEO_SUBCATEGORIES);
  });
});
