import { describe, it, expect, beforeEach, vi } from 'vitest';
import { confirmDeleteGeneration, deleteGeneration } from '../lib/generationHistory.js';

describe('generation delete', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('muapi_history', JSON.stringify([{ url: 'a.jpg' }, { url: 'b.jpg' }]));
    localStorage.setItem('video_history', JSON.stringify([{ url: 'v.mp4' }]));
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  it('removes the entry from local history for its type', () => {
    deleteGeneration('a.jpg', 'image');
    expect(JSON.parse(localStorage.getItem('muapi_history'))).toEqual([{ url: 'b.jpg' }]);
    deleteGeneration('v.mp4', 'video');
    expect(JSON.parse(localStorage.getItem('video_history'))).toEqual([]);
  });

  it('does nothing when the user cancels the confirm', () => {
    const removed = confirmDeleteGeneration('a.jpg', 'image', () => false);
    expect(removed).toBe(false);
    expect(JSON.parse(localStorage.getItem('muapi_history'))).toHaveLength(2);
  });

  it('deletes after the user confirms', () => {
    const removed = confirmDeleteGeneration('a.jpg', 'image', () => true);
    expect(removed).toBe(true);
    expect(JSON.parse(localStorage.getItem('muapi_history'))).toEqual([{ url: 'b.jpg' }]);
  });
});
