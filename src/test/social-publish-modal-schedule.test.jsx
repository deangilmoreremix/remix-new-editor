// Render test for the live Social Publish modal's scheduling and thumbnail
// behaviour (components/modals/SocialPublishModal.jsx).
//
// The build silently stubs unresolved imports from components/, so a broken
// import or handler in this modal would not fail the build; this test does.

import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
  createScheduledPost: vi.fn(),
  publishAndPoll: vi.fn(),
  setYoutubeThumbnail: vi.fn(),
  thumbModal: { instance: null },
  accounts: [{ id: 42, platform_name: 'youtube', account_name: 'My Channel' }],
}));

vi.mock('../lib/supabase.js', () => ({
  supabase: {},
  primeSupabaseIdentity: vi.fn(),
  getClerkSessionToken: vi.fn(),
  getSupabaseAnonKey: vi.fn(),
  getSupabaseUrl: vi.fn(),
}));
vi.mock('../lib/apiKeyManager.js', () => ({ apiKeyManager: { getMuapiKey: vi.fn(() => 'mu_key') } }));

vi.mock('../../lib/socialPublishing', () => ({
  default: {
    listAccounts: vi.fn(async () => h.accounts),
    publishAndPoll: h.publishAndPoll,
    setYoutubeThumbnail: h.setYoutubeThumbnail,
  },
  SOCIAL_PLATFORMS: [
    { id: 'youtube', label: 'YouTube', mediaKinds: ['video'], color: '#f00', note: '' },
    { id: 'tiktok', label: 'TikTok', mediaKinds: ['video'], color: '#0ff', note: '' },
    { id: 'instagram', label: 'Instagram', mediaKinds: ['image', 'video'], color: '#e13', note: '' },
  ],
  YOUTUBE_CATEGORIES: [{ id: '22', label: 'People & Blogs' }],
  getExternalUserId: () => 'user_1',
  extractYoutubeVideoId: (u) => (typeof u === 'string' && u.includes('v=') ? u.split('v=')[1] : null),
}));

vi.mock('../../lib/socialSchedule', async () => {
  const real = await import('../lib/socialSchedule.js');
  return { ...real, createScheduledPost: h.createScheduledPost };
});
vi.mock('../../lib/socialPostEnhancer', () => ({ enhanceSocialPostText: vi.fn(), TONALITIES: [] }));
vi.mock('../../lib/config/openaiConfig.js', () => ({ default: { getResponsesModel: () => 'gpt-test' } }));
vi.mock('../../lib/socialPublisherThumbnail', () => ({ seedThumbnailFieldsFromSocialCopy: () => ({}) }));

vi.mock('../../src/components/modals/TemplateThumbnailModal', () => ({
  default: class FakeThumbnailModal {
    constructor(opts) { this.opts = opts; h.thumbModal.instance = this; }
    open() {}
  },
  mountThumbnailModal: () => {},
}));

import SocialPublishModal from '../../components/modals/SocialPublishModal.jsx';

const baseOptions = {
  mediaUrl: 'https://cdn.example.com/video.mp4',
  mediaType: 'video',
  title: 'My video',
  description: 'About it',
};

async function openPlatformStepAndSelectAccount() {
  fireEvent.click(await screen.findByRole('tab', { name: /platform/i }));
  const radio = await screen.findByRole('radio', { name: '' }, { timeout: 3000 }).catch(() => null);
  const account = radio || (await screen.findAllByRole('radio')).find((r) => r.getAttribute('name') === 'account');
  fireEvent.click(account);
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  h.createScheduledPost.mockResolvedValue({ id: 'post-1' });
  h.thumbModal.instance = null;
  h.accounts = [{ id: 42, platform_name: 'youtube', account_name: 'My Channel' }];
});

describe('SocialPublishModal scheduling', () => {
  test('defaults to publishing now and opens on a preset in schedule mode', async () => {
    const { unmount } = render(<SocialPublishModal options={baseOptions} handleClose={() => {}} />);
    expect(await screen.findByRole('button', { name: /publish \(/i })).toBeTruthy();
    unmount();

    render(<SocialPublishModal options={{ ...baseOptions, mode: 'schedule' }} handleClose={() => {}} />);
    expect(await screen.findByRole('button', { name: /schedule \(/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'In 1 hour' }).getAttribute('aria-checked')).toBe('true');
  });

  test('schedules the post with the stored fields instead of publishing', async () => {
    const onScheduled = vi.fn();
    render(
      <SocialPublishModal
        options={{ ...baseOptions, mode: 'schedule', onScheduled }}
        handleClose={() => {}}
      />,
    );
    await openPlatformStepAndSelectAccount();

    const before = Date.now();
    fireEvent.click(await screen.findByRole('button', { name: /schedule \(/i }));

    await waitFor(() => expect(h.createScheduledPost).toHaveBeenCalledTimes(1));
    const arg = h.createScheduledPost.mock.calls[0][0];
    expect(arg.platform).toBe('youtube');
    expect(arg.accountId).toBe(42);
    expect(arg.mediaUrl).toBe(baseOptions.mediaUrl);
    expect(arg.runAt.getTime()).toBeGreaterThanOrEqual(before + 59 * 60 * 1000);
    // account_id / media_url travel as top-level fields, not inside payload
    expect(arg.payload.account_id).toBeUndefined();
    expect(arg.payload.media_url).toBeUndefined();
    expect(arg.payload.title).toBe('My video');
    expect(h.publishAndPoll).not.toHaveBeenCalled();

    expect(await screen.findByText(/scheduled for/i)).toBeTruthy();
    expect(onScheduled).toHaveBeenCalledWith(expect.objectContaining({ platform: 'youtube' }));
  });

  test('a custom time with nothing entered is rejected before calling the server', async () => {
    render(<SocialPublishModal options={{ ...baseOptions, mode: 'schedule' }} handleClose={() => {}} />);
    await openPlatformStepAndSelectAccount();
    fireEvent.click(screen.getByRole('radio', { name: 'Pick date & time' }));
    fireEvent.click(await screen.findByRole('button', { name: /schedule \(/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(h.createScheduledPost).not.toHaveBeenCalled();
  });

  test('surfaces a server error instead of claiming success', async () => {
    h.createScheduledPost.mockRejectedValue(new Error('You can have at most 100 pending scheduled posts.'));
    render(<SocialPublishModal options={{ ...baseOptions, mode: 'schedule' }} handleClose={() => {}} />);
    await openPlatformStepAndSelectAccount();
    fireEvent.click(await screen.findByRole('button', { name: /schedule \(/i }));
    expect(await screen.findByText(/at most 100 pending/i)).toBeTruthy();
    expect(screen.queryByText(/scheduled for/i)).toBeNull();
  });
});

describe('SocialPublishModal thumbnail on publish', () => {
  const THUMB = 'https://cdn.example.com/thumb.png';

  async function chooseThumbnail() {
    fireEvent.click(await screen.findByRole('tab', { name: /thumbnail/i }));
    fireEvent.click(await screen.findByRole('button', { name: /create thumbnail/i }));
    await waitFor(() => expect(h.thumbModal.instance).toBeTruthy());
    h.thumbModal.instance.opts.onApply({ imageUrl: THUMB, revisedPrompt: 'p' });
  }

  async function publish() {
    fireEvent.click(await screen.findByRole('button', { name: /publish \(/i }));
  }

  test('YouTube: applies the chosen thumbnail once the video is live', async () => {
    h.publishAndPoll.mockResolvedValue({ output: { platform: 'youtube', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' } });
    h.setYoutubeThumbnail.mockResolvedValue({});
    render(<SocialPublishModal options={baseOptions} handleClose={() => {}} />);
    await openPlatformStepAndSelectAccount();
    await chooseThumbnail();
    await publish();

    await waitFor(() => expect(h.setYoutubeThumbnail).toHaveBeenCalledTimes(1));
    expect(h.setYoutubeThumbnail.mock.calls[0][0]).toEqual({ accountId: 42, videoId: 'dQw4w9WgXcQ', thumbnailUrl: THUMB });
    expect(await screen.findByText(/published!/i)).toBeTruthy();
    expect(screen.queryByText(/thumbnail was not applied|could not be applied/i)).toBeNull();
  });

  test('YouTube: a thumbnail failure is a warning, the post still counts as published', async () => {
    h.publishAndPoll.mockResolvedValue({ output: { platform: 'youtube', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' } });
    h.setYoutubeThumbnail.mockRejectedValue(new Error('too large'));
    render(<SocialPublishModal options={baseOptions} handleClose={() => {}} />);
    await openPlatformStepAndSelectAccount();
    await chooseThumbnail();
    await publish();

    expect(await screen.findByText(/published!/i)).toBeTruthy();
    expect(await screen.findByText(/video is live, but the thumbnail was not applied \(too large\)/i)).toBeTruthy();
  });

  test('YouTube: no thumbnail chosen means no thumbnail call', async () => {
    h.publishAndPoll.mockResolvedValue({ output: { platform: 'youtube', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' } });
    render(<SocialPublishModal options={baseOptions} handleClose={() => {}} />);
    await openPlatformStepAndSelectAccount();
    await publish();
    expect(await screen.findByText(/published!/i)).toBeTruthy();
    expect(h.setYoutubeThumbnail).not.toHaveBeenCalled();
  });

  test('Instagram: the AI thumbnail is sent as the Reel cover', async () => {
    h.accounts = [{ id: 7, platform_name: 'instagram', account_name: 'ig' }];
    h.publishAndPoll.mockResolvedValue({ platform: 'instagram', media_id: 'm1' });
    render(<SocialPublishModal options={baseOptions} handleClose={() => {}} />);
    await openPlatformStepAndSelectAccount();
    await chooseThumbnail();
    await publish();

    await waitFor(() => expect(h.publishAndPoll).toHaveBeenCalledTimes(1));
    const [platform, payload] = h.publishAndPoll.mock.calls[0];
    expect(platform).toBe('instagram');
    expect(payload.cover_url).toBe(THUMB);
  });

  test('Instagram: a cover URL typed by the user wins over the AI thumbnail', async () => {
    h.accounts = [{ id: 7, platform_name: 'instagram', account_name: 'ig' }];
    h.publishAndPoll.mockResolvedValue({ platform: 'instagram', media_id: 'm1' });
    render(<SocialPublishModal options={baseOptions} handleClose={() => {}} />);
    await openPlatformStepAndSelectAccount();
    await chooseThumbnail();
    fireEvent.click(await screen.findByRole('tab', { name: /copy/i }));
    fireEvent.change(await screen.findByPlaceholderText(/cover image url/i), { target: { value: 'https://cdn.example.com/mine.jpg' } });
    await publish();

    await waitFor(() => expect(h.publishAndPoll).toHaveBeenCalledTimes(1));
    expect(h.publishAndPoll.mock.calls[0][1].cover_url).toBe('https://cdn.example.com/mine.jpg');
  });
});
