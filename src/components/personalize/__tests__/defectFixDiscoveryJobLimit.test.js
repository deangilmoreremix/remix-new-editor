/**
 * defectFixDiscoveryJobLimit.test.js
 *
 * Regression: the discovery job limit compared `jobStore.size` — which
 * includes finished jobs retained for 60s so clients can poll their
 * results — against MAX_CONCURRENT_JOBS. After three sequential jobs
 * completed, a fourth submission was wrongly rejected with
 * JOB_LIMIT_REACHED. Only `pending` / `running` jobs may count; the
 * retention window must stay intact.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const runDiscoveryWorker = vi.fn();
const DONE = { ok: true, urls: [], logos: [], products: [], brandReferences: [], errors: [] };

vi.mock('../discovery/worker.js', () => ({
  runDiscoveryWorker: (...args) => runDiscoveryWorker(...args),
}));

const {
  discoverAssets,
  getJobStatus,
  listJobs,
  cancelJob,
  _resetJobStore,
} = await import('../discovery/index.js');

let originalLookup;

beforeEach(() => {
  originalLookup = require('node:dns').promises.lookup;
  require('node:dns').promises.lookup = (host) => {
    if (host === 'example.com') return Promise.resolve([{ address: '93.184.216.34' }]);
    return Promise.reject(new Error('ENOTFOUND'));
  };
  _resetJobStore();
  runDiscoveryWorker.mockReset();
  runDiscoveryWorker.mockResolvedValue(DONE);
});

afterEach(() => {
  require('node:dns').promises.lookup = originalLookup;
  _resetJobStore();
});

/** Let every queued setImmediate job callback (and its awaits) finish. */
async function flushJobs() {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe('defect: finished jobs do not count against the concurrency limit', () => {
  it('accepts a 4th submission after 3 jobs ran to completion', async () => {
    const first = discoverAssets('https://example.com/a');
    const second = discoverAssets('https://example.com/b');
    const third = discoverAssets('https://example.com/c');
    expect(first.jobId).toBeTruthy();
    expect(second.jobId).toBeTruthy();
    expect(third.jobId).toBeTruthy();

    await flushJobs();

    // All three finished…
    expect(getJobStatus(first.jobId).status).toBe('completed');
    expect(getJobStatus(second.jobId).status).toBe('completed');
    expect(getJobStatus(third.jobId).status).toBe('completed');
    // …and are still retained so clients can poll their results.
    expect(listJobs().length).toBe(3);

    // The fourth submission must NOT be rejected.
    const fourth = discoverAssets('https://example.com/d');
    expect(fourth.error).toBeUndefined();
    expect(fourth.jobId).toBeTruthy();
    expect(fourth.status).toBe('pending');

    await flushJobs();
    expect(getJobStatus(fourth.jobId).status).toBe('completed');
  });

  it('still rejects a 4th CONCURRENT job', async () => {
    runDiscoveryWorker.mockImplementation(() => new Promise(() => {}));
    const jobs = [
      discoverAssets('https://example.com/a'),
      discoverAssets('https://example.com/b'),
      discoverAssets('https://example.com/c'),
    ];
    for (const job of jobs) expect(job.jobId).toBeTruthy();

    await flushJobs();
    const fourth = discoverAssets('https://example.com/d');
    expect(fourth.error).toBe('JOB_LIMIT_REACHED');
    expect(fourth.jobId).toBeUndefined();
  });

  it('frees the slot again once a running job finishes', async () => {
    const resolvers = [];
    runDiscoveryWorker.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));
    discoverAssets('https://example.com/a');
    discoverAssets('https://example.com/b');
    discoverAssets('https://example.com/c');
    await flushJobs();
    expect(discoverAssets('https://example.com/d').error).toBe('JOB_LIMIT_REACHED');

    // Let the in-flight workers resolve: their slots open up.
    resolvers.forEach((resolve) => resolve(DONE));
    await flushJobs();
    const next = discoverAssets('https://example.com/e');
    expect(next.error).toBeUndefined();
    expect(next.jobId).toBeTruthy();
  });

  it('does not count cancelled jobs against the limit', async () => {
    runDiscoveryWorker.mockImplementation(() => new Promise(() => {}));
    discoverAssets('https://example.com/a');
    const second = discoverAssets('https://example.com/b');
    const third = discoverAssets('https://example.com/c');
    await flushJobs();
    expect(discoverAssets('https://example.com/d').error).toBe('JOB_LIMIT_REACHED');

    // Cancel two: their slots are released immediately.
    expect(cancelJob(second.jobId)).toBe(true);
    expect(cancelJob(third.jobId)).toBe(true);
    const next = discoverAssets('https://example.com/e');
    expect(next.error).toBeUndefined();
    expect(next.jobId).toBeTruthy();
  });
});
