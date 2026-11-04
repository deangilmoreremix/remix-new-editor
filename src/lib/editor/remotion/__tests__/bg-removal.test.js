import { describe, it, expect, vi } from 'vitest';
import { applyAlpha } from '../bgRemoval.js';
import { renderBgRemovalPanel } from '../bgRemovalPanel.js';
import { inlineLocalMedia } from '../exportClient.js';

describe('background removal', () => {
  it('writes the matte into the alpha channel, optionally hardening edges', () => {
    const img = { width: 3, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255, 1, 2, 3, 255, 1, 2, 3, 100]) };
    applyAlpha(img, new Uint8Array([0, 128, 255]));
    expect([img.data[3], img.data[7], img.data[11]]).toEqual([0, 128, 100]); // never more opaque than the source
    const hard = { width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255]) };
    applyAlpha(hard, new Uint8Array([30, 230]), { edge: 0.5 });
    expect([hard.data[3], hard.data[7]]).toEqual([0, 255]);
  });

  it('panel starts a job, shows progress and survives being re-opened', async () => {
    let resolve;
    const listeners = new Set();
    const job = { last: null, cancel: vi.fn(), subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, done: new Promise((r) => { resolve = r; }) };
    const start = vi.fn(() => job);
    const box = document.createElement('div');
    const panel = renderBgRemovalPanel(box, { kind: 'video', gpu: false, start });
    expect(box.querySelector('[data-bg-fast]').value).toBe('1'); // CPU → faster mode by default
    box.querySelector('[data-bg-run]').click();
    expect(start).toHaveBeenCalledWith({ maskEvery: 2, edge: 0, maxSize: 1280 });
    listeners.forEach((fn) => fn({ stage: 'process', progress: 0.5, frame: 5, frames: 10, etaSec: 20 }));
    expect(box.querySelector('[data-bg-status]').textContent).toBe('Processing frame 5 of 10 · about 20 s left');
    panel.destroy();
    expect(job.cancel).not.toHaveBeenCalled(); // closing the panel doesn't stop the job
    const again = document.createElement('div');
    renderBgRemovalPanel(again, { kind: 'video', gpu: false, start, job });
    again.querySelector('[data-bg-cancel]').click();
    expect(job.cancel).toHaveBeenCalled();
    resolve();
  });

  it('shows restore once removed', () => {
    const onRestore = vi.fn();
    const box = document.createElement('div');
    renderBgRemovalPanel(box, { kind: 'image', removed: true, onRestore });
    box.querySelector('[data-bg-restore]').click();
    expect(onRestore).toHaveBeenCalled();
  });

  it('sends local blob: media to the export runner as Blobs', async () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    const url = 'blob:http://localhost/abc';
    const orig = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({ blob: async () => blob }));
    try {
      const out = await inlineLocalMedia({ layers: [{ src: url }, { src: 'https://x/y.mp4', options: { resolvedSrc: url } }] });
      expect(out.layers[0].src).toBe(blob);
      expect(out.layers[1].src).toBe('https://x/y.mp4');
      expect(out.layers[1].options.resolvedSrc).toBe(blob);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
