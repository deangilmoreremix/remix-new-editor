// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const renderer = vi.hoisted(() => ({
  signals: [] as AbortSignal[],
  createDownloadUrl: vi.fn(() => 'blob:test'),
}));

vi.mock('../webRenderer', () => ({
  canRenderVideo: vi.fn(async () => ({ canRender: true, issues: [], videoCodec: 'h264', audioCodec: 'aac' })),
  renderVideoOnWeb: vi.fn(async (opts: { signal: AbortSignal }) => {
    renderer.signals.push(opts.signal);
    await new Promise((r) => setTimeout(r, 20));
    return { blob: new Blob(['mp4'], { type: 'video/mp4' }) };
  }),
  createDownloadUrl: renderer.createDownloadUrl,
  formatEta: () => '',
  guardTabWhileRendering: () => () => {},
}));

import ExportButton, { requestExport } from '../ExportButton';

const settle = (ms = 80) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
beforeEach(() => {
  renderer.signals.length = 0;
  renderer.createDownloadUrl.mockClear();
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('ExportButton "Export again"', () => {
  it('does not abort the next export when the previous download URL is cleaned up', async () => {
    await act(async () => { root.render(<ExportButton />); });

    await act(async () => { requestExport(); });
    await settle();
    expect(renderer.signals).toHaveLength(1);
    expect(renderer.signals[0].aborted).toBe(false);

    await act(async () => { requestExport(); });
    await settle();
    expect(renderer.signals).toHaveLength(2);
    expect(renderer.signals[1].aborted).toBe(false);
  });

  it('creates one download URL per rendered file, not one per render', async () => {
    await act(async () => { root.render(<ExportButton />); });
    await act(async () => { requestExport(); });
    await settle(120);
    expect(renderer.createDownloadUrl).toHaveBeenCalledTimes(1);
  });
});
