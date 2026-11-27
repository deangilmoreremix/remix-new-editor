// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaBrowser } from '@cinegen/components/edit/use-media-browser';
import type { StockItem } from '@cinegen/components/edit/stock-media-popup';

vi.mock('../../../lib/editor/ai/timelineMuapi.js', () => ({ runTimelineMuapi: vi.fn() }));

const persist = vi.fn();
const queue = vi.fn().mockResolvedValue(undefined);
const timeline = { id: 't', tracks: [{ id: 'v1', name: 'V1', kind: 'video', locked: false, color: '#fff', muted: false, solo: false, visible: true, volume: 1 }], clips: [], duration: 0 } as never;
const item = (source: 'pixabay' | 'pexels', over: Partial<StockItem> = {}): StockItem => ({ id: `${source}-1`, source, name: 'forest', src: 'https://x/f.jpg', thumbnail: 'https://x/t.jpg', mustCopy: source === 'pixabay', ...over });

beforeEach(() => {
  Object.assign(URL, { createObjectURL: vi.fn().mockReturnValue('blob:http://x/default') });
  persist.mockReset();
  (window as unknown as { electronAPI: unknown }).electronAPI = { media: { persistGeneratedAsset: persist, queueProcessing: queue } };
});

const setup = () => {
  const dispatch = vi.fn();
  const { result } = renderHook(() => useMediaBrowser({ timeline, currentTime: 0, projectId: 'p', dispatch }));
  return { dispatch, add: result.current.handleAddStock };
};
const added = (dispatch: ReturnType<typeof vi.fn>) => dispatch.mock.calls.map((c) => c[0]).find((a) => a.type === 'ADD_ASSET')?.asset;

describe('Pixabay copies', () => {
  it('signed in: the https storage copy is used', async () => {
    persist.mockResolvedValue({ path: 'https://storage.test/a.jpg', downloaded: true });
    const { dispatch, add } = setup();
    await act(async () => { await add(item('pixabay'), 'images'); });
    expect(added(dispatch).fileRef).toBe('https://storage.test/a.jpg');
  });

  it('signed out: the inlined data: copy is accepted, so Pixabay images work for everyone', async () => {
    persist.mockResolvedValue({ path: 'data:image/jpeg;base64,AAAA', downloaded: true });
    const { dispatch, add } = setup();
    await act(async () => { await add(item('pixabay'), 'images'); });
    const a = added(dispatch);
    expect(a.url).toBe('data:image/jpeg;base64,AAAA');
    expect(a.fileRef).toBe('data:image/jpeg;base64,AAAA');
    expect(dispatch.mock.calls.some((c) => c[0].type === 'SET_TIMELINE')).toBe(true);
  });

  it('a session-only blob: copy is still refused for Pixabay (it would be dead after a reload)', async () => {
    persist.mockResolvedValue({ path: 'blob:http://x/1', downloaded: true });
    const { dispatch, add } = setup();
    await expect(add(item('pixabay'), 'images')).rejects.toThrow(/expired|copy/i);
    expect(added(dispatch)).toBeUndefined();
  });

  it('an expired link (copy fails) gives a message that says to search again', async () => {
    persist.mockResolvedValue({ path: 'https://pixabay.com/get/x.jpg', downloaded: false });
    const { add } = setup();
    await expect(add(item('pixabay'), 'images')).rejects.toThrow(/search again/i);
  });

  it('Pexels still falls back to its own link when no copy can be made', async () => {
    persist.mockRejectedValue(new Error('offline'));
    const { dispatch, add } = setup();
    await act(async () => { await add(item('pexels', { src: 'https://p/x.jpg' }), 'images'); });
    expect(added(dispatch).url).toBe('https://p/x.jpg');
  });

  it('signed out, a video copy is played from a blob: URL (the CSP blocks data: media) and the user is told it is session-only', async () => {
    const create = vi.fn().mockReturnValue('blob:http://x/v');
    Object.assign(URL, { createObjectURL: create });
    persist.mockResolvedValue({ path: 'data:video/mp4;base64,AAAA', downloaded: true });
    const { dispatch, add } = setup();
    let note: unknown;
    await act(async () => { note = await add(item('pixabay', { duration: 8 }), 'videos'); });
    expect(added(dispatch).fileRef).toBe('blob:http://x/v');
    expect(create).toHaveBeenCalled();
    expect(String(note)).toMatch(/this session only/i);
  });

  it('a video whose full file cannot be copied is retried with the smaller rendition', async () => {
    persist.mockImplementation(async (a: { remoteUrl: string }) => a.remoteUrl.includes('tiny') ? { path: 'data:video/mp4;base64,AAAA', downloaded: true } : { path: a.remoteUrl, downloaded: false });
    const { dispatch, add } = setup();
    await act(async () => { await add(item('pixabay', { src: 'https://cdn/v_small.mp4', fallbackSrc: 'https://cdn/v_tiny.mp4', duration: 10 }), 'videos'); });
    expect(added(dispatch).fileRef).toMatch(/^blob:/);
    expect(persist.mock.calls.map((c) => c[0].remoteUrl)).toEqual(['https://cdn/v_small.mp4', 'https://cdn/v_tiny.mp4']);
  });
});
