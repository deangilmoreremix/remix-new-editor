// [remix] The Overlays lane shows what an overlay shows: an Image overlay's block carries its own picture, and a picture dragged from the
// Media pool onto the lane is handed to the host (which turns it into an Image overlay).
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { OverlayLane } from '../components/edit/overlay-lane';
import type { OverlayClip } from '../types/workspace';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PIC = 'https://example.com/pic.png';
const overlays = [{ id: 'img', type: 'overlay-image', name: 'Image', start: 0, end: 8, addon: { src: PIC } }] as unknown as OverlayClip[];

function setup(onAssetDrop = vi.fn()) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(<OverlayLane overlays={overlays} pxPerSecond={50} scrollLeft={0} labelWidth={150} sequenceDuration={20} onOpenAdd={() => {}} onUpdate={() => {}} onRemove={() => {}} onAssetDrop={onAssetDrop} />);
  });
  return { host, onAssetDrop, cleanup: () => { act(() => root.unmount()); host.remove(); } };
}

function dropEvent(type: string, data: Record<string, string>) {
  const e = new Event(type, { bubbles: true, cancelable: true }) as Event & { dataTransfer: unknown };
  e.dataTransfer = { types: Object.keys(data), getData: (k: string) => data[k] ?? '', dropEffect: 'none' };
  return e;
}

describe('OverlayLane image overlays', () => {
  it('shows the picked picture inside the Image overlay block', () => {
    const { host, cleanup } = setup();
    const img = host.querySelector('img.overlay-card__thumb') as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toBe(PIC);
    cleanup();
  });

  it('hands a Media-pool picture dropped on the lane to onAssetDrop', () => {
    const { host, onAssetDrop, cleanup } = setup();
    const area = host.querySelector('.overlay-track__clips') as HTMLElement;
    const over = dropEvent('dragover', { 'application/x-asset-id': 'asset-1' });
    act(() => { area.dispatchEvent(over); });
    expect(over.defaultPrevented).toBe(true); // the lane accepts the drag
    act(() => { area.dispatchEvent(dropEvent('drop', { 'application/x-asset-id': 'asset-1' })); });
    expect(onAssetDrop).toHaveBeenCalledTimes(1);
    expect(onAssetDrop.mock.calls[0][0]).toBe('asset-1');
    expect(typeof onAssetDrop.mock.calls[0][1].time).toBe('number');
    cleanup();
  });
});
