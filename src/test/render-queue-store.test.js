import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  enqueueRender,
  listRenderQueue,
  removeFromRenderQueue,
  clearRenderQueue,
  subscribe,
} from '../lib/editor/renderQueueStore.js';

describe('renderQueueStore', () => {
  let localStorageMock;
  let listeners;
  let originalLocalStorage;

  beforeEach(() => {
    listeners = new Set();
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
    global.localStorage = originalLocalStorage;
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
});
