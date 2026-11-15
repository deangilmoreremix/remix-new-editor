// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createPendingJobTracker, getPendingJobs } from '../pendingJobs.js';

describe('createPendingJobTracker().finish({ keep })', () => {
  beforeEach(() => { localStorage.clear(); });

  it('removes the saved record by default (the job is done)', () => {
    const t = createPendingJobTracker('zackd', { slot: 'clip', id: 'a' });
    t.onRequestId('req_done_1');
    expect(getPendingJobs('zackd').some((j) => j.requestId === 'req_done_1')).toBe(true);
    t.finish();
    expect(getPendingJobs('zackd').some((j) => j.requestId === 'req_done_1')).toBe(false);
  });

  it('keeps the saved record when the browser only stopped waiting (cancel or navigation)', () => {
    const t = createPendingJobTracker('zackd', { slot: 'clip', id: 'b' });
    t.onRequestId('req_kept_1');
    t.finish({ keep: true });
    expect(getPendingJobs('zackd').some((j) => j.requestId === 'req_kept_1')).toBe(true); // a later visit can resume it
  });
});
