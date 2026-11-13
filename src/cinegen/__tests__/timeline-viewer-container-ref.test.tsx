// [remix] Regression: the viewer's video container ref must stay the same function across renders. An inline ref made React call it with
// null and then the element on every render, so the playback engine rebuilt its video pool ~17 times a second and playback froze.
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('TimelineViewer video container ref', () => {
  it('is attached once and not re-attached while the playhead moves', async () => {
    // jsdom has no canvas: a stub context lets the viewer's layers load
    HTMLCanvasElement.prototype.getContext = (() => new Proxy({}, { get: () => () => ({}), set: () => true })) as never;
    const { TimelineViewer } = await import('../components/edit/timeline-viewer');
    const videoContainerRef = vi.fn();
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    const base = {
      videoContainerRef, activeAsset: null, duration: 10, isPlaying: true, onPlayPause: vi.fn(), onSeek: vi.fn(), proxyMode: 'off', onProxyModeChange: vi.fn(),
      sourceViewerVisible: false, onToggleSourceViewer: vi.fn(), inspectorVisible: false, onToggleInspector: vi.fn(),
    };
    for (let t = 0; t < 5; t++) act(() => { root.render(<TimelineViewer {...(base as never)} currentTime={t * 0.1} />); });
    const nullCalls = videoContainerRef.mock.calls.filter((c) => c[0] === null).length;
    const elementCalls = videoContainerRef.mock.calls.filter((c) => c[0] instanceof HTMLElement).length;
    expect(elementCalls).toBe(1);
    expect(nullCalls).toBe(0);
    act(() => root.unmount()); host.remove();
  });
});
