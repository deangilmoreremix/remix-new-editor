// [remix] Every overlay block on the timeline lane can be removed: the × button, or Delete / Backspace while it is selected.
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { OverlayLane } from '../components/edit/overlay-lane';
import type { OverlayClip } from '../types/workspace';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const overlays = [
  { id: 'a', kind: 'lead-form', name: 'Lead Generator', start: 1, end: 5 },
  { id: 'b', kind: 'click-to-call', name: 'CTA', start: 6, end: 9 },
] as unknown as OverlayClip[];

function setup() {
  const onRemove = vi.fn();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(<OverlayLane overlays={overlays} pxPerSecond={50} scrollLeft={0} labelWidth={150} sequenceDuration={20} onAdd={() => {}} onUpdate={() => {}} onRemove={onRemove} />);
  });
  return { host, onRemove, cleanup: () => { act(() => root.unmount()); host.remove(); } };
}

describe('OverlayLane remove', () => {
  it('has a remove (×) button on every overlay block', () => {
    const { host, cleanup } = setup();
    const buttons = host.querySelectorAll('.overlay-lane__remove');
    expect(buttons.length).toBe(2);
    expect(buttons[0].getAttribute('title')).toBe('Remove overlay');
    cleanup();
  });

  it('clicking × removes that overlay (and only that one)', () => {
    const { host, onRemove, cleanup } = setup();
    const second = host.querySelectorAll('.overlay-lane__remove')[1] as HTMLButtonElement;
    act(() => { second.click(); });
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('b');
    cleanup();
  });

  it('Delete and Backspace remove the focused overlay', () => {
    const { host, onRemove, cleanup } = setup();
    const first = host.querySelector('.overlay-lane__item') as HTMLElement;
    act(() => { first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); });
    act(() => { first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })); });
    expect(onRemove).toHaveBeenCalledTimes(2);
    expect(onRemove).toHaveBeenCalledWith('a');
    cleanup();
  });
});
