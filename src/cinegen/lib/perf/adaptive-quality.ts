// [remix] Stage 4: adaptive preview quality. Watches frame pacing during playback and says when the preview should move to proxies
// (the PlaybackEngine's proxy mode: 'off' = original, 'auto', 'on' = proxy). Pure policy; the UI feeds it requestAnimationFrame deltas.
export type PreviewAdvice = 'ok' | 'use-proxy' | 'back-to-original';

export class PreviewQualityMonitor {
  private slow = 0;
  private fast = 0;
  private frames = 0;
  /** @param targetMs the frame budget (33.3 for 30 fps); a frame slower than 1.5x of it counts as dropped */
  constructor(private targetMs = 1000 / 30, private windowFrames = 90, private dropFraction = 0.25) {}

  record(deltaMs: number): void {
    if (!(deltaMs > 0) || deltaMs > 1000) return; // a pause / tab switch is not a drop
    this.frames++;
    if (deltaMs > this.targetMs * 1.5) this.slow++;
    if (deltaMs <= this.targetMs * 1.1) this.fast++;
  }

  /** Advice for the last full window; resets the window. Null until enough frames. */
  advise(currentlyProxy: boolean): PreviewAdvice | null {
    if (this.frames < this.windowFrames) return null;
    const dropped = this.slow / this.frames; const smooth = this.fast / this.frames;
    this.slow = this.fast = this.frames = 0;
    if (!currentlyProxy && dropped >= this.dropFraction) return 'use-proxy';
    if (currentlyProxy && smooth >= 0.98) return 'back-to-original';
    return 'ok';
  }
}
