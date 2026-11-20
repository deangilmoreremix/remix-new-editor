import { describe, expect, it } from 'vitest';
import { frameSourceFromVideo } from '../frameSource';

/** A video stand-in whose seeks finish later (in a microtask), like a real decoder, and which records every draw. */
function fakeVideo() {
  const listeners: Record<string, Array<() => void>> = {};
  const video = {
    duration: 10,
    videoWidth: 640,
    videoHeight: 360,
    readyState: 4,
    _t: 0,
    get currentTime() { return this._t; },
    set currentTime(v: number) { this._t = v; setTimeout(() => (listeners.seeked ?? []).slice().forEach((f) => f()), 0); },
    addEventListener(name: string, fn: () => void) { (listeners[name] ??= []).push(fn); },
    removeEventListener(name: string, fn: () => void) { listeners[name] = (listeners[name] ?? []).filter((f) => f !== fn); },
    removeAttribute() {},
    load() {},
  };
  return video as unknown as HTMLVideoElement & { _t: number };
}

describe('shared decoder draws', () => {
  it('overlapping draws each paint their own frame, in order', async () => {
    const video = fakeVideo();
    const painted: number[] = [];
    const ctx = { drawImage: (v: { _t: number }) => { painted.push(v._t); } } as unknown as CanvasRenderingContext2D;
    const source = frameSourceFromVideo(video);
    await Promise.all([source.draw(ctx, 1, 0, 0, 10, 10), source.draw(ctx, 2, 0, 0, 10, 10), source.draw(ctx, 3, 0, 0, 10, 10)]);
    expect(painted).toEqual([1, 2, 3]);
  });

  it('a draw that fails does not block the ones queued behind it', async () => {
    const video = fakeVideo();
    const painted: number[] = [];
    let first = true;
    const ctx = { drawImage: (v: { _t: number }) => { if (first) { first = false; throw new Error('boom'); } painted.push(v._t); } } as unknown as CanvasRenderingContext2D;
    const source = frameSourceFromVideo(video);
    const a = source.draw(ctx, 1, 0, 0, 1, 1);
    const b = source.draw(ctx, 2, 0, 0, 1, 1);
    await expect(a).rejects.toThrow('boom');
    await b;
    expect(painted).toEqual([2]);
  });
});
