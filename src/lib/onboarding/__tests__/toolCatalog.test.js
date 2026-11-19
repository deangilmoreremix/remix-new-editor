// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../../muapi.js', () => ({ muapi: {} }));

const { NAV_GROUPS } = await import('../../studioRoutes.js');
const { directoryByGroup } = await import('../../studioDirectory.js');
const { buildToolGroups, toolIds, VIDEO_TYPES, GOAL_CARDS, GOAL_TO_TYPES, orderedVideoTypes, recommendedTools } = await import('../toolCatalog.js');

const onDisk = (p) => existsSync(join(process.cwd(), 'public', p)) || existsSync(join(process.cwd(), 'public', `${p}.png`));

describe('onboarding tool catalog', () => {
  it('lists all 38 studios, grouped Discover / Image / Video / Agents / My Work, the same as the studio directory', () => {
    const cat = buildToolGroups();
    expect(cat.map((g) => [g.title, g.items.length])).toEqual([['Discover', 3], ['Image', 7], ['Video', 11], ['Agents', 15], ['My Work', 2]]);
    expect(toolIds()).toHaveLength(38);
    expect(new Set(toolIds()).size).toBe(38);
    expect(cat.map((g) => [g.title, g.items.map((i) => i.id)])).toEqual(directoryByGroup().map((g) => [g.title, g.items.map((i) => i.id)]));
    // every side-menu studio (all but the Apps hub) is in the picker, plus the 7 that are not in the side menu
    for (const id of NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)).filter((id) => id !== 'apps')) expect(toolIds()).toContain(id);
    for (const id of ['influencer', 'motion-director', 'leadfinder', 'outreach', 'recorder', 'find-my-brand', 'render']) expect(toolIds()).toContain(id);
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
