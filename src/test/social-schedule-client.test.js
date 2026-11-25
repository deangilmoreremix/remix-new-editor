// Client-side scheduling helpers and the YouTube video-id parser used by the
// Social Publish modal.

import { describe, test, expect, vi } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  supabase: {},
  primeSupabaseIdentity: vi.fn(),
  getClerkSessionToken: vi.fn(),
  getSupabaseAnonKey: vi.fn(),
  getSupabaseUrl: vi.fn(),
}));
vi.mock('../lib/apiKeyManager.js', () => ({ apiKeyManager: { getMuapiKey: vi.fn() } }));

const { resolveScheduleTime, validateScheduleTime, SCHEDULE_PRESETS } = await import('../lib/socialSchedule.js');
const { extractYoutubeVideoId } = await import('../lib/socialPublishing.js');

const NOW = new Date(2026, 10, 25, 10, 30, 0); // local time: 25 Nov 2026 10:30

describe('resolveScheduleTime', () => {
  test('now means publish immediately (no date)', () => {
    expect(resolveScheduleTime('now', '', NOW)).toBeNull();
  });

  test('relative presets', () => {
    expect(resolveScheduleTime('1h', '', NOW).getTime()).toBe(NOW.getTime() + 3_600_000);
    expect(resolveScheduleTime('3h', '', NOW).getTime()).toBe(NOW.getTime() + 3 * 3_600_000);
  });

  test('tomorrow is 9 AM local the next day, even at month end', () => {
    const d = resolveScheduleTime('tomorrow', '', NOW);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 26, 9, 0]);
    const eom = resolveScheduleTime('tomorrow', '', new Date(2026, 10, 30, 22, 0));
    expect([eom.getMonth(), eom.getDate()]).toEqual([11, 1]);
  });

  test('custom parses a datetime-local value in local time', () => {
    const d = resolveScheduleTime('custom', '2026-12-01T14:15', NOW);
    expect([d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([11, 1, 14, 15]);
  });

  test('custom with nothing or garbage is null', () => {
    expect(resolveScheduleTime('custom', '', NOW)).toBeNull();
    expect(resolveScheduleTime('custom', 'soon', NOW)).toBeNull();
  });

  test('every preset has an id and label', () => {
    expect(SCHEDULE_PRESETS.map((p) => p.id)).toEqual(['now', '1h', '3h', 'tomorrow', 'custom']);
    SCHEDULE_PRESETS.forEach((p) => expect(p.label).toBeTruthy());
  });
});

describe('validateScheduleTime', () => {
  test('accepts a time a few hours out', () => {
    expect(validateScheduleTime(new Date(NOW.getTime() + 3 * 3_600_000), NOW)).toBeNull();
  });
  test('rejects missing, past, under-a-minute and beyond-90-days times', () => {
    expect(validateScheduleTime(null, NOW)).toMatch(/date and time/i);
    expect(validateScheduleTime(new Date(NOW.getTime() - 1000), NOW)).toMatch(/minute/i);
    expect(validateScheduleTime(new Date(NOW.getTime() + 30_000), NOW)).toMatch(/minute/i);
    expect(validateScheduleTime(new Date(NOW.getTime() + 91 * 86_400_000), NOW)).toMatch(/90 days/);
  });
});

describe('extractYoutubeVideoId (client)', () => {
  test.each([
    ['https://youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=short', null],
    ['', null],
    [null, null],
  ])('%s -> %s', (input, expected) => {
    expect(extractYoutubeVideoId(input)).toBe(expected);
  });
});
