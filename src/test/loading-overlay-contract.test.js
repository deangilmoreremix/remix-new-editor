// Contract test for createLoadingOverlay — regression guard for the
// VideoStudio generate crash (R3): the helper must return the overlay DOM
// element itself (callers do container.appendChild(overlay) and
// loadingOverlay.appendChild(progressBar)), not a { show, hide, element }
// wrapper with no DOM methods.
import { describe, test, expect, vi } from 'vitest';
import { createLoadingOverlay, createProgressBar } from '../lib/loading.js';

describe('createLoadingOverlay contract', () => {
  test('returns the overlay element itself, not a wrapper object', () => {
    const overlay = createLoadingOverlay('Generating video...');
    expect(overlay).toBeInstanceOf(HTMLDivElement);
    expect(typeof overlay.appendChild).toBe('function');
    expect(typeof overlay.remove).toBe('function');
    expect(typeof overlay.show).toBe('function');
    expect(typeof overlay.hide).toBe('function');
  });

  test('supports the exact VideoStudio generate call sequence (appendChild + remove)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const overlay = createLoadingOverlay('Generating video...');
    const progressBar = createProgressBar(0);
    overlay.appendChild(progressBar);
    container.appendChild(overlay);
    expect(overlay.parentNode).toBe(container);
    expect(overlay.querySelector('.progress-text')).toBeTruthy();
    overlay.remove();
    expect(overlay.parentNode).toBeNull();
    container.remove();
  });

  test('show() attaches to the body and hide() removes it after the fade timer', () => {
    vi.useFakeTimers();
    const overlay = createLoadingOverlay('Working...');
    overlay.show();
    expect(overlay.parentNode).toBe(document.body);
    overlay.hide();
    vi.advanceTimersByTime(400);
    expect(overlay.parentNode).toBeNull();
    vi.useRealTimers();
  });
});
