// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  cleanAppOnboarding, blankAppOnboarding, toAppRow, fromAppRow, newerAppOnboarding, shouldPromptOnboarding,
  saveLocalAppOnboarding, loadLocalAppOnboarding, seedOutreach, isAppDone, isAppSkipped,
} from '../store.js';
import { loadLocalOnboarding } from '../../outreach/onboarding.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };

describe('app onboarding answers', () => {
  it('keeps only known answers and caps the rest', () => {
    const c = cleanAppOnboarding({ step: 99, goal: 'nope', team: '2-5', volume: 'x', company: `  Acme   Inc ${'x'.repeat(200)}`, videoTypes: ['talking', 'bogus', 'talking'], tools: ['video', 'zzz', 'avatar'], primaryTool: 'avatar' });
    expect(c.step).toBe(6);
    expect(c.goal).toBe('');
    expect(c.team).toBe('2-5');
    expect(c.volume).toBe('');
    expect(c.company.length).toBe(120);
    expect(c.videoTypes).toEqual(['talking']);
    expect(c.tools).toEqual(['video', 'avatar']);
    expect(c.primaryTool).toBe('avatar');
  });
  it('primary tool defaults to the first selected and must be a selected tool', () => {
    expect(cleanAppOnboarding({ tools: ['edit', 'image'], primaryTool: 'video' }).primaryTool).toBe('edit');
    expect(cleanAppOnboarding({}).primaryTool).toBe('');
  });
  it('round-trips through the Supabase row', () => {
    const a = cleanAppOnboarding({ step: 6, goal: 'ai-video', team: 'solo', volume: 'few', company: 'Acme', website: 'https://www.acme.com', jobTitle: 'AE', heard: 'other', heardOther: 'a friend', videoTypes: ['cinematic'], tools: ['cinema'], completedAt: '2026-11-19T10:00:00Z' });
    const row = toAppRow(a);
    expect(row.website).toBe('acme.com');
    expect(row.tools).toEqual(['cinema']);
    expect(fromAppRow(row)).toMatchObject({ goal: 'ai-video', team: 'solo', company: 'Acme', website: 'acme.com', heard: 'other', heardOther: 'a friend', tools: ['cinema'], primaryTool: 'cinema' });
    expect(isAppDone(fromAppRow(row))).toBe(true);
  });
  it('finished beats skipped beats in progress, then the further step wins', () => {
    const prog = cleanAppOnboarding({ step: 3 });
    const further = cleanAppOnboarding({ step: 5 });
    const skipped = cleanAppOnboarding({ step: 1, skippedAt: '2026-11-19T10:00:00Z' });
    const done = cleanAppOnboarding({ step: 6, completedAt: '2026-11-19T10:00:00Z' });
    expect(newerAppOnboarding(prog, further)).toBe(further);
    expect(newerAppOnboarding(prog, skipped)).toBe(skipped);
    expect(newerAppOnboarding(skipped, done)).toBe(done);
    expect(newerAppOnboarding(null, prog)).toBe(prog);
    expect(isAppSkipped(skipped)).toBe(true);
  });
  it('prompts only people who neither finished nor skipped', () => {
    expect(shouldPromptOnboarding(null)).toBe(true);
    expect(shouldPromptOnboarding(blankAppOnboarding())).toBe(true);
    expect(shouldPromptOnboarding(cleanAppOnboarding({ completedAt: '2026-11-19T10:00:00Z' }))).toBe(false);
    expect(shouldPromptOnboarding(cleanAppOnboarding({ skippedAt: '2026-11-19T10:00:00Z' }))).toBe(false);
  });
  it('keeps one browser copy per user', () => {
    const s = mem();
    saveLocalAppOnboarding('u1', { goal: 'personal', step: 2 }, s);
    expect(loadLocalAppOnboarding('u1', s).goal).toBe('personal');
    expect(loadLocalAppOnboarding('u2', s)).toBeNull();
  });
});

describe('pre-filling the Video Outreach welcome', () => {
  it('fills empty answers, never overwrites, and leaves the welcome unfinished', () => {
    const s = mem();
    const app = cleanAppOnboarding({ team: '2-5', volume: '100+', company: 'Acme', website: 'acme.com', jobTitle: 'AE', heard: 'google', completedAt: '2026-11-19T10:00:00Z' });
    seedOutreach('u1', app, s);
    let o = loadLocalOnboarding('u1', s);
    expect(o).toMatchObject({ team: '2-5', volume: '100+', company: 'Acme', website: 'acme.com', jobTitle: 'AE', heard: 'google', completedAt: null, step: 1 });
    // Outreach's own answer wins on a later seed.
    seedOutreach('u1', { ...app, company: 'Other' }, s);
    o = loadLocalOnboarding('u1', s);
    expect(o.company).toBe('Acme');
  });
});
