// The add-on renderers (Lottie, GL, media) of a thumbnail must be released when its layer unmounts, not only when it rebuilds.
import { describe, it, expect, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const destroy = vi.hoisted(() => vi.fn());
vi.mock('../../lib/editor/addons/overlayRender.js', () => ({
  buildOverlayElement: () => document.createElement('div'),
  finishOverlayElement: async () => undefined,
  destroyOverlayElement: destroy,
  syncOverlayTime: () => undefined,
  setOverlayPlaying: () => undefined,
}));

import { OverlayLayer } from '../components/edit/overlay-layer';
import { createOverlay } from '../lib/overlays/overlays';

describe('OverlayLayer unmount', () => {
  it('destroys the add-on elements it built', () => {
    destroy.mockClear();
    const o = createOverlay('overlay-text', 0, 6);
    const { unmount } = render(<OverlayLayer overlays={[o]} currentTime={1} isPlaying={false} onPause={() => undefined} />);
    expect(destroy).not.toHaveBeenCalled();
    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
