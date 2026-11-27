import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({ configured: true, user: 'u1', token: 'tok', insert: vi.fn(), update: vi.fn() }));
vi.mock('../../supabase.js', () => ({
  supabase: {
    from: () => ({
      insert: (row) => ({ select: () => ({ single: () => db.insert(row) }) }),
      update: (fields) => ({ eq: () => ({ select: () => ({ maybeSingle: () => db.update(fields) }) }) }),
    }),
  },
  primeSupabaseIdentity: vi.fn().mockResolvedValue(undefined),
  getClerkUserId: () => db.user,
  isSupabaseConfigured: () => db.configured,
  getClerkSessionToken: async () => db.token,
}));
import { jobProblem, toJobRow, scheduleJob, cancelJob, retryJob, rescheduleJob, autoPublishStatus, enableAutoPublish, disableAutoPublish, describeResult } from '../publishJobs.js';

const NOW = new Date('2026-11-26T10:00:00Z');
const input = (o = {}) => ({ jobs: [{ platform: 'instagram', account_id: '5', payload: { account_id: 5, media_url: 'https://cdn/a.mp4' } }], mediaUrl: 'https://cdn/a.mp4', mediaType: 'video', caption: 'hi', scheduledFor: new Date('2026-11-26T12:00:00Z'), timeZone: 'America/New_York', ...o });
beforeEach(() => { db.configured = true; db.user = 'u1'; db.token = 'tok'; db.insert.mockReset().mockResolvedValue({ data: { id: 'r1', job_key: 'k1' }, error: null }); db.update.mockReset().mockResolvedValue({ data: { id: 'r1' }, error: null }); localStorage.clear(); });

describe('job validation', () => {
  it('rejects missing accounts, non-public media, invalid and past times', () => {
    expect(jobProblem(input({ jobs: [] }), NOW)).toMatch(/account/);
    expect(jobProblem(input({ mediaUrl: 'blob:x' }), NOW)).toMatch(/https/);
    expect(jobProblem(input({ scheduledFor: new Date('nope') }), NOW)).toMatch(/date/i);
    expect(jobProblem(input({ scheduledFor: new Date('2026-11-26T10:00:30Z') }), NOW)).toMatch(/future/);
    expect(jobProblem(input(), NOW)).toBe('');
  });
});

describe('storing jobs (UTC, cloud only)', () => {
  it('stores UTC time with the display zone, exact payloads, and numeric account ids', () => {
    const row = toJobRow(input());
    expect(row).toMatchObject({ scheduled_for: '2026-11-26T12:00:00.000Z', time_zone: 'America/New_York', auto_publish: true, status: 'scheduled', platforms: ['instagram'] });
    expect(row.jobs[0]).toMatchObject({ account_id: 5, platform: 'instagram' });
  });
  it('saves to the cloud', async () => {
    expect(await scheduleJob(input(), NOW)).toEqual({ id: 'r1', job_key: 'k1' });
    expect(db.insert.mock.calls[0][0].auto_publish).toBe(true);
  });
  it('never falls back to browser storage when signed out or the cloud rejects it', async () => {
    db.user = '';
    await expect(scheduleJob(input(), NOW)).rejects.toThrow(/never stays only in this browser/);
    expect(localStorage.getItem('sv:scheduledPosts')).toBeNull();
    db.user = 'u1';
    db.insert.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(scheduleJob(input(), NOW)).rejects.toThrow(/Nothing was scheduled/);
    expect(localStorage.getItem('sv:scheduledPosts')).toBeNull();
  });
  it('surfaces the "turn on automatic publishing" rule from the database', async () => {
    db.insert.mockResolvedValue({ data: null, error: { message: 'turn on automatic publishing first (no MuAPI key is stored on the server)' } });
    await expect(scheduleJob(input(), NOW)).rejects.toThrow(/turn on automatic publishing first/);
  });
});

describe('cancel / reschedule / retry', () => {
  it('sends only the allowed fields', async () => {
    await cancelJob('r1'); expect(db.update).toHaveBeenLastCalledWith({ status: 'cancelled' });
    await retryJob('r1'); expect(db.update).toHaveBeenLastCalledWith({ status: 'scheduled' });
    await rescheduleJob('r1', new Date('2026-11-27T09:00:00Z'), 'UTC'); expect(db.update).toHaveBeenLastCalledWith({ scheduled_for: '2026-11-27T09:00:00.000Z', time_zone: 'UTC', status: 'scheduled' });
  });
  it('explains a job that is already publishing and a missing one', async () => {
    db.update.mockResolvedValue({ data: null, error: { message: 'a post that is publishing or published cannot be changed' } });
    await expect(cancelJob('r1')).rejects.toThrow(/already being published/);
    db.update.mockResolvedValue({ data: null, error: null });
    await expect(cancelJob('r1')).rejects.toThrow(/not found/);
  });
});

describe('server key endpoint client', () => {
  it('sends the Clerk token and consent, never the key anywhere else', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ enabled: true }) }));
    await enableAutoPublish('muapi-key-0123456789', fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/.netlify/functions/social-publish-key');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ apiKey: 'muapi-key-0123456789', consent: true });
    expect(localStorage.getItem('sv:scheduledPosts')).toBeNull();
    await autoPublishStatus(fetchImpl); await disableAutoPublish(fetchImpl);
    expect(fetchImpl.mock.calls.map((c) => c[1].method)).toEqual(['PUT', 'GET', 'DELETE']);
  });
  it('requires sign-in and reports server errors', async () => {
    db.token = null;
    await expect(autoPublishStatus(vi.fn())).rejects.toThrow(/Sign in/);
    db.token = 'tok';
    await expect(autoPublishStatus(vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: 'not set up' }) })))).rejects.toThrow('not set up');
  });
});

describe('history text', () => {
  it('describes each destination outcome', () => {
    expect(describeResult({ status: 'published', url: 'https://x/p/1' })).toContain('https://x/p/1');
    expect(describeResult({ status: 'failed', error: 'nope' })).toBe('nope');
    expect(describeResult({ status: 'processing' })).toBe('Publishing…');
  });
});
