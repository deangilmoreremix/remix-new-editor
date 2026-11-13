// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNativeTimelineVideo } from '@cinegen/components/edit/use-native-timeline-video';

vi.mock('@cinegen/lib/editor/visual-playback-state', () => ({
  buildNativeVisualPlaybackDescriptors: () => [{ id: 'd1' }],
}));

const setSurfaceHidden = vi.fn();
const syncSurface = vi.fn();
const opts = {
  enabled: true, surfaceId: 's', timeline: {} as never, assets: [],
  activeClips: [{ asset: { type: 'video' } }] as never, currentTime: 0, isPlaying: true, proxyMode: 'full' as never,
};

beforeEach(() => {
  setSurfaceHidden.mockClear();
  (window as unknown as { electronAPI: unknown }).electronAPI = { nativeVideo: { setSurfaceHidden, syncSurface } };
});
afterEach(() => { document.body.innerHTML = ''; });

describe('useNativeTimelineVideo + blocking overlays', () => {
  it('shows the surface when no overlay is open', () => {
    renderHook(() => useNativeTimelineVideo(opts));
    expect(setSurfaceHidden).toHaveBeenLastCalledWith({ surfaceId: 's', hidden: false });
  });

  it('keeps it hidden while an aria-modal element is open, and restores it on close', async () => {
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
    renderHook(() => useNativeTimelineVideo(opts));
    expect(setSurfaceHidden).toHaveBeenLastCalledWith({ surfaceId: 's', hidden: true });
    setSurfaceHidden.mockClear();
    act(() => { modal.remove(); });
    await waitFor(() => expect(setSurfaceHidden).toHaveBeenLastCalledWith({ surfaceId: 's', hidden: false }));
  });

  it('hides when an overlay opens after mount', async () => {
    renderHook(() => useNativeTimelineVideo(opts));
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    act(() => { document.body.appendChild(modal); });
    await waitFor(() => expect(setSurfaceHidden).toHaveBeenLastCalledWith({ surfaceId: 's', hidden: true }));
  });
});
