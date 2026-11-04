import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createResultHistory, createResultActions, createFrameScrubber, buildExtendParams, canExtend, EXTEND_MODEL_ID,
} from '../../src/lib/templateResultTools.js';

const flush = () => new Promise(r => setTimeout(r, 0));

describe('Extend (Video Studio parity)', () => {
  it('only Seedance 2.0 video results with a request id can be extended', () => {
    expect(canExtend({ id: 'r1', model: 'seedance-v2.0-t2v', type: 'video' })).toBe(true);
    expect(canExtend({ id: 'r1', model: 'seedance-v2.0-i2v', type: 'video' })).toBe(true);
    expect(canExtend({ id: 'r1', model: 'kling-v2.6-pro-i2v', type: 'video' })).toBe(false);
    expect(canExtend({ id: null, model: 'seedance-v2.0-t2v', type: 'video' })).toBe(false);
  });

  it('builds seedance-v2.0-extend params with the original request id', () => {
    expect(buildExtendParams({ id: 'req-9' }, { prompt: ' keep walking ', duration: 10 }))
      .toEqual({ model: EXTEND_MODEL_ID, request_id: 'req-9', duration: 10, prompt: 'keep walking' });
    expect(buildExtendParams({ id: 'req-9' }, {})).toEqual({ model: EXTEND_MODEL_ID, request_id: 'req-9', duration: 5 });
  });
});

describe('createResultActions', () => {
  it('Regenerate calls back; Extend shows only for extendable results and runs with the form values', async () => {
    const onRegenerate = vi.fn();
    const onExtend = vi.fn(async () => {});
    const a = createResultActions({ onRegenerate, onExtend });
    const extendBtn = a.element.querySelector('[data-action="extend"]');
    a.setEntry({ id: 'x', model: 'kling-v2.6-pro-i2v', type: 'video' });
    expect(extendBtn.classList.contains('hidden')).toBe(true);
    a.setEntry({ id: 'req-1', model: 'seedance-v2.0-t2v', type: 'video' });
    expect(extendBtn.classList.contains('hidden')).toBe(false);

    a.element.querySelector('[data-action="regenerate"]').click();
    expect(onRegenerate).toHaveBeenCalled();

    extendBtn.click();
    a.element.querySelector('[name="extend-prompt"]').value = 'camera pulls back';
    a.element.querySelector('[name="extend-duration"]').value = '15';
    a.element.querySelector('[data-action="extend-run"]').click();
    await flush();
    expect(onExtend).toHaveBeenCalledWith(expect.objectContaining({ id: 'req-1' }), { prompt: 'camera pulls back', duration: 15 });
  });
});

describe('createResultHistory', () => {
  beforeEach(() => localStorage.clear());

  it('adds, persists, selects and deletes entries', async () => {
    const onSelect = vi.fn();
    const h = createResultHistory({ storageKey: 'test_history', onSelect });
    expect(h.element.classList.contains('hidden')).toBe(true);
    h.add({ id: 'a', url: 'https://cdn/a.mp4', type: 'video' });
    h.add({ id: 'b', url: 'https://cdn/b.png', type: 'image' });
    expect(h.entries().map(e => e.id)).toEqual(['b', 'a']);
    expect(JSON.parse(localStorage.getItem('test_history')).length).toBe(2);
    // Reload keeps the strip.
    const again = createResultHistory({ storageKey: 'test_history', onSelect });
    expect(again.entries().length).toBe(2);

    h.element.querySelector('[data-history-url="https://cdn/a.mp4"]').click();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    h.element.querySelector('[data-history-url="https://cdn/b.png"] [data-action="delete"]').click();
    for (let i = 0; i < 20 && h.entries().length > 1; i++) await new Promise(r => setTimeout(r, 25));
    expect(h.entries().map(e => e.id)).toEqual(['a']);
  });
});

describe('createFrameScrubber', () => {
  it('seeks the video', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'duration', { value: 10, configurable: true });
    const row = createFrameScrubber(video);
    const input = row.querySelector('input');
    input.value = '50';
    input.dispatchEvent(new Event('input'));
    expect(video.currentTime).toBe(5);
    expect(row.querySelector('[data-time]').textContent).toBe('0:05');
  });
});
