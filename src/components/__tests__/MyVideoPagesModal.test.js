// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../LandingPagesStudio.js', () => ({ LandingPagesStudio: vi.fn(({ embedded } = {}) => { const d = document.createElement('div'); d.dataset.studio = embedded ? 'embedded' : 'page'; return d; }) }));
import { openMyVideoPages } from '../modals/MyVideoPagesModal.js';
import { RETIRED_ROUTES } from '../../lib/router.js';

beforeEach(() => { document.body.innerHTML = ''; document.body.style.overflow = ''; });

describe('My Video Pages is a modal, not a studio page', () => {
  it('opens as a dialog with the saved-pages list inside, once', () => {
    const o = openMyVideoPages();
    expect(o.querySelector('[role="dialog"]')).toBeTruthy();
    expect(o.querySelector('[data-studio="embedded"]')).toBeTruthy();
    expect(openMyVideoPages()).toBe(o);
    expect(document.querySelectorAll('[data-my-video-pages]').length).toBe(1);
  });
  it('closes with the close button and gives the page its scroll back', () => {
    openMyVideoPages();
    document.querySelector('[aria-label="Close"]').click();
    expect(document.querySelector('[data-my-video-pages]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
  it('the old #/video-pages link lands in the Library', () => {
    expect(RETIRED_ROUTES['video-pages']).toBe('library');
  });
});

describe('stacking with the picker', () => {
  it('Escape closes the window on top: this one when it is above the picker, not when under it', () => {
    const picker = document.createElement('div'); picker.dataset.landingPicker = ''; picker.style.zIndex = '2000'; document.body.appendChild(picker);
    openMyVideoPages({ zIndex: 2100 });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('[data-my-video-pages]')).toBeNull();
    openMyVideoPages({ zIndex: 1000 });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('[data-my-video-pages]')).not.toBeNull();
  });
  it('closing it leaves the page scroll locked while the picker is open', () => {
    const picker = document.createElement('div'); picker.dataset.landingPicker = ''; document.body.appendChild(picker);
    document.body.style.overflow = 'hidden';
    openMyVideoPages({ zIndex: 2100 });
    document.querySelector('[aria-label="Close"]').click();
    expect(document.body.style.overflow).toBe('hidden');
  });
});
