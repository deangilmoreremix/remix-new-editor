// @vitest-environment jsdom
// The hero's headline animation runs on timers. On smartvid.app they fired after a signed-in visitor
// had been sent on from the landing page, found no headline in the page and threw
// "Cannot read properties of null (reading 'style')" five times (one per headline part).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../common/landingVideo.js', () => ({ mountLandingVideos: () => {}, videoSlot: () => '' }));

const { HeroSection } = await import('../sections/HeroSection.jsx');

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('landing hero', () => {
  test('its timers do nothing (and do not throw) when the hero has left the page', () => {
    const errors = [];
    const onError = (e) => { errors.push(e); e.preventDefault?.(); };
    window.addEventListener('error', onError);
    HeroSection(); // built but never attached, like a hero the visitor already navigated away from
    expect(() => vi.runAllTimers()).not.toThrow();
    window.removeEventListener('error', onError);
    expect(errors).toEqual([]);
  });

  test('the headline still animates in when the hero is on the page', () => {
    const section = HeroSection();
    document.body.appendChild(section);
    vi.runAllTimers();
    const parts = [1, 2, 3, 4, 5].map((n) => section.querySelector(`#headline-part-${n}`)).filter(Boolean);
    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts) expect(part.style.opacity).toBe('1');
  });
});
