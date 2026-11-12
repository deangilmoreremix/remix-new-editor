// [remix] The List Builder is a registration wall: while the video plays it holds playback behind a solid backdrop until the
// form is submitted (then playback resumes). A Lead Generator pauses wherever it is placed.
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { OverlayLayer } from '@cinegen/components/edit/overlay-layer';
import { createOverlay } from '@cinegen/lib/overlays/overlays';
import type { OverlayClip } from '@cinegen/types/workspace';

function setup(overlays: OverlayClip[]) {
  const onPause = vi.fn();
  const onResume = vi.fn();
  const base = { overlays, onPause, onResume, currentTime: 0, isPlaying: false };
  const view = render(<OverlayLayer {...base} />);
  const rerender = (next: Partial<typeof base>) => view.rerender(<OverlayLayer {...base} {...next} />);
  const q = (sel: string) => view.container.querySelector(sel) as HTMLElement | null;
  return { onPause, onResume, rerender, q };
}
const submit = async (q: (s: string) => HTMLElement | null, email?: string) => {
  const form = q('[data-overlay] form') as HTMLFormElement;
  if (email) (form.querySelector('input') as HTMLInputElement).value = email;
  await act(async () => { form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); await new Promise((r) => setTimeout(r, 0)); });
};

describe('overlay gates in the Timeline Studio', () => {
  it('List Builder: see-through while editing, a solid wall while playing, resumes after submit', async () => {
    const lb = createOverlay('list-builder', 0, 30);
    const { onPause, onResume, rerender, q } = setup([lb]);
    // stopped: the form shows as a see-through preview so it can be designed
    rerender({ currentTime: 0.5 });
    expect(q('[data-overlay]')?.style.background).toMatch(/0\.67/);
    // playing from the start: pauses and becomes the opaque wall
    rerender({ currentTime: 0.5, isPlaying: true });
    expect(onPause).toHaveBeenCalledTimes(1);
    rerender({ currentTime: 0.5, isPlaying: false }); // the player paused itself
    expect(q('[data-overlay]')?.style.background).toMatch(/^rgb\(62, 62, 81\)$/); // still solid, not the preview
    // empty answers don't get through
    await submit(q);
    expect(onResume).not.toHaveBeenCalled();
    await submit(q, 'viewer@example.com');
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(q('[data-overlay]')).toBeNull();
  });

  it('shows the chosen pointer on the List Builder and not on the Lead Generator by default', () => {
    const lb = createOverlay('list-builder', 0, 30) as unknown as OverlayClip & { config: Record<string, unknown> };
    lb.config = { ...lb.config, pointerStyle: 'click-hand', pointerMotion: 'tap' };
    const a = setup([lb as OverlayClip]);
    a.rerender({ currentTime: 0.5 });
    expect(a.q('.overlay-arrow')?.getAttribute('data-pointer')).toBe('click-hand');
    const lead = { ...createOverlay('lead-form', 1, 30), start: 1, end: 6 };
    const b = setup([lead]);
    b.rerender({ currentTime: 2 });
    expect(b.q('[data-overlay]')).not.toBeNull();
    expect(b.q('.overlay-arrow')).toBeNull();
  });

  it('Lead Generator pauses the video wherever it is placed', () => {
    const lead = { ...createOverlay('lead-form', 4, 30), start: 4, end: 9 };
    const { onPause, rerender } = setup([lead]);
    rerender({ currentTime: 2, isPlaying: true });
    expect(onPause).not.toHaveBeenCalled();
    rerender({ currentTime: 4.2, isPlaying: true });
    expect(onPause).toHaveBeenCalledTimes(1);
  });
});
