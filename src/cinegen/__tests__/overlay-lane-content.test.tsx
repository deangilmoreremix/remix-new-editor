// [remix] Every block on the Overlays lane says what it is, whatever its width: text for the List Builder (its words live in config.caption),
// an icon for overlays that draw nothing (Pause / Skip / Loop), a picture only when the block is wide enough to hold one.
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { OverlayLane } from '../components/edit/overlay-lane';
import type { OverlayClip } from '../types/workspace';

vi.mock('../components/edit/preview-card', async (orig) => ({ ...(await orig<typeof import('../components/edit/preview-card')>()), useInView: () => false }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PX = 50; // pixels per second: a 3s block is 150px, a 1s block 50px, a 5s block 250px
const ov = (o: Record<string, unknown>) => ({ id: String(o.type), name: String(o.name), start: 0, ...o }) as unknown as OverlayClip;

function render(overlays: OverlayClip[]) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(<OverlayLane overlays={overlays} pxPerSecond={PX} scrollLeft={0} labelWidth={150} sequenceDuration={20} onOpenAdd={() => {}} onUpdate={() => {}} onRemove={() => {}} />); });
  const card = (id: string) => host.querySelector(`[data-testid="overlay-card-${id}"]`) as HTMLElement;
  return { host, card, cleanup: () => { act(() => root.unmount()); host.remove(); } };
}

describe('OverlayLane block content', () => {
  it('shows the List Builder\'s own words, not just its time (its text is config.caption)', () => {
    const { card, cleanup } = render([ov({ type: 'list-builder', name: 'List Builder', end: 3, config: { caption: 'WANT TO PERSONALIZE YOUR VIDEO EXPERIENCE ' } })]);
    const c = card('list-builder');
    expect(c.querySelector('.overlay-card__name')?.textContent).toContain('List Builder');
    expect(c.querySelector('.overlay-card__meta')?.textContent).toBe('WANT TO PERSONALIZE YOUR VIDEO EXPERIENCE');
    expect(c.querySelector('.overlay-card__thumb')).toBeNull(); // 150px: text only, so the name is not squeezed to "🔒 .."
    cleanup();
  });

  it('gives a narrow Pause block an icon, so it is never an empty box', () => {
    const { card, cleanup } = render([ov({ type: 'addon-pause', name: 'Pause', end: 1 })]);
    const c = card('addon-pause');
    expect(c.querySelector('.overlay-card__thumb')?.textContent).toBe('⏸');
    expect(c.querySelector('.overlay-card__name')).toBeNull();
    cleanup();
  });

  it('shows an icon plus the name on a wide Skip block (it draws nothing to preview)', () => {
    const { card, cleanup } = render([ov({ type: 'addon-skip', name: 'Skip', end: 5 })]);
    const c = card('addon-skip');
    expect(c.querySelector('.overlay-card__thumb')?.textContent).toBe('⏭');
    expect(c.querySelector('.overlay-card__name')?.textContent).toBe('Skip');
    cleanup();
  });

  it('keeps the picture, the name and the words on a wide Lead Generator block', () => {
    const { card, cleanup } = render([ov({ type: 'lead-form', name: 'Lead Generator', end: 5, caption: 'Please enter your details to find out more' })]);
    const c = card('lead-form');
    expect(c.querySelector('.overlay-card__thumb')).not.toBeNull();
    expect(c.querySelector('.overlay-card__name')?.textContent).toBe('Lead Generator');
    expect(c.querySelector('.overlay-card__meta')?.textContent).toContain('Please enter your details');
    cleanup();
  });

  it('gives Text Mask, Wrapper and an Image with no picture an icon, and keeps a picked picture', () => {
    const { card, cleanup } = render([
      ov({ type: 'overlay-text-mask', name: 'Text Mask', end: 5 }),
      ov({ type: 'overlay-background', name: 'Wrapper', end: 5 }),
      ov({ type: 'overlay-image', name: 'Image', end: 5 }),
      ov({ type: 'overlay-image', name: 'Picked', id: 'picked', end: 5, addon: { src: '/x.png' } }),
    ]);
    expect(card('overlay-text-mask').querySelector('.overlay-card__thumb')?.textContent).toBe('🔠');
    expect(card('overlay-background').querySelector('.overlay-card__thumb')?.textContent).toBe('🟪');
    expect(card('overlay-image').querySelector('.overlay-card__thumb')?.textContent).toBe('🖼️');
    expect(card('picked').querySelector('img.overlay-card__thumb')).not.toBeNull();
    cleanup();
  });
});
