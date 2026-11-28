// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { mountMonitor, openMonitorWindow, monitorSupported } from '../monitorWindow.js';

const $ = (s) => document.querySelector(s);
const handlers = () => ({ onStop: vi.fn(), onPause: vi.fn(), onResume: vi.fn() });

describe('floating recording monitor', () => {
  it('shows the time, the level and the state', () => {
    document.body.innerHTML = '';
    const m = mountMonitor(document, handlers());
    m.update({ seconds: 83, level: 0.5 });
    expect($('[data-monitor-time]').textContent).toBe('1:23');
    expect($('[data-monitor-level]').style.width).toBe('50%');
    expect($('[data-monitor-state]').textContent).toBe('Recording');
    expect($('[data-monitor-hint]').textContent).toBe('');
  });
  it('warns when the sound distorts and shows paused', () => {
    document.body.innerHTML = '';
    const m = mountMonitor(document, handlers());
    m.update({ seconds: 5, level: 1, clipped: true, paused: true });
    expect($('[data-monitor-hint]').textContent).toMatch(/Too loud/);
    expect($('[data-monitor-state]').textContent).toBe('Paused');
    expect($('[data-monitor-pause]').textContent).toBe('Resume');
  });
  it('clamps bad numbers', () => {
    document.body.innerHTML = '';
    const m = mountMonitor(document, handlers());
    m.update({ seconds: -4, level: 9 });
    expect($('[data-monitor-time]').textContent).toBe('0:00');
    expect($('[data-monitor-level]').style.width).toBe('100%');
    m.update({ seconds: 'x', level: 'y' });
    expect($('[data-monitor-time]').textContent).toBe('0:00');
    expect($('[data-monitor-level]').style.width).toBe('0%');
  });
  it('Stop stops; Pause pauses, then the same button resumes', () => {
    document.body.innerHTML = '';
    const h = handlers();
    const m = mountMonitor(document, h);
    m.update({ seconds: 1, level: 0 });
    $('[data-monitor-pause]').click();
    expect(h.onPause).toHaveBeenCalledTimes(1);
    m.update({ seconds: 2, level: 0, paused: true });
    $('[data-monitor-pause]').click();
    expect(h.onResume).toHaveBeenCalledTimes(1);
    $('[data-monitor-stop]').click();
    expect(h.onStop).toHaveBeenCalledTimes(1);
  });
  it('is labelled for screen readers and escapes nothing it was not given (no markup from outside)', () => {
    document.body.innerHTML = '';
    mountMonitor(document, handlers());
    expect($('[data-recording-monitor]').getAttribute('aria-label')).toBe('Recording controls');
    expect($('[data-monitor-state]').getAttribute('role')).toBe('status');
    expect(document.body.innerHTML).not.toMatch(/<script/i);
  });
});

describe('opening the window', () => {
  it('is supported only with Document Picture-in-Picture', () => {
    expect(monitorSupported({})).toBe(false);
    expect(monitorSupported({ documentPictureInPicture: { requestWindow() {} } })).toBe(true);
    expect(monitorSupported(undefined)).toBe(false);
  });
  it('opens a window and mounts the monitor in it', async () => {
    const doc = document.implementation.createHTMLDocument('x');
    const requestWindow = vi.fn(async () => ({ document: doc }));
    const r = await openMonitorWindow(handlers(), { win: { documentPictureInPicture: { requestWindow } } });
    expect(requestWindow).toHaveBeenCalledWith({ width: 300, height: 170 });
    expect(doc.title).toBe('Recording');
    expect(doc.querySelector('[data-recording-monitor]')).not.toBeNull();
    r.monitor.update({ seconds: 3, level: 0.2 });
    expect(doc.querySelector('[data-monitor-time]').textContent).toBe('0:03');
  });
  it('returns null when the browser refuses or does not support it', async () => {
    expect(await openMonitorWindow(handlers(), { win: {} })).toBeNull();
    expect(await openMonitorWindow(handlers(), { win: { documentPictureInPicture: { requestWindow: async () => { throw new Error('no gesture'); } } } })).toBeNull();
  });
});
