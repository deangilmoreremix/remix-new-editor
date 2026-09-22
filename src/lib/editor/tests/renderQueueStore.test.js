import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enqueueRender, listRenderQueue, removeFromRenderQueue, clearRenderQueue, subscribe, processNextJob, setRenderExecutor, startProcessor, stopProcessor } from '../renderQueueStore.js';

describe('renderQueueStore', () => {
  beforeEach(() => {
    clearRenderQueue();
    stopProcessor();
    setRenderExecutor(null);
    vi.clearAllMocks();
  });

  it('starts empty', () => {
    expect(listRenderQueue()).toEqual([]);
  });

  it('enqueues a job with queued status', () => {
    const entry = enqueueRender({ videoUrl: 'blob:test', label: 'Test Render' });
    const queue = listRenderQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(entry.id);
    expect(queue[0].status).toBe('queued');
    expect(queue[0].progress).toBe(0);
  });

  it('removes a job by id', () => {
    const entry = enqueueRender({ videoUrl: 'blob:test', label: 'To Remove' });
    removeFromRenderQueue(entry.id);
    expect(listRenderQueue()).toHaveLength(0);
  });

  it('notifies subscribers on queue changes', async () => {
    const listener = vi.fn();
    subscribe(listener);
    const entry = enqueueRender({ videoUrl: 'blob:test', label: 'Notified' });
    expect(listener).toHaveBeenCalledTimes(1);
    const queued = listener.mock.calls[0][0];
    expect(queued.some((e) => e.id === entry.id)).toBe(true);
  });

  it('marks job failed when no executor is registered', async () => {
    const entry = enqueueRender({ videoUrl: 'blob:test', label: 'No Executor' });
    const result = processNextJob();
    // When no executor is available, the job is immediately marked failed and
    // processNextJob returns null rather than the queued entry.
    expect(result).toBeNull();

    await new Promise((r) => setTimeout(r, 50));
    const queue = listRenderQueue();
    const updated = queue.find((e) => e.id === entry.id);
    expect(updated.status).toBe('failed');
    expect(updated.error).toContain('No renderer available');
  });

  it('completes job when executor returns a real result', async () => {
    const fakeUrl = 'blob:success';
    const fakeBlob = new Blob(['video'], { type: 'video/webm' });
    setRenderExecutor(async () => ({ url: fakeUrl, blob: fakeBlob, mime: 'video/webm', ext: 'webm' }));
    const entry = enqueueRender({ videoUrl: 'blob:test', label: 'Real Executor' });
    const result = processNextJob();
    expect(result).not.toBeNull();
    expect(result.status).toBe('processing');

    await new Promise((r) => setTimeout(r, 50));
    const queue = listRenderQueue();
    const updated = queue.find((e) => e.id === entry.id);
    expect(updated.status).toBe('completed');
    expect(updated.result.url).toBe(fakeUrl);
    expect(updated.result.ext).toBe('webm');
  });

  it('marks job failed when executor rejects', async () => {
    setRenderExecutor(async () => {
      throw new Error('boom');
    });
    const entry = enqueueRender({ videoUrl: 'blob:test', label: 'Failing Executor' });
    processNextJob();

    await new Promise((r) => setTimeout(r, 50));
    const queue = listRenderQueue();
    const updated = queue.find((e) => e.id === entry.id);
    expect(updated.status).toBe('failed');
    expect(updated.error).toBe('boom');
  });

  it('marks job failed when executor returns no output', async () => {
    setRenderExecutor(async () => ({}));
    const entry = enqueueRender({ videoUrl: 'blob:test', label: 'Empty Executor' });
    processNextJob();

    await new Promise((r) => setTimeout(r, 50));
    const queue = listRenderQueue();
    const updated = queue.find((e) => e.id === entry.id);
    expect(updated.status).toBe('failed');
    expect(updated.error).toContain('no output');
  });

  it('does not process two jobs simultaneously', async () => {
    let resolveFirst;
    const firstPromise = new Promise((r) => { resolveFirst = r; });
    setRenderExecutor(async () => {
      await firstPromise;
      return { url: 'blob:1', blob: new Blob(['x']), mime: 'video/webm', ext: 'webm' };
    });
    enqueueRender({ videoUrl: 'blob:test', label: 'Job 1' });
    enqueueRender({ videoUrl: 'blob:test', label: 'Job 2' });
    processNextJob();
    processNextJob(); // should be ignored because processing=true
    resolveFirst();
    await new Promise((r) => setTimeout(r, 50));
    const queue = listRenderQueue();
    const statuses = queue.map((e) => e.status).sort();
    expect(statuses).toEqual(['completed', 'queued']);
  });

  it('starts and stops the background processor', () => {
    const stop = startProcessor(1000);
    expect(typeof stop).toBe('function');
    stop();
    // processorInterval should be null after stop
    // (internal state, but at least it doesn't throw)
  });
});
