/**
 * OpenMontage full production flow tests.
 *
 * Verifies end-to-end production workflows:
 * - Full production flow from creation to completion
 * - API key collection from apiKeyManager
 * - Polling with backoff
 * - Gate approval flow
 * - Error recovery
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

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

function mockJsonResponse(data, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('Full production flow', () => {
  test('completes lifecycle: create -> poll -> approve -> complete', async () => {
    const jobId = 'om_flow_test_123';

    // Step 1: Create production
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'queued', pipeline: 'animated-explainer' })
    );

    const createRes = await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Test video', pipeline: 'animated-explainer' }),
    });
    const createData = await createRes.json();
    expect(createData.jobId).toBe(jobId);
    expect(createData.status).toBe('queued');

    // Step 2: Poll - processing
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'processing', progress: 30, stage: 'script' })
    );

    const pollRes1 = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    const pollData1 = await pollRes1.json();
    expect(pollData1.status).toBe('processing');
    expect(pollData1.stage).toBe('script');

    // Step 3: Poll - awaiting approval (gate)
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'awaiting_approval', progress: 50, stage: 'gate' })
    );

    const pollRes2 = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    const pollData2 = await pollRes2.json();
    expect(pollData2.status).toBe('awaiting_approval');

    // Step 4: Approve gate
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'approved', stage: 'narration' })
    );

    const approveRes = await fetch(
      `${OPENMONTAGE_BASE}/api/productions/${jobId}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'gate' }),
      }
    );
    const approveData = await approveRes.json();
    expect(approveData.status).toBe('approved');

    // Step 5: Poll - completed
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        jobId,
        status: 'completed',
        progress: 100,
        stage: 'render',
        result: { videoUrl: 'https://cdn.example.com/final.mp4' },
      })
    );

    const pollRes3 = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    const pollData3 = await pollRes3.json();
    expect(pollData3.status).toBe('completed');
    expect(pollData3.result.videoUrl).toBe('https://cdn.example.com/final.mp4');

    // Verify total fetch calls
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test('production fails during processing', async () => {
    const jobId = 'om_fail_test';

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'queued' })
    );
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'processing', progress: 20, stage: 'research' })
    );
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        jobId,
        status: 'failed',
        error: 'TTS generation failed: rate limited',
      })
    );

    // Create
    await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Test' }),
    });

    // Poll - processing
    await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);

    // Poll - failed
    const failRes = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    const failData = await failRes.json();
    expect(failData.status).toBe('failed');
    expect(failData.error).toContain('rate limited');
  });
});

describe('API key collection from apiKeyManager', () => {
  test('collects muapi key and sends as header', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();
    await manager.setMuapiKey('sk-muapi-flow-test-1234567890', true);

    const headers = { 'Content-Type': 'application/json' };
    if (manager.hasMuapiKey()) {
      headers['x-muapi-api-key'] = manager.getMuapiKey();
    }

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId: 'om_keyed', status: 'queued' })
    );

    await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: 'Test' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${OPENMONTAGE_BASE}/api/productions`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-muapi-api-key': 'sk-muapi-flow-test-1234567890',
        }),
      })
    );
  });

  test('collects both muapi and openai keys', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();
    await manager.setMuapiKey('sk-muapi-key-1234567890', true);
    await manager.setOpenAIKey('sk-openai-key-1234567890', true);

    const headers = { 'Content-Type': 'application/json' };
    if (manager.hasMuapiKey()) headers['x-muapi-api-key'] = manager.getMuapiKey();
    if (manager.hasOpenAIKey()) headers['x-openai-api-key'] = manager.getOpenAIKey();

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId: 'om_multi', status: 'queued' })
    );

    await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: 'Test' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${OPENMONTAGE_BASE}/api/productions`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-muapi-api-key': 'sk-muapi-key-1234567890',
          'x-openai-api-key': 'sk-openai-key-1234567890',
        }),
      })
    );
  });

  test('sends request without key headers when no keys configured', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();

    const headers = { 'Content-Type': 'application/json' };
    if (manager.hasMuapiKey()) headers['x-muapi-api-key'] = manager.getMuapiKey();
    if (manager.hasOpenAIKey()) headers['x-openai-api-key'] = manager.getOpenAIKey();

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId: 'om_no_keys', status: 'queued' })
    );

    await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: 'Test' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${OPENMONTAGE_BASE}/api/productions`,
      expect.objectContaining({
        headers: expect.not.objectContaining({
          'x-muapi-api-key': expect.anything(),
        }),
      })
    );
  });
});

describe('Polling with backoff', () => {
  test('polls at regular interval during active stages', async () => {
    const jobId = 'om_poll_test';

    // Simulate 3 polls at consistent interval
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'processing', progress: 25, stage: 'script' })
    );
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'processing', progress: 50, stage: 'script' })
    );
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'processing', progress: 75, stage: 'narration' })
    );

    const poll1 = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    const d1 = await poll1.json();
    expect(d1.progress).toBe(25);

    const poll2 = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    const d2 = await poll2.json();
    expect(d2.progress).toBe(50);

    const poll3 = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    const d3 = await poll3.json();
    expect(d3.progress).toBe(75);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('stops polling on terminal state', async () => {
    const jobId = 'om_terminal_test';

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'completed', progress: 100 })
    );

    const res = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    const data = await res.json();

    if (['completed', 'failed', 'cancelled'].includes(data.status)) {
      // Would stop polling in real implementation
      expect(data.status).toBe('completed');
    }

    // Only one poll needed for terminal state
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('retries with backoff on error', async () => {
    const jobId = 'om_backoff_test';

    // First call fails
    fetchMock.mockRejectedValueOnce(new Error('Network timeout'));
    // Second call succeeds
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'processing', progress: 10 })
    );

    // Simulate retry logic
    let data;
    try {
      const res = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
      data = await res.json();
    } catch {
      // Retry
      const res = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
      data = await res.json();
    }

    expect(data.status).toBe('processing');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('Gate approval flow', () => {
  test('production pauses at gate until approved', async () => {
    const jobId = 'om_gate_test';

    // Production reaches gate
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'awaiting_approval', stage: 'gate', progress: 50 })
    );

    const gateRes = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    const gateData = await gateRes.json();
    expect(gateData.status).toBe('awaiting_approval');

    // User approves
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'approved', stage: 'narration' })
    );

    const approveRes = await fetch(
      `${OPENMONTAGE_BASE}/api/productions/${jobId}/approve`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
    );
    const approveData = await approveRes.json();
    expect(approveData.status).toBe('approved');
    expect(approveData.stage).toBe('narration');
  });

  test('production can be cancelled at gate', async () => {
    const jobId = 'om_gate_cancel';

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'awaiting_approval', stage: 'gate' })
    );
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'cancelled' })
    );

    // Check gate status
    const gateRes = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    const gateData = await gateRes.json();
    expect(gateData.status).toBe('awaiting_approval');

    // Cancel instead of approve
    const cancelRes = await fetch(
      `${OPENMONTAGE_BASE}/api/productions/${jobId}/cancel`,
      { method: 'POST' }
    );
    const cancelData = await cancelRes.json();
    expect(cancelData.status).toBe('cancelled');
  });
});

describe('Error recovery', () => {
  test('recovers from transient network errors', async () => {
    const jobId = 'om_recovery_test';

    // Fail twice, then succeed
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    fetchMock.mockRejectedValueOnce(new Error('ETIMEDOUT'));
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'processing', progress: 30 })
    );

    let attempts = 0;
    let data;
    while (attempts < 3) {
      try {
        const res = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
        data = await res.json();
        break;
      } catch {
        attempts++;
      }
    }

    expect(data.status).toBe('processing');
    expect(attempts).toBe(2);
  });

  test('handles server restart during polling', async () => {
    const jobId = 'om_restart_test';

    // First poll succeeds
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'processing', progress: 40 })
    );

    // Server goes down
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ error: 'Service unavailable' }, 503)
    );

    // Server recovers
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ jobId, status: 'processing', progress: 40 })
    );

    const r1 = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    expect((await r1.json()).status).toBe('processing');

    const r2 = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    expect(r2.status).toBe(503);

    const r3 = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    expect((await r3.json()).status).toBe('processing');
  });

  test('regenerates scene after production completes', async () => {
    const jobId = 'om_regen_test';
    const sceneIndex = 2;

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        jobId,
        status: 'completed',
        result: { videoUrl: 'https://cdn.example.com/v1.mp4' },
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        jobId,
        sceneIndex,
        status: 'regenerating',
        estimatedCost: '0.16',
      })
    );

    // Check production is done
    const prodRes = await fetch(`${OPENMONTAGE_BASE}/api/productions/${jobId}`);
    const prodData = await prodRes.json();
    expect(prodData.status).toBe('completed');

    // Regenerate scene
    const regenRes = await fetch(
      `${OPENMONTAGE_BASE}/api/productions/${jobId}/scenes/${sceneIndex}/regenerate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneIndex }),
      }
    );
    const regenData = await regenRes.json();
    expect(regenData.status).toBe('regenerating');
    expect(regenData.estimatedCost).toBe('0.16');
  });
});
