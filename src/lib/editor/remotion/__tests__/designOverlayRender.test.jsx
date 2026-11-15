// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('remotion', async () => {
  const actual = await vi.importActual('remotion');
  return {
    ...actual,
    AbsoluteFill: ({ children }) => <div data-fill>{children}</div>,
    Sequence: ({ children }) => <>{children}</>,
    useCurrentFrame: () => 10,
    useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 300 }),
    delayRender: () => 1,
    continueRender: () => {},
  };
});
vi.mock('@remotion/media', () => ({ Video: () => null, Audio: () => null }));
vi.mock('@remotion/lottie', () => ({ Lottie: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));

const received = [];
vi.mock('../../../../features/personalization/shared/personalization/preview/DesignOverlay', () => ({
  DesignOverlay: (props) => { received.push(props); return <div data-testid="design-overlay">{props.designId}</div>; },
}));

import { TimelineComposition } from '../TimelineComposition.jsx';
import { loadDesigns } from '../designOverlays.js';
import { timelineToComposition } from '../timelineToComposition.js';
import '../../addons/index.js';

const model = (profile) => timelineToComposition({
  timelineSeconds: 10,
  tracks: [{ id: 't', name: 'Titles', type: 'text', items: [{ id: 'd1', type: 'overlay-design', start: 0, end: 10, addon: { designId: 'animated-headline', text: 'Hi', geometry: { left: 10, top: 20, width: 50, height: 25 }, opacity: 100 } }] }],
}, { profile });

let root; let container;
beforeEach(() => { received.length = 0; container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('TimelineComposition draws design overlays', () => {
  it('draws nothing until the design renderer has loaded, then the design in its box', async () => {
    const m = model({ id: 'c', name: 'Ann', personalization: { business: { businessName: 'Acme' } } });
    act(() => { root.render(<TimelineComposition model={m} />); });
    // (not loaded yet in this module instance, or loaded by another test: either way nothing throws)
    await act(async () => { await loadDesigns(['animated-headline']); });
    act(() => { root.render(<TimelineComposition model={m} />); });
    expect(container.querySelector('[data-testid="design-overlay"]')?.textContent).toBe('animated-headline');
    const p = received.at(-1);
    expect(p).toMatchObject({ designId: 'animated-headline', text: 'Hi', width: 1920, height: 1080 });
    expect(p.boxWidthPx).toBeCloseTo(960, 0);   // 50% of 1920
    expect(p.boxHeightPx).toBeCloseTo(270, 0);  // 25% of 1080
    expect(p.brand.businessName).toBe('Acme');
  });
  it('places the design in the overlay box from its geometry', async () => {
    await act(async () => { await loadDesigns(['animated-headline']); });
    act(() => { root.render(<TimelineComposition model={model(null)} />); });
    const box = container.querySelector('[data-testid="design-overlay"]').parentElement;
    expect(box.style.left).toBe('10%');
    expect(box.style.top).toBe('20%');
    expect(box.style.width).toBe('50%');
  });
});
