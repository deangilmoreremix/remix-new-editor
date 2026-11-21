// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../../muapi.js', () => ({ muapi: {} }));

const { NAV_GROUPS } = await import('../../studioRoutes.js');
const { directoryByGroup } = await import('../../studioDirectory.js');
const { buildToolGroups, PURPOSE_GROUPS, toolIds, VIDEO_TYPES, GOAL_CARDS, GOAL_TO_TYPES, orderedVideoTypes, recommendedTools } = await import('../toolCatalog.js');

const onDisk = (p) => existsSync(join(process.cwd(), 'public', p)) || existsSync(join(process.cwd(), 'public', `${p}.png`));

describe('onboarding tool catalog', () => {
  it('lists all 38 studios in the landing page six purpose groups, each studio exactly once', () => {
    const cat = buildToolGroups();
    expect(cat.map((g) => g.title)).toEqual(['Create', 'Enhance', 'Produce', 'Localize', 'Automate', 'Scale']);
    expect(cat.map((g) => g.items.length)).toEqual([9, 4, 8, 2, 5, 10]);
    for (const g of cat) { expect(g.blurb, g.title).toBeTruthy(); for (const t of g.items) expect(t.group).toBe(g.title); }
    expect(toolIds()).toHaveLength(38);
    expect(new Set(toolIds()).size).toBe(38);
    // the same 38 studios as the studio directory (nothing missing, nothing extra), whatever the grouping
    expect([...toolIds()].sort()).toEqual(directoryByGroup().flatMap((g) => g.items.map((i) => i.id)).sort());
    // every group id exists in the directory (no silently dropped entries)
    expect(PURPOSE_GROUPS.flatMap((g) => g.ids)).toHaveLength(38);
    // every side-menu studio (all but the Apps hub) is in the picker, plus the 7 that are not in the side menu
    for (const id of NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)).filter((id) => id !== 'apps')) expect(toolIds()).toContain(id);
    for (const id of ['influencer', 'motion-director', 'leadfinder', 'outreach', 'recorder', 'find-my-brand', 'render']) expect(toolIds()).toContain(id);
  });
  it('the group names match the landing page category tabs', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(join(process.cwd(), 'src/components/landing/sections/AppsGridSection.jsx'), 'utf8');
    const list = /const categories = \[([^\]]+)\]/.exec(src)[1];
    const tabs = list.match(/'([^']+)'/g).map((x) => x.slice(1, -1)).filter((x) => x !== 'All');
    expect(buildToolGroups().map((g) => g.title)).toEqual(tabs);
  });
  it('gives every studio a link to it (#/<id>)', () => {
    for (const t of buildToolGroups().flatMap((g) => g.items)) expect(t.href, t.id).toBe(`#/${t.id}`);
  });
  it('gives every tool a name, a description and a thumbnail that exists on disk', () => {
    for (const t of buildToolGroups().flatMap((g) => g.items)) {
      expect(t.name, t.id).toBeTruthy();
      expect(t.description, `${t.id} description`).toBeTruthy();
      expect(t.thumb, `${t.id} thumbnail`).toBeTruthy();
      expect(onDisk(t.thumb), `${t.id}: ${t.thumb}`).toBe(true);
    }
  });
  it('gives every studio its own picture (no two cards share one)', () => {
    const thumbs = buildToolGroups().flatMap((g) => g.items).map((t) => t.thumb);
    const dupes = [...new Set(thumbs.filter((t, i) => thumbs.indexOf(t) !== i))];
    expect(dupes, `shared pictures: ${dupes.join(', ')}`).toEqual([]);
  });
  it('only recommends tools that are in the menu, and every goal maps to known video types', () => {
    const ids = new Set(toolIds());
    for (const v of VIDEO_TYPES) for (const id of v.tools) expect(ids.has(id), `${v.id} -> ${id}`).toBe(true);
    const types = new Set(VIDEO_TYPES.map((v) => v.id));
    for (const g of GOAL_CARDS) for (const t of GOAL_TO_TYPES[g.id] || []) expect(types.has(t)).toBe(true);
    expect(Object.keys(GOAL_TO_TYPES).sort()).toEqual(GOAL_CARDS.map((g) => g.id).sort());
  });
  it('orders video types by goal and recommends tools without repeats', () => {
    expect(orderedVideoTypes('personal')[0].id).toBe('outreach');
    expect(orderedVideoTypes('explore')).toHaveLength(VIDEO_TYPES.length);
    const rec = recommendedTools(['text-to-video', 'effects']);
    expect(rec[0]).toBe('video');
    expect(new Set(rec).size).toBe(rec.length);
  });
});
