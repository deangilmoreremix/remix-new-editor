// A hovered card must keep its picture until a live render really exists: when the live pool (20) is full it used to go blank.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { CardPreview } from '../components/edit/preview-types';

vi.mock('../components/edit/overlay-layer', () => ({ OverlayLayer: () => null }));
import { PreviewCard } from '../components/edit/preview-card';

const noImage: CardPreview = { kind: 'overlay', build: () => [], duration: 1 };
const withImage: CardPreview = { kind: 'overlay', build: () => [], duration: 1, image: '/x/thumb.jpg' };

describe('PreviewCard live pool', () => {
  it('keeps the picture while the pool is full, and swaps to the live render once a slot frees up', async () => {
    const pool = Array.from({ length: 20 }, (_, i) => render(<PreviewCard key={i} preview={noImage} title={`pool ${i}`} onClick={() => undefined} />));
    await waitFor(() => expect(document.querySelectorAll('[data-live="true"]').length).toBe(20));

    render(<PreviewCard preview={withImage} title="hovered" onClick={() => undefined} testId="hovered" />);
    const wrap = screen.getByTestId('hovered').closest('.add-card-wrap')!;
    fireEvent.mouseEnter(wrap);
    await new Promise((r) => setTimeout(r, 400)); // past the 250 ms hover delay: the card now wants a live render but has no slot
    expect(wrap.querySelector('img')).not.toBeNull();
    expect(wrap.querySelector('[data-live="true"]')).toBeNull();

    pool[0].unmount(); // a slot frees up
    await waitFor(() => expect(wrap.querySelector('[data-live="true"]')).not.toBeNull(), { timeout: 3000 });
    expect(wrap.querySelector('img')).toBeNull();
    cleanup();
  });

  it('every card has a + button named "Add to the timeline" that runs the same action as the card', () => {
    const onClick = vi.fn();
    render(<PreviewCard preview={withImage} title="Lower Third" onClick={onClick} testId="c" />);
    fireEvent.click(screen.getByTestId('c-add'));
    fireEvent.click(screen.getByTestId('c'));
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('c-add').getAttribute('aria-label')).toContain('Add to the timeline');
    cleanup();
  });
});
