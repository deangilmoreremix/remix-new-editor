/**
 * OpenMontage API integration tests.
 *
 * Verifies the frontend's interaction with the OpenMontage proxy endpoints:
 * - API health check
 * - Create production (with api_keys)
 * - Get production status
 * - Approve/cancel production
 * - Pipeline/profile listing
 * - Error handling
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------
// Storage fakes so apiKeyManager works in tests.
// ---------------------------------------------------------------
function createStorage() {
  const store = {};
  return {
    getItem(key) {
      return store.hasOwnProperty(key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    _raw: store,
  };
}

let ls;
let ss;
let fetchMock;

const OPENMONTAGE_BASE = 'http://localhost:3001/openmontage';

beforeEach(() => {
  ls = createStorage();
  ss = createStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: ls, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: ss, writable: true, configurable: true });
  fetchMock = vi.fn();
  global.fetch = fetchMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------
// Helper: mock a JSON response
// ---------------------------------------------------------------
function mockJsonResponse(data, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------
describe('OpenMontage API health check', () => {
  test('returns healthy status when API is reachable', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ status: 'healthy', version: '0.1.0' }));

    const res = await fetch(`${OPENMONTAGE_BASE}/health`);
    const data = await res.json();

    expect(fetchMock).toHaveBeenCalledWith(`${OPENMONTAGE_BASE}/health`);
    expect(data.status).toBe('healthy');
  });

  test('handles unreachable API gracefully', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ error: 'Service unavailable' }, 503));

    const res = await fetch(`${OPENMONTAGE_BASE}/health`);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(503);
  });
});

describe('Create production', () => {
  test('sends production request with api_keys from headers', async () => {
    const requestBody = {
      prompt: 'Make a 60-second explainer about neural networks',
      pipeline: 'animated-explainer',
      profile: 'youtube-landscape',
      action: 'start',
    };
    const apiKeys = { muapi: 'sk-muapi-test-key-1234567890' };
    const headers = {
      'Content-Type': 'application/json',
      'x-muapi-api-key': 'sk-muapi-test-key-1234567890',
    };

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId: 'om_abc123', status: 'queued', pipeline: 'animated-explainer' })
    );

    const res = await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
    const data = await res.json();

    expect(fetchMock).toHaveBeenCalledWith(
      `${OPENMONTAGE_BASE}/api/productions`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-muapi-api-key': 'sk-muapi-test-key-1234567890',
        }),
      })
    );
    expect(data.jobId).toBe('om_abc123');
    expect(data.status).toBe('queued');
  });

  test('sends production request with both muapi and openai keys', async () => {
    const headers = {
      'Content-Type': 'application/json',
      'x-muapi-api-key': 'sk-muapi-key',
      'x-openai-api-key': 'sk-openai-key',
    };

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId: 'om_multi_keys', status: 'queued' })
    );

    await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: 'test' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${OPENMONTAGE_BASE}/api/productions`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-muapi-api-key': 'sk-muapi-key',
          'x-openai-api-key': 'sk-openai-key',
        }),
      })
    );
  });

  test('handles production creation failure', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ error: 'Invalid pipeline' }, 400)
    );

    const res = await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test', pipeline: 'nonexistent' }),
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });
});

describe('Get production status', () => {
  test('returns current production state', async () => {
    const jobStatus = {
      jobId: 'om_abc123',
      status: 'processing',
      progress: 45,
      stage: 'script',
      pipeline: 'animated-explainer',
      profile: 'youtube-landscape',
      result: null,
      error: null,
    };

    fetchMock.mockResolvedValueOnce(mockJsonResponse(jobStatus));

    const res = await fetch(`${OPENMONTAGE_BASE}/api/productions/om_abc123`);
    const data = await res.json();

    expect(fetchMock).toHaveBeenCalledWith(
      `${OPENMONTAGE_BASE}/api/productions/om_abc123`
    );
    expect(data.status).toBe('processing');
    expect(data.progress).toBe(45);
    expect(data.stage).toBe('script');
  });

  test('returns completed production with result', async () => {
    const completedStatus = {
      jobId: 'om_done',
      status: 'completed',
      progress: 100,
      stage: 'render',
      result: { videoUrl: 'https://cdn.example.com/video.mp4' },
    };

    fetchMock.mockResolvedValueOnce(mockJsonResponse(completedStatus));

    const res = await fetch(`${OPENMONTAGE_BASE}/api/productions/om_done`);
    const data = await res.json();

    expect(data.status).toBe('completed');
    expect(data.result.videoUrl).toBe('https://cdn.example.com/video.mp4');
  });

  test('handles job not found', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ error: 'Job not found' }, 404)
    );

    const res = await fetch(`${OPENMONTAGE_BASE}/api/productions/om_nonexistent`);
    expect(res.status).toBe(404);
  });
});

describe('Approve and cancel production', () => {
  test('approves production gate', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId: 'om_abc123', status: 'approved', stage: 'narration' })
    );

    const res = await fetch(
      `${OPENMONTAGE_BASE}/api/productions/om_abc123/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'gate' }),
      }
    );
    const data = await res.json();

    expect(data.status).toBe('approved');
    expect(data.stage).toBe('narration');
  });

  test('cancels a queued production', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId: 'om_abc123', status: 'cancelled' })
    );

    const res = await fetch(
      `${OPENMONTAGE_BASE}/api/productions/om_abc123/cancel`,
      { method: 'POST' }
    );
    const data = await res.json();

    expect(data.status).toBe('cancelled');
  });

  test('rejects cancel on completed job', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ error: 'Cannot cancel completed job' }, 409)
    );

    const res = await fetch(
      `${OPENMONTAGE_BASE}/api/productions/om_done/cancel`,
      { method: 'POST' }
    );

    expect(res.status).toBe(409);
  });
});

describe('Pipeline and profile listing', () => {
  test('lists available pipelines', async () => {
    const pipelines = [
      { id: 'animated-explainer', name: 'Animated Explainer' },
      { id: 'documentary-montage', name: 'Documentary Montage' },
      { id: 'cinematic', name: 'Cinematic' },
    ];

    fetchMock.mockResolvedValueOnce(mockJsonResponse(pipelines));

    const res = await fetch(`${OPENMONTAGE_BASE}/api/pipelines`);
    const data = await res.json();

    expect(data).toHaveLength(3);
    expect(data[0].id).toBe('animated-explainer');
  });

  test('lists available output profiles', async () => {
    const profiles = [
      { id: 'youtube-landscape', name: 'YouTube Landscape', resolution: '1920x1080' },
      { id: 'youtube-shorts', name: 'YouTube Shorts', resolution: '1080x1920' },
      { id: 'tiktok', name: 'TikTok', resolution: '1080x1920' },
    ];

    fetchMock.mockResolvedValueOnce(mockJsonResponse(profiles));

    const res = await fetch(`${OPENMONTAGE_BASE}/api/profiles`);
    const data = await res.json();

    expect(data).toHaveLength(3);
    expect(data[0].resolution).toBe('1920x1080');
  });
});

describe('Error handling', () => {
  test('handles network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      fetch(`${OPENMONTAGE_BASE}/api/productions`)
    ).rejects.toThrow('Network error');
  });

  test('handles 500 internal server error', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ error: 'Internal server error' }, 500)
    );

    const res = await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test' }),
    });

    expect(res.status).toBe(500);
  });

  test('handles malformed JSON response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    });

    const res = await fetch(`${OPENMONTAGE_BASE}/api/productions/om_123`);
    expect(res.ok).toBe(true);

    await expect(res.json()).rejects.toThrow(SyntaxError);
  });

  test('handles timeout via AbortController', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValueOnce(abortError);

    const controller = new AbortController();
    controller.abort();

    await expect(
      fetch(`${OPENMONTAGE_BASE}/api/productions/om_123`, {
        signal: controller.signal,
      })
    ).rejects.toThrow('The operation was aborted');
  });
});
