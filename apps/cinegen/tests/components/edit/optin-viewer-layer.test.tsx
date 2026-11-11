import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { OptinViewerLayer } from '@/components/edit/optin-viewer-layer';
import { newOverlay } from '@/lib/optin/overlay-kinds';
import type { OverlayClip } from '@/types/timeline';

function setup(overlays: OverlayClip[], extra: Partial<React.ComponentProps<typeof OptinViewerLayer>> = {}) {
  const pause = vi.fn();
  const play = vi.fn();
  const onLead = vi.fn();
  const props = { overlays, currentTime: 0, isPlaying: false, selectedId: null, pause, play, onLead, ...extra };
  const view = render(<OptinViewerLayer {...props} />);
  const rerender = (next: Partial<typeof props>) => view.rerender(<OptinViewerLayer {...props} {...next} />);
  const q = (sel: string) => view.container.querySelector(sel) as HTMLElement | null;
  return { pause, play, onLead, rerender, q };
}

async function submit(q: (s: string) => HTMLElement | null, email?: string) {
  const form = q('[data-overlay="optin"] form') as HTMLFormElement;
  if (email) (form.querySelector('input') as HTMLInputElement).value = email;
  await act(async () => {
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('OptinViewerLayer', () => {
  it('List Builder: holds playback at 0s behind an opaque wall until the form is submitted', async () => {
    const lb = newOverlay('list-builder', 0);
    const { pause, play, onLead, rerender, q } = setup([lb]);
    expect(q('[data-overlay="optin"]')).toBeNull();

    rerender({ isPlaying: true, currentTime: 0 });
    expect(pause).toHaveBeenCalledTimes(1);
    const wall = q('[data-overlay="optin"]') as HTMLElement;
    expect(wall.style.background).toMatch(/^rgb\(62, 62, 81\)$/); // fully opaque: hides the video

    // required field: empty submit is refused, nothing resumes
    await submit(q);
    expect(play).not.toHaveBeenCalled();
    expect(q('[data-overlay="optin"]')).not.toBeNull();

    await submit(q, 'viewer@example.com');
    expect(onLead).toHaveBeenCalledWith(expect.objectContaining({ id: lb.id }), { EMAIL: 'viewer@example.com' });
    expect(play).toHaveBeenCalledTimes(1);
    expect(q('[data-overlay="optin"]')).toBeNull();

    // once through, it doesn't gate again while playing on
    rerender({ isPlaying: true, currentTime: 0.1 });
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('Lead Generator: pauses when the playhead reaches it, anywhere in the video', async () => {
    const lg = { ...newOverlay('lead-generator', 4), start: 4, end: 10 };
    const { pause, play, rerender, q } = setup([lg]);
    rerender({ isPlaying: true, currentTime: 2 });
    expect(pause).not.toHaveBeenCalled();
    rerender({ isPlaying: true, currentTime: 4.1 });
    expect(pause).toHaveBeenCalledTimes(1);
    expect(q('[data-overlay="optin"]')).not.toBeNull();
    await submit(q, 'a@b.co');
    expect(play).toHaveBeenCalledTimes(1);
    rerender({ isPlaying: true, currentTime: 5 });
    expect(pause).toHaveBeenCalledTimes(1); // never again
  });

  it('scrubbing back re-arms the forms that are now ahead of the playhead', async () => {
    const lg = { ...newOverlay('lead-generator', 4), start: 4, end: 10 };
    const { pause, rerender, q } = setup([lg]);
    rerender({ isPlaying: true, currentTime: 4.1 });
    await submit(q, 'a@b.co');
    rerender({ isPlaying: false, currentTime: 0 }); // rewind
    rerender({ isPlaying: true, currentTime: 4.2 });
    expect(pause).toHaveBeenCalledTimes(2);
  });

  it('previews the selected overlay (see-through) while stopped, so it can be designed', () => {
    const lb = newOverlay('list-builder', 0);
    const { pause, q, rerender } = setup([lb], { selectedId: lb.id });
    const preview = q('[data-overlay="optin"]') as HTMLElement;
    expect(preview).not.toBeNull();
    expect(preview.style.background).toMatch(/0\.67/);
    expect(pause).not.toHaveBeenCalled();
    rerender({ selectedId: null });
    expect(q('[data-overlay="optin"]')).toBeNull();
  });

  it('shows the pointer on a List Builder, not on a Lead Generator, and honors design edits', () => {
    const lb = newOverlay('list-builder', 0);
    lb.options = { ...lb.options, pointerStyle: 'cursor', pointerColor: '#22d3ee', buttonBackground: '#16a34a' };
    const a = setup([lb], { selectedId: lb.id });
    expect(a.q('.overlay-arrow')?.getAttribute('data-pointer')).toBe('cursor');
    expect((a.q('.buttons-inner button') as HTMLElement).style.background).toContain('rgb(22, 163, 74)');
    const lg = newOverlay('lead-generator', 0);
    const b = setup([lg], { selectedId: lg.id });
    expect(b.q('[data-overlay="optin"]')).not.toBeNull();
    expect(b.q('.overlay-arrow')).toBeNull();
  });
});
