// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../muapi.js', () => ({ muapi: {} }));

const { STUDIO_DIRECTORY, STUDIO_GROUPS, directoryByGroup, SLUG_BY_ROUTE, EXTRA_STUDIOS, getStudio } = await import('../studioDirectory.js');
const { NAV_GROUPS, STUDIO_ROUTES } = await import('../studioRoutes.js');
const { getGuideOverview, getGuideFeatures, guideSlugs } = await import('../guideImages.js');

const pub = (p) => join(process.cwd(), 'public', p);
const onDisk = (p) => existsSync(pub(p)) || existsSync(pub(`${p}.png`));

describe('studio directory (the 38)', () => {
  it('has exactly 38 unique studios, every one a known route', () => {
    expect(STUDIO_DIRECTORY).toHaveLength(38);
    expect(new Set(STUDIO_DIRECTORY.map((s) => s.id)).size).toBe(38);
    for (const s of STUDIO_DIRECTORY) expect(STUDIO_ROUTES[s.id], `${s.id} has a route`).toBeTruthy();
  });
  it('groups them 3 / 7 / 11 / 15 / 2 in the order Discover, Image, Video, Agents, My Work', () => {
    expect(STUDIO_GROUPS).toEqual(['Discover', 'Image', 'Video', 'Agents', 'My Work']);
    expect(directoryByGroup().map((g) => [g.title, g.items.length])).toEqual([['Discover', 3], ['Image', 7], ['Video', 11], ['Agents', 15], ['My Work', 2]]);
  });
  it('contains every side-menu item except the Apps hub, in the side menu\'s own order, plus the 7 off-menu studios', () => {
    const menu = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)).filter((id) => id !== 'apps');
    expect(menu).toHaveLength(31);
    const ids = STUDIO_DIRECTORY.map((s) => s.id);
    for (const id of menu) expect(ids).toContain(id);
    expect(ids).not.toContain('apps');
    expect(EXTRA_STUDIOS.map((s) => s.id).sort()).toEqual(['find-my-brand', 'influencer', 'leadfinder', 'motion-director', 'outreach', 'recorder', 'render']);
    // within a group the side-menu order is kept
    for (const g of NAV_GROUPS) {
      const inDir = STUDIO_DIRECTORY.map((s) => s.id).filter((id) => g.items.some((i) => i.id === id));
      expect(inDir).toEqual(g.items.map((i) => i.id).filter((id) => id !== 'apps'));
    }
  });
  it('gives every studio a name, description, link and an image that exists', () => {
    for (const s of STUDIO_DIRECTORY) {
      expect(s.name, s.id).toBeTruthy();
      expect(s.description, `${s.id} description`).toBeTruthy();
      expect(s.href).toBe(`#/${s.id}`);
      expect(s.image, `${s.id} image`).toBeTruthy();
      expect(onDisk(s.image), `${s.id}: ${s.image}`).toBe(true);
      expect(s.fallback === null || onDisk(s.fallback), `${s.id} fallback`).toBe(true);
    }
  });
  it('uses the guide screenshot for the 36 studios that have one, and the thumbnail for the other two', () => {
    const noGuide = STUDIO_DIRECTORY.filter((s) => !s.slug).map((s) => s.id).sort();
    expect(noGuide).toEqual(['video-pages', 'website-builder']);
    for (const s of STUDIO_DIRECTORY.filter((x) => x.slug)) expect(s.image, s.id).toBe(`/guides/${s.slug}/overview.webp`);
    for (const id of noGuide) expect(getStudio(id).image).toBe(getStudio(id).fallback);
  });
  it('matches the screenshots folder: every slug is a folder with an overview, and every feature image exists', () => {
    const folders = readdirSync(pub('guides')).filter((f) => !f.startsWith('.'));
    expect(folders.sort()).toEqual(guideSlugs().sort());
    for (const slug of guideSlugs()) {
      expect(existsSync(pub(getGuideOverview(slug))), slug).toBe(true);
      for (const p of Object.values(getGuideFeatures(slug))) expect(existsSync(pub(p)), p).toBe(true);
    }
    // every slug in the map is a real guide folder; every guide folder except the Apps hub belongs to a studio
    for (const slug of Object.values(SLUG_BY_ROUTE)) expect(guideSlugs()).toContain(slug);
    const used = new Set(Object.values(SLUG_BY_ROUTE));
    expect(guideSlugs().filter((s) => !used.has(s))).toEqual(['apps']);
  });
});
