// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../../muapi.js', () => ({ muapi: {} }));

const { NAV_GROUPS } = await import('../../studioRoutes.js');
const { buildToolGroups, toolIds, VIDEO_TYPES, GOAL_CARDS, GOAL_TO_TYPES, orderedVideoTypes, recommendedTools } = await import('../toolCatalog.js');

const onDisk = (p) => existsSync(join(process.cwd(), 'public', p)) || existsSync(join(process.cwd(), 'public', `${p}.png`));

describe('onboarding tool catalog', () => {
  it('lists every side-menu tool, in the same groups and order (Home is navigation, not a tool)', () => {
    const menu = NAV_GROUPS.filter((g) => g.title).map((g) => [g.title, g.items.map((i) => i.id)]);
    const cat = buildToolGroups().map((g) => [g.title, g.items.map((i) => i.id)]);
    expect(cat).toEqual(menu);
    expect(buildToolGroups().map((g) => g.title)).toEqual(['Image', 'Video', 'Agents', 'My Work']);
  });
  it('gives every tool a name, a description and a thumbnail that exists on disk', () => {
    for (const t of buildToolGroups().flatMap((g) => g.items)) {
      expect(t.name, t.id).toBeTruthy();
      expect(t.description, `${t.id} description`).toBeTruthy();
      expect(t.thumb, `${t.id} thumbnail`).toBeTruthy();
      expect(onDisk(t.thumb), `${t.id}: ${t.thumb}`).toBe(true);
    }
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
