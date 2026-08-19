import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock muapi.proxyJson at the module level so no network calls are made.
// The factory is hoisted by vitest, so we define the mock function inside it
// and re-export it to capture the reference for assertions.
vi.mock('../lib/muapi.js', () => {
  const proxyJson = vi.fn();
  return {
    muapi: { proxyJson },
    __mockProxyJson: proxyJson,
  };
});

import { __mockProxyJson as mockProxyJson } from '../lib/muapi.js';
import socialPublishing, {
  SOCIAL_PLATFORMS,
  YOUTUBE_CATEGORIES,
  setExternalUserId,
  getExternalUserId,
} from '../lib/socialPublishing.js';

describe('socialPublishing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setExternalUserId(null);
    delete window.__muapiExternalUserId;
    localStorage.getItem.mockClear();
    localStorage.setItem.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('exports', () => {
    test('exports SOCIAL_PLATFORMS array with expected platforms', () => {
      expect(Array.isArray(SOCIAL_PLATFORMS)).toBe(true);
      expect(SOCIAL_PLATFORMS.map(p => p.id)).toEqual(
        expect.arrayContaining(['youtube', 'tiktok', 'instagram'])
      );
    });

    test('exports YOUTUBE_CATEGORIES array', () => {
      expect(Array.isArray(YOUTUBE_CATEGORIES)).toBe(true);
      expect(YOUTUBE_CATEGORIES.length).toBeGreaterThan(0);
    });
  });

  describe('getExternalUserId', () => {
    test('override parameter wins over everything', () => {
      expect(getExternalUserId('override_user')).toBe('override_user');
    });

    test('module variable set via setExternalUserId', () => {
      setExternalUserId('module_user');
      expect(getExternalUserId()).toBe('module_user');
    });

    test('window.__muapiExternalUserId when no module var', () => {
      setExternalUserId(null);
      window.__muapiExternalUserId = 'window_user';
      expect(getExternalUserId()).toBe('window_user');
    });

    test('localStorage value when no window prop and no module var', () => {
      setExternalUserId(null);
      delete window.__muapiExternalUserId;
      localStorage.getItem.mockReturnValue('stored_user');
      expect(getExternalUserId()).toBe('stored_user');
      expect(localStorage.getItem).toHaveBeenCalledWith('social_publishing_uid');
    });

    test('generates and stores anon id when localStorage is empty', () => {
      setExternalUserId(null);
      delete window.__muapiExternalUserId;
      localStorage.getItem.mockReturnValue(null);
      const result = getExternalUserId();
      expect(result).toMatch(/^anon_/);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'social_publishing_uid',
        result
      );
    });

    test('falls back to default_user when localStorage is unavailable', () => {
      setExternalUserId(null);
      delete window.__muapiExternalUserId;
      localStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage disabled');
      });
      expect(getExternalUserId()).toBe('default_user');
    });
  });

  describe('getConnectUrl', () => {
    test('calls muapi.proxyJson with correct endpoint, params, and generationType', async () => {
      mockProxyJson.mockResolvedValue({ url: 'https://connect.example.com' });
      await socialPublishing.getConnectUrl('youtube', 'user_123', 'https://app.example.com/callback');
      expect(mockProxyJson).toHaveBeenCalledWith(
        'social/youtube/connect-url',
        {
          method: 'POST',
          params: {
            external_user_id: 'user_123',
            redirect_to: 'https://app.example.com/callback',
          },
          generationType: 'social',
        }
      );
    });
  });

  describe('listAccounts', () => {
    test('calls muapi.proxyJson with correct endpoint and generationType', async () => {
      mockProxyJson.mockResolvedValue({ accounts: [] });
      await socialPublishing.listAccounts('user_123');
      expect(mockProxyJson).toHaveBeenCalledWith(
        `social/ext/accounts?external_user_id=${encodeURIComponent('user_123')}`,
        { method: 'GET', generationType: 'list' }
      );
    });
  });

  describe('disconnectAccount', () => {
    test('calls muapi.proxyJson with correct endpoint', async () => {
      mockProxyJson.mockResolvedValue({ success: true });
      await socialPublishing.disconnectAccount('acc_456');
      expect(mockProxyJson).toHaveBeenCalledWith(
        'social/ext/accounts/acc_456/disconnect',
        {
          method: 'POST',
          generationType: 'social',
        }
      );
    });
  });

  describe('publish', () => {
    test('calls muapi.proxyJson with correct endpoint, params, and generationType', async () => {
      mockProxyJson.mockResolvedValue({ request_id: 'req_789' });
      const payload = { title: 'Test', video_url: 'https://cdn.example.com/v.mp4' };
      await socialPublishing.publish('youtube', payload);
      expect(mockProxyJson).toHaveBeenCalledWith(
        'youtube-publish',
        {
          method: 'POST',
          params: payload,
          generationType: 'social',
        },
        undefined
      );
    });
  });

  describe('getResult', () => {
    test('calls muapi.proxyJson with correct endpoint and generationType', async () => {
      mockProxyJson.mockResolvedValue({ status: 'completed', url: 'https://yt.be/abc' });
      await socialPublishing.getResult('req_789');
      expect(mockProxyJson).toHaveBeenCalledWith(
        'predictions/req_789/result',
        {
          method: 'GET',
          generationType: 'poll',
        },
        undefined
      );
    });
  });

  describe('publishAndPoll', () => {
    test('happy path: publish returns request_id, getResult returns completed', async () => {
      vi.useFakeTimers();
      mockProxyJson
        .mockResolvedValueOnce({ request_id: 'req_123' })
        .mockResolvedValueOnce({ status: 'completed', url: 'https://post' });

      const promise = socialPublishing.publishAndPoll('youtube', { video_url: 'https://cdn/v.mp4' });
      await vi.advanceTimersByTimeAsync(800);
      const result = await promise;
      expect(result.url).toBe('https://post');
      expect(mockProxyJson).toHaveBeenCalledTimes(2);
    });

    test('failure: getResult returns failed with error', async () => {
      vi.useFakeTimers();
      mockProxyJson
        .mockResolvedValueOnce({ request_id: 'req_123' })
        .mockResolvedValueOnce({ status: 'failed', error: 'quota exceeded' });

      const promise = socialPublishing.publishAndPoll('youtube', { video_url: 'https://cdn/v.mp4' });
      void promise.catch(() => {});
      await vi.advanceTimersByTimeAsync(800);
      await expect(promise).rejects.toThrow('quota exceeded');
    });

    test('timeout: exceeds maxAttempts', async () => {
      vi.useFakeTimers();
      mockProxyJson
        .mockResolvedValueOnce({ request_id: 'req_123' })
        .mockResolvedValueOnce({ status: 'processing' })
        .mockResolvedValueOnce({ status: 'processing' });

      const promise = socialPublishing.publishAndPoll('youtube', { video_url: 'https://cdn/v.mp4' }, { maxAttempts: 2 });
      void promise.catch(() => {});
      await vi.advanceTimersByTimeAsync(800);
      await vi.advanceTimersByTimeAsync(2000);
      await expect(promise).rejects.toThrow(
        'Publishing is taking longer than expected. Check the platform shortly.'
      );
    });

    test('abort: signal.aborted throws Request cancelled by user', async () => {
      vi.useFakeTimers();
      const signal = { aborted: false };
      mockProxyJson.mockResolvedValue({ request_id: 'req_123' });

      const promise = socialPublishing.publishAndPoll('youtube', { video_url: 'https://cdn/v.mp4' }, { signal });
      void promise.catch(() => {});
      signal.aborted = true;
      await vi.advanceTimersByTimeAsync(800);
      await expect(promise).rejects.toThrow('Request cancelled by user');
    });
  });
});
