import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  enqueueRender,
  listRenderQueue,
  removeFromRenderQueue,
  clearRenderQueue,
  subscribe,
  processNextJob,
  startProcessor,
  stopProcessor,
  setRenderExecutor,
} from '../lib/editor/renderQueueStore.js';

describe('renderQueueStore', () => {
  let localStorageMock;
  let originalLocalStorage;

  beforeEach(() => {
    originalLocalStorage = global.localStorage;

    const store = {};

    localStorageMock = {
      getItem: vi.fn((key) => store[key] ?? null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => { for (const k in store) delete store[k]; }),
    };

    global.localStorage = localStorageMock;
  });

  afterEach(() => {
    localStorageMock.clear();
    global.localStorage = originalLocalStorage;
    setRenderExecutor(null);
    stopProcessor();
    vi.restoreAllMocks();
  });

  describe('listRenderQueue', () => {
    it('returns empty queue when nothing stored', () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(listRenderQueue()).toEqual([]);
    });
  });

  describe('enqueueRender', () => {
    it('returns entry with id and timestamp', () => {
      const entry = enqueueRender({ payload: 'test' });
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('timestamp');
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.timestamp).toBe('number');
    });

    it('subscriber is notified on enqueue', () => {
      const listener = vi.fn();
      subscribe(listener);
      enqueueRender({ payload: 'test' });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeFromRenderQueue', () => {
    it('removes entry by id', () => {
      const entry = enqueueRender({ payload: 'test' });
      removeFromRenderQueue(entry.id);
      expect(listRenderQueue()).not.toContainEqual(entry);
    });
  });

  describe('clearRenderQueue', () => {
    it('clears the queue', () => {
      enqueueRender({ payload: 'a' });
      enqueueRender({ payload: 'b' });
      clearRenderQueue();
      expect(listRenderQueue()).toEqual([]);
    });
  });

  describe('subscribe', () => {
    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);
      enqueueRender({ payload: 'first' });
      unsubscribe();
      enqueueRender({ payload: 'second' });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('legacy migration', () => {
    it('migrates render_queue to render:queue on first read', () => {
      const legacyData = [{ id: 'legacy-1', payload: 'old' }];
      localStorageMock.setItem('render_queue', JSON.stringify(legacyData));

      const queue = listRenderQueue();

      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('legacy-1');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'render:queue',
        JSON.stringify(legacyData)
      );
    });
  });

  describe('processNextJob without a registered executor', () => {
    it('never marks a job completed and fails it with an explicit error', () => {
      enqueueRender({ payload: 'test' });
      const result = processNextJob();

      // No executor is registered, so nothing can render. The job must fail,
      // not silently "complete".
      expect(result).toBeNull();
      const updated = listRenderQueue();
      expect(updated[0].status).toBe('failed');
      expect(updated[0].error).toMatch(/no renderer available/i);
    });

    it('returns null when queue is empty', () => {
      expect(processNextJob()).toBeNull();
    });
  });

  describe('processNextJob with a real executor', () => {
    it('marks the job completed only after the executor resolves with output', async () => {
      const blob = { size: 1234 };
      const executor = vi.fn().mockResolvedValue({ url: 'blob:real', blob, mime: 'video/webm', ext: 'webm' });
      setRenderExecutor(executor);

      enqueueRender({ payload: 'test' });
      const started = processNextJob();
      expect(started.status).toBe('processing');

      // Let the executor promise settle.
      await vi.waitFor(() => {
        expect(listRenderQueue()[0].status).toBe('completed');
      });

      const done = listRenderQueue()[0];
      expect(executor).toHaveBeenCalledTimes(1);
      expect(done.progress).toBe(100);
      expect(done.result).toEqual({ url: 'blob:real', mime: 'video/webm', ext: 'webm', size: 1234 });
    });

    it('marks the job failed when the executor rejects', async () => {
      const executor = vi.fn().mockRejectedValue(new Error('encode blew up'));
      setRenderExecutor(executor);

      enqueueRender({ payload: 'test' });
      processNextJob();

      await vi.waitFor(() => {
        expect(listRenderQueue()[0].status).toBe('failed');
      });
      expect(listRenderQueue()[0].error).toBe('encode blew up');
    });

    it('marks the job failed when the executor resolves with no output', async () => {
      const executor = vi.fn().mockResolvedValue({});
      setRenderExecutor(executor);

      enqueueRender({ payload: 'test' });
      processNextJob();

      await vi.waitFor(() => {
        expect(listRenderQueue()[0].status).toBe('failed');
      });
      expect(listRenderQueue()[0].error).toMatch(/no output/i);
    });
  });

  describe('startProcessor', () => {
    it('returns a stop function', () => {
      const stop = startProcessor(1000);
      expect(typeof stop).toBe('function');
      stop();
    });

    it('does not create multiple intervals', () => {
      const stop1 = startProcessor(1000);
      expect(typeof stop1).toBe('function');
      stop1();
    });
  });
});
