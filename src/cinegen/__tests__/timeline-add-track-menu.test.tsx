// [remix] "Add Track" still adds a video + audio pair; the arrow menu adds just one track.
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { TimelineBottomBar } from '../components/edit/timeline-bottom-bar';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('TimelineBottomBar add-track menu', () => {
  it('adds a pair from the button and a single track from the menu', () => {
    const onAddTrack = vi.fn();
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    const props = { pxPerSecond: 50, onZoomChange: vi.fn(), trackHeight: 110, onTrackHeightChange: vi.fn(), trackCount: 4, sequenceDuration: 10, onAddTrack } as never;
    act(() => { root.render(<TimelineBottomBar {...props} />); });
    const click = (el: Element | null) => act(() => { (el as HTMLElement).click(); });
    click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Add Track')) ?? null);
    expect(onAddTrack).toHaveBeenLastCalledWith(['video', 'audio']);
    click(host.querySelector('[aria-label="Add one track"]'));
    click([...host.querySelectorAll('[role=menuitem]')].find((b) => b.textContent === 'Audio track') ?? null);
    expect(onAddTrack).toHaveBeenLastCalledWith('audio');
    click(host.querySelector('[aria-label="Add one track"]'));
    click([...host.querySelectorAll('[role=menuitem]')].find((b) => b.textContent === 'Video track') ?? null);
    expect(onAddTrack).toHaveBeenLastCalledWith('video');
    act(() => root.unmount()); host.remove();
  });
});
