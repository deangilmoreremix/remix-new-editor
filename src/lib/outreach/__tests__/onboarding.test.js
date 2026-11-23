import { describe, it, expect, vi } from 'vitest';
import {
  blankOnboarding, cleanOnboarding, normalizeWebsite, workReady, loadLocalOnboarding, saveLocalOnboarding,
  toRow, fromRow, fetchOnboarding, saveOnboarding, newerOnboarding, applyToDraft, isDone,
} from '../onboarding.js';

const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };

describe('SmartVideo welcome answers', () => {
  it('keeps only known answers, trimmed and capped', () => {
    const c = cleanOnboarding({ step: 9, goal: 'dynamic', team: 'huge', volume: '100+', company: '  Acme   Inc ', heard: 'other', heardOther: 'x'.repeat(500), completedAt: 'nope' });
    expect(c).toMatchObject({ step: 5, goal: 'dynamic', team: '', volume: '100+', company: 'Acme Inc', heard: 'other', completedAt: null });
    expect(c.heardOther).toHaveLength(120);
    expect(cleanOnboarding(null)).toEqual(blankOnboarding());
  });
  it('website must be a web address', () => {
    expect(normalizeWebsite('https://www.Acme.com/')).toBe('acme.com');
    expect(normalizeWebsite('acme')).toBe('');
    expect(workReady({ company: 'Acme', website: 'acme.com', jobTitle: 'AE' })).toBe(true);
    expect(workReady({ company: 'Acme', website: 'acme', jobTitle: 'AE' })).toBe(false);
  });
  it('is kept in the browser per signed-in user', () => {
    const s = mem();
    saveLocalOnboarding('user_a', { step: 3, goal: 'personal' }, s);
    expect(loadLocalOnboarding('user_a', s)).toMatchObject({ step: 3, goal: 'personal' });
    expect(loadLocalOnboarding('user_b', s)).toBeNull();
  });
  it('maps to and from the user_onboarding row', () => {
    const a = cleanOnboarding({ step: 5, goal: 'dynamic', team: '2-5', volume: 'few', company: 'Acme', website: 'https://acme.com', jobTitle: 'AE', heard: 'linkedin', completedAt: '2026-11-16T10:00:00.000Z' });
    const row = toRow(a);
    expect(row).toMatchObject({ goal: 'dynamic', team_size: '2-5', videos_per_month: 'few', website: 'acme.com', job_title: 'AE', heard_from: 'linkedin', heard_other: null, step: 5 });
    expect(fromRow(row)).toEqual({ ...a, website: 'acme.com' });
  });
  it('saves with an upsert for the user and reads it back; a missing table is not an error', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const maybeSingle = vi.fn(async () => ({ data: { step: 2, goal: 'personal' }, error: null }));
    const client = { from: vi.fn(() => ({ upsert, select: () => ({ maybeSingle }) })) };
    expect(await saveOnboarding(client, { goal: 'personal' }, 'user_a')).toBe(true);
    expect(upsert.mock.calls[0][0]).toMatchObject({ clerk_user_id: 'user_a', goal: 'personal' });
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: 'clerk_user_id' });
    expect(await fetchOnboarding(client)).toMatchObject({ step: 2, goal: 'personal' });
    const missing = { from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: { code: '42P01' } }) }) }) };
    expect(await fetchOnboarding(missing)).toBeNull();
    expect(await saveOnboarding(client, {}, '')).toBe(false);
  });
  it('the finished copy wins, else the one further along', () => {
    const done = { step: 5, completedAt: '2026-11-16T10:00:00.000Z' };
    expect(isDone(newerOnboarding({ step: 2 }, done))).toBe(true);
    expect(newerOnboarding({ step: 4 }, { step: 2 }).step).toBe(4);
    expect(newerOnboarding(null, null)).toBeNull();
  });
  it('fills empty Video Outreach fields only', () => {
    const d = { sender: { company: '', title: 'Founder' }, background: { mode: 'recording', fallbackSite: '' } };
    applyToDraft(d, { company: 'Acme', jobTitle: 'AE', website: 'https://acme.com' });
    expect(d.sender).toMatchObject({ company: 'Acme', title: 'Founder' });
    expect(d.background.fallbackSite).toBe('acme.com');
  });
});
