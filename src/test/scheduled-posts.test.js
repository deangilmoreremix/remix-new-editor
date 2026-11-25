// Scheduling helpers shared by the social-schedule and social-schedule-worker
// edge functions. Pure functions only; no network or database.

import { describe, test, expect } from 'vitest';
import {
  buildPublishBody,
  classifySubmitFailure,
  constantTimeEqual,
  extractYoutubeVideoId,
  pickPublishFields,
  pollResultState,
  validateCreateRequest,
} from '../../supabase/functions/_shared/scheduledPosts.ts';

const NOW = new Date('2026-11-25T15:00:00Z');
const inMinutes = (m) => new Date(NOW.getTime() + m * 60_000).toISOString();

const valid = (overrides = {}) => ({
  platform: 'youtube',
  account_id: 42,
  media_url: 'https://cdn.example.com/video.mp4',
  run_at: inMinutes(30),
  muapi_api_key: 'mu_test_key',
  payload: { title: 'My video', description: 'd', tags: ['a'], privacy: 'public' },
  ...overrides,
});

describe('validateCreateRequest', () => {
  test('accepts a well-formed request', () => {
    const res = validateCreateRequest(valid(), NOW);
    expect(res.ok).toBe(true);
    expect(res.value.accountId).toBe(42);
    expect(res.value.thumbnailUrl).toBeNull();
  });

  test.each([
    ['unknown platform', { platform: 'myspace' }],
    ['non-integer account', { account_id: 'abc' }],
    ['zero account', { account_id: 0 }],
    ['http media url', { media_url: 'http://cdn.example.com/v.mp4' }],
    ['non-url media', { media_url: 'not a url' }],
    ['bad thumbnail', { thumbnail_url: 'javascript:alert(1)' }],
    ['past run_at', { run_at: inMinutes(-5) }],
    ['run_at under the minimum lead', { run_at: new Date(NOW.getTime() + 30_000).toISOString() }],
    ['run_at too far out', { run_at: inMinutes(60 * 24 * 91) }],
    ['garbage run_at', { run_at: 'tomorrow-ish' }],
    ['missing key', { muapi_api_key: '' }],
    ['youtube without title', { payload: { description: 'x' } }],
  ])('rejects %s', (_label, overrides) => {
    expect(validateCreateRequest(valid(overrides), NOW).ok).toBe(false);
  });

  test('rejects a non-object body', () => {
    expect(validateCreateRequest(null, NOW).ok).toBe(false);
    expect(validateCreateRequest('x', NOW).ok).toBe(false);
  });

  test('keeps an https thumbnail url', () => {
    const res = validateCreateRequest(valid({ thumbnail_url: 'https://cdn.example.com/t.png' }), NOW);
    expect(res.value.thumbnailUrl).toBe('https://cdn.example.com/t.png');
  });
});

describe('pickPublishFields / buildPublishBody', () => {
  test('drops fields that are not valid for the platform', () => {
    const picked = pickPublishFields('tiktok', {
      title: 't',
      privacy_level: 'PUBLIC_TO_EVERYONE',
      account_id: 999,
      media_url: 'https://evil.example/x.mp4',
      webhook: 'https://evil.example/hook',
      caption: 'instagram-only',
    });
    expect(picked).toEqual({ title: 't', privacy_level: 'PUBLIC_TO_EVERYONE' });
  });

  test('the stored account and media always win over the payload', () => {
    const body = buildPublishBody({
      platform: 'instagram',
      account_id: 7,
      media_url: 'https://cdn.example.com/v.mp4',
      payload: { caption: 'hi', cover_url: 'https://cdn.example.com/c.png', account_id: 1, media_url: 'x' },
    });
    expect(body).toEqual({
      caption: 'hi',
      cover_url: 'https://cdn.example.com/c.png',
      account_id: 7,
      media_url: 'https://cdn.example.com/v.mp4',
    });
  });

  test('ignores null payloads', () => {
    expect(pickPublishFields('youtube', null)).toEqual({});
  });
});

describe('classifySubmitFailure', () => {
  test('retries throttling, 5xx and network failures with backoff', () => {
    expect(classifySubmitFailure(429, 1)).toEqual({ kind: 'retry', delaySeconds: 60 });
    expect(classifySubmitFailure(503, 2)).toEqual({ kind: 'retry', delaySeconds: 120 });
    expect(classifySubmitFailure(0, 1)).toEqual({ kind: 'retry', delaySeconds: 60 });
  });

  test('does not retry rejected requests', () => {
    expect(classifySubmitFailure(400, 1)).toEqual({ kind: 'fail' });
    expect(classifySubmitFailure(401, 1)).toEqual({ kind: 'fail' });
    expect(classifySubmitFailure(422, 1)).toEqual({ kind: 'fail' });
  });

  test('gives up after the maximum attempts', () => {
    expect(classifySubmitFailure(503, 3)).toEqual({ kind: 'fail' });
  });
});

describe('pollResultState', () => {
  test.each([
    [{ status: 'completed' }, 'done'],
    [{ status: 'SUCCEEDED' }, 'done'],
    [{ status: 'failed' }, 'failed'],
    [{ status: 'error' }, 'failed'],
    [{ status: 'processing' }, 'pending'],
    [{}, 'pending'],
    [null, 'pending'],
  ])('%j -> %s', (input, expected) => {
    expect(pollResultState(input)).toBe(expected);
  });
});

describe('constantTimeEqual', () => {
  test('compares equal and unequal secrets', () => {
    expect(constantTimeEqual('abc123', 'abc123')).toBe(true);
    expect(constantTimeEqual('abc123', 'abc124')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('extractYoutubeVideoId', () => {
  test.each([
    ['https://youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=short', null],
    ['https://example.com/page', null],
    ['', null],
    [undefined, null],
  ])('%s -> %s', (input, expected) => {
    expect(extractYoutubeVideoId(input)).toBe(expected);
  });
});
