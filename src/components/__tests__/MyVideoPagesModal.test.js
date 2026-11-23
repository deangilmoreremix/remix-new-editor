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
