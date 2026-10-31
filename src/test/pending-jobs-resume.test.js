import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createPendingJobTracker,
  resumePendingJobs,
  getPendingJobs,
  savePendingJob,
  resultUrlOf,
} from '../lib/pendingJobs.js';

describe('pending job resume', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('tracker persists a job on request id and clears it on finish', () => {
    const tracker = createPendingJobTracker('image', { prompt: 'cat' });
    tracker.onRequestId('req-1');
    expect(getPendingJobs('image')).toHaveLength(1);
    expect(getPendingJobs('image')[0].historyMeta).toEqual({ prompt: 'cat' });
    tracker.finish();
    expect(getPendingJobs('image')).toHaveLength(0);
  });

  it('does not resume a job this page is still polling', async () => {
    const tracker = createPendingJobTracker('video', {});
    tracker.onRequestId('req-live');
    const poll = vi.fn();
    await resumePendingJobs('video', { poll, onResult: vi.fn() });
    expect(poll).not.toHaveBeenCalled();
    tracker.finish();
  });

  it('resumes a job left over from a previous page load and reports its url', async () => {
    savePendingJob({ requestId: 'req-old', studioType: 'cinema', historyMeta: { settings: { prompt: 'p' } }, maxAttempts: 10, interval: 1000, submittedAt: Date.now() - 3000 });
    const poll = vi.fn().mockResolvedValue({ outputs: ['https://cdn/x.mp4'] });
    const onResult = vi.fn();
    await resumePendingJobs('cinema', { poll, onResult });
    expect(poll).toHaveBeenCalledWith('req-old', 7, 1000);
    expect(onResult).toHaveBeenCalledWith('https://cdn/x.mp4', expect.objectContaining({ requestId: 'req-old' }));
    expect(getPendingJobs('cinema')).toHaveLength(0);
  });

  it('drops jobs older than an hour without polling', async () => {
    savePendingJob({ requestId: 'req-stale', studioType: 'audio', historyMeta: {}, maxAttempts: 10, interval: 1000, submittedAt: Date.now() - 2 * 60 * 60 * 1000 });
    const poll = vi.fn();
    await resumePendingJobs('audio', { poll, onResult: vi.fn() });
    expect(poll).not.toHaveBeenCalled();
    expect(getPendingJobs('audio')).toHaveLength(0);
  });

  it('clears a job whose poll fails', async () => {
    savePendingJob({ requestId: 'req-bad', studioType: 'image', historyMeta: {}, maxAttempts: 10, interval: 1000, submittedAt: Date.now() });
    const onResult = vi.fn();
    await resumePendingJobs('image', { poll: vi.fn().mockRejectedValue(new Error('gone')), onResult });
    expect(onResult).not.toHaveBeenCalled();
    expect(getPendingJobs('image')).toHaveLength(0);
  });

  it('reads urls from every muapi result shape', () => {
    expect(resultUrlOf({ outputs: ['a'] })).toBe('a');
    expect(resultUrlOf({ url: 'b' })).toBe('b');
    expect(resultUrlOf({ output: { url: 'c' } })).toBe('c');
    expect(resultUrlOf({})).toBeNull();
  });
});

describe('job finished event', () => {
  it('tells the header to refresh the balance when a generation settles', () => {
    const listener = vi.fn();
    window.addEventListener('muapi:job-finished', listener);
    const tracker = createPendingJobTracker('image', {});
    tracker.finish();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('muapi:job-finished', listener);
  });
});
