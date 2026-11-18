// Regression: a Play pressed before the Remotion Player ref is bound used to be silently lost.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let refCb = null;
vi.mock('react-dom/client', () => ({
  createRoot: () => ({ render: (el) => { refCb = el.ref; }, unmount: vi.fn() }),
}));
vi.mock('@remotion/player', () => ({ Player: () => null }));
vi.mock('../TimelineComposition.jsx', () => ({ TimelineComposition: () => null, registerGoogleFonts: async () => {} }));
vi.mock('../effects.js', () => ({ loadEffects: async () => {}, effectIdsInModel: () => [] }));

const { createPreviewEngine } = await import('../previewEngine.jsx');
const model = { durationInFrames: 300, fps: 30, width: 1280, height: 720, layers: [] };
const fakePlayer = () => ({ play: vi.fn(), pause: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), isPlaying: () => false, getCurrentFrame: () => 0, seekTo: vi.fn() });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('previewEngine pending play', () => {
  beforeEach(() => { refCb = null; });

  it('queues play() before bind, marks the host pending, and starts exactly once on bind', async () => {
    const host = document.createElement('div');
    const onReady = vi.fn();
    const e = createPreviewEngine(host, { model, onReady });
    await flush();
    e.play(); e.play(); // a double press must not double-fire
    expect(host.hasAttribute('data-play-pending')).toBe(true);
    expect(e.playPending).toBe(true);
    const p = fakePlayer();
    refCb(p);
    expect(p.play).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalled();
    expect(host.hasAttribute('data-play-pending')).toBe(false);
    refCb(p); // re-bind of the same ref (React re-render) does not replay
    refCb(fakePlayer()); // a new ref after the queue was consumed does not auto-play either
    expect(p.play).toHaveBeenCalledTimes(1);
  });

  it('pause() before bind cancels the queued play', async () => {
    const host = document.createElement('div');
    const e = createPreviewEngine(host, { model });
    await flush();
    e.play(); e.pause();
    const p = fakePlayer();
    refCb(p);
    expect(p.play).not.toHaveBeenCalled();
    expect(host.hasAttribute('data-play-pending')).toBe(false);
  });

  it('destroy() clears the pending state; play() after bind goes straight to the player', async () => {
    const host = document.createElement('div');
    const e = createPreviewEngine(host, { model });
    await flush();
    e.play(); e.destroy();
    expect(host.hasAttribute('data-play-pending')).toBe(false);
    const h2 = document.createElement('div');
    const e2 = createPreviewEngine(h2, { model });
    await flush();
    const p = fakePlayer(); refCb(p);
    e2.play();
    expect(p.play).toHaveBeenCalledTimes(1);
    expect(h2.hasAttribute('data-play-pending')).toBe(false);
  });
});
