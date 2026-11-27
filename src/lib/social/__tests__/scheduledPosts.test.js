import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({ configured: false, user: '', insert: vi.fn() }));
vi.mock('../../supabase.js', () => ({
  supabase: { from: () => ({ insert: db.insert }) },
  primeSupabaseIdentity: vi.fn().mockResolvedValue(undefined),
  getClerkUserId: () => db.user,
  isSupabaseConfigured: () => db.configured,
}));
import { whenFor, postProblem, savePost, listLocalPosts } from '../scheduledPosts.js';

const NOW = new Date('2026-11-25T10:00:00');
const post = (over = {}) => ({ mediaUrl: 'https://cdn.test/a.png', mediaType: 'image', studio: 'image', platforms: ['instagram'], caption: 'Hi', hashtags: ['a'], status: 'scheduled', scheduledFor: new Date('2026-11-26T09:00:00'), ...over });
beforeEach(() => { localStorage.clear(); db.configured = false; db.user = ''; db.insert.mockReset().mockResolvedValue({ error: null }); });

describe('when', () => {
  it('turns each choice into a time', () => {
    expect(whenFor('1h', {}, NOW).getTime()).toBe(NOW.getTime() + 3600000);
    const t = whenFor('tomorrow', {}, NOW);
    expect([t.getDate(), t.getHours(), t.getMinutes()]).toEqual([26, 9, 0]);
    expect(whenFor('custom', { date: '2026-12-01', time: '14:30' }, NOW).getHours()).toBe(14);
    expect(whenFor('custom', { date: '' }, NOW)).toBeNull();
    expect(whenFor('nope', {}, NOW)).toBeNull();
  });
});

describe('what is wrong with a post', () => {
  it('names the first problem, and accepts a good post and a draft with no time', () => {
    expect(postProblem(post(), NOW)).toBe('');
    expect(postProblem(post({ status: 'draft', scheduledFor: null }), NOW)).toBe('');
    expect(postProblem(post({ mediaUrl: 'blob:x' }), NOW)).toMatch(/shareable link/);
    expect(postProblem(post({ platforms: [] }), NOW)).toMatch(/platform/);
    expect(postProblem(post({ caption: '  ' }), NOW)).toMatch(/caption/);
    expect(postProblem(post({ scheduledFor: null }), NOW)).toMatch(/date and time/);
    expect(postProblem(post({ scheduledFor: new Date('2026-11-24T09:00:00') }), NOW)).toMatch(/future/);
  });
});

describe('saving', () => {
  it('refuses an invalid post', async () => {
    await expect(savePost(post({ caption: '' }), NOW)).rejects.toThrow(/caption/);
  });
  it('keeps it in this browser when signed out', async () => {
    expect(await savePost(post(), NOW)).toEqual({ saved: 'browser' });
    expect(db.insert).not.toHaveBeenCalled();
    expect(listLocalPosts()).toHaveLength(1);
    expect(listLocalPosts()[0]).toMatchObject({ platforms: ['instagram'], status: 'scheduled' });
  });
  it('saves to the account when signed in, as the table expects it', async () => {
    db.configured = true; db.user = 'user_1';
    expect(await savePost(post(), NOW)).toEqual({ saved: 'cloud' });
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ media_url: 'https://cdn.test/a.png', media_type: 'image', platforms: ['instagram'], caption: 'Hi', hashtags: ['a'], status: 'scheduled', scheduled_for: expect.stringMatching(/Z$/) }));
    expect(listLocalPosts()).toHaveLength(0);
  });
  it('falls back to the browser when the table is missing or fails', async () => {
    db.configured = true; db.user = 'user_1';
    db.insert.mockResolvedValue({ error: { code: '42P01' } });
    expect(await savePost(post(), NOW)).toEqual({ saved: 'browser' });
    expect(listLocalPosts()).toHaveLength(1);
  });
  it('a draft has no time', async () => {
    db.configured = true; db.user = 'user_1';
    await savePost(post({ status: 'draft', scheduledFor: null }), NOW);
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', scheduled_for: null }));
  });
});
